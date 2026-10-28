import { transaction } from './db.mjs';
import { masters } from './masters.mjs';
export const MASTER_EXAMPLES = 'masters-v1';
export function installMasterExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(MASTER_EXAMPLES)) return;
  transaction(db, () => {
    const day = () => '2026-10-29',
      manager = masters(db, 'ahmed', day);
    let shared = null;
    for (const [company, actor] of [['jakh', 'sara'], ['build', 'maya']]) {
      const buyer = masters(db, actor, day);
      let p = manager.saveParty(null, {
        company_id: company,
        existing_party_id: shared,
        name: 'Example · Meridian Materials',
        supplier: true,
        customer: true,
        subcontractor: false,
        reference: 'EX-MERIDIAN',
        email: 'purchasing@example.invalid',
        address: 'Fictional materials depot · demonstration only',
        country: 'United Arab Emirates',
        reason: 'Synthetic example: one identity with separate terms in two legal companies.'
      });
      shared = p.party_id;
      p = buyer.proposeTerms(p.party_id, {
        company_id: company,
        version: p.version,
        preferred_currency: company === 'jakh' ? 'EUR' : 'USD',
        currencies: company === 'jakh' ? ['EUR', 'AED'] : ['USD', 'EUR'],
        payment_days: company === 'jakh' ? 30 : 45,
        effective_from: '2026-10-28',
        reason: 'Example company agreement. No supplier communication or payment.'
      });
      p = manager.decideTerms(p.proposals.find(t => !t.decision).id, {
        company_id: company,
        version: p.version,
        decision: 'approved',
        reason: 'Example independent review of company-specific currencies and payment days.'
      });
      buyer.proposeTerms(p.party_id, {
        company_id: company,
        version: p.version,
        preferred_currency: p.terms.preferred_currency,
        currencies: p.terms.currencies,
        payment_days: 60,
        effective_from: '2026-10-29',
        reason: 'Example: proposed extension to 60 days, awaiting a reviewer. Current approved terms still apply.'
      });
      const product = buyer.productDetail(company + '-BLOCK');
      buyer.addPack(product.id, {
        version: product.version,
        name: 'Pallet of 100 blocks',
        base_quantity: '100',
        supplier_code: 'EX-BLOCK-100',
        reason: 'Synthetic packing specification: exactly 100 base units per pallet.'
      });
      const category = buyer.saveCategory(null, {
        company_id: company,
        name: 'Professional services',
        reason: 'Synthetic service catalogue example.'
      });
      buyer.saveProduct(null, {
        company_id: company,
        code: 'EX-SURVEY',
        name: 'Example · Setting-out survey',
        kind: 'service',
        uom: 'hour',
        precision: 2,
        category_id: category.id,
        description: 'Survey crew time. Service entries are separate from material receipts.',
        reason: 'Synthetic service item; cannot enter the material request/stock workflow.'
      });
    }
    db.prepare('INSERT INTO sample_packs(id,installed_at) VALUES(?,?)').run(MASTER_EXAMPLES, new Date().toISOString());
  });
}
