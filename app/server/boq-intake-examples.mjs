import { transaction } from './db.mjs';
import { estimates } from './estimates.mjs';
import { boqIntake } from './boq-intake.mjs';
import { sampleEstimate } from './estimates-examples.mjs';
export const BOQ_EXAMPLES = 'boq-intake-v1';
export function installBoqExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(BOQ_EXAMPLES)) return;
  transaction(db, () => {
    const today = () => '2026-10-29',
      svc = estimates(db, 'ahmed', today),
      maker = boqIntake(db, 'ahmed', today),
      reviewer = boqIntake(db, 'example-estimate-reviewer', today),
      reason = 'Fictional workbook intake example; no source migration or external action.';
    for (const p of db.prepare('SELECT * FROM projects ORDER BY id').all()) {
      const c = db.prepare('SELECT * FROM companies WHERE id=?').get(p.company_id),
        customer = db.prepare('SELECT customer_id FROM estimate_versions WHERE company_id=? LIMIT 1').get(c.id),
        product = db.prepare('SELECT * FROM products WHERE company_id=? AND active=1 ORDER BY code LIMIT 1').get(c.id),
        cc = db.prepare('SELECT * FROM cost_codes WHERE company_id=? ORDER BY code LIMIT 1').get(c.id);
      if (!customer || !product || !cc) continue;
      let e = svc.save(null, {
        ...sampleEstimate(c, customer.customer_id, today(), p.id),
        title: 'Example · BOQ workbook intake · ' + p.name,
        tender_reference: 'DEMO-INTAKE-' + p.code,
        buildings: 2,
        overrides: [],
        indirect_pool: '100',
        reason
      });
      const make = (code, bad = false) => {
        const contents = `Code,Description,Quantity,Unit cost,Unit,Cost code,Product\n${code},Fictional imported work,2,12.50,${bad ? 'unknown-unit' : product.uom},${cc.code},${product.code}\n`;
        let b = maker.upload(e.id, {
          estimate_version: e.version,
          reason,
          files: [{
            filename: `Example-${p.code}-${code}.csv`,
            base64: Buffer.from(contents).toString('base64')
          }]
        });
        return maker.check(b.id, {
          version: b.version,
          reason,
          configs: b.configs.map(cfg => ({
            ...cfg,
            expected_total: '50.00'
          }))
        });
      };
      let done = make('IMPORTED-EXAMPLE');
      done = reviewer.decide(done.id, {
        version: done.version,
        action: 'review',
        confirmed: true,
        reason
      });
      maker.commit(done.id, {
        version: done.version,
        reason
      });
      e = svc.detail(e.id);
      make('CHECK-UNIT', true);
      make('REVIEW-ME');
    }
    db.prepare('INSERT INTO sample_packs(id,installed_at) VALUES(?,?)').run(BOQ_EXAMPLES, new Date().toISOString());
  });
}
