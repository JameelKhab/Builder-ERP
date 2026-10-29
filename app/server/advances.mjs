import { randomUUID, createHash } from 'node:crypto';
import { transaction } from './db.mjs';
import { policy } from './access.mjs';
import { ROLE_BY_ID } from '../shared/access.mjs';
import { D, decimal, money, sum, requireThat } from './money.mjs';
import { convertJournal } from './ledger.mjs';
import { receivableBalance } from './receivable-balance.mjs';
import { payableRatio } from './payables.mjs';

const uid = p => `${p}-${randomUUID().slice(0, 8).toUpperCase()}`;
const now = () => new Date().toISOString();
const text = (value, name, max = 2000) => {
  requireThat(typeof value === 'string' && value.trim() && value.length <= max, `${name} is required (maximum ${max} characters).`);
  return value.trim();
};
const day = value => {
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Enter a valid calendar date.');
  return value;
};
const positiveMoney = value => {
  const n = decimal(value, 'Advance principal', false);
  requireThat(n.cmp(money(n)) === 0, 'Advance principal needs at most two decimals.');
  return money(n);
};
const get = (db, sql, ...v) => db.prepare(sql).get(...v);
const all = (db, sql, ...v) => db.prepare(sql).all(...v);

export function advanceAuthority(db, who, cap, r, column = null, amount = null) {
  try {
    const access = policy(db, who);
    access.actor();
    return access.has(cap, r.company_id, r.project_id) && (!column || access.matching(r.company_id, r.project_id).some(g => ROLE_BY_ID[g.role_id]?.capabilities.includes(cap) && new D(g[column] || 0).gt(0) && new D(g[column] || 0).gte(amount)));
  } catch { return false; }
}

function contractData(db, id) {
  const c = get(db, 'SELECT * FROM client_contracts WHERE id=?', id);
  requireThat(c, 'Client contract is unavailable.', 404);
  const s = JSON.parse(c.snapshot), terms = s.offer;
  return { ...c, snapshot: undefined, title: terms.title, customer: s.customer.name || s.customer.party?.name || 'Client', project: get(db, 'SELECT name FROM projects WHERE id=?', c.project_id).name, company_currency: get(db, 'SELECT currency FROM companies WHERE id=?', c.company_id).currency, terms: { advance_ceiling: terms.advance_ceiling, recovery_percent: terms.recovery_percent, payment_days: terms.payment_days } };
}

function conversion(c, input, date, today) {
  const rate = decimal(input.rate, 'Exchange rate', false).toString();
  const rate_date = day(input.rate_date), rate_source = text(input.rate_source, 'FX evidence', 300);
  requireThat(rate_date <= date && rate_date <= today(), 'FX date cannot follow the document date or today.');
  requireThat(c.currency !== c.company_currency || new D(rate).cmp(1) === 0, 'Same-currency documents use rate 1.');
  return { rate, rate_date, rate_source };
}

function account(db, id, company, type, purpose) {
  const a = get(db, 'SELECT * FROM ledger_accounts WHERE id=? AND company_id=?', id, company);
  requireThat(a?.active && a.type === type && a.purpose === purpose, `Choose an active ${type} / ${purpose} account in this company.`);
  return a;
}

function requestCalculation(db, c, input, today) {
  const p = get(db, "SELECT * FROM contract_finance_policies WHERE contract_id=? AND state='active'", c.id);
  requireThat(p, 'Activate the contract finance policy before requesting an advance.');
  const ps = JSON.parse(p.snapshot);
  requireThat(advanceAuthority(db, p.approved_by, 'contracts.configure', p, 'certificate_approval_limit', c.company_value), 'The finance policy reviewer no longer has sufficient authority.', 409);
  for (const a of Object.values(ps.accounts).filter(Boolean)) requireThat(JSON.stringify(get(db, 'SELECT * FROM ledger_accounts WHERE id=?', a.id)) === JSON.stringify(a) && a.active, 'A finance policy account changed; review a new policy.', 409);
  const date = day(input.request_date), principal = positiveMoney(input.principal), taxPercent = decimal(input.tax_percent, 'Advance tax percentage');
  requireThat(date <= today(), 'Advance request date cannot be future.');
  requireThat(new D(principal).lte(c.terms.advance_ceiling), 'Advance principal exceeds the original contract ceiling.');
  requireThat(taxPercent.lte(100), 'Advance tax percentage cannot exceed 100.');
  const tax = money(new D(principal).times(taxPercent).div(100)), total = money(new D(principal).plus(tax));
  const fx = conversion(c, input, date, today), companyTotal = money(new D(total).times(fx.rate));
  requireThat(new D(companyTotal).gt(0), 'Advance rounds to zero in company currency.');
  const accounts = {
    receivable: ps.accounts.receivable,
    advance: account(db, input.advance_account, c.company_id, 'liability', 'client_advance'),
    tax: taxPercent.gt(0) ? account(db, input.tax_account, c.company_id, 'liability', 'tax') : null
  };
  return { policy: 'builder-client-advance-v1', policy_id: p.id, policy_revision: p.revision, contract: c, accounts, principal, tax_percent: taxPercent.toString(), tax, total, company_total: companyTotal, ...fx };
}

