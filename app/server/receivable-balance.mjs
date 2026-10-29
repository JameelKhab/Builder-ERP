import { D, money, sum } from './money.mjs';
// Internal query. Each caller must authorise the invoice and project before returning it.
export function receivableBalance(db, invoice, to = '9999-12-31') {
  const allocations = db.prepare("SELECT a.*,r.accounting_date,r.journal_id,r.reversal_of FROM client_receipt_allocations a JOIN client_receipts r ON r.id=a.receipt_id WHERE a.invoice_id=? AND r.state='recorded' AND r.accounting_date<=?").all(invoice.id, to);
  const settled = money(sum(allocations.map(a => new D(a.amount).times(a.effect))));
  const base_settled = money(sum(allocations.map(a => new D(a.base_amount).times(a.effect))));
  return {
    settled,
    base_settled,
    open: money(new D(invoice.total).minus(settled)),
    base_open: money(new D(invoice.company_total).minus(base_settled)),
    latest_date: [invoice.accounting_date, ...allocations.map(a => a.accounting_date)].sort().at(-1),
    allocations
  };
}
