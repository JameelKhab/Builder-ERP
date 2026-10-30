import { randomUUID, createHash } from 'node:crypto';
import { transaction } from './db.mjs';
import { policy } from './access.mjs';
import { ROLE_BY_ID } from '../shared/access.mjs';
import { D, decimal, money, sum, requireThat } from './money.mjs';
const uid = p => `${p}-${randomUUID().slice(0, 8).toUpperCase()}`,
  now = () => new Date().toISOString();
const txt = (v, n, max = 2000) => {
  requireThat(typeof v === 'string' && v.trim() && v.length <= max, `${n} is required (up to ${max} characters).`);
  return v.trim();
};
const day = v => {
  requireThat(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Enter a valid calendar date.');
  return v;
};
const amt = (v, n) => {
  const d = decimal(v, n);
  requireThat(d.cmp(money(v)) === 0, `${n} needs at most two decimals.`);
  return money(v);
};
const pretty = v => money(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const pct = (v, n) => {
  const d = decimal(v, n);
  requireThat(d.lte(100), `${n} cannot exceed 100%.`);
  return d.toString();
};
export const OFFER_STATES = {
  draft: 'Draft offer',
  submitted: 'Needs commercial review',
  returned: 'Changes requested',
  approved: 'Approved offer',
  withdrawn: 'Withdrawn',
  superseded: 'Superseded',
  awarded: 'Award recorded'
};
export function commercial(db, actorId, today = () => now().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (q, ...v) => db.prepare(q).get(...v),
    all = (q, ...v) => db.prepare(q).all(...v),
    run = (q, ...v) => db.prepare(q).run(...v);
  const insert = (t, d) => {
    const ks = Object.keys(d);
    run(`INSERT INTO ${t}(${ks.join(',')}) VALUES(${ks.map(() => '?').join(',')})`, ...ks.map(k => d[k]));
  };
  const can = (cap, r, who = actorId) => !!get('SELECT active FROM users WHERE id=?', who)?.active && policy(db, who).has(cap, r.company_id, r.project_id);
  const limit = (r, who = actorId, kind = 'commercial', cap = 'sales.approve') => policy(db, who).matching(r.company_id, r.project_id).filter(g => ROLE_BY_ID[g.role_id]?.capabilities.includes(cap)).reduce((n, g) => new D(g[kind + '_approval_limit'] || 0).gt(n) ? money(g[kind + '_approval_limit']) : n, '0.00');
  const allowed = (r, who = actorId) => can('sales.approve', r, who) && new D(limit(r, who)).gte(r.company_amount);
  const scope = (c, p) => {
    requireThat(get('SELECT id FROM companies WHERE id=?', c) && access.has('sales.read', c, p, !p), 'Commercial scope is unavailable.', 404);
    if (p) requireThat(get('SELECT id FROM projects WHERE id=? AND company_id=?', p, c), 'Project is unavailable.', 404);
  };
  const readable = r => r && (can('sales.read', r) || !!all('SELECT company_id,project_id FROM client_contracts WHERE offer_id=?', r.id).find(c => can('sales.read', c)));
  const row = id => {
    const r = get('SELECT * FROM sales_offers WHERE id=?', id);
    requireThat(readable(r), 'Offer is unavailable.', 404);
    return r;
  };
  const version = (r, v) => requireThat(Number.isSafeInteger(v) && r.version === v, 'This record changed. Reload before continuing.', 409);
  const lines = id => all('SELECT * FROM sales_offer_lines WHERE offer_id=? ORDER BY position', id).map(l => ({
    ...l,
    source: JSON.parse(l.source_snapshot)
  }));
  const editable = r => r.author_id === actorId && can('sales.write', r) && ['draft', 'returned'].includes(r.state);
  const pending = id => get("SELECT id FROM sales_acceptances WHERE offer_id=? AND state='submitted'", id);
  const sourceCurrent = r => {
    const e = get('SELECT * FROM estimate_versions WHERE id=?', r.estimate_id);
    requireThat(e?.state === 'approved' && get("SELECT id FROM estimate_versions WHERE study_id=? AND state<>'cancelled' ORDER BY revision DESC LIMIT 1", e.study_id)?.id === e.id, 'The source estimate is not the latest approved revision. Revise the offer from a reviewed estimate.', 409);
    const t = JSON.parse(e.calculation).totals,
      authority = new D(t.company_budget).gt(t.company_selling) ? t.company_budget : t.company_selling;
    requireThat(e.approved_by !== e.author_id && can('tenders.approve', e, e.approved_by) && new D(limit(e, e.approved_by, 'estimate', 'tenders.approve')).gte(authority), 'Source estimate approval authority changed. A newly approved estimate revision is required.', 409);
    const c = get('SELECT p.id,p.name,p.version identity_version,pc.version company_version,pc.reference,pc.active,pc.blocked,pc.customer FROM parties p JOIN party_companies pc ON pc.party_id=p.id WHERE p.id=? AND pc.company_id=?', r.customer_id, r.company_id);
    requireThat(c?.customer && c.active && !c.blocked && JSON.stringify(c) === r.customer_snapshot, 'Customer identity or company status changed. Refresh the estimate and revise the offer.', 409);
    requireThat(JSON.stringify(get('SELECT * FROM companies WHERE id=?', r.company_id)) === r.company_snapshot, 'Legal company information changed. Revise the offer before approval or award.', 409);
    return e;
  };
  const approvalCurrent = r => {
    sourceCurrent(r);
    requireThat(r.approved_by && r.approved_by !== r.author_id && allowed(r, r.approved_by), 'Commercial approver no longer has sufficient authority. Revise and reapprove the offer.', 409);
    requireThat(can('sales.write', r, r.author_id), 'Offer author no longer has commercial access.', 409);
  };
  const event = (r, action, reason, a = null) => insert('commercial_events', {
    offer_id: r.id,
    acceptance_id: a?.id || null,
    actor_id: actorId,
    action,
    reason: txt(reason, 'Reason'),
    snapshot: JSON.stringify({
      offer: r,
      acceptance: a ? {
        ...a,
        bytes: undefined
      } : null
    }),
    at: now()
  });
  const acceptance = id => {
    const a = get('SELECT * FROM sales_acceptances WHERE id=?', id);
    requireThat(a, 'Acceptance is unavailable.', 404);
    const r = row(a.offer_id);
    requireThat(can('sales.read', a), 'Acceptance is unavailable.', 404);
    return {
      a,
      r
    };
  };
  const mapLines = (r, p, mapping) => {
    requireThat(Array.isArray(mapping) && mapping.length === lines(r.id).length, 'Map every BOQ item once to the project work breakdown.');
    const seen = new Set();
    return lines(r.id).map(l => {
      const m = mapping.find(m => m.line_key === l.line_key);
      requireThat(m && !seen.has(m.line_key), 'Each BOQ item needs one unique work allocation.');
      seen.add(m.line_key);
      const w = get("SELECT * FROM work_packages WHERE id=? AND project_id=? AND company_id=? AND kind='item'", m.work_package_id, p, r.company_id);
      requireThat(w && w.cost_code_id === l.cost_code_id, 'Work item must belong to this project and use the BOQ cost code.');
      const loc = m.location_id ? get('SELECT * FROM project_locations WHERE id=? AND project_id=? AND company_id=?', m.location_id, p, r.company_id) : null;
      requireThat(!m.location_id || loc, 'Choose a location within this project.');
      return {
        line_key: l.line_key,
        work_package_id: w.id,
        location_id: loc?.id || null,
        work_snapshot: w,
        location_snapshot: loc
      };
    });
  };
  const presentAcceptance = a => ({
    ...a,
    bytes: undefined,
    mapping: JSON.parse(a.mapping),
    project_snapshot: JSON.parse(a.project_snapshot),
    recorder: get('SELECT name FROM users WHERE id=?', a.recorder_id)?.name,
    can_verify: a.state === 'submitted' && a.recorder_id !== actorId && get('SELECT author_id FROM sales_offers WHERE id=?', a.offer_id)?.author_id !== actorId && allowed(a) && allowed(row(a.offer_id)),
    can_cancel: a.state === 'submitted' && a.recorder_id === actorId && can('sales.write', a),
    late_recorded: a.recorded_on > row(a.offer_id).valid_until
  });
  const contract = id => {
    const r = get('SELECT * FROM client_contracts WHERE id=?', id);
    requireThat(r && can('sales.read', r), 'Contract is unavailable.', 404);
    return {
      ...r,
      snapshot: JSON.parse(r.snapshot),
      lines: all('SELECT * FROM client_contract_lines WHERE contract_id=?', id).map(l => ({
        ...l,
        snapshot: JSON.parse(l.snapshot)
      })),
      state_label: get("SELECT id FROM contract_finance_policies WHERE contract_id=? AND state='active'",id) ? 'Finance policy active' : 'Finance setup required', can_open_finance: can('certificates.read',r)
    };
  };
  const detail = id => {
    const r = row(id),
      p = pending(id),
      c = get('SELECT id,project_id,company_id FROM client_contracts WHERE offer_id=?', id);
    return {
      ...r,
      can_open_estimate: can('tenders.read', r),
      customer: JSON.parse(r.customer_snapshot),
      legal_company: JSON.parse(r.company_snapshot),
      lines: lines(id),
      state_label: r.state === 'approved' && r.valid_until < today() ? 'Expired offer' : OFFER_STATES[r.state],
      author: get('SELECT name FROM users WHERE id=?', r.author_id)?.name,
      company_currency: get('SELECT currency FROM companies WHERE id=?', r.company_id).currency,
      can_edit: editable(r),
      can_review: r.state === 'submitted' && r.author_id !== actorId && allowed(r),
      can_withdraw: ['submitted', 'approved'].includes(r.state) && r.author_id === actorId && can('sales.write', r) && !p,
      can_revise: ['approved', 'withdrawn', 'returned'].includes(r.state) && can('sales.write', r) && !p && !get("SELECT id FROM sales_offers WHERE study_id=? AND revision>? AND state<>'withdrawn'", r.study_id, r.revision),
      can_record: r.state === 'approved' && can('sales.write', r) && !p,
      acceptances: all('SELECT * FROM sales_acceptances WHERE offer_id=? ORDER BY created_at DESC,rowid DESC', id).filter(a => can('sales.read', a)).map(a => presentAcceptance({
        ...a,
        company_amount: r.company_amount
      })),
      contract: c && can('sales.read', c) ? contract(c.id) : null,
      revisions: all('SELECT * FROM sales_offers WHERE study_id=? ORDER BY revision', r.study_id).filter(readable).map(x => ({
        id: x.id,
        revision: x.revision,
        state: x.state,
        estimate_id: x.estimate_id
      })),
      history: all('SELECT e.id,e.acceptance_id,e.action,e.reason,e.at,u.name actor FROM commercial_events e JOIN users u ON u.id=e.actor_id WHERE e.offer_id=? ORDER BY e.id', id).filter(e => !e.acceptance_id || can('sales.read', get('SELECT company_id,project_id FROM sales_acceptances WHERE id=?', e.acceptance_id))),
      findings: [`${r.currency} ${pretty(r.net_amount)} before tax from approved estimate ${r.estimate_id}; ${lines(id).length} work items.`, `Offer valid ${r.offered_on} to ${r.valid_until}. ${r.state === 'approved' && r.valid_until < today() ? 'Expired: only evidence of acceptance within the valid period can be reviewed.' : OFFER_STATES[r.state] + '.'}`, `Retention ${r.retention_percent}% capped at ${r.currency} ${pretty(r.retention_cap)}; advance ceiling ${r.currency} ${pretty(r.advance_ceiling)}, recovery ${r.recovery_percent}%. These are terms, not cash or receivable balances.`, c ? 'Award recorded. Contract finance configuration and measured certification remain required.' : 'Commercial approval is internal; no client acceptance or contract is inferred.']
    };
  };
  const terms = (v, r) => {
    const t = {
      title: txt(v.title, 'Offer title', 160),
      offered_on: day(v.offered_on),
      valid_until: day(v.valid_until),
      payment_days: v.payment_days,
      retention_percent: pct(v.retention_percent, 'Retention'),
      retention_cap: amt(v.retention_cap, 'Retention cap'),
      advance_ceiling: amt(v.advance_ceiling, 'Advance ceiling'),
      recovery_percent: pct(v.recovery_percent, 'Recovery'),
      terms: txt(v.terms, 'Commercial terms', 4000),
      basis: txt(v.basis, 'Scope basis', 3000),
      exclusions: v.exclusions ? txt(v.exclusions, 'Exclusions', 3000) : ''
    };
    requireThat(t.valid_until >= t.offered_on, 'Offer expiry cannot precede its date.');
    requireThat(Number.isInteger(t.payment_days) && t.payment_days >= 0 && t.payment_days <= 365, 'Payment days must be 0 to 365.');
    requireThat(new D(t.retention_cap).lte(r.net_amount) && new D(t.advance_ceiling).lte(r.net_amount), 'Retention cap and advance ceiling cannot exceed the net offer.');
    requireThat(!new D(t.retention_percent).isZero() || new D(t.retention_cap).isZero(), 'Zero retention needs a zero cap.');
    requireThat(new D(t.advance_ceiling).isZero() ? new D(t.recovery_percent).isZero() : new D(t.recovery_percent).gt(0), 'Set a positive recovery percentage for an advance, or zero when no advance is agreed.');
    return t;
  };
  const create = (input, predecessor = null) => {
    const e = get('SELECT * FROM estimate_versions WHERE id=?', input.estimate_id);
    requireThat(e && can('sales.write', e) && can('tenders.read', e), 'Source estimate is unavailable.', 404);
    const current = get("SELECT * FROM sales_offers WHERE study_id=? AND state NOT IN('withdrawn','superseded')", e.study_id);
    requireThat(!current, 'This study already has a current offer. Open or revise it.', 409);
    if (predecessor) requireThat(predecessor.study_id === e.study_id, 'An offer revision must use the same estimate study.');
    const calc = JSON.parse(e.calculation),
      h = get('SELECT * FROM estimate_handovers WHERE study_id=?', e.study_id),
      project_id = e.project_id || h?.project_id || null;
    requireThat(!project_id || access.has('sales.write', e.company_id, project_id), 'Project commercial access is required.', 403);
    const r = {
      id: uid('OFR'),
      study_id: e.study_id,
      revision: get('SELECT coalesce(max(revision),0)+1 n FROM sales_offers WHERE study_id=?', e.study_id).n,
      predecessor_id: predecessor?.id || null,
      estimate_id: e.id,
      company_id: e.company_id,
      project_id,
      customer_id: e.customer_id,
      customer_snapshot: e.customer_snapshot,
      company_snapshot: JSON.stringify(get('SELECT * FROM companies WHERE id=?', e.company_id)),
      currency: e.currency,
      rate: e.rate,
      rate_date: e.rate_date,
      rate_source: e.rate_source,
      net_amount: calc.totals.selling,
      company_amount: calc.totals.company_selling,
      author_id: actorId,
      state: 'draft',
      version: 1,
      approved_by: null,
      approved_on: null,
      created_at: now()
    };
    sourceCurrent(r);
    requireThat(new D(r.net_amount).gt(0), 'Offer requires a positive value.');
    Object.assign(r, terms(input, r));
    insert('sales_offers', r);
    for (const [position, l] of calc.rows.filter(l => l.kind === 'item').entries()) insert('sales_offer_lines', {
      offer_id: r.id,
      line_key: l.key,
      position,
      code: l.code,
      description: l.description,
      unit: l.unit,
      quantity: l.total_quantity,
      unit_price: l.selling_rate,
      amount: l.selling,
      cost_code_id: l.cost_code_id,
      source_snapshot: JSON.stringify(l)
    });
    requireThat(money(sum(lines(r.id).map(l => l.amount))) === r.net_amount, 'Offer BOQ does not reconcile to the approved study.');
    event(r, predecessor ? 'offer revision' : 'offer draft', input.reason);
    return detail(r.id);
  };
  const list = (c, p = null) => {
    scope(c, p);
    const records = all('SELECT * FROM sales_offers WHERE company_id=? ORDER BY revision DESC,created_at DESC', c).filter(r => readable(r) && (!p || r.project_id === p || get('SELECT id FROM client_contracts WHERE offer_id=? AND project_id=?', r.id, p)));
    const seen = new Set();
    return records.filter(r => {
      if (seen.has(r.study_id)) return false;
      seen.add(r.study_id);
      return true;
    }).map(r => {
      const a = all("SELECT * FROM sales_acceptances WHERE offer_id=? AND state='submitted'", r.id).find(a => can('sales.read', a));
      const award = get('SELECT id,project_id,company_id FROM client_contracts WHERE offer_id=?', r.id);
      return {
        id: r.id,
        company_id: c,
        project_id: award?.project_id || r.project_id,
        title: r.title,
        customer: JSON.parse(r.customer_snapshot).name,
        estimate_id: r.estimate_id,
        revision: r.revision,
        state: r.state,
        state_label: r.state === 'approved' && r.valid_until < today() ? 'Expired offer' : a ? 'Acceptance needs verification' : OFFER_STATES[r.state],
        offered_on: r.offered_on,
        valid_until: r.valid_until,
        currency: r.currency,
        net_amount: r.net_amount,
        company_amount: r.company_amount,
        rate: r.rate,
        rate_date: r.rate_date,
        can_review: r.state === 'submitted' && r.author_id !== actorId && allowed(r) || !!a && a.recorder_id !== actorId && r.author_id !== actorId && allowed({
          ...a,
          company_amount: r.company_amount
        }) && allowed(r),
        my_draft: editable(r),
        contract_id: award && can('sales.read', award) ? award.id : null
      };
    });
  };
  return {
    detail,
    contract,
    list,
    options: (c, p = null) => {
      scope(c, p);
      return {
        projects: all('SELECT id,name,code,company_id FROM projects WHERE company_id=?', c).filter(r => access.has('sales.read', c, r.id)).map(r => ({
          ...r,
          can_write: access.has('sales.write', c, r.id)
        })),
        estimates: all("SELECT id,study_id,title,project_id,company_id,revision,basis,exclusions,calculation FROM estimate_versions WHERE company_id=? AND state='approved'", c).filter(e => can('sales.write', e) && can('tenders.read', e) && (!p || e.project_id === p) && get("SELECT id FROM estimate_versions WHERE study_id=? AND state<>'cancelled' ORDER BY revision DESC LIMIT 1", e.study_id)?.id === e.id).map(e => ({
          ...e,
          calculation: undefined
        })),
        can_create: access.has('sales.write', c, p, !p)
      };
    },
    allocationOptions: (id, p) => {
      const r = row(id);
      requireThat(access.has('sales.read', r.company_id, p) && get('SELECT id FROM projects WHERE id=? AND company_id=?', p, r.company_id), 'Project is unavailable.', 404);
      requireThat(!r.project_id || r.project_id === p, 'Use the offer project.');
      return {
        work_items: all("SELECT * FROM work_packages WHERE project_id=? AND kind='item'", p),
        locations: all('SELECT * FROM project_locations WHERE project_id=?', p),
        suggested: all('SELECT line_key,work_package_id FROM estimate_handover_lines WHERE version_id=?', r.estimate_id)
      };
    },
    save: (id, input) => transaction(db, () => {
      if (!id) return create(input);
      const r = row(id);
      version(r, input.version);
      requireThat(editable(r), 'Only the author can edit this draft.', 403);
      const t = terms(input, r),
        keys = Object.keys(t);
      run(`UPDATE sales_offers SET ${keys.map(k => k + '=?').join(',')},state='draft',version=version+1 WHERE id=?`, ...keys.map(k => t[k]), id);
      event(row(id), 'offer edited', input.reason);
      return detail(id);
    }),
    decide: (id, input) => transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      let state;
      const a = input.action;
      if (a === 'submit') {
        requireThat(editable(r), 'Only the author can submit the offer.', 403);
        sourceCurrent(r);
        requireThat(r.offered_on <= today() && today() <= r.valid_until, 'Offer must be within its valid dates before submission.');
        state = 'submitted';
      } else if (a === 'approve' || a === 'return') {
        requireThat(r.state === 'submitted' && actorId !== r.author_id && allowed(r), 'An independent reviewer with separate commercial authority is required.', 403);
        if (a === 'approve') {
          sourceCurrent(r);
          requireThat(can('sales.write', r, r.author_id), 'The author no longer has commercial access.', 409);
          requireThat(r.offered_on <= today() && today() <= r.valid_until, 'The offer has expired or is not yet valid. Return it for revision.');
        }
        state = a === 'approve' ? 'approved' : 'returned';
      } else if (a === 'withdraw') {
        requireThat(r.author_id === actorId && can('sales.write', r) && ['draft', 'returned', 'submitted', 'approved'].includes(r.state) && !pending(id), 'Only the author can withdraw an unawarded offer without a pending acceptance.', 403);
        state = r.state === 'submitted' ? 'draft' : 'withdrawn';
      } else requireThat(false, 'Unknown offer action.');
      run('UPDATE sales_offers SET state=?,version=version+1,approved_by=?,approved_on=? WHERE id=?', state, state === 'approved' ? actorId : r.approved_by, state === 'approved' ? today() : r.approved_on, id);
      event(row(id), a, input.reason);
      return detail(id);
    }),
    revise: (id, input) => transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      requireThat(detail(id).can_revise, 'This offer cannot be revised.', 403);
      if (r.state !== 'withdrawn') {
        run("UPDATE sales_offers SET state='superseded',version=version+1 WHERE id=?", id);
        event(row(id), 'superseded', input.reason);
      }
      return create({
        ...r,
        ...input,
        estimate_id: input.estimate_id || r.estimate_id
      }, r);
    }),
    recordAcceptance: (id, input) => transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      requireThat(r.state === 'approved' && can('sales.write', r) && !pending(id), 'An approved offer without a pending acceptance is required.', 403);
      approvalCurrent(r);
      const date = day(input.accepted_on);
      requireThat(date >= r.offered_on && date >= r.approved_on && date <= r.valid_until && date <= today(), 'Acceptance must be dated within the approved offer validity, no later than today. Revise an expired offer for a later acceptance.');
      const p = input.project_id;
      requireThat(p && access.has('sales.write', r.company_id, p), 'Project commercial access is required.', 403);
      requireThat(!r.project_id || r.project_id === p, 'Acceptance must use the offer project.');
      const h = get('SELECT project_id FROM estimate_handovers WHERE study_id=?', r.study_id);
      requireThat(!h || h.project_id === p, 'Use the project already created by the estimate handover.');
      const project = get('SELECT * FROM projects WHERE id=? AND company_id=?', p, r.company_id);
      requireThat(project, 'Project is unavailable.', 404);
      const mapping = mapLines(r, p, input.mapping),
        reference = txt(input.reference, 'Client acceptance reference', 120).toUpperCase();
      requireThat(!get("SELECT id FROM sales_acceptances WHERE company_id=? AND customer_id=? AND reference=? AND state IN('submitted','verified')", r.company_id, r.customer_id, reference), 'This client acceptance reference is already recorded.', 409);
      const filename = txt(input.filename, 'Evidence filename', 180);
      requireThat(!/[\/\\\x00-\x1f\x7f]/.test(filename) && /\.(pdf|png|jpe?g|txt)$/i.test(filename), 'Use a plain PDF, PNG, JPG or TXT evidence filename.');
      requireThat(typeof input.base64 === 'string' && input.base64.length <= 2800000 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64), 'Evidence must be valid base64.');
      const bytes = Buffer.from(input.base64, 'base64');
      requireThat(bytes.length > 0 && bytes.length <= 2 * 1024 * 1024 && bytes.toString('base64') === input.base64, 'Evidence file must be between 1 byte and 2 MiB.');
      const a = {
        id: uid('ACC'),
        offer_id: id,
        company_id: r.company_id,
        customer_id: r.customer_id,
        project_id: p,
        reference,
        accepted_on: date,
        recorded_on: today(),
        signatory: txt(input.signatory, 'Client signatory', 160),
        description: txt(input.description, 'Acceptance evidence description'),
        mapping: JSON.stringify(mapping),
        project_snapshot: JSON.stringify(project),
        filename,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes,
        recorder_id: actorId,
        state: 'submitted',
        version: 1,
        verified_by: null,
        verified_at: null,
        created_at: now()
      };
      insert('sales_acceptances', a);
      run('UPDATE sales_offers SET version=version+1 WHERE id=?', id);
      event(row(id), 'acceptance recorded', input.reason, a);
      return detail(id);
    }),
    decideAcceptance: (id, input) => transaction(db, () => {
      const {
        a,
        r
      } = acceptance(id);
      if (a.state === 'verified' && input.action === 'verify') {
        requireThat(a.verified_by === actorId && allowed({
          ...a,
          company_amount: r.company_amount
        }) && allowed(r), 'Award verification is restricted.', 403);
        return detail(r.id);
      }
      version(a, input.version);
      requireThat(a.state === 'submitted' && r.state === 'approved', 'Acceptance is no longer awaiting verification.', 409);
      let state;
      if (input.action === 'cancel') {
        requireThat(a.recorder_id === actorId && can('sales.write', a), 'Only the recorder can cancel this pending evidence.', 403);
        state = 'cancelled';
      } else {
        requireThat(['verify', 'return'].includes(input.action) && a.recorder_id !== actorId && r.author_id !== actorId && allowed({
          ...a,
          company_amount: r.company_amount
        }) && allowed(r), 'An independent commercial reviewer with authority in both scopes is required.', 403);
        state = input.action === 'verify' ? 'verified' : 'returned';
      }
      if (state === 'verified') {
        requireThat(input.confirmed === true, 'Confirm that the evidence supports this exact offer and scope.');
        approvalCurrent(r);
        requireThat(can('sales.write', a, a.recorder_id), 'Evidence recorder no longer has project commercial access.', 409);
        const mapping = mapLines(r, a.project_id, JSON.parse(a.mapping));
        requireThat(JSON.stringify(mapping) === a.mapping && JSON.stringify(get('SELECT * FROM projects WHERE id=?', a.project_id)) === a.project_snapshot, 'Project work allocation changed. Return the acceptance and record a fresh allocation.', 409);
        const c = {
          id: uid('CTR'),
          offer_id: r.id,
          acceptance_id: a.id,
          company_id: r.company_id,
          project_id: a.project_id,
          customer_id: r.customer_id,
          currency: r.currency,
          original_value: r.net_amount,
          company_value: r.company_amount,
          snapshot: JSON.stringify({
            offer: r,
            customer: JSON.parse(r.customer_snapshot),
            legal_company: JSON.parse(r.company_snapshot),
            acceptance: {
              ...a,
              bytes: undefined
            },
            policy: 'builder-commercial-v1',
            finance_status: 'Configuration required; no finance activation or balance implied'
          }),
          created_by: actorId,
          created_at: now()
        };
        insert('client_contracts', c);
        for (const m of mapping) {
          const l = lines(r.id).find(l => l.line_key === m.line_key);
          insert('client_contract_lines', {
            contract_id: c.id,
            line_key: m.line_key,
            work_package_id: m.work_package_id,
            location_id: m.location_id,
            snapshot: JSON.stringify({
              offer_line: l,
              allocation: m
            })
          });
        }
        run("UPDATE sales_offers SET state='awarded',version=version+1 WHERE id=?", r.id);
      } else run('UPDATE sales_offers SET version=version+1 WHERE id=?', r.id);
      run('UPDATE sales_acceptances SET state=?,version=version+1,verified_by=?,verified_at=? WHERE id=?', state, state === 'verified' ? actorId : null, state === 'verified' ? now() : null, a.id);
      event(row(r.id), 'acceptance ' + state, input.reason, get('SELECT * FROM sales_acceptances WHERE id=?', a.id));
      return detail(r.id);
    }),
    download: id => {
      const {
        a
      } = acceptance(id);
      return {
        filename: a.filename,
        sha256: a.sha256,
        bytes: a.bytes
      };
    },
    report: (c, {
      project = null,
      state = 'all',
      from = null,
      to = null
    } = {}) => {
      requireThat(state === 'all' || Object.hasOwn(OFFER_STATES, state), 'Unknown offer state.');
      if (from) day(from);
      if (to) day(to);
      requireThat(!from || !to || from <= to, 'Report dates are reversed.');
      const rows = list(c, project).filter(r => (state === 'all' || r.state === state) && (!from || r.offered_on >= from) && (!to || r.offered_on <= to)),
        currency = get('SELECT currency FROM companies WHERE id=?', c).currency;
      const totals = {
        awarded: money(sum(rows.filter(r => r.state === 'awarded').map(r => r.company_amount))),
        open_offers: money(sum(rows.filter(r => r.state === 'approved' && r.valid_until >= today()).map(r => r.company_amount)))
      };
      return {
        company: c,
        project,
        state,
        from,
        to,
        as_of: today(),
        currency,
        rows,
        totals,
        findings: [`${rows.length} latest offers in the authorised ${project ? 'project' : 'company'} scope, ${from || to ? `offer dates ${from || 'the beginning'} to ${to || 'today'}` : 'all offer dates'}; ${state === 'all' ? 'all states' : OFFER_STATES[state].toLowerCase()}.`, `${currency} ${pretty(totals.awarded)} original awarded value; ${currency} ${pretty(totals.open_offers)} valid approved offers awaiting recorded award.`, `${rows.filter(r => r.state === 'approved' && r.valid_until < today()).length} expired offers need review. Drafts, withdrawn and superseded offers are excluded from both value totals.`, `Saved offer exchange rates are used. Awards are not revenue, certified work, receivables or cash. Finance configuration and later contract changes are not included.`]
      };
    }
  };
}
