import { transaction } from './db.mjs';
import { procurement } from './procurement.mjs';
export const PROCUREMENT_EXAMPLES = 'procurement-chain-v1';
// These synthetic cases go through the same services as user actions, atomically.
// Example history is deliberately labelled; it is not a migration of JAKH transactions.
export function installProcurementExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(PROCUREMENT_EXAMPLES)) return;
  transaction(db, () => {
    const today = () => '2026-10-28';
    for (const [company, project, engineer, buyerId, item, vendor] of [['jakh', 'harbour', 'mohammed', 'sara', 'C-103', 'euro'], ['jakh', 'gardens', 'amina', 'sara', 'C-201', 'gulf'], ['build', 'creek', 'noah', 'maya', 'C-301', 'world']]) {
      const site = procurement(db, engineer, today),
        buyer = procurement(db, buyerId, today),
        manager = procurement(db, 'ahmed', today);
      const input = {
        company_id: company,
        project_id: project,
        needed_by: '2026-11-06',
        lines: [{
          product_id: `${company}-BLOCK`,
          work_package_id: `WP-${item}`,
          location_id: `${project}-unit`,
          quantity: '100',
          note: 'Example: internal blockwork from approved drawing A-1204.'
        }]
      };
      site.createRequest({
        ...input,
        title: 'Example · Unpriced blockwork demand',
        lines: [...input.lines, {
          ...input.lines[0],
          product_id: `${company}-FORM`,
          quantity: '6',
          note: 'Example: temporary formwork for the opening.'
        }]
      });
      for (const [title, makeOrder] of [['Example · Review supplier allocation', false], ['Example · Partial delivery and material use', true]]) {
        let r = site.createRequest({
          ...input,
          title
        });
        r = site.decide(r.id, {
          version: r.version,
          action: 'submit'
        });
        const vendors = vendor === 'euro' ? [[vendor, '60', '10', '4'], ['gulf', '40', '42', '1']] : [[vendor, '100', '12', '1']];
        for (const [id, quantity, unit_price, rate] of vendors) r = buyer.addQuote(r.id, {
          version: r.version,
          line_id: r.lines[0].id,
          vendor_id: id,
          reference: `Example ${project} block supply / ${id}`,
          quantity,
          unit_price,
          rate,
          rate_date: '2026-10-28',
          rate_source: 'Illustrative fixed example rate',
          valid_until: '2026-11-04',
          lead_days: 3
        });
        r = buyer.sourcePlan(r.id, {
          version: r.version,
          allocations: r.quotes.map(q => ({
            quote_id: q.id,
            quantity: q.quantity
          }))
        });
        if (makeOrder) {
          r = manager.decide(r.id, {
            version: r.version,
            action: 'approve'
          });
          for (let o of buyer.issueOrders(r.id, {
            version: r.version
          })) {
            o = manager.receive(o.id, {
              version: o.version,
              command_key: 'sample-delivery-1',
              line_id: o.lines[0].id,
              accepted: '30',
              rejected: '5',
              delivery_reference: 'Example delivery DN-001',
              reason: 'Example: five blocks damaged during transport; supplier replacement required.'
            });
            o = manager.moveStock(o.receipts[0].id, {
              version: o.version,
              command_key: 'sample-return-1',
              kind: 'return',
              quantity: '5',
              location_id: `${project}-unit`,
              reason: 'Example: latent damage found before use; replacement required.'
            });
            manager.moveStock(o.receipts[0].id, {
              version: o.version,
              command_key: 'sample-issue-1',
              kind: 'issue',
              quantity: '20',
              location_id: `${project}-unit`,
              reason: 'Example: 20 blocks incorporated into internal walls.'
            });
          }
        }
      }
    }
    db.prepare('INSERT INTO sample_packs(id,installed_at) VALUES(?,?)').run(PROCUREMENT_EXAMPLES, new Date().toISOString());
  });
}
