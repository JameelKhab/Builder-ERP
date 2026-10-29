import { transaction } from './db.mjs';
import { estimates } from './estimates.mjs';
import { sampleEstimate } from './estimates-examples.mjs';
import { commercial } from './commercial.mjs';
export const COMMERCIAL_EXAMPLES = 'commercial-v1';
export const sampleOffer = (estimate, date) => ({
  estimate_id: estimate.id,
  title: 'Example · ' + estimate.title.replace(/^Example · /, ''),
  offered_on: date,
  valid_until: '2026-12-31',
  payment_days: 30,
  retention_percent: '5',
  retention_cap: '2000',
  advance_ceiling: '1000',
  recovery_percent: '20',
  terms: 'Fictional local example. Monthly measured work; payment 30 days from invoice. All values exclude tax. No external offer or agreement is made.',
  basis: estimate.basis,
  exclusions: estimate.exclusions,
  reason: 'Synthetic commercial example; no external communication'
});
export function installCommercialExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(COMMERCIAL_EXAMPLES)) return;
  transaction(db, () => {
    db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run('example-commercial-reviewer', 'Lina · example commercial reviewer', 'commercial_manager');
    for (const c of ['jakh', 'build']) db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,commercial_approval_limit) VALUES(?,?,'*',?,?)").run('example-commercial-reviewer', c, 'commercial_manager', '1000000');
    const date = new Date().toISOString().slice(0, 10),
      today = () => date,
      maker = estimates(db, 'ahmed', today),
      er = estimates(db, 'example-estimate-reviewer', today),
      s = commercial(db, 'ahmed', today),
      review = commercial(db, 'example-commercial-reviewer', today);
    for (const p of db.prepare("SELECT * FROM projects WHERE id IN('creek','gardens','harbour')").all()) {
      const c = db.prepare('SELECT * FROM companies WHERE id=?').get(p.company_id),
        customer = db.prepare("SELECT party_id FROM party_companies WHERE company_id=? AND reference='DEMO-EST-CLIENT'").get(c.id).party_id;
      for (const stage of ['draft', 'review', 'acceptance', 'awarded']) {
        let e = maker.save(null, {
          ...sampleEstimate(c, customer, date, p.id),
          title: `Example · ${p.name} · ${stage} offer`,
          tender_reference: `DEMO-OFFER-${p.code}-${stage}`
        });
        e = maker.decide(e.id, {
          version: e.version,
          action: 'submit',
          reason: 'Fictional source estimate for offer'
        });
        e = er.decide(e.id, {
          version: e.version,
          action: 'approve',
          reason: 'Fictional independent estimate review'
        });
        let o = s.save(null, sampleOffer(e, date));
        if (stage === 'draft') continue;
        o = s.decide(o.id, {
          version: o.version,
          action: 'submit',
          reason: 'Fictional commercial terms for review'
        });
        if (stage === 'review') continue;
        o = review.decide(o.id, {
          version: o.version,
          action: 'approve',
          reason: 'Fictional independent commercial approval'
        });
        if (stage === 'acceptance') continue;
        const w = db.prepare("SELECT id FROM work_packages WHERE project_id=? AND kind='item' AND cost_code_id=? ORDER BY id LIMIT 1").get(p.id, c.id + '-GENERAL');
        const mapping = o.lines.map(l => ({
          line_key: l.line_key,
          work_package_id: w.id,
          location_id: null
        }));
        o = s.recordAcceptance(o.id, {
          version: o.version,
          project_id: p.id,
          mapping,
          reference: 'DEMO-ACCEPT-' + p.code,
          accepted_on: date,
          signatory: 'Fictional client representative',
          description: 'Synthetic acceptance of this exact estimate and commercial terms for local walkthroughs.',
          filename: 'fictional-client-acceptance.txt',
          base64: Buffer.from(`FICTIONAL EXAMPLE ONLY\nOffer ${o.id}\nNet ${o.currency} ${o.net_amount}\nNo real client agreement or signature.`).toString('base64'),
          reason: 'Add fictional acceptance evidence'
        });
        review.decideAcceptance(o.acceptances[0].id, {
          version: 1,
          action: 'verify',
          confirmed: true,
          reason: 'Fictional independent evidence verification; original contract awaits finance setup'
        });
      }
    }
    db.prepare('INSERT INTO sample_packs(id,installed_at) VALUES(?,?)').run(COMMERCIAL_EXAMPLES, new Date().toISOString());
  });
}
