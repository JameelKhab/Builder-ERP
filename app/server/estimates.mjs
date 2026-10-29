import { randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { policy } from './access.mjs';
import { ROLE_BY_ID } from '../shared/access.mjs';
import { D, decimal, money, sum, requireThat } from './money.mjs';
import { calculateEstimate } from './estimates-calculation.mjs';
import { foundations } from './foundations.mjs';
const uid = p => `${p}-${randomUUID().slice(0, 8).toUpperCase()}`,
  now = () => new Date().toISOString();
const text = (v, label, max = 160) => {
  requireThat(typeof v === 'string' && v.trim() && v.length <= max, `${label} is required (up to ${max} characters).`);
  return v.trim();
};
const optional = (v, label, max = 160) => v ? text(v, label, max) : '';
const day = v => {
  requireThat(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Enter a valid calendar date.');
  return v;
};
const number = (v, label, positive = false) => decimal(v, label, !positive).toString();
const amount = (v, label) => {
  const n = decimal(v, label);
  requireThat(n.cmp(money(v)) === 0, `${label} needs at most two decimals.`);
  return money(v);
};
const readable = v => money(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const code = v => {
  const c = text(v, 'BOQ code', 30).toUpperCase();
  requireThat(/^[A-Z0-9][A-Z0-9._-]*$/.test(c), 'Use letters, numbers, full stops, hyphens or underscores in BOQ codes.');
  return c;
};
const percent = (v, label) => {
  const n = number(v, label);
  requireThat(new D(n).lte(1000), `${label} cannot exceed 1,000%.`);
  return n;
};
export const ESTIMATE_STATES = {
  draft: 'Draft',
  submitted: 'Needs approval',
  returned: 'Changes requested',
  approved: 'Approved',
  cancelled: 'Cancelled'
};
export function estimates(db, actorId, today = () => now().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (q, ...v) => db.prepare(q).get(...v),
    all = (q, ...v) => db.prepare(q).all(...v),
    run = (q, ...v) => db.prepare(q).run(...v);
  const can = (cap, r, who = actorId) => (who === actorId || get('SELECT active FROM users WHERE id=?', who)?.active === 1) && policy(db, who).has(cap, r.company_id, r.project_id);
  const company = c => {
    const r = get('SELECT * FROM companies WHERE id=?', c);
    requireThat(r, 'Company is unavailable.', 404);
    return r;
  };
  const scope = (c, p) => {
    company(c);
    requireThat(access.has('tenders.read', c, p, !p), 'Tender scope is unavailable.', 404);
    if (p) requireThat(get('SELECT id FROM projects WHERE id=? AND company_id=?', p, c), 'Project is unavailable.', 404);
  };
  const row = id => {
    const r = get('SELECT * FROM estimate_versions WHERE id=?', id);
    requireThat(r && can('tenders.read', r), 'Estimate is unavailable.', 404);
    return r;
  };
  const version = (r, v) => requireThat(Number.isSafeInteger(v) && r.version === v, 'This estimate changed. Reload before continuing.', 409);
  const limit = (r, who = actorId) => policy(db, who).matching(r.company_id, r.project_id).filter(g => ROLE_BY_ID[g.role_id]?.capabilities.includes('tenders.approve')).reduce((n, g) => new D(g.estimate_approval_limit || '0').gt(n) ? money(g.estimate_approval_limit) : n, '0.00');
  const inputRows = r => ({
    lines: all('SELECT * FROM estimate_lines WHERE version_id=? ORDER BY position', r.id),
    resources: all('SELECT * FROM estimate_resources WHERE version_id=? ORDER BY rowid', r.id),
    overrides: all('SELECT * FROM estimate_overrides WHERE version_id=? ORDER BY building,line_key', r.id)
  });
  const latest = r => get("SELECT id FROM estimate_versions WHERE study_id=? AND state<>'cancelled' ORDER BY revision DESC LIMIT 1", r.study_id)?.id === r.id;
  const authority = r => {
    const t = JSON.parse(r.calculation).totals;
    return new D(t.company_selling).gt(t.company_budget) ? t.company_selling : t.company_budget;
  };
  const editable = r => r.author_id === actorId && can('tenders.write', r) && ['draft', 'returned'].includes(r.state);
  const snapshot = r => ({
    ...r,
    ...inputRows(r)
  });
  const event = (r, action, reason) => run('INSERT INTO estimate_events(version_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?)', r.id, actorId, action, text(reason, 'Reason', 2000), JSON.stringify(snapshot(r)), now());
  const handoverRights = r => ['tenders.handover', 'projects.manage', 'locations.write', 'wbs.write', 'budgets.write'].every(cap => can(cap, r));
  const detail = id => {
    const r = row(id),
      h = get('SELECT * FROM estimate_handovers WHERE study_id=?', r.study_id);
    const targetReady = !r.project_id || get('SELECT budget_status FROM projects WHERE id=?', r.project_id)?.budget_status === 'unapproved' && !get('SELECT id FROM work_packages WHERE project_id=?', r.project_id);
    return {
      ...r,
      ...inputRows(r),
      commercial_offers: access.has('sales.read',r.company_id,r.project_id) ? all('SELECT id,title,revision,state FROM sales_offers WHERE study_id=? ORDER BY revision DESC',r.study_id) : [],
      can_prepare_offer: r.state==='approved' && latest(r) && can('sales.write',r) && !get("SELECT id FROM sales_offers WHERE study_id=? AND state NOT IN('withdrawn','superseded')",r.study_id),
      customer: JSON.parse(r.customer_snapshot),
      calculation: JSON.parse(r.calculation),
      state_label: ESTIMATE_STATES[r.state],
      author: get('SELECT name FROM users WHERE id=?', r.author_id)?.name,
      approver: r.approved_by ? get('SELECT name FROM users WHERE id=?', r.approved_by)?.name : null,
      company_currency: company(r.company_id).currency,
      can_edit: editable(r),
      can_review: r.state === 'submitted' && r.author_id !== actorId && can('tenders.approve', r) && new D(limit(r)).gte(authority(r)),
      can_withdraw: r.state === 'submitted' && r.author_id === actorId && can('tenders.write', r),
      can_revise: r.state === 'approved' && latest(r) && !h && can('tenders.write', r),
      can_handover: r.state === 'approved' && latest(r) && !h && targetReady && handoverRights(r),
      handover_blocker: r.state === 'approved' && !h && !targetReady ? 'This project already has a work breakdown or baseline. Use a budget revision for changes; project setup cannot be recreated.' : null,
      handover: h ? {
        ...h,
        snapshot: JSON.parse(h.snapshot),
        can_open_project: access.has('projects.read', h.company_id, h.project_id),
        can_open_budget: access.has('cost.read', h.company_id, h.project_id),
        lines: all('SELECT * FROM estimate_handover_lines WHERE version_id=?', h.version_id)
      } : null,
      revisions: all('SELECT id,revision,state,title FROM estimate_versions WHERE study_id=? ORDER BY revision', r.study_id),
      intake_sources: all('SELECT i.batch_id,i.file_id,i.line_key,i.source_sheet,i.source_row,i.snapshot,f.filename,f.sha256 FROM boq_intake_lines i JOIN boq_intake_files f ON f.id=i.file_id WHERE i.study_id=?', r.study_id).filter(s => get('SELECT key FROM estimate_lines WHERE version_id=? AND key=?', r.id, s.line_key)).map(s => ({...s,snapshot:JSON.parse(s.snapshot)})),
      history: all('SELECT e.id,e.action,e.reason,e.at,u.name actor FROM estimate_events e JOIN users u ON u.id=e.actor_id WHERE e.version_id=? ORDER BY e.id', r.id)
    };
  };
  const unit = v => {
    requireThat(get('SELECT id FROM catalogue_units WHERE id=?', v), 'Choose a known unit.');
    return v;
  };
  const fx = (currency, target, rate, rateDate, rateSource) => {
    requireThat(['AED', 'USD', 'EUR', 'GBP', 'SAR', 'QAR'].includes(currency), 'Choose a supported two-decimal currency.');
    rate = number(rate, 'Exchange rate', true);
    requireThat(currency !== target || new D(rate).cmp(1) === 0, 'Same-currency exchange rate must be 1.');
    rateDate = day(rateDate);
    requireThat(rateDate <= today(), 'Exchange-rate evidence cannot be dated in the future.');
    return {
      currency,
      rate,
      rate_date: rateDate,
      rate_source: text(rateSource, 'Exchange-rate source', 300)
    };
  };
  const validate = (input, c, p, before) => {
    const cust = get('SELECT p.id,p.name,p.version identity_version,pc.version company_version,pc.reference,pc.active,pc.blocked,pc.customer FROM parties p JOIN party_companies pc ON pc.party_id=p.id WHERE p.id=? AND pc.company_id=?', input.customer_id, c);
    requireThat(cust?.customer && cust.active && !cust.blocked, 'Choose an active customer in this company.');
    const h = {
      company_id: c,
      project_id: p,
      customer_id: cust.id,
      customer_snapshot: JSON.stringify(cust),
      title: text(input.title, 'Estimate title'),
      tender_reference: text(input.tender_reference, 'Tender reference'),
      due: day(input.due),
      ...fx(input.currency, company(c).currency, input.rate, input.rate_date, input.rate_source),
      buildings: input.buildings,
      indirect_pool: amount(input.indirect_pool, 'Indirect cost pool'),
      overhead: percent(input.overhead, 'Overhead'),
      profit: percent(input.profit, 'Profit'),
      header_markup: percent(input.header_markup, 'Header markup'),
      basis: text(input.basis, 'Estimate basis', 3000),
      exclusions: optional(input.exclusions, 'Exclusions', 3000)
    };
    if (before) requireThat(h.currency === before.currency, 'Study currency is fixed. Create a separate study for a different offer currency.');
    requireThat(Number.isInteger(h.buildings) && h.buildings >= 1 && h.buildings <= 1000, 'Use 1 to 1,000 repeated buildings.');
    requireThat(Array.isArray(input.lines) && input.lines.length >= 1 && input.lines.length <= 200, 'Provide 1 to 200 BOQ rows.');
    const keys = new Set(),
      codes = new Set();
    const lines = input.lines.map((l, position) => {
      requireThat(!l.cap && (!l.share || new D(l.share).isZero()), 'Parent value caps and shares require the verified import workflow; they cannot be silently treated as summaries.');
      const key = l.key ? text(l.key, 'Line key', 80) : uid('EL'),
        cde = code(l.code);
      requireThat(!keys.has(key) && !codes.has(cde), 'Line keys and BOQ codes must be unique.');
      keys.add(key);
      codes.add(cde);
      requireThat(['item', 'group'].includes(l.kind), 'Choose item or summary group.');
      requireThat(get('SELECT id FROM cost_codes WHERE id=? AND company_id=?', l.cost_code_id, c), 'Choose a cost code in this company.');
      const group = l.kind === 'group';
      const product = l.product_id ? get('SELECT id,company_id,code,name,uom,version,active FROM products WHERE id=? AND company_id=?', l.product_id,c) : null;
      if (l.product_id) requireThat(product?.active && product.uom === l.unit && !group, 'Referenced product must be active in this company and use the same unit.');
      return {
        key,
        position,
        code: cde,
        description: text(l.description, 'BOQ description'),
        kind: l.kind,
        product_id: product?.id || null,
        product_snapshot: product ? JSON.stringify(product) : null,
        parent_key: l.parent_key || null,
        cost_code_id: l.cost_code_id,
        unit: unit(group ? 'lump' : l.unit),
        quantity: group ? '0' : number(l.quantity, 'Quantity per building'),
        mode: group ? 'direct' : l.mode,
        direct_rate: group ? '0' : number(l.direct_rate, 'Direct unit cost'),
        item_markup: group ? '0' : percent(l.item_markup, 'Item markup'),
        secondary_unit: !group && l.secondary_unit ? unit(l.secondary_unit) : null,
        conversion: !group && l.secondary_unit ? number(l.conversion, 'Secondary units per primary unit', true) : '0'
      };
    });
    requireThat(lines.some(l => l.kind === 'item'), 'Add at least one priced work item.');
    for (const l of lines) {
      requireThat(['direct', 'assembly'].includes(l.mode), 'Choose direct unit cost or resource assembly.');
      requireThat(l.mode !== 'assembly' || new D(l.direct_rate).isZero(), 'Assembly items cannot also add a fallback direct rate.');
      let parent = l.parent_key;
      const seen = new Set([l.key]);
      while (parent) {
        const g = lines.find(x => x.key === parent);
        requireThat(g?.kind === 'group' && !seen.has(parent), 'Choose a summary parent without a hierarchy cycle.');
        seen.add(parent);
        parent = g.parent_key;
      }
    }
    requireThat(Array.isArray(input.resources) && input.resources.length <= 4000, 'Provide a bounded resource list.');
    const resourceKeys = new Set();
    const resources = input.resources.map(r => {
      const l = lines.find(l => l.key === r.line_key);
      requireThat(l?.kind === 'item' && l.mode === 'assembly', 'Resource must belong to an assembly item.');
      const key = r.key ? text(r.key, 'Resource key', 80) : uid('ER');
      requireThat(!resourceKeys.has(key), 'Resource keys must be unique.');
      resourceKeys.add(key);
      requireThat(['material', 'labour', 'plant', 'subcontract', 'other'].includes(r.kind), 'Choose a resource type.');
      return {
        key,
        line_key: l.key,
        kind: r.kind,
        description: text(r.description, 'Resource description'),
        unit: unit(r.unit),
        consumption: number(r.consumption, 'Consumption per primary unit', true),
        unit_rate: number(r.unit_rate, 'Resource rate'),
        price_basis: number(r.price_basis, 'Price basis', true),
        ...fx(r.currency, h.currency, r.rate, r.rate_date, r.rate_source)
      };
    });
    for (const l of lines.filter(l => l.mode === 'assembly')) {
      const count = resources.filter(r => r.line_key === l.key).length;
      requireThat(count >= 1 && count <= 20, 'Each assembly needs 1 to 20 resource components.');
    }
    requireThat(Array.isArray(input.overrides) && input.overrides.length <= 500, 'Provide up to 500 building overrides.');
    const pairs = new Set(),
      overrides = input.overrides.map(v => {
        requireThat(lines.some(l => l.key === v.line_key && l.kind === 'item'), 'Override must refer to a work item.');
        requireThat(Number.isInteger(v.building) && v.building >= 1 && v.building <= h.buildings, 'Override building number must be within the repeated building count.');
        const pair = v.line_key + ':' + v.building;
        requireThat(!pairs.has(pair), 'Each building/item pair can have one override.');
        pairs.add(pair);
        return {
          line_key: v.line_key,
          building: v.building,
          quantity: number(v.quantity, 'Replacement quantity'),
          reason: text(v.reason, 'Override reason', 500)
        };
      });
    const calculation = calculateEstimate(h, lines, resources, overrides);
    for (const k of ['budget', 'selling', 'company_budget', 'company_selling']) requireThat(new D(calculation.totals[k]).lte('999999999999.99'), 'Estimate exceeds the supported amount range.');
    return {
      h,
      lines,
      resources,
      overrides,
      calculation
    };
  };
  const insert = (table, data) => {
    const keys = Object.keys(data);
    run(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...keys.map(k => data[k]));
  };
  const save = (key, input, predecessor = null) => transaction(db, () => {
    const before = key ? row(key) : null,
      c = before?.company_id || predecessor?.company_id || input.company_id,
      p = before ? before.project_id : predecessor ? predecessor.project_id : input.project_id || null;
    requireThat(access.has('tenders.write', c, p), 'Your role cannot prepare estimates in this scope.', 403);
    scope(c, p);
    if (before) {
      version(before, input.version);
      requireThat(editable(before), 'Only the author can change this draft.', 403);
      requireThat(!input.project_id || input.project_id === p, 'Estimate project scope is fixed.');
      requireThat(!input.company_id || input.company_id === c, 'Estimate company is fixed.');
    }
    const v = validate(input, c, p, before || predecessor),
      id = key || uid('EST'),
      base = {
        id,
        study_id: before?.study_id || predecessor?.study_id || uid('STUDY'),
        revision: before?.revision || (predecessor ? get('SELECT max(revision) n FROM estimate_versions WHERE study_id=?', predecessor.study_id).n + 1 : 1),
        predecessor_id: before?.predecessor_id || predecessor?.id || null,
        ...v.h,
        author_id: actorId,
        state: 'draft',
        version: (before?.version || 0) + 1,
        approved_by: null,
        approved_at: null,
        calculation: JSON.stringify(v.calculation),
        created_at: before?.created_at || now()
      };
    if (before) {
      for (const table of ['estimate_overrides', 'estimate_resources', 'estimate_lines']) run(`DELETE FROM ${table} WHERE version_id=?`, id);
      const updates = {
        ...v.h,
        state: 'draft',
        version: base.version,
        calculation: base.calculation
      };
      const keys = Object.keys(updates);
      run(`UPDATE estimate_versions SET ${keys.map(k => k + '=?').join(',')} WHERE id=?`, ...keys.map(k => updates[k]), id);
    } else insert('estimate_versions', base);
    for (const l of v.lines) insert('estimate_lines', {
      version_id: id,
      ...l
    });
    for (const r of v.resources) insert('estimate_resources', {
      version_id: id,
      ...r
    });
    for (const o of v.overrides) insert('estimate_overrides', {
      version_id: id,
      ...o
    });
    event(row(id), before ? 'edited' : predecessor ? 'revision created' : 'created', input.reason);
    return detail(id);
  });
  const customerCurrent = r => {
    const current = get('SELECT p.id,p.name,p.version identity_version,pc.version company_version,pc.reference,pc.active,pc.blocked,pc.customer FROM parties p JOIN party_companies pc ON pc.party_id=p.id WHERE p.id=? AND pc.company_id=?', r.customer_id, r.company_id);
    requireThat(current?.customer && current.active && !current.blocked && JSON.stringify(current) === r.customer_snapshot, 'Customer information changed or is unavailable. Return and refresh the estimate before approval.', 409);
  };
  const reviewerCurrent = r => {
    requireThat(r.approved_by && r.approved_by !== r.author_id && can('tenders.approve', r, r.approved_by) && new D(limit(r, r.approved_by)).gte(authority(r)), 'The approving reviewer no longer has sufficient authority. Create a new reviewed revision before handover.');
  };
  const summaries = (c, p = null) => {
    scope(c, p);
    const rows = all('SELECT * FROM estimate_versions WHERE company_id=? ORDER BY revision DESC,created_at DESC', c).filter(r => (!p || r.project_id === p) && can('tenders.read', r));
    const grouped = new Map();
    for (const r of rows) if (!grouped.has(r.study_id) || grouped.get(r.study_id).state === 'cancelled' && r.state !== 'cancelled') grouped.set(r.study_id, r);
    return [...grouped.values()].map(r => ({
      id: r.id,
      study_id: r.study_id,
      company_id: c,
      project_id: r.project_id,
      project: r.project_id ? get('SELECT name FROM projects WHERE id=?', r.project_id)?.name : null,
      title: r.title,
      customer: JSON.parse(r.customer_snapshot).name,
      tender_reference: r.tender_reference,
      currency: r.currency,
      rate: r.rate,
      rate_date: r.rate_date,
      revision: r.revision,
      version: r.version,
      due: r.due,
      state: r.state,
      state_label: ESTIMATE_STATES[r.state],
      author_id: r.author_id,
      author: get('SELECT name FROM users WHERE id=?', r.author_id)?.name,
      totals: JSON.parse(r.calculation).totals,
      can_review: r.state === 'submitted' && r.author_id !== actorId && can('tenders.approve', r) && new D(limit(r)).gte(authority(r)),
      my_draft: editable(r)
    }));
  };
  return {
    detail,
    save,
    list: summaries,
    options: (c, p = null) => {
      scope(c, p);
      return {
        company: company(c),
        today: today(),
        currencies: ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'QAR'],
        units: all('SELECT * FROM catalogue_units ORDER BY name'),
        cost_codes: all('SELECT * FROM cost_codes WHERE company_id=? ORDER BY code', c),
        customers: all('SELECT p.id,p.name,pc.reference FROM parties p JOIN party_companies pc ON pc.party_id=p.id WHERE pc.company_id=? AND pc.active=1 AND pc.blocked=0 AND pc.customer=1 ORDER BY p.name', c),
        projects: all('SELECT id,name,code FROM projects WHERE company_id=?', c).filter(x => access.has('tenders.read', c, x.id)),
        managers: all('SELECT DISTINCT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.company_id=? AND u.active=1', c).filter(u => policy(db, u.id).has('projects.manage', c, p)),
        can_create: access.has('tenders.write', c, p),
        can_create_company: access.has('tenders.write', c, null)
      };
    },
    decide: (id, input) => transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      const reason = text(input.reason, 'Decision reason', 2000),
        a = input.action;
      let state;
      if (a === 'submit') {
        requireThat(editable(r), 'Only the author can submit this draft.', 403);
        requireThat(new D(JSON.parse(r.calculation).totals.selling).gt(0), 'The estimate needs a positive selling value before review.');
        customerCurrent(r);
        state = 'submitted';
      } else if (a === 'withdraw') {
        requireThat(r.state === 'submitted' && r.author_id === actorId && can('tenders.write', r), 'Only the author can withdraw this submission.', 403);
        state = 'draft';
      } else if (a === 'cancel') {
        requireThat(editable(r), 'Only the author can cancel an unapproved draft.', 403);
        state = 'cancelled';
      } else if (a === 'return' || a === 'approve') {
        requireThat(r.state === 'submitted' && r.author_id !== actorId && can('tenders.approve', r), 'An independent authorised reviewer is required.', 403);
        requireThat(new D(limit(r)).gte(authority(r)), 'Estimate exceeds your separate estimate approval authority.', 403);
        if (a === 'approve') {
          customerCurrent(r);
          requireThat(can('tenders.write', r, r.author_id), 'The preparer no longer has estimate access. Return the study for reassignment.', 403);
        }
        state = a === 'approve' ? 'approved' : 'returned';
      } else requireThat(false, 'Unknown estimate action.');
      run('UPDATE estimate_versions SET state=?,version=version+1,approved_by=?,approved_at=? WHERE id=?', state, state === 'approved' ? actorId : null, state === 'approved' ? now() : null, id);
      event(row(id), a, reason);
      return detail(id);
    }),
    revise: (id, input) => transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      requireThat(r.state === 'approved' && latest(r) && can('tenders.write', r), 'Create a revision from the latest approved estimate.', 403);
      requireThat(!get('SELECT version_id FROM estimate_handovers WHERE study_id=?', r.study_id), 'This study was handed over. Changes must follow the contract/budget change workflow.');
      const source = snapshot(r);
      return save(null, {
        ...source,
        reason: input.reason
      }, r);
    }),
    compare: (id, other) => {
      const a = detail(other),
        b = detail(id);
      requireThat(a.study_id === b.study_id, 'Choose revisions of the same study.');
      const aa = a.calculation.rows.filter(r => r.kind === 'item'),
        bb = b.calculation.rows.filter(r => r.kind === 'item');
      const rows = [...new Set([...aa, ...bb].map(r => r.key))].map(key => {
        const old = aa.find(r => r.key === key),
          current = bb.find(r => r.key === key);
        const facts = (d, k) => ({
          line: d.lines.find(l => l.key === k),
          resources: d.resources.filter(r => r.line_key === k),
          overrides: d.overrides.filter(r => r.line_key === k)
        });
        const clean = x => JSON.stringify(x, (k, v) => k === 'version_id' ? undefined : v);
        return {
          key,
          code: (current || old).code,
          description: (current || old).description,
          change: !old ? 'Added' : !current ? 'Removed' : clean(facts(a, key)) !== clean(facts(b, key)) || old.budget !== current.budget || old.selling !== current.selling ? 'Changed' : 'Unchanged',
          cause: !old ? 'New work item' : !current ? 'Removed work item' : [old.total_quantity !== current.total_quantity ? 'Quantity changed' : '', old.direct !== current.direct ? 'Direct cost changed' : '', old.indirect !== current.indirect ? 'Indirect allocation changed' : '', old.budget === current.budget && old.selling !== current.selling ? 'Pricing changed' : ''].filter(Boolean).join('; ') || (clean(facts(a, key)) !== clean(facts(b, key)) ? 'Definition or rate evidence changed' : 'No change'),
          direct_delta: money(new D(current?.direct || 0).minus(old?.direct || 0)),
          indirect_delta: money(new D(current?.indirect || 0).minus(old?.indirect || 0)),
          old_quantity: old?.total_quantity || '0',
          quantity: current?.total_quantity || '0',
          old_budget: old?.budget || '0.00',
          budget: current?.budget || '0.00',
          budget_delta: money(new D(current?.budget || 0).minus(old?.budget || 0)),
          selling_delta: money(new D(current?.selling || 0).minus(old?.selling || 0))
        };
      });
      return {
        from: a.revision,
        to: b.revision,
        currency: b.currency,
        rows,
        budget_delta: money(new D(b.calculation.totals.budget).minus(a.calculation.totals.budget)),
        selling_delta: money(new D(b.calculation.totals.selling).minus(a.calculation.totals.selling)),
        findings: [`${rows.filter(r => r.change !== 'Unchanged').length} of ${rows.length} work items changed between revisions ${a.revision} and ${b.revision}.`, 'The indirect pool is allocated in proportion to direct cost. A changed resource cost can therefore redistribute indirect costs across other items.', 'Compare the saved pricing policy and FX evidence as well as quantities and resource rates.']
      };
    },
    handover: (id, input) => transaction(db, () => {
      const r = row(id),
        existing = get('SELECT * FROM estimate_handovers WHERE study_id=?', r.study_id);
      if (existing) {
        requireThat(handoverRights(r), 'Project handover is restricted.', 403);
        return detail(id);
      }
      version(r, input.version);
      requireThat(r.state === 'approved' && latest(r) && handoverRights(r), 'Handover needs the latest approved estimate and project/budget preparation authority.', 403);
      reviewerCurrent(r);
      customerCurrent(r);
      const reason = text(input.reason, 'Handover reason', 2000),
        f = foundations(db, actorId, today),
        calc = JSON.parse(r.calculation);
      let p;
      if (r.project_id) {
        p = get('SELECT * FROM projects WHERE id=?', r.project_id);
        requireThat(p.budget_status === 'unapproved' && !get('SELECT id FROM work_packages WHERE project_id=?', p.id), 'The attached project must have no work items or approved baseline. Use the controlled change workflow for an active project.');
      } else p = f.saveProject(null, {
        ...input.project,
        company_id: r.company_id,
        customer_reference: JSON.parse(r.customer_snapshot).name,
        provenance: `Estimate ${r.id}, revision ${r.revision}; project setup, no client acceptance implied`,
        reason
      });
      const site = get("SELECT * FROM project_locations WHERE project_id=? AND kind='site' ORDER BY rowid LIMIT 1", p.id);
      const locations = [];
      for (let n = 1; n <= r.buildings; n++) locations.push(f.saveLocation(null, {
        project_id: p.id,
        parent_id: site?.id || null,
        code: `B${String(n).padStart(3, '0')}`,
        name: `Building ${n}`,
        kind: 'building',
        reason
      }));
      const mapping = new Map(),
        pending = [...calc.rows];
      while (pending.length) {
        const i = pending.findIndex(l => !l.parent_key || mapping.has(l.parent_key));
        requireThat(i >= 0, 'Invalid work hierarchy.');
        const [l] = pending.splice(i, 1);
        const w = f.savePackage(null, {
          project_id: p.id,
          parent_id: mapping.get(l.parent_key) || null,
          code: l.code,
          name: l.description,
          kind: l.kind,
          cost_code_id: l.cost_code_id,
          reason
        });
        mapping.set(l.key, w.id);
      }
      const budget = f.saveBudget(null, {
        project_id: p.id,
        kind: 'baseline',
        title: `Estimate handover · ${r.title}`,
        basis: `Draft baseline from ${r.id}, revision ${r.revision}. ${r.currency} 1 = ${company(r.company_id).currency} ${r.rate}; ${r.rate_date}; ${r.rate_source}. Independent budget approval and released capacity are still required.`,
        lines: calc.rows.filter(l => l.kind === 'item').map(l => ({
          work_package_id: mapping.get(l.key),
          proposed_budget: l.company_budget,
          proposed_release: '0.00',
          note: `${r.id} / ${l.code}; estimated cost including allocated indirect; no sales markup`
        }))
      });
      insert('estimate_handovers', {
        version_id: r.id,
        study_id: r.study_id,
        company_id: r.company_id,
        project_id: p.id,
        budget_id: budget.id,
        actor_id: actorId,
        reason,
        snapshot: JSON.stringify({
          estimate: snapshot(r),
          project: p,
          locations,
          quotation_status: 'Separate sales quotation handover remains required; no customer acceptance implied'
        }),
        at: now()
      });
      for (const l of calc.rows) insert('estimate_handover_lines', {
        version_id: r.id,
        line_key: l.key,
        work_package_id: mapping.get(l.key),
        budget_amount: l.company_budget
      });
      event(r, 'project handover', reason);
      return detail(id);
    }),
    report: (c, {
      project = null,
      state = 'all'
    } = {}) => {
      requireThat(state === 'all' || Object.hasOwn(ESTIMATE_STATES, state), 'Unknown estimate state.');
      const rows = summaries(c, project).filter(r => state === 'all' || r.state === state),
        active = rows.filter(r => r.state !== 'cancelled');
      const currency = company(c).currency,
        totals = {
          budget: money(sum(active.map(r => r.totals.company_budget))),
          selling: money(sum(active.map(r => r.totals.company_selling)))
        };
      return {
        company: c,
        project,
        state,
        currency,
        rows,
        totals,
        findings: [`${rows.length} latest studies in the authorised ${project ? 'project' : 'company'} scope; prior revisions are excluded.`, `${active.filter(r => r.state === 'approved').length} approved, ${active.filter(r => r.state === 'submitted').length} awaiting approval.`, `${currency} ${readable(totals.budget)} estimated cost and ${currency} ${readable(totals.selling)} potential selling value across noncancelled studies. These are estimates, not committed contracts.`, `Each study uses its recorded exchange-rate date. Figures are not retranslated at today's rates.`]
      };
    }
  };
}
