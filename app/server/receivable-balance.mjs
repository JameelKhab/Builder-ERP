import { D, money, sum } from './money.mjs';
import { invoiceCredit } from './client-correction-state.mjs';
// Internal query. Each caller must authorise the invoice and project before returning it.
export function receivableBalance(db, invoice, to = '9999-12-31') {
  const allocations = db.prepare("SELECT a.*,r.accounting_date,r.journal_id,r.reversal_of FROM client_receipt_allocations a JOIN client_receipts r ON r.id=a.receipt_id WHERE a.invoice_id=? AND r.state='recorded' AND r.accounting_date<=?").all(invoice.id, to);
  const settled = money(sum(allocations.map(a => new D(a.amount).times(a.effect))));
  const base_settled = money(sum(allocations.map(a => new D(a.base_amount).times(a.effect))));
  const credit = invoiceCredit(db, invoice.id, to);
  const credited = credit ? invoice.total : '0.00', base_credited = credit ? invoice.company_total : '0.00';
  const open = money(new D(invoice.total).minus(credited).minus(settled));
  return {
    settled,
    base_settled,
    credited, base_credited, credit_id: credit?.id || null, credit_journal_id: credit?.journal_id || null,
    open,
    debit_open: new D(open).gt(0) ? open : '0.00',
    customer_credit: new D(open).cmp(0)<0 ? money(new D(0).minus(open)) : '0.00',
    base_open: money(new D(invoice.company_total).minus(base_credited).minus(base_settled)),
    latest_date: [invoice.accounting_date, ...allocations.map(a => a.accounting_date), ...(credit?[credit.effective_date]:[])].sort().at(-1),
    allocations
  };
}
