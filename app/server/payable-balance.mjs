import { D, money, sum } from './money.mjs';
// Internal accounting query: callers must authorise the source bill and scope.
export function payableBalance(db, bill, to = '9999-12-31') {
  const credits = db.prepare("SELECT id,total,company_total,accounting_date FROM payable_documents WHERE original_id=? AND state='posted' AND accounting_date<=?").all(bill.id, to);
  const settlements = db.prepare("SELECT a.*,p.accounting_date,p.kind,p.reversal_of,p.journal_id FROM payment_allocations a JOIN payments p ON p.id=a.payment_id WHERE a.bill_id=? AND p.state='recorded' AND p.accounting_date<=?").all(bill.id, to);
  const credited = money(sum(credits.map(c => c.total))),
    base_credited = money(sum(credits.map(c => c.company_total)));
  const settled = money(sum(settlements.map(a => new D(a.amount).times(a.effect)))),
    base_settled = money(sum(settlements.map(a => new D(a.base_amount).times(a.effect))));
  return {
    credited,
    base_credited,
    settled,
    base_settled,
    open: money(new D(bill.total).minus(credited).minus(settled)),
    base_open: money(new D(bill.company_total).minus(base_credited).minus(base_settled)),
    latest_date: [bill.accounting_date, ...credits.map(c => c.accounting_date), ...settlements.map(c => c.accounting_date)].sort().at(-1),
    credits,
    settlements
  };
}