// Internal accounting helper. Public callers must authorise the request/invoice scope first.
export function advanceInvoiceCalculation(db, r, input, today) {
  requireThat(r?.state === 'approved', 'Only an independently approved advance can be invoiced.');
  const s = JSON.parse(r.snapshot), c = s.contract;
  requireThat(advanceAuthority(db, r.author_id, 'advances.write', r), 'Advance author no longer has current scope.', 409);
  requireThat(advanceAuthority(db, r.approved_by, 'advances.approve', r, 'advance_approval_limit', r.company_total), 'Advance approver no longer has sufficient authority.', 409);
  const date = day(input.invoice_date), accounting = day(input.accounting_date), due = day(input.due_date);
  requireThat(date >= r.request_date && date <= today() && accounting >= date && accounting <= today() && due >= date, 'Invoice/accounting dates must follow the advance request and not be future; due date cannot precede invoice.');
  for (const a of Object.values(s.accounts).filter(Boolean)) requireThat(JSON.stringify(get(db, 'SELECT * FROM ledger_accounts WHERE id=?', a.id)) === JSON.stringify(a) && a.active, 'An approved advance account changed; resolve its accounting policy before invoicing.', 409);
  const fx = conversion(c, input, accounting, today);
  const lines = [
    { account: s.accounts.receivable, debit: r.total, credit: '0.00', description: 'Client advance receivable' },
    { account: s.accounts.advance, debit: '0.00', credit: r.principal, description: 'Client advance liability; not earned revenue' },
    ...(new D(r.tax).gt(0) ? [{ account: s.accounts.tax, debit: '0.00', credit: r.tax, description: 'Explicit exclusive tax on client advance' }] : [])
  ];
  const converted = convertJournal(lines.map(l => ({ ...l, account_id: l.account.id })), fx.rate);
  const journal = converted.lines.map((l, i) => ({ ...l, account_code: lines[i].account.code, account_name: lines[i].account.name, account_type: lines[i].account.type }));
  return { snapshot: { policy: 'builder-client-advance-invoice-v1', advance_id: r.id, advance: s, contract: c, accounts: s.accounts }, journal, total: r.total, company_total: journal.find(l => l.account_id === s.accounts.receivable.id).base_debit, company_gross: converted.company_total, company_retention: '0.00', ...fx };
}

// Paid principal is a fact, not permission to recover it: recovery reservations follow separately.
export function advanceSettlement(db, invoice, cutoff = '9999-12-31') {
  requireThat(invoice.advance_id && invoice.state === 'posted', 'A posted advance invoice is required.');
  day(cutoff);
  if (invoice.accounting_date > cutoff) return { settled: '0.00', paid_principal: '0.00', paid_tax: '0.00', paid_principal_carrying: '0.00', open_receivable: '0.00', latest_date: null };
  const s = JSON.parse(invoice.snapshot), b = receivableBalance(db, invoice, cutoff);
  const principal = payableRatio(b.settled, s.advance.principal, invoice.total);
  const liability = JSON.parse(invoice.journal_json).find(l => l.account_id === s.accounts.advance.id).base_credit;
  return { settled: b.settled, paid_principal: principal, paid_tax: money(new D(b.settled).minus(principal)), paid_principal_carrying: payableRatio(principal, liability, s.advance.principal), open_receivable: b.open, latest_date: b.latest_date };
}

