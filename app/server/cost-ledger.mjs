import { D, sum, money } from './money.mjs';
// One capacity calculation shared by the original sample requests and typed procurement.
export function sourcingAvailable(db, itemId, {
  legacyRequest = '',
  materialRequest = ''
} = {}) {
  const item = db.prepare('SELECT request_allowance FROM cost_items WHERE id=?').get(itemId);
  const old = sum(db.prepare("SELECT company_amount FROM requests WHERE item_id=? AND status='approved' AND id<>?").all(itemId, legacyRequest || '').map(r => r.company_amount));
  const reserved = sum(db.prepare("SELECT a.company_amount FROM sourcing_allocations a JOIN material_requests r ON r.id=a.request_id JOIN material_request_lines l ON l.id=a.line_id JOIN work_packages w ON w.id=l.work_package_id WHERE w.cost_item_id=? AND r.state='approved' AND r.id<>?").all(itemId, materialRequest || '').map(r => r.company_amount));
  const committed = sum(db.prepare("SELECT amount FROM construction_cost_facts WHERE cost_item_id=? AND kind='commitment'").all(itemId).map(r => r.amount));
  return new D(item.request_allowance).minus(old).minus(reserved).minus(committed);
}
export function costPosition(db, item) {
  const facts = db.prepare(`SELECT f.id,f.kind,f.amount,f.source_type,f.source_id,f.at,COALESCE(pl.order_id,rc.order_id) order_id FROM construction_cost_facts f LEFT JOIN purchase_order_lines pl ON f.source_type='purchase_order_line' AND pl.id=f.source_id LEFT JOIN stock_movements sm ON f.source_type='stock_movement' AND sm.id=f.source_id LEFT JOIN material_receipts rc ON rc.id=sm.receipt_id WHERE f.cost_item_id=? ORDER BY f.at,f.id`).all(item.id);
  const additions = kind => sum(facts.filter(f => f.kind === kind).map(f => f.amount));
  return {
    ...item,
    committed: money(new D(item.committed).plus(additions('commitment'))),
    incurred: money(new D(item.incurred).plus(additions('incurred'))),
    opening_committed: item.committed,
    opening_incurred: item.incurred,
    transaction_sources: facts
  };
}
