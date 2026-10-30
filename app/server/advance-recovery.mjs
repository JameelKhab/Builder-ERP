import { D, money, sum, requireThat } from './money.mjs';
import { advancePaidComponents, advanceSettlement } from './advance-balances.mjs';
import { receivableBalance } from './receivable-balance.mjs';
import { payableRatio } from './payables.mjs';
import { appliedCorrection, effectiveRecoveries } from './client-correction-state.mjs';
const min = (...values) => values.map(v => new D(v)).reduce((a, b) => a.lte(b) ? a : b);
const positive = v => new D(v).gt(0) ? new D(v) : new D(0);
const CENT = 10n ** 10n;
const rows = (db, q, ...v) => db.prepare(q).all(...v);
// Internal queries: every public caller authorises the source company/project.
export function pendingAdvanceReversals(db, invoiceId, exclude = '') {
  return rows(db, "SELECT id,version,payload,accounting_date FROM client_receipts WHERE state='approved' AND reversal_of IS NOT NULL AND id<>? ORDER BY id", exclude)
    .flatMap(r => JSON.parse(r.payload).allocations.filter(a => a.invoice_id === invoiceId).map(a => ({ id: r.id, version: r.version, accounting_date: r.accounting_date, amount: a.amount })));
}
function protectedAmounts(db, invoiceId) {
  const allocations = effectiveRecoveries(db, invoiceId);
  return Object.fromEntries(['principal', 'tax', 'base_principal', 'base_tax'].map(k => [k, money(sum(allocations.map(a => a[k])))]));
}
export function assertAdvancePaidProtection(db, invoice, reversal = null) {
  const protectedBalance = protectedAmounts(db, invoice.id), paid = receivableBalance(db, invoice).settled;
  const reserved = sum(pendingAdvanceReversals(db, invoice.id, reversal?.id).map(r => r.amount));
  const projected = new D(paid).minus(reserved).minus(reversal?.amount || '0');
  requireThat(projected.gte(0), 'Other approved corrections reserve this advance receipt balance.', 409);
  const remaining = advancePaidComponents(invoice, money(projected));
  requireThat(new D(remaining.paid_principal).gte(protectedBalance.principal) && new D(remaining.paid_tax).gte(protectedBalance.tax), 'Certified advance recovery protects this receipt. Resolve the certified recovery through an authorised credit/correction workflow before reversing its cash.', 409);
}
function sources(db, contractId, cutoff) {
  return rows(db, "SELECT * FROM client_invoices WHERE contract_id=? AND advance_id IS NOT NULL AND state='posted' AND accounting_date<=? ORDER BY invoice_date,id", contractId, cutoff).filter(i=>!appliedCorrection(db,i)).map(invoice => {
    const snapshot = JSON.parse(invoice.snapshot), journal = JSON.parse(invoice.journal_json);
    const paid = advanceSettlement(db, invoice, cutoff), previous = protectedAmounts(db, invoice.id);
    const pending = pendingAdvanceReversals(db, invoice.id);
    const usable = advancePaidComponents(invoice, money(positive(new D(paid.settled).minus(sum(pending.map(r => r.amount))))));
    return { invoice_id: invoice.id, advance_id: invoice.advance_id, invoice_date: invoice.invoice_date, accounting_date: invoice.accounting_date,
      currency: invoice.currency, principal: snapshot.advance.principal, tax: snapshot.advance.tax,
      base_principal: journal.find(l => l.account_id === snapshot.accounts.advance.id).base_credit,
      base_tax: snapshot.accounts.tax ? journal.find(l => l.account_id === snapshot.accounts.tax.id)?.base_credit || '0.00' : '0.00',
      accounts: { advance: snapshot.accounts.advance, tax: snapshot.accounts.tax }, paid, pending, previous,
      available_principal: money(positive(new D(usable.paid_principal).minus(previous.principal))),
      available_tax: money(positive(new D(usable.paid_tax).minus(previous.tax))) };
  });
}
export function recoveryQuote(db, contract, policy, cutoff, gross, retention) {
  const all = sources(db, contract.id, cutoff);
  // Keep pre-advance certificate snapshots compatible; unpaid invoices alone are
  // not an eligible balance and must not invalidate an existing measurement.
  if (!all.some(s => new D(s.paid.settled).gt(0) || new D(s.previous.principal).gt(0) || s.pending.length)) return null;
  const eligible = money(sum(all.map(s => s.available_principal)));
  const netBefore = new D(gross).minus(retention);
  let target = min(money(new D(gross).times(contract.terms.recovery_percent).div(100)), eligible, netBefore);
  const originalTax = policy.recovery_tax_mode === 'original_tax';
  const workTax = money(new D(policy.tax_basis === 'gross' ? gross : netBefore).times(policy.tax_percent).div(100));
  let capacity = netBefore.plus(workTax);
  const allocations = [];
  for (const source of all) {
    let principal = min(target, source.available_principal);
    if (!principal.gt(0)) continue;
    if (new D(source.tax).gt(0)) requireThat(originalTax, 'Activate the original advance-tax recovery policy before recovering a taxed advance.');
    if (contract.currency !== contract.company_currency) {
      requireThat(policy.recovery_fx_basis === 'historical_consideration', 'Activate the historical advance-consideration policy before foreign-currency recovery.');
      if (new D(source.tax).gt(0)) requireThat(policy.accounts.fx_gain && policy.accounts.fx_loss, 'Configure both exchange gain and loss accounts for foreign advance-tax recovery.');
    }
    const taxFor = p => money(min(positive(new D(payableRatio(new D(source.previous.principal).plus(p), source.tax, source.principal)).minus(source.previous.tax)), source.available_tax));
    // Maximise recoverable cents without creating a negative invoice when work
    // and original advance tax rates differ.
    let lo = 0n, hi = principal.scaled / CENT;
    while (lo < hi) {
      const mid = (lo + hi + 1n) / 2n, p = D.raw(mid * CENT);
      if (p.plus(taxFor(p)).lte(capacity)) lo = mid; else hi = mid - 1n;
    }
    principal = D.raw(lo * CENT);
    if (!principal.gt(0)) continue;
    const tax = taxFor(principal), cumulative = new D(source.previous.principal).plus(principal);
    const basePrincipal = money(new D(payableRatio(cumulative, source.base_principal, source.principal)).minus(source.previous.base_principal));
    const baseTax = new D(source.tax).gt(0) ? money(new D(payableRatio(new D(source.previous.tax).plus(tax), source.base_tax, source.tax)).minus(source.previous.base_tax)) : '0.00';
    allocations.push({ invoice_id: source.invoice_id, advance_id: source.advance_id, principal: money(principal), tax, base_principal: basePrincipal, base_tax: baseTax, accounts: source.accounts });
    target = target.minus(principal); capacity = capacity.minus(principal).minus(tax);
  }
  return { policy: 'builder-advance-recovery-v1', cutoff, eligible_principal: eligible, principal: money(sum(allocations.map(a => a.principal))), tax: money(sum(allocations.map(a => a.tax))), sources: all, allocations };
}
export function freezeRecoveries(db, certificate, quote, actorId, at) {
  for (const [i, a] of (quote?.allocations || []).entries()) db.prepare('INSERT INTO client_advance_recoveries(certificate_id,invoice_id,company_id,project_id,ordinal,principal,tax,base_principal,base_tax,snapshot,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(certificate.id, a.invoice_id, certificate.company_id, certificate.project_id, i + 1, a.principal, a.tax, a.base_principal, a.base_tax, JSON.stringify(a), actorId, at);
}
export function certifiedRecoveries(db, certificate, snapshot) {
  const frozen = rows(db, 'SELECT * FROM client_advance_recoveries WHERE certificate_id=? ORDER BY ordinal', certificate.id);
  const expected = snapshot.advance_recovery?.allocations || [];
  requireThat(frozen.length === expected.length, 'Certified recovery allocations do not match their frozen basis.', 409);
  for (const [i, r] of frozen.entries()) {
    const a = expected[i], source = db.prepare('SELECT * FROM client_invoices WHERE id=?').get(r.invoice_id);
    requireThat(r.snapshot === JSON.stringify(a) && ['invoice_id', 'principal', 'tax', 'base_principal', 'base_tax'].every(k => r[k] === a[k]) && source?.state === 'posted' && source.advance_id && source.contract_id === certificate.contract_id && source.company_id === certificate.company_id && source.project_id === certificate.project_id, 'Certified recovery source is inconsistent.', 409);
    assertAdvancePaidProtection(db, source);
  }
  requireThat(money(sum(expected.map(a => a.principal))) === snapshot.recovery, 'Certified recovery total is inconsistent.', 409);
  return expected;
}
export function contractAdvancePosition(db, contractId, cutoff) {
  const all = sources(db, contractId, cutoff);
  const posted = rows(db, "SELECT r.principal,r.certificate_id FROM client_advance_recoveries r JOIN client_invoices i ON i.certificate_id=r.certificate_id WHERE i.state='posted' AND i.contract_id=? AND i.accounting_date<=?", contractId, cutoff).filter(r=>!appliedCorrection(db,r,cutoff));
  return { paid_principal: money(sum(all.map(s => s.paid.paid_principal))), certified_principal: money(sum(all.map(s => s.previous.principal))), posted_principal: money(sum(posted.map(r => r.principal))), available_principal: money(sum(all.map(s => s.available_principal))) };
}
