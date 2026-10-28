import { D, decimal, money, requireThat } from './money.mjs';
export const snapshot = (db, type, id) => {
  const s = db.prepare('SELECT payload FROM document_master_snapshots WHERE entity_type=? AND entity_id=?').get(type, id);
  return s ? JSON.parse(s.payload) : {};
};
export const freezeMaster = (db, type, id, data) => db.prepare('INSERT INTO document_master_snapshots VALUES(?,?,?,?)').run(type, id, JSON.stringify(data), 'document_creation');
export function usableSupplier(db, company, vendor, today, expectedTerms = null) {
  const r = db.prepare('SELECT pc.*,p.name FROM party_companies pc JOIN parties p ON p.id=pc.party_id WHERE pc.company_id=? AND pc.vendor_id=?').get(company, vendor);
  requireThat(r && r.active && !r.blocked && (r.supplier || r.subcontractor) && r.current_terms_id, 'Supplier is not available for new purchasing. Approved active terms are required.');
  const t = db.prepare('SELECT * FROM supplier_terms WHERE id=?').get(r.current_terms_id);
  requireThat(t && t.effective_from <= today && (!t.effective_until || t.effective_until >= today), 'Supplier terms are not effective on this date.');
  requireThat(!expectedTerms || expectedTerms === t.id, 'Supplier terms changed. Obtain a fresh quotation and submit sourcing for review again.', 409);
  return {
    ...r,
    terms: t,
    currencies: JSON.parse(t.currencies),
    currency: t.preferred_currency
  };
}
export function quantityFor(value, precision, label = 'Quantity', zero = false) {
  const q = decimal(value, label, zero);
  requireThat(q.cmp(q.toDecimalPlaces(precision)) === 0, `${label} permits at most ${precision} decimal places in the base unit.`);
  return q;
}
// Exact rational rounding to currency cents, without first rounding a derived base-unit rate.
export function quotePrice(db, quoteId, quantity, unitPrice, rate) {
  const p = db.prepare('SELECT * FROM quote_pack_details WHERE quote_id=?').get(quoteId);
  const q = decimal(quantity, 'Quantity', false),
    u = new D(p?.quoted_price || unitPrice),
    factor = new D(p?.base_quantity || '1');
  const numerator = q.scaled * u.scaled * 100n,
    denominator = factor.scaled * 10n ** 12n;
  const cents = numerator / denominator + (numerator % denominator * 2n >= denominator ? 1n : 0n);
  const amount = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
  return {
    amount,
    companyAmount: money(new D(amount).times(rate))
  };
}
export function legacyMaster(db, id) {
  const r = db.prepare("SELECT payload FROM document_master_snapshots WHERE entity_type='legacy_request' AND (entity_id=? OR entity_id LIKE ?) ORDER BY CAST(substr(entity_id,instr(entity_id,'@')+1) AS INTEGER) DESC LIMIT 1").get(id, id + '@%');
  return r ? JSON.parse(r.payload) : {};
}
