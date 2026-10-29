import { D, money, requireThat, sum } from './money.mjs';
import { payableRatio } from './payables.mjs';
import { receivableBalance } from './receivable-balance.mjs';

const CENT = 10n ** 10n;
// Internal helpers: the caller must authorise invoice/project before exposing facts.
export function advancePaidComponents(invoice, settled) {
  const s = typeof invoice.snapshot === 'string' ? JSON.parse(invoice.snapshot) : invoice.snapshot;
  requireThat(invoice.advance_id && new D(invoice.total).gt(0) && new D(settled).gte(0) && new D(settled).lte(invoice.total) && new D(settled).scaled % CENT === 0n, 'Advance settlement is outside its invoiced balance or currency precision.');
  // A partial payment cannot settle all principal while leaving a tax-only
  // remainder. Floor principal to cents; the final payment exhausts both.
  const principalCents = (new D(settled).scaled / CENT) * (new D(s.advance.principal).scaled / CENT) / (new D(invoice.total).scaled / CENT);
  const principal = money(D.raw(principalCents * CENT));
  const lines = typeof invoice.journal_json === 'string' ? JSON.parse(invoice.journal_json) : invoice.journal;
  const liability = lines.find(l => l.account_id === s.accounts.advance.id).base_credit;
  return { settled: money(settled), paid_principal: principal, paid_tax: money(new D(settled).minus(principal)), paid_principal_carrying: payableRatio(principal, liability, s.advance.principal) };
}

export function advanceSettlement(db, invoice, cutoff = '9999-12-31') {
  requireThat(invoice.advance_id && invoice.state === 'posted', 'A posted advance invoice is required.');
  requireThat(typeof cutoff === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cutoff) && !Number.isNaN(Date.parse(cutoff)) && new Date(cutoff).toISOString().slice(0, 10) === cutoff, 'Enter a valid calendar date.');
  if (invoice.accounting_date > cutoff) return { settled: '0.00', paid_principal: '0.00', paid_tax: '0.00', paid_principal_carrying: '0.00', open_receivable: '0.00', latest_date: null };
  const b = receivableBalance(db, invoice, cutoff);
  return { ...advancePaidComponents(invoice, b.settled), open_receivable: b.open, latest_date: b.latest_date };
}

export function contractAdvancePaid(db, contractId, cutoff) {
  return money(sum(db.prepare("SELECT * FROM client_invoices WHERE contract_id=? AND advance_id IS NOT NULL AND state='posted' AND accounting_date<=?").all(contractId, cutoff).map(i => advanceSettlement(db, i, cutoff).paid_principal)));
}