export function contractAdvancePaid(db, contractId, cutoff) {
  return money(sum(all(db, "SELECT * FROM client_invoices WHERE contract_id=? AND advance_id IS NOT NULL AND state='posted' AND accounting_date<=?", contractId, cutoff).map(i => advanceSettlement(db, i, cutoff).paid_principal)));
}

export function advances(db, actorId, today = () => now().slice(0, 10)) {
  const access = policy(db, actorId); access.actor();
  const run = (q, ...v) => db.prepare(q).run(...v);
  const can = (cap, r) => access.has(`advances.${cap}`, r.company_id, r.project_id);
  const row = id => { const r = get(db, 'SELECT * FROM client_advances WHERE id=?', id); requireThat(r && can('read', r), 'Client advance is unavailable.', 404); return r; };
  const version = (r, value) => requireThat(Number.isSafeInteger(value) && value === r.version, 'Advance changed. Reload before continuing.', 409);
  const event = (r, action, reason) => run('INSERT INTO client_advance_events(advance_id,company_id,project_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?,?,?)', r.id, r.company_id, r.project_id, actorId, action, text(reason, 'Reason'), JSON.stringify(r), now());
  const approvedPrincipal = (contract, exclude = '') => money(sum(all(db, "SELECT principal FROM client_advances WHERE contract_id=? AND state='approved' AND id<>?", contract, exclude).map(r => r.principal)));
  const reviewer = r => r.state === 'submitted' && r.author_id !== actorId && advanceAuthority(db, actorId, 'advances.approve', r, 'advance_approval_limit', r.company_total);

  function detail(id) {
    const r = row(id), s = JSON.parse(r.snapshot), invoice = get(db, 'SELECT * FROM client_invoices WHERE advance_id=?', id);
    const received = invoice?.state === 'posted' ? advanceSettlement(db, invoice) : null;
    return { ...r, snapshot: s, invoice: invoice && { id: invoice.id, state: invoice.state, total: invoice.total, company_total: invoice.company_total, can_open: access.has('ar.read', r.company_id, r.project_id) }, received,
      can_edit: r.author_id === actorId && ['draft','returned'].includes(r.state) && can('write', r),
      can_submit: r.author_id === actorId && r.state === 'draft' && can('write', r), can_review: reviewer(r),
      can_cancel: r.author_id === actorId && ['draft','submitted','returned'].includes(r.state) && can('write', r),
      can_invoice: r.state === 'approved' && !invoice && access.has('ar.write', r.company_id, r.project_id),
      evidence: all(db, 'SELECT id,filename,sha256,length(bytes) size,created_at FROM client_advance_evidence WHERE advance_id=? ORDER BY created_at,id', id),
      history: all(db, 'SELECT e.*,u.name actor FROM client_advance_events e JOIN users u ON u.id=e.actor_id WHERE advance_id=? ORDER BY e.id', id),
      findings: [`${r.currency} ${r.principal} requested principal and ${r.tax} explicit exclusive tax.`, `${r.currency} ${approvedPrincipal(r.contract_id)} approved principal against the original ceiling ${s.contract.terms.advance_ceiling}; approval does not establish cash.`, received ? `${r.currency} ${received.settled} actually recorded against the invoice, including ${received.paid_principal} principal; certificate recovery is a separate controlled allocation.` : 'No posted advance receipt balance exists.'] };
  }
  function save(id, input) {
    return transaction(db, () => {
      const old = id ? row(id) : null, c = contractData(db, old?.contract_id || input.contract_id);
      access.requireCap('advances.write', c.company_id, c.project_id);
      if (old) { version(old, input.version); requireThat(old.author_id === actorId && ['draft','returned'].includes(old.state), 'Only the author may revise an unsubmitted advance.', 403); }
      const s = requestCalculation(db, c, input, today);
      const r = { id: id || uid('CAD'), contract_id: c.id, company_id: c.company_id, project_id: c.project_id, customer_id: c.customer_id, currency: c.currency, title: text(input.title, 'Advance title', 200), request_date: input.request_date, principal: s.principal, tax_percent: s.tax_percent, tax: s.tax, total: s.total, rate: s.rate, rate_date: s.rate_date, rate_source: s.rate_source, company_total: s.company_total, advance_account: s.accounts.advance.id, tax_account: s.accounts.tax?.id || null, policy_id: s.policy_id, basis: text(input.basis, 'Advance purpose and tax basis'), snapshot: JSON.stringify(s) };
      if (old) {
        const keys = Object.keys(r).filter(k => !['id','contract_id','company_id','project_id','customer_id','currency'].includes(k));
        run(`UPDATE client_advances SET ${keys.map(k=>k+'=?').join(',')},state='draft',version=version+1 WHERE id=?`, ...keys.map(k=>r[k]), id);
      } else {
        Object.assign(r, { author_id: actorId, state: 'draft', created_at: now() });
        const keys = Object.keys(r); run(`INSERT INTO client_advances(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`, ...keys.map(k=>r[k]));
      }
      if (input.base64 !== undefined) {
        requireThat(typeof input.filename === 'string' && input.filename.length <= 140 && !/[\\/\x00-\x1f]/.test(input.filename) && /\.(pdf|png|jpe?g|txt)$/i.test(input.filename), 'Use a plain PDF, PNG, JPG or TXT evidence filename.');
        requireThat(typeof input.base64 === 'string' && input.base64.length <= 2800000 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64), 'Use valid base64 evidence up to 2 MiB.');
        const bytes = Buffer.from(input.base64, 'base64'); requireThat(bytes.length > 0 && bytes.length <= 2*1024*1024, 'Evidence must contain 1 byte to 2 MiB.');
        const eid = uid('CAE'); run('INSERT INTO client_advance_evidence VALUES(?,?,?,?,?,?,?)', eid, r.id, input.filename, createHash('sha256').update(bytes).digest('hex'), bytes, actorId, now());
        run('UPDATE client_advances SET evidence_id=? WHERE id=?', eid, r.id);
      }
      event(row(r.id), old ? 'Advance revised' : 'Advance prepared', input.reason);
      return detail(r.id);
    });
  }
  function validate(r) {
    const c = contractData(db, r.contract_id), s = requestCalculation(db, c, r, today);
    requireThat(JSON.stringify(s) === r.snapshot, 'The advance policy or accounts changed. Return and revise.', 409);
    requireThat(advanceAuthority(db, r.author_id, 'advances.write', r), 'Advance author no longer has current scope.', 409);
    requireThat(r.evidence_id && get(db, 'SELECT id FROM client_advance_evidence WHERE id=? AND advance_id=?', r.evidence_id, r.id), 'Attach the original advance evidence before submitting.');
    requireThat(new D(approvedPrincipal(r.contract_id, r.id)).plus(r.principal).lte(c.terms.advance_ceiling), 'Other approved advances leave insufficient contract allowance.', 409);
  }
  function decide(id, input) {
    return transaction(db, () => {
      const r = row(id); version(r, input.version); let state;
      if (input.action === 'cancel') {
        requireThat(r.author_id === actorId && can('write', r) && ['draft','submitted','returned'].includes(r.state), 'Only the author can cancel an unapproved advance.', 403); state = 'cancelled';
      } else if (input.action === 'submit') {
        requireThat(r.author_id === actorId && can('write', r) && r.state === 'draft', 'Only the author can submit a draft advance.', 403); validate(r); state = 'submitted';
      } else {
        requireThat(reviewer(r), 'A different finance reviewer needs sufficient advance authority.', 403);
        requireThat(['approve','return'].includes(input.action), 'Choose approve or return.');
        state = input.action === 'approve' ? 'approved' : 'returned'; if (state === 'approved') validate(r);
      }
      run('UPDATE client_advances SET state=?,approved_by=?,approved_at=?,version=version+1 WHERE id=?', state, state === 'approved' ? actorId : null, state === 'approved' ? now() : null, id);
      event(row(id), `Advance ${state}`, input.reason); return detail(id);
    });
  }
  function download(id) { const e = get(db, 'SELECT * FROM client_advance_evidence WHERE id=?', id); requireThat(e, 'Evidence is unavailable.', 404); row(e.advance_id); return e; }
  return { save, decide, detail, download };
}
