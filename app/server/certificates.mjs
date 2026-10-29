import { randomUUID, createHash } from 'node:crypto';
import { advanceInvoiceCalculation } from './advances.mjs';
import { recoveryQuote, freezeRecoveries, certifiedRecoveries, contractAdvancePosition } from './advance-recovery.mjs';
import { receivableBalance } from './receivable-balance.mjs';
import { transaction } from './db.mjs';
import { policy } from './access.mjs';
import { ROLE_BY_ID } from '../shared/access.mjs';
import { D, decimal, money, sum, requireThat } from './money.mjs';
import { payableRatio } from './payables.mjs';
import { convertJournal } from './ledger.mjs';
const uid = p => `${p}-${randomUUID().slice(0, 8).toUpperCase()}`;
const now = () => new Date().toISOString();
const text = (v, label, max = 2000) => {
  requireThat(typeof v === 'string' && v.trim() && v.length <= max, `${label} is required (maximum ${max} characters).`);
  return v.trim();
};
const day = v => {
  requireThat(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Enter a valid calendar date.');
  return v;
};
const min = (a, b) => new D(a).lte(b) ? new D(a) : new D(b);
export const CERTIFICATE_STATES = {
  draft: 'Draft measurement',
  technical: 'Technical review',
  commercial: 'Commercial review',
  finance: 'Finance approval',
  returned: 'Returned for correction',
  approved: 'Certified',
  cancelled: 'Cancelled'
};
export function certificates(db, actorId, today = () => now().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (q, ...v) => db.prepare(q).get(...v),
    all = (q, ...v) => db.prepare(q).all(...v),
    run = (q, ...v) => db.prepare(q).run(...v);
  const can = (cap, r) => access.has(cap, r.company_id, r.project_id);
  const version = (r, v) => requireThat(Number.isSafeInteger(v) && v === r.version, 'This record changed. Reload before continuing.', 409);
  const scoped = (company, project, cap = 'certificates.read') => {
    requireThat(get('SELECT id FROM companies WHERE id=?', company) && access.has(cap, company, project, !project), 'Client finance scope is unavailable.', 404);
    if (project) requireThat(get('SELECT id FROM projects WHERE id=? AND company_id=?', project, company), 'Project is unavailable.', 404);
  };
  const authority = (who, cap, r, column, amount) => {
    try {
      const p = policy(db, who);
      p.actor();
      if (!p.has(cap, r.company_id, r.project_id)) return false;
      if (!column) return true;
      return p.matching(r.company_id, r.project_id).some(g => ROLE_BY_ID[g.role_id]?.capabilities.includes(cap) && new D(g[column] || '0').gt(0) && new D(g[column] || '0').gte(amount));
    } catch {
      return false;
    }
  };
  const event = (type, r, action, reason) => run('INSERT INTO client_finance_events(entity_type,entity_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?,?)', type, r.id, r.company_id, r.project_id, actorId, action, text(reason, 'Reason'), JSON.stringify(r), now());
  const history = (type, id) => all('SELECT e.*,u.name actor FROM client_finance_events e JOIN users u ON u.id=e.actor_id WHERE entity_type=? AND entity_id=? ORDER BY e.id', type, id).map(e => ({
    ...e,
    snapshot: JSON.parse(e.snapshot)
  }));
  const contractRow = id => {
    const r = get('SELECT * FROM client_contracts WHERE id=?', id);
    requireThat(r && can('certificates.read', r), 'Client contract is unavailable.', 404);
    return r;
  };
  function contractData(id) {
    const r = contractRow(id),
      s = JSON.parse(r.snapshot),
      terms = s.offer;
    return {
      ...r,
      snapshot: undefined,
      company_currency: get('SELECT currency FROM companies WHERE id=?', r.company_id).currency,
      title: terms.title,
      project: get('SELECT name FROM projects WHERE id=?', r.project_id).name,
      customer: s.customer.name || s.customer.party?.name || 'Client',
      terms: {
        payment_days: terms.payment_days,
        retention_percent: terms.retention_percent,
        retention_cap: terms.retention_cap,
        advance_ceiling: terms.advance_ceiling,
        recovery_percent: terms.recovery_percent
      },
      lines: all('SELECT * FROM client_contract_lines WHERE contract_id=? ORDER BY rowid', id).map(l => {
        const x = JSON.parse(l.snapshot),
          o = x.offer_line;
        return {
          line_key: l.line_key,
          code: o.code,
          description: o.description,
          unit: o.unit,
          quantity: o.quantity,
          unit_price: o.unit_price,
          amount: o.amount,
          work_package_id: l.work_package_id,
          location_id: l.location_id,
          work_package: x.allocation.work_snapshot.name,
          location: x.allocation.location_snapshot?.name || null
        };
      })
    };
  }
  const row = id => {
    const r = get('SELECT * FROM client_certificates WHERE id=?', id);
    requireThat(r && can('certificates.read', r), 'Certificate is unavailable.', 404);
    return r;
  };
  const invoiceRow = id => {
    const r = get('SELECT * FROM client_invoices WHERE id=?', id);
    requireThat(r && can('ar.read', r), 'Client invoice is unavailable.', 404);
    return r;
  };
  const policyRow = id => {
    const r = get('SELECT * FROM contract_finance_policies WHERE id=?', id);
    requireThat(r && can('certificates.read', r), 'Finance policy is unavailable.', 404);
    return r;
  };
  const activePolicy = id => get("SELECT * FROM contract_finance_policies WHERE contract_id=? AND state='active'", id);
  const prior = id => get("SELECT * FROM client_certificates WHERE contract_id=? AND state='approved' ORDER BY period_to DESC,approved_at DESC,id DESC LIMIT 1", id);
  function account(id, c, type, purpose) {
    const a = get('SELECT * FROM ledger_accounts WHERE id=? AND company_id=?', id, c);
    requireThat(a?.active && a.type === type && a.purpose === purpose, `Choose an active ${type} / ${purpose} account in this company.`);
    return a;
  }
  function policySnapshot(c, i) {
    const percent = decimal(i.tax_percent, 'Tax percentage');
    requireThat(percent.lte(100), 'Tax percentage cannot exceed 100.');
    requireThat(['gross', 'net'].includes(i.tax_basis), 'Choose the exclusive tax basis.');
    const accounts = {
      receivable: account(i.receivable_account, c.company_id, 'asset', 'receivable'),
      retention: account(i.retention_account, c.company_id, 'asset', 'receivable'),
      revenue: account(i.revenue_account, c.company_id, 'income', 'general'),
      tax: percent.gt(0) ? account(i.tax_account, c.company_id, 'liability', 'tax') : null
    };
    requireThat(accounts.receivable.id !== accounts.retention.id, 'Use separate receivable and retention accounts.');
    const taxMode = i.recovery_tax_mode || 'unconfigured', fxBasis = i.recovery_fx_basis || 'unconfigured';
    requireThat(['unconfigured', 'original_tax'].includes(taxMode), 'Choose the advance-tax recovery policy.');
    requireThat(['unconfigured', 'historical_consideration'].includes(fxBasis), 'Choose the advance currency policy.');
    requireThat(!!i.fx_gain_account === !!i.fx_loss_account, 'Configure exchange gain and loss accounts together.');
    if (i.fx_gain_account) {
      accounts.fx_gain = account(i.fx_gain_account, c.company_id, 'income', 'general');
      accounts.fx_loss = account(i.fx_loss_account, c.company_id, 'expense', 'general');
      requireThat(accounts.fx_gain.id !== accounts.revenue.id, 'Exchange gains need a separate account from measured revenue.');
    }
    return {
      policy: 'builder-client-finance-v1', accounts, terms: c.terms,
      tax_percent: percent.toString(), tax_basis: i.tax_basis,
      ...(taxMode !== 'unconfigured' ? { recovery_tax_mode: taxMode } : {}),
      ...(fxBasis !== 'unconfigured' ? { recovery_fx_basis: fxBasis } : {})
    };
  }
  function currentPolicy(p) {
    requireThat(p && p.state === 'active', 'An independently activated finance policy is required.');
    const c = contractData(p.contract_id),
      s = JSON.parse(p.snapshot);
    requireThat(authority(p.approved_by, 'contracts.configure', p, 'certificate_approval_limit', c.company_value), 'The finance-policy reviewer no longer has sufficient current authority. Review a new policy.', 409);
    for (const a of Object.values(s.accounts).filter(Boolean)) {
      const live = get('SELECT * FROM ledger_accounts WHERE id=? AND company_id=?', a.id, p.company_id);
      requireThat(live?.active && JSON.stringify(live) === JSON.stringify(a), 'An account changed after policy approval. Review a new finance policy.', 409);
    }
    return s;
  }
  function savePolicy(id, input) {
    return transaction(db, () => {
      const old = id ? policyRow(id) : null,
        c = contractData(old?.contract_id || input.contract_id);
      access.requireCap('contracts.configure', c.company_id, c.project_id);
      if (old) {
        version(old, input.version);
        requireThat(old.author_id === actorId && ['draft', 'returned'].includes(old.state), 'Only the author may revise an unsubmitted finance policy.', 403);
      } else requireThat(!get("SELECT id FROM contract_finance_policies WHERE contract_id=? AND state IN ('draft','returned','submitted')", c.id), 'Finish or cancel the pending finance policy first.', 409);
      const snap = policySnapshot(c, input),
        basis = text(input.basis, 'Tax and account basis');
      id = old?.id || uid('CFP');
      if (old) run("UPDATE contract_finance_policies SET state='draft',receivable_account=?,retention_account=?,revenue_account=?,tax_account=?,tax_percent=?,tax_basis=?,basis=?,snapshot=?,version=version+1 WHERE id=?", snap.accounts.receivable.id, snap.accounts.retention.id, snap.accounts.revenue.id, snap.accounts.tax?.id || null, snap.tax_percent, snap.tax_basis, basis, JSON.stringify(snap), id);else run("INSERT INTO contract_finance_policies(id,contract_id,company_id,project_id,revision,author_id,state,receivable_account,retention_account,revenue_account,tax_account,tax_percent,tax_basis,basis,snapshot,created_at) VALUES(?,?,?,?,?,?,'draft',?,?,?,?,?,?,?,?,?)", id, c.id, c.company_id, c.project_id, get('SELECT coalesce(max(revision),0)+1 n FROM contract_finance_policies WHERE contract_id=?', c.id).n, actorId, snap.accounts.receivable.id, snap.accounts.retention.id, snap.accounts.revenue.id, snap.accounts.tax?.id || null, snap.tax_percent, snap.tax_basis, basis, JSON.stringify(snap), now());
      run('UPDATE contract_finance_policies SET recovery_tax_mode=?,recovery_fx_basis=?,fx_gain_account=?,fx_loss_account=? WHERE id=?', snap.recovery_tax_mode || 'unconfigured', snap.recovery_fx_basis || 'unconfigured', snap.accounts.fx_gain?.id || null, snap.accounts.fx_loss?.id || null, id);
      event('policy', policyRow(id), 'Finance policy prepared', input.reason);
      return contract(c.id);
    });
  }
  function decidePolicy(id, input) {
    return transaction(db, () => {
      const r = policyRow(id),
        c = contractData(r.contract_id);
      version(r, input.version);
      access.requireCap('contracts.configure', r.company_id, r.project_id);
      let state;
      if (input.action === 'cancel') {
        requireThat(r.author_id === actorId && ['draft', 'submitted', 'returned'].includes(r.state), 'Only the author can cancel a pending policy.', 403);
        state = 'cancelled';
      } else if (input.action === 'submit') {
        requireThat(r.author_id === actorId && r.state === 'draft', 'Only the author can submit the prepared policy.', 403);
        requireThat(JSON.stringify(policySnapshot(c, r)) === r.snapshot, 'Accounts changed; revise the policy before submitting.', 409);
        state = 'submitted';
      } else {
        requireThat(r.state === 'submitted' && r.author_id !== actorId && authority(actorId, 'contracts.configure', r, 'certificate_approval_limit', c.company_value), 'An independent finance reviewer needs sufficient certificate authority for the contract.', 403);
        requireThat(['approve', 'return'].includes(input.action), 'Choose approve or return.');
        state = input.action === 'approve' ? 'active' : 'returned';
        if (state === 'active') {
          requireThat(authority(r.author_id, 'contracts.configure', r), 'The policy author no longer has current authority.', 409);
          requireThat(JSON.stringify(policySnapshot(c, r)) === r.snapshot, 'Accounts changed; return and revise the policy.', 409);
          run("UPDATE contract_finance_policies SET state='superseded',version=version+1 WHERE contract_id=? AND state='active'", r.contract_id);
        }
      }
      run('UPDATE contract_finance_policies SET state=?,version=version+1,approved_by=?,approved_at=? WHERE id=?', state, state === 'active' ? actorId : null, state === 'active' ? now() : null, id);
      event('policy', policyRow(id), `Finance policy ${state}`, input.reason);
      return contract(r.contract_id);
    });
  }
  function fx(c, input, date) {
    const rate = decimal(input.rate, 'Exchange rate', false).toString(),
      rateDate = day(input.rate_date),
      source = text(input.rate_source, 'Rate source', 300);
    requireThat(rateDate <= date && rateDate <= today(), 'The FX date cannot follow the document date or today.');
    requireThat(c.currency !== get('SELECT currency FROM companies WHERE id=?', c.company_id).currency || new D(rate).cmp(1) === 0, 'Same-currency transactions use rate 1.');
    return {
      rate,
      rate_date: rateDate,
      rate_source: source
    };
  }
  function measurement(c, input, p = activePolicy(c.id), previous = prior(c.id)) {
    const s = currentPolicy(p),
      start = day(input.period_from),
      end = day(input.period_to);
    requireThat(start <= end && end <= today(), 'Measurement dates must be ordered and not in the future.');
    requireThat(!previous || start > previous.period_to, 'The period overlaps a previously certified period.');
    requireThat(Array.isArray(input.lines) && input.lines.every(l => l && typeof l === 'object' && typeof l.line_key === 'string') && input.lines.length === c.lines.length && new Set(input.lines.map(l => l.line_key)).size === c.lines.length, 'Include every contract BOQ item exactly once.');
    const prev = previous ? JSON.parse(previous.snapshot) : null;
    const lines = c.lines.map(l => {
      const x = input.lines.find(x => x.line_key === l.line_key);
      requireThat(x, 'Every measurement must match the original BOQ.');
      const cumulative = decimal(x.cumulative_quantity, 'Cumulative quantity'),
        before = prev?.lines.find(x => x.line_key === l.line_key),
        prevQ = before?.cumulative_quantity || '0';
      requireThat(cumulative.gte(prevQ) && cumulative.lte(l.quantity), `${l.code}: cumulative quantity must be between previous ${prevQ} and contracted ${l.quantity}.`);
      const total = payableRatio(cumulative.toString(), l.amount, l.quantity);
      return {
        ...l,
        previous_quantity: prevQ,
        cumulative_quantity: cumulative.toString(),
        current_quantity: cumulative.minus(prevQ).toString(),
        remaining_quantity: new D(l.quantity).minus(cumulative).toString(),
        previous_amount: before?.cumulative_amount || '0.00',
        cumulative_amount: total,
        current_amount: money(new D(total).minus(before?.cumulative_amount || 0))
      };
    });
    const cumulative = money(sum(lines.map(l => l.cumulative_amount))),
      previousGross = prev?.cumulative_gross || '0.00',
      gross = money(new D(cumulative).minus(previousGross));
    requireThat(new D(gross).gt(0), 'Record positive new measured work.');
    const retentionCumulative = money(min(new D(cumulative).times(c.terms.retention_percent).div(100).toDecimalPlaces(2), c.terms.retention_cap)),
      retention = money(new D(retentionCumulative).minus(prev?.cumulative_retention || 0));
    const advanceRecovery = recoveryQuote(db, c, s, end, gross, retention);
    const recovery = advanceRecovery?.principal || '0.00',
      net = money(new D(gross).minus(retention).minus(recovery)),
      taxBasis = s.tax_basis === 'gross' ? gross : s.recovery_tax_mode === 'original_tax' ? new D(gross).minus(retention) : net,
      workTax = money(new D(taxBasis).times(s.tax_percent).div(100)),
      tax = money(new D(workTax).minus(advanceRecovery?.tax || '0')),
      total = money(new D(net).plus(tax));
    requireThat(new D(total).gte(0), 'Recovery and tax cannot create a negative invoice; an authorised credit workflow is required.');
    const conversion = fx(c, input, end);
    return {
      policy: 'builder-certificate-v1',
      policy_id: p.id,
      policy_revision: p.revision,
      finance_policy: s,
      predecessor_id: previous?.id || null,
      contract_id: c.id,
      currency: c.currency,
      lines,
      cumulative_gross: cumulative,
      previous_gross: previousGross,
      gross,
      cumulative_retention: retentionCumulative,
      retention,
      recovery,
      eligible_advance: advanceRecovery?.eligible_principal || '0.00',
      net,
      tax,
      total,
      company_gross: money(new D(gross).times(conversion.rate)),
      company_authority: money(new D(gross).plus(workTax).times(conversion.rate)),
      ...conversion,
      ...(advanceRecovery ? { work_tax: workTax, recovered_tax: advanceRecovery.tax, advance_recovery: advanceRecovery } : {})
    };
  }
  function evidenceFile(id, input) {
    requireThat(typeof input.filename === 'string' && input.filename.length <= 140 && !/[\\/\x00-\x1f]/.test(input.filename) && /\.(pdf|png|jpe?g|txt)$/i.test(input.filename), 'Use a plain PDF, PNG, JPG or TXT filename.');
    requireThat(typeof input.base64 === 'string' && input.base64.length <= 2800000 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64), 'Use a valid evidence file up to 2 MiB.');
    const bytes = Buffer.from(input.base64, 'base64');
    requireThat(bytes.length > 0 && bytes.length <= 2 * 1024 * 1024, 'Use a non-empty evidence file up to 2 MiB.');
    const eid = uid('CFE');
    run('INSERT INTO client_measurement_evidence VALUES(?,?,?,?,?,?,?)', eid, id, input.filename, createHash('sha256').update(bytes).digest('hex'), bytes, actorId, now());
    return eid;
  }
  function save(id, input) {
    return transaction(db, () => {
      const old = id ? row(id) : null,
        c = contractData(old?.contract_id || input.contract_id);
      access.requireCap('certificates.write', c.company_id, c.project_id);
      if (old) {
        version(old, input.version);
        requireThat(old.author_id === actorId && ['draft', 'returned'].includes(old.state), 'Only the author can revise a draft or returned measurement.', 403);
      } else requireThat(!get("SELECT id FROM client_certificates WHERE contract_id=? AND state NOT IN ('approved','cancelled')", c.id), 'Finish or cancel the existing measurement before starting another.', 409);
      const s = measurement(c, input),
        title = text(input.title, 'Certificate title', 200),
        basis = text(input.basis, 'Measurement basis');
      id = old?.id || uid('CER');
      const lines = JSON.stringify(s.lines.map(l => ({
        line_key: l.line_key,
        cumulative_quantity: l.cumulative_quantity
      })));
      if (old) run("UPDATE client_certificates SET title=?,period_from=?,period_to=?,rate=?,rate_date=?,rate_source=?,basis=?,lines_json=?,policy_id=?,predecessor_id=?,snapshot=?,state='draft',technical_by=NULL,commercial_by=NULL,finance_by=NULL,version=version+1 WHERE id=?", title, input.period_from, input.period_to, s.rate, s.rate_date, s.rate_source, basis, lines, s.policy_id, s.predecessor_id, JSON.stringify(s), id);else run("INSERT INTO client_certificates(id,contract_id,company_id,project_id,title,period_from,period_to,currency,rate,rate_date,rate_source,basis,lines_json,policy_id,predecessor_id,snapshot,author_id,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?)", id, c.id, c.company_id, c.project_id, title, input.period_from, input.period_to, c.currency, s.rate, s.rate_date, s.rate_source, basis, lines, s.policy_id, s.predecessor_id, JSON.stringify(s), actorId, now());
      if (input.base64) run('UPDATE client_certificates SET evidence_id=? WHERE id=?', evidenceFile(id, input), id);
      event('certificate', row(id), old ? 'Measurement revised' : 'Measurement prepared', input.reason);
      return detail(id);
    });
  }
  const stageCap = {
    technical: 'certificates.technical',
    commercial: 'certificates.commercial',
    finance: 'certificates.finance'
  };
  function mayReview(r, who = actorId) {
    const s = JSON.parse(r.snapshot);
    return !!stageCap[r.state] && ![r.author_id, r.technical_by, r.commercial_by].includes(who) && authority(who, stageCap[r.state], r, r.state === 'technical' ? null : 'certificate_approval_limit', s.company_authority);
  }
  function validateMeasurement(r) {
    const c = contractData(r.contract_id),
      s = measurement(c, {
        ...r,
        lines: JSON.parse(r.lines_json)
      });
    requireThat(JSON.stringify(s) === r.snapshot, 'Measurement basis, preceding certificate or policy changed. Return and revise this certificate.', 409);
    requireThat(r.evidence_id && get('SELECT id FROM client_measurement_evidence WHERE id=? AND certificate_id=?', r.evidence_id, r.id), 'Attach the measurement evidence before submitting.');
    requireThat(authority(r.author_id, 'certificates.write', r), 'The measurement author no longer has current access.', 409);
    for (const [who, cap, column] of [[r.technical_by, 'certificates.technical', null], [r.commercial_by, 'certificates.commercial', 'certificate_approval_limit']]) if (who) requireThat(authority(who, cap, r, column, s.company_authority), 'An earlier reviewer no longer has current authority. Return for a new review cycle.', 409);
    return s;
  }
  function decide(id, input) {
    return transaction(db, () => {
      const r = row(id);
      version(r, input.version);
      let state;
      if (input.action === 'cancel') {
        requireThat(r.author_id === actorId && can('certificates.write', r) && !['approved', 'cancelled'].includes(r.state), 'Only the author can cancel unapproved work.', 403);
        state = 'cancelled';
      } else if (input.action === 'submit') {
        requireThat(r.state === 'draft' && r.author_id === actorId && can('certificates.write', r), 'Only the author can submit a draft measurement.', 403);
        validateMeasurement(r);
        state = 'technical';
      } else {
        requireThat(mayReview(r), 'A different authorised reviewer must complete this stage.', 403);
        requireThat(['accept', 'return'].includes(input.action), 'Choose accept or return.');
        state = input.action === 'return' ? 'returned' : {
          technical: 'commercial',
          commercial: 'finance',
          finance: 'approved'
        }[r.state];
        if (input.action === 'accept') {
          const s = validateMeasurement(r);
          if (state === 'approved') {
            for (const l of s.lines) run('INSERT INTO client_certificate_lines VALUES(?,?,?,?,?,?,?,?,?)', id, l.line_key, l.previous_quantity, l.cumulative_quantity, l.current_quantity, l.remaining_quantity, l.cumulative_amount, l.current_amount, JSON.stringify(l));
            freezeRecoveries(db, r, s.advance_recovery, actorId, now());
          }
        }
      }
      const fields = state === 'commercial' ? ['technical_by', actorId] : state === 'finance' ? ['commercial_by', actorId] : state === 'approved' ? ['finance_by', actorId] : null;
      if (fields) run(`UPDATE client_certificates SET ${fields[0]}=? WHERE id=?`, fields[1], id);
      run('UPDATE client_certificates SET state=?,cycle=cycle+?,approved_at=?,version=version+1 WHERE id=?', state, input.action === 'submit' ? 1 : 0, state === 'approved' ? now() : null, id);
      event('certificate', row(id), `${CERTIFICATE_STATES[r.state]} → ${CERTIFICATE_STATES[state]}`, input.reason);
      return detail(id);
    });
  }
  function summary(r) {
    const s = JSON.parse(r.snapshot),
      inv = get('SELECT id,state,total,company_total,journal_id FROM client_invoices WHERE certificate_id=?', r.id);
    return {
      id: r.id,
      contract_id: r.contract_id,
      company_id: r.company_id,
      project_id: r.project_id,
      title: r.title,
      state: r.state,
      state_label: CERTIFICATE_STATES[r.state],
      period_from: r.period_from,
      period_to: r.period_to,
      currency: r.currency,
      version: r.version,
      cycle: r.cycle,
      gross: s.gross,
      retention: s.retention,
      recovery: s.recovery,
      tax: s.tax,
      work_tax: s.work_tax ?? s.tax,
      recovered_tax: s.recovered_tax || '0.00',
      total: s.total,
      company_gross: s.company_gross,
      company_authority: s.company_authority,
      can_review: mayReview(r),
      my_draft: r.author_id === actorId && can('certificates.write', r) && ['draft', 'returned'].includes(r.state),
      invoice: inv ? {
        ...inv,
        can_open: can('ar.read', r)
      } : null,
      next_action: r.state === 'approved' ? inv ? inv.state === 'posted' ? 'Invoice posted; customer settlement is separate' : inv.state === 'submitted' ? 'AR reviewer to post invoice' : 'AR preparer to finish invoice' : 'Prepare the client invoice' : {
        draft: 'Complete evidence and submit',
        technical: 'Project manager to review',
        commercial: 'Commercial manager to review',
        finance: 'Finance controller to approve',
        returned: 'Author to correct and resubmit',
        cancelled: 'Cancelled; retained for history'
      }[r.state]
    };
  }
  function list(company, project = null) {
    scoped(company, project);
    return all('SELECT * FROM client_certificates WHERE company_id=? ORDER BY created_at DESC,id', company).filter(r => (!project || r.project_id === project) && can('certificates.read', r)).map(summary);
  }
  function detail(id) {
    const r = row(id),
      s = summary(r);
    return {
      ...r,
      ...s,
      lines: JSON.parse(r.lines_json),
      snapshot: JSON.parse(r.snapshot),
      contract: contractData(r.contract_id),
      evidence: all('SELECT id,filename,sha256,length(bytes) size,actor_id,created_at FROM client_measurement_evidence WHERE certificate_id=? ORDER BY created_at,id', id),
      history: history('certificate', id),
      can_edit: s.my_draft,
      can_submit: r.author_id === actorId && r.state === 'draft' && can('certificates.write', r),
      can_cancel: r.author_id === actorId && can('certificates.write', r) && !['approved', 'cancelled'].includes(r.state),
      can_invoice: r.state === 'approved' && !s.invoice && can('ar.write', r),
      can_open_offer: can('sales.read', r),
      findings: [`${r.currency} ${s.gross} new measured work; ${s.retention} retained; ${s.recovery} advance principal deducted.`, `${r.currency} ${s.work_tax} work tax less ${s.recovered_tax} original advance tax gives ${s.tax} net tax; certificate amount ${s.total}.`, r.state === 'approved' ? 'Quantities and deductions are frozen. Accounting and payment remain separate.' : 'This measurement is not yet certified or posted.', `Advance eligible in this measurement basis: ${r.currency} ${JSON.parse(r.snapshot).eligible_advance}. The allowance of ${contractData(r.contract_id).terms.advance_ceiling} does not establish cash received; current paid principal is shown on the contract.`]
    };
  }
  function contract(id) {
    const c = contractData(id),
      p = activePolicy(id),
      previous = prior(id),
      policies = all('SELECT * FROM contract_finance_policies WHERE contract_id=? ORDER BY revision DESC', id).map(r => ({
        ...r,
        snapshot: JSON.parse(r.snapshot),
        history: history('policy', r.id),
        can_edit: can('contracts.configure', r) && r.author_id === actorId && ['draft', 'returned'].includes(r.state),
        can_submit: can('contracts.configure', r) && r.author_id === actorId && r.state === 'draft',
        can_cancel: can('contracts.configure', r) && r.author_id === actorId && ['draft', 'submitted', 'returned'].includes(r.state),
        can_review: r.state === 'submitted' && r.author_id !== actorId && authority(actorId, 'contracts.configure', r, 'certificate_approval_limit', c.company_value)
      }));
    let readiness = p ? 'Ready for measurement' : 'Finance configuration required';
    if (p) try {
      currentPolicy(p);
    } catch (e) {
      readiness = e.message;
    }
    const advancePosition = contractAdvancePosition(db, id, today());
    return {
      ...c,
      policies,
      active_policy_id: p?.id || null,
      readiness,
      can_configure: can('contracts.configure', c),
      can_measure: can('certificates.write', c),
      paid_advance_principal: advancePosition.paid_principal,
      advance_position: advancePosition,
      can_open_offer: can('sales.read', c),
      previous: previous ? summary(previous) : null,
      previous_lines: previous ? JSON.parse(previous.snapshot).lines : [],
      certificates: all('SELECT * FROM client_certificates WHERE contract_id=? ORDER BY period_to DESC,created_at DESC', id).map(summary)
    };
  }
  function options(company, project = null) {
    scoped(company, project);
    return {
      company: get('SELECT * FROM companies WHERE id=?', company),
      contracts: all('SELECT id,company_id,project_id FROM client_contracts WHERE company_id=?', company).filter(r => (!project || r.project_id === project) && can('certificates.read', r)).map(r => {
        const c = contractData(r.id);
        return {
          id: c.id,
          title: c.title,
          project_id: c.project_id,
          project: c.project,
          currency: c.currency,
          original_value: c.original_value,
          finance_ready: !!activePolicy(c.id)
        };
      }),
      projects: all('SELECT id,name,company_id FROM projects WHERE company_id=?', company).filter(p => can('certificates.read', {
        ...p,
        project_id: p.id
      })),
      accounts: access.has('contracts.configure', company, project, !project) ? all('SELECT * FROM ledger_accounts WHERE company_id=? AND active=1 ORDER BY code', company) : [],
      can_write: access.has('certificates.write', company, project, !project),
      can_ar: access.has('ar.read', company, project, !project)
    };
  }
  function download(id) {
    const e = get('SELECT * FROM client_measurement_evidence WHERE id=?', id);
    requireThat(e, 'Evidence is unavailable.', 404);
    row(e.certificate_id);
    return e;
  }
  function invoiceCalc(cert, input) {
    const c = contractData(cert.contract_id),
      s = JSON.parse(cert.snapshot),
      date = day(input.invoice_date),
      accounting = day(input.accounting_date),
      due = day(input.due_date);
    requireThat(date >= cert.period_to && date <= today() && accounting >= date && accounting <= today() && due >= date, 'Invoice/accounting dates must follow the measured period and not be future; due date cannot precede invoice.');
    const conversion = fx(c, input, accounting),
      accounts = s.finance_policy.accounts;
    for (const a of Object.values(accounts).filter(Boolean)) {
      const current = get('SELECT * FROM ledger_accounts WHERE id=? AND company_id=?', a.id, c.company_id);
      requireThat(current?.active && current.type === a.type && current.purpose === a.purpose, 'A certified accounting account is inactive or changed; resolve before invoicing.');
    }
    const recoveries = certifiedRecoveries(db, cert, s);
    for (const allocation of recoveries) for (const a of Object.values(allocation.accounts).filter(Boolean)) {
      const current = get('SELECT * FROM ledger_accounts WHERE id=? AND company_id=?', a.id, c.company_id);
      requireThat(current?.active && current.type === a.type && current.purpose === a.purpose, 'An original advance account is inactive or changed; resolve before invoicing.');
    }
    const workTax = s.work_tax ?? s.tax;
    const lines = [{
      account: accounts.receivable,
      debit: s.total,
      credit: '0.00',
      description: 'Certified client receivable'
    }, {
      account: accounts.retention,
      debit: s.retention,
      credit: '0.00',
      description: 'Contract retention held'
    }, {
      account: accounts.revenue,
      debit: '0.00',
      credit: s.gross,
      description: 'Certified measured work'
    }, ...(new D(workTax).gt(0) ? [{
      account: accounts.tax,
      debit: '0.00',
      credit: workTax,
      description: 'Exclusive output tax'
    }] : []), ...recoveries.flatMap(a => [{ account: a.accounts.advance, debit: a.principal, credit: '0.00', description: `Advance principal recovered · ${a.invoice_id}`, carrying: a.base_principal, recovery_kind: 'principal', source_invoice: a.invoice_id }, ...(new D(a.tax).gt(0) ? [{ account: a.accounts.tax, debit: a.tax, credit: '0.00', description: `Original advance tax released · ${a.invoice_id}`, carrying: a.base_tax, recovery_kind: 'tax', source_invoice: a.invoice_id }] : [])])].filter(l => new D(l.debit).gt(0) || new D(l.credit).gt(0));
    const converted = convertJournal(lines.map(l => ({
        ...l,
        account_id: l.account.id
      })), conversion.rate, { maxLines: 5000, allowZeroBase: recoveries.length > 0 }),
      journal = converted.lines.map((l, i) => ({
        ...l,
        account_code: lines[i].account.code,
        account_name: lines[i].account.name,
        account_type: lines[i].account.type
      }));
    const revenue = journal.find(l => l.account_id === accounts.revenue.id);
    for (const [i, original] of lines.entries()) if (original.recovery_kind) {
      const line = journal[i], difference = new D(original.carrying).minus(line.base_debit);
      line.base_debit = original.carrying;
      line.rounding_adjustment = '0.00';
      line.recovery_source = original.source_invoice;
      line.carrying_basis = 'Original advance invoice';
      if (original.recovery_kind === 'principal') revenue.base_credit = money(new D(revenue.base_credit).plus(difference));
    }
    const difference = sum(journal.map(l => l.base_debit)).minus(sum(journal.map(l => l.base_credit)));
    if (!difference.isZero()) {
      const a = difference.gt(0) ? accounts.fx_gain : accounts.fx_loss;
      requireThat(a, 'An explicit exchange account is required for the original advance-tax carrying difference.');
      journal.push({ account_id: a.id, account_code: a.code, account_name: a.name, account_type: a.type, description: 'Advance tax carrying exchange difference', debit: '0.00', credit: '0.00', base_debit: difference.gt(0) ? '0.00' : money(difference.abs()), base_credit: difference.gt(0) ? money(difference) : '0.00', rounding_adjustment: '0.00' });
    }
    requireThat(journal.every(l => new D(l.base_debit).gte(0) && new D(l.base_credit).gte(0)) && sum(journal.map(l => l.base_debit)).cmp(sum(journal.map(l => l.base_credit))) === 0, 'Recovered invoice accounting must remain non-negative and balanced.');
    return {
      snapshot: {
        certificate: s,
        certificate_id: cert.id,
        contract: c,
        accounts,
        policy: 'builder-client-invoice-v1'
      },
      journal,
      total: s.total,
      company_total: journal.find(l => l.account_id === accounts.receivable.id)?.base_debit || '0.00',
      company_retention: journal.find(l => l.account_id === accounts.retention.id)?.base_debit || '0.00',
      company_gross: money(sum(journal.map(l => l.base_debit))),
      ...conversion
    };
  }
  function invoiceSource(input) {
    requireThat(!(input.advance_id && input.certificate_id), 'Choose one invoice source: certificate or advance.');
    if (!input.advance_id) return row(input.certificate_id);
    const r = get('SELECT * FROM client_advances WHERE id=?', input.advance_id);
    requireThat(r && can('ar.read', r), 'Approved advance is unavailable.', 404);
    return r;
  }
  const calculateInvoice = (source, input) => input.advance_id ? advanceInvoiceCalculation(db, source, input, today) : invoiceCalc(source, input);
  function saveInvoice(id, input) {
    return transaction(db, () => {
      const old = id ? invoiceRow(id) : null,
        sourceInput = old ? { ...input, advance_id: old.advance_id, certificate_id: old.certificate_id } : input,
        cert = invoiceSource(sourceInput);
      access.requireCap('ar.write', cert.company_id, cert.project_id);
      requireThat(cert.state === 'approved', 'Only an approved certificate or advance can be invoiced.');
      if (!old) {
        const existing = sourceInput.advance_id ? get('SELECT id FROM client_invoices WHERE advance_id=?', cert.id) : get('SELECT id FROM client_invoices WHERE certificate_id=?', cert.id);
        if (existing) return invoice(existing.id);
      } else {
        version(old, input.version);
        requireThat(old.author_id === actorId && ['draft', 'returned'].includes(old.state), 'Only the invoice author may revise unsubmitted accounting details.', 403);
      }
      const s = calculateInvoice(cert, sourceInput),
        title = text(input.title || cert.title, 'Invoice title', 200),
        basis = text(input.basis, 'Invoice accounting basis');
      id = old?.id || uid('CIN');
      const c = contractData(cert.contract_id);
      if (old) run("UPDATE client_invoices SET title=?,invoice_date=?,accounting_date=?,due_date=?,rate=?,rate_date=?,rate_source=?,basis=?,snapshot=?,journal_json=?,total=?,company_total=?,company_gross=?,company_retention=?,state='draft',version=version+1 WHERE id=?", title, input.invoice_date, input.accounting_date, input.due_date, s.rate, s.rate_date, s.rate_source, basis, JSON.stringify(s.snapshot), JSON.stringify(s.journal), s.total, s.company_total, s.company_gross, s.company_retention, id);else run("INSERT INTO client_invoices(id,certificate_id,advance_id,contract_id,company_id,project_id,customer_id,title,invoice_date,accounting_date,due_date,currency,rate,rate_date,rate_source,basis,snapshot,journal_json,total,company_total,company_gross,company_retention,author_id,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?)", id, sourceInput.advance_id ? null : cert.id, sourceInput.advance_id || null, c.id, c.company_id, c.project_id, c.customer_id, title, input.invoice_date, input.accounting_date, input.due_date, c.currency, s.rate, s.rate_date, s.rate_source, basis, JSON.stringify(s.snapshot), JSON.stringify(s.journal), s.total, s.company_total, s.company_gross, s.company_retention, actorId, now());
      event('invoice', invoiceRow(id), old ? 'Invoice revised' : sourceInput.advance_id ? 'Invoice prepared from approved advance' : 'Invoice prepared from certified work', input.reason);
      return invoice(id);
    });
  }
  const invoiceReview = r => r.state === 'submitted' && r.author_id !== actorId && authority(actorId, 'ar.post', r, 'ar_approval_limit', r.company_gross);
  function post(r) {
    const cert = invoiceSource(r),
      calc = calculateInvoice(cert, r);
    requireThat(JSON.stringify(calc.journal) === r.journal_json && calc.company_total === r.company_total && JSON.stringify(calc.snapshot) === r.snapshot, 'The accounting basis changed; return and revise the invoice.', 409);
    requireThat(authority(r.author_id, 'ar.write', r), 'The invoice author no longer has current authority.', 409);
    const period = get("SELECT * FROM ledger_periods WHERE company_id=? AND state='open' AND start_date<=? AND end_date>=?", r.company_id, r.accounting_date, r.accounting_date);
    requireThat(period, 'The accounting date needs an open company period.');
    const id = uid('JRN'),
      year = r.accounting_date.slice(0, 4);
    run('INSERT OR IGNORE INTO ledger_sequences VALUES(?,?,1)', r.company_id, year);
    const n = get('SELECT next_number FROM ledger_sequences WHERE company_id=? AND year=?', r.company_id, year).next_number;
    run('UPDATE ledger_sequences SET next_number=next_number+1 WHERE company_id=? AND year=?', r.company_id, year);
    const total = money(sum(calc.journal.map(l => l.debit))),
      number = `GL/${year}/${String(n).padStart(6, '0')}`;
    run("INSERT INTO ledger_entries(id,company_id,project_id,title,accounting_date,currency,rate,rate_date,rate_source,source_reference,explanation,lines_json,total,company_total,author_id,state,created_at,source_type,source_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'submitted',?,'client_invoice',?)", id, r.company_id, r.project_id, r.title, r.accounting_date, r.currency, r.rate, r.rate_date, r.rate_source, r.id, r.basis, r.journal_json, total, r.company_gross, r.author_id, now(), r.id);
    calc.journal.forEach((l, i) => run('INSERT INTO ledger_lines(id,entry_id,company_id,project_id,account_id,ordinal,account_code,account_name,account_type,description,debit,credit,base_debit,base_credit,rounding_adjustment) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', `${id}-${i + 1}`, id, r.company_id, r.project_id, l.account_id, i + 1, l.account_code, l.account_name, l.account_type, l.description, l.debit, l.credit, l.base_debit, l.base_credit, l.rounding_adjustment));
    run("UPDATE ledger_entries SET state='posted',number=?,period_id=?,posted_by=?,posted_at=?,version=version+1 WHERE id=?", number, period.id, actorId, now(), id);
    run('INSERT INTO ledger_events(entity_type,entity_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?,?)', 'journal', id, r.company_id, r.project_id, actorId, 'Client invoice posted', `Typed ${r.advance_id ? 'advance' : 'certified'} invoice ${r.id}; independent AR authority`, JSON.stringify(get('SELECT * FROM ledger_entries WHERE id=?', id)), now());
    run("UPDATE client_invoices SET state='posted',journal_id=?,posted_by=?,posted_at=?,version=version+1 WHERE id=?", id, actorId, now(), r.id);
  }
  function decideInvoice(id, input) {
    return transaction(db, () => {
      const r = invoiceRow(id);
      if (r.state === 'posted' && input.action === 'post' && r.posted_by === actorId && authority(actorId, 'ar.post', r, 'ar_approval_limit', r.company_gross)) return invoice(id);
      version(r, input.version);
      if (input.action === 'submit') {
        requireThat(r.author_id === actorId && r.state === 'draft' && can('ar.write', r), 'Only the author can submit a draft invoice.', 403);
        calculateInvoice(invoiceSource(r), r);
        run("UPDATE client_invoices SET state='submitted',version=version+1 WHERE id=?", id);
      } else {
        requireThat(invoiceReview(r), 'Independent AR posting authority is required.', 403);
        requireThat(['return', 'post'].includes(input.action), 'Choose return or post.');
        if (input.action === 'post') post(r);else run("UPDATE client_invoices SET state='returned',version=version+1 WHERE id=?", id);
      }
      event('invoice', invoiceRow(id), `Invoice ${input.action}`, input.reason);
      return invoice(id);
    });
  }
  function invoice(id) {
    const r = invoiceRow(id),
      s = JSON.parse(r.snapshot);
    return {
      ...r,
      snapshot: s,
      journal: JSON.parse(r.journal_json),
      history: history('invoice', id),
      can_edit: r.author_id === actorId && ['draft', 'returned'].includes(r.state) && can('ar.write', r),
      can_submit: r.author_id === actorId && r.state === 'draft' && can('ar.write', r),
      can_review: invoiceReview(r),
      can_open_journal: can('finance.read', r),
      settlement: r.state==='posted'&&access.has('customer_receipts.read',r.company_id,r.project_id)?receivableBalance(db,r):null,
      can_prepare_receipt: r.state==='posted'&&access.has('customer_receipts.write',r.company_id,r.project_id)&&new D(receivableBalance(db,r).open).gt(0),
      findings: [r.advance_id ? `${r.currency} ${s.advance.principal} advance principal plus ${s.advance.tax} explicit tax gives ${r.total} receivable. Advance principal credits its liability control; no measured revenue or retention is created.` : `${r.currency} ${s.certificate.gross} measured work less ${s.certificate.retention} retention and ${s.certificate.recovery} advance principal, plus ${s.certificate.tax} net tax gives ${r.total} client receivable.`, r.state === 'posted' ? `${get('SELECT currency FROM companies WHERE id=?', r.company_id).currency} ${r.company_total} posted to AR; ${r.company_retention} posted to retention.` : 'This invoice is not posted and does not yet affect the ledger.', 'No customer receipt or clearance is implied.']
    };
  }
  function invoiceList(company, project = null) {
    scoped(company, project, 'ar.read');
    return all('SELECT * FROM client_invoices WHERE company_id=? ORDER BY created_at DESC', company).filter(r => (!project || r.project_id === project) && can('ar.read', r)).map(r => ({
      id: r.id,
      title: r.title,
      advance_id: r.advance_id,
      certificate_id: r.certificate_id,
      company_id: r.company_id,
      project_id: r.project_id,
      state: r.state,
      state_label: r.state === 'submitted' ? 'Independent AR review' : r.state,
      currency: r.currency,
      total: r.total,
      company_total: r.company_total,
      can_review: invoiceReview(r),
      my_draft: r.author_id === actorId && ['draft', 'returned'].includes(r.state) && can('ar.write', r)
    }));
  }
  function report(company, {
    project = null,
    state = 'all',
    from = null,
    to = null
  } = {}) {
    scoped(company, project);
    requireThat(state === 'all' || Object.hasOwn(CERTIFICATE_STATES, state), 'Unknown certificate status.');
    if (from) day(from);
    if (to) day(to);
    requireThat(!from || !to || from <= to, 'Report dates are reversed.');
    const rows = list(company, project).filter(r => (state === 'all' || r.state === state) && (!from || r.period_to >= from) && (!to || r.period_to <= to));
    const invoices = access.has('ar.read', company, project, !project) ? all('SELECT * FROM client_invoices WHERE company_id=? AND certificate_id IS NOT NULL', company).filter(r => (!project || r.project_id === project) && can('ar.read', r) && (!from || r.accounting_date >= from) && (!to || r.accounting_date <= to)).map(r => ({
      id: r.id,
      title: r.title,
      certificate_id: r.certificate_id,
      contract_id: r.contract_id,
      project_id: r.project_id,
      state: r.state,
      accounting_date: r.accounting_date,
      due_date: r.due_date,
      currency: r.currency,
      total: r.total,
      company_total: r.company_total,
      company_retention: r.company_retention,
      journal_id: r.journal_id
    })) : [];
    const posted = invoices.filter(r => r.state === 'posted'),
      currencies = [...new Set(rows.map(r => r.currency))].sort().map(currency => {
        const group = rows.filter(r => r.currency === currency),
          approved = group.filter(r => r.state === 'approved');
        return {
          currency,
          certified_gross: money(sum(approved.map(r => r.gross))),
          retained: money(sum(approved.map(r => r.retention))),
          certified_recovery: money(sum(approved.map(r => r.recovery))),
          recovered_tax: money(sum(approved.map(r => r.recovered_tax))),
          certified_due: money(sum(approved.map(r => r.total))),
          awaiting_posted_invoice: money(sum(approved.filter(r => r.invoice?.state !== 'posted').map(r => r.total))),
          pending_gross: money(sum(group.filter(r => !['approved', 'cancelled'].includes(r.state)).map(r => r.gross)))
        };
      });
    let ar = new D(0),
      retention = new D(0), recovery = new D(0), expectedRecovery = new D(0);
    for (const r of posted) {
      const snap = JSON.parse(get('SELECT snapshot FROM client_invoices WHERE id=?', r.id).snapshot);
      const allocations = snap.certificate.advance_recovery?.allocations || [];
      expectedRecovery = expectedRecovery.plus(sum(allocations.map(a => a.base_principal)));
      const advanceAccounts = new Set(allocations.map(a => a.accounts.advance.id));
      for (const l of all('SELECT * FROM ledger_lines WHERE entry_id=?', r.journal_id)) {
        if (advanceAccounts.has(l.account_id)) recovery = recovery.plus(new D(l.base_debit).minus(l.base_credit));
        if (l.account_id === snap.accounts.receivable.id) ar = ar.plus(new D(l.base_debit).minus(l.base_credit));
        if (l.account_id === snap.accounts.retention.id) retention = retention.plus(new D(l.base_debit).minus(l.base_credit));
      }
    }
    const totals = {
      posted_receivable: money(sum(posted.map(r => r.company_total))),
      posted_retention: money(sum(posted.map(r => r.company_retention))),
      ledger_receivable: money(ar),
      ledger_retention: money(retention),
      posted_recovery: money(expectedRecovery),
      ledger_recovery: money(recovery),
      recovery_difference: money(expectedRecovery.minus(recovery))
    };
    totals.receivable_difference = money(new D(totals.posted_receivable).minus(ar));
    totals.retention_difference = money(new D(totals.posted_retention).minus(retention));
    const currency = get('SELECT currency FROM companies WHERE id=?', company).currency,
      canAr = access.has('ar.read', company, project, !project);
    return {
      company_id: company,
      project_id: project,
      company_currency: currency,
      filters: {
        state,
        from,
        to
      },
      as_of: today(),
      rows,
      invoices,
      currencies,
      totals: canAr ? totals : null,
      findings: [`${rows.length} measurements match the period-end and status filters; ${rows.filter(r => r.state === 'approved').length} are certified.`, ...currencies.map(g => `${g.currency} ${g.certified_gross} certified gross; ${g.retained} held as retention; ${g.certified_recovery} advance principal and ${g.recovered_tax} original advance tax deducted; ${g.pending_gross} still awaiting certification; ${g.awaiting_posted_invoice} certified due has no posted invoice.`), ...(canAr ? [`${posted.length} posted invoices match the accounting-date filters: ${currency} ${totals.posted_receivable} receivable and ${totals.posted_retention} retention; ${totals.posted_recovery} advance liability cleared at original carrying value.`, `Selected invoice-to-ledger differences: AR ${totals.receivable_difference}; retention ${totals.retention_difference}; advance recovery ${totals.recovery_difference}.`] : []), 'Certificate status filters apply to measurements. Invoice figures use accounting dates independently; they are posted charges, not receipts or cleared cash.']
    };
  }
  return {
    options,
    contract,
    savePolicy,
    decidePolicy,
    save,
    decide,
    detail,
    list,
    download,
    saveInvoice,
    decideInvoice,
    invoice,
    invoiceList,
    report
  };
}
