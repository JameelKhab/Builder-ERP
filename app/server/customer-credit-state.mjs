import { D, money, sum, requireThat } from './money.mjs';
// Internal helpers: authorise each invoice/project before returning rows.
export function creditLegs(db, invoiceId, to = '9999-12-31') {
  return db.prepare("SELECT l.*,s.kind,s.accounting_date,s.journal_id FROM client_credit_legs l JOIN client_credit_settlements s ON s.id=l.settlement_id WHERE l.invoice_id=? AND s.state='recorded' AND s.accounting_date<=?").all(invoiceId, to);
}
export function creditPlans(db, invoiceId, exclude = '') {
  return db.prepare("SELECT id,version,payload,accounting_date FROM client_credit_settlements WHERE state='approved' AND id<>? ORDER BY id").all(exclude).flatMap(r => JSON.parse(r.payload).legs.filter(l => l.invoice_id === invoiceId).map(l => ({
    ...l,
    id: r.id,
    version: r.version,
    accounting_date: r.accounting_date
  })));
}
export function creditReserved(db, invoiceId, effect, exclude = '') {
  return money(sum(creditPlans(db, invoiceId, exclude).filter(l => l.effect === effect).map(l => l.amount)));
}
export function protectCreditReceipt(db, invoiceId) {
  requireThat(!creditLegs(db, invoiceId).some(l => l.effect === 1) && !new D(creditReserved(db, invoiceId, 1)).gt(0), 'Customer credit has been used or reserved. Correct its settlement before reversing the original receipt.', 409);
}
