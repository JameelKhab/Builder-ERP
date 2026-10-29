import { transaction } from './db.mjs';
import { certificates } from './certificates.mjs';
import { ledger } from './ledger.mjs';
import { D } from './money.mjs';
export const CERTIFICATE_EXAMPLES = 'client-certificates-v1';
export function installCertificateExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(CERTIFICATE_EXAMPLES)) return;
  transaction(db, () => {
    for (const [id, name, role] of [['example-client-finance-author', 'Faris · example client finance preparer', 'financial_controller'], ['example-client-finance-reviewer', 'Maha · example client finance reviewer', 'financial_controller'], ['example-measurer', 'Salma · example quantity surveyor', 'quantity_surveyor'], ['example-technical-reviewer', 'Yusuf · example technical reviewer', 'project_manager'], ['example-certificate-commercial', 'Noor · example certificate commercial reviewer', 'commercial_manager'], ['example-client-accountant', 'Hana · example accounts receivable clerk', 'ar_clerk']]) {
      db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, name, role);
      for (const c of ['jakh', 'build']) db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,certificate_approval_limit,ar_approval_limit) VALUES(?,?,'*',?,?,?)").run(id, c, role, ['financial_controller', 'commercial_manager'].includes(role) ? '1000000' : '0', role === 'financial_controller' ? '1000000' : '0');
    }
    const today = () => new Date().toISOString().slice(0, 10),
      s = actor => certificates(db, actor, today),
      setup = s('example-client-finance-author'),
      finance = s('example-client-finance-reviewer'),
      maker = s('example-measurer'),
      technical = s('example-technical-reviewer'),
      commercial = s('example-certificate-commercial'),
      ar = s('example-client-accountant');
    const decision = (svc, r, action) => svc.decide(r.id, {
      version: r.version,
      action,
      reason: 'Fictional independent certificate walkthrough; no real financial action.'
    });
    for (const company of ['jakh', 'build']) {
      const chart = ledger(db, 'example-client-finance-author', today),
        a = {};
      for (const [key, code, name, type, purpose] of [['receivable', '1300', 'Client receivable', 'asset', 'receivable'], ['retention', '1310', 'Client retention receivable', 'asset', 'receivable'], ['revenue', '4100', 'Measured client revenue', 'income', 'general'], ['tax', '2310', 'Output tax', 'liability', 'tax']]) a[key] = chart.account(null, {
        company_id: company,
        code,
        name: 'Example · ' + name,
        type,
        purpose,
        active: true,
        reason: 'Synthetic client accounting chart; no jurisdictional policy inferred.'
      }).id;
      for (const project of db.prepare("SELECT id FROM projects WHERE company_id=? AND id IN ('harbour','gardens','creek')").all(company)) {
        const original = db.prepare('SELECT id FROM client_contracts WHERE company_id=? AND project_id=? ORDER BY created_at LIMIT 1').get(company, project.id);
        if (!original) continue;
        let c = setup.savePolicy(null, {
          contract_id: original.id,
          receivable_account: a.receivable,
          retention_account: a.retention,
          revenue_account: a.revenue,
          tax_account: a.tax,
          tax_percent: '5',
          tax_basis: 'gross',
          basis: 'FICTIONAL ONLY: illustrative 5% exclusive tax on measured gross. Not a jurisdictional tax configuration.',
          reason: 'Prepare illustrative client finance policy.'
        });
        c = setup.decidePolicy(c.policies[0].id, {
          version: c.policies[0].version,
          action: 'submit',
          reason: 'Independent review of fictional finance policy.'
        });
        c = finance.decidePolicy(c.policies[0].id, {
          version: c.policies[0].version,
          action: 'approve',
          reason: 'Synthetic finance authority; no real accounts or tax advice.'
        });
        for (const [i, fraction] of ['0.1', '0.2', '0.25', '0.4'].entries()) {
          const start = `2026-10-${String(1 + i * 7).padStart(2, '0')}`,
            end = `2026-10-${String(7 + i * 7).padStart(2, '0')}`;
          let r = maker.save(null, {
            contract_id: c.id,
            title: `Example · ${c.project} · measured work ${i + 1}`,
            period_from: start,
            period_to: end,
            rate: '1',
            rate_date: end,
            rate_source: 'Same-currency fictional measurement',
            basis: 'Fictional installed quantities from a local measurement sheet; original BOQ only. No production work is asserted.',
            lines: c.lines.map(l => ({
              line_key: l.line_key,
              cumulative_quantity: new D(l.quantity).times(fraction).toString()
            })),
            filename: 'fictional-measurement.txt',
            base64: Buffer.from(`FICTIONAL MEASUREMENT ONLY\nContract ${c.id}\nCumulative fraction ${fraction}\nNo production work or client signature.`).toString('base64'),
            reason: 'Add a synthetic measured-work example.'
          });
          r = decision(maker, r, 'submit');
          if (i === 3) continue;
          r = decision(technical, r, 'accept');
          r = decision(commercial, r, 'accept');
          r = decision(finance, r, 'accept');
          let inv = ar.saveInvoice(null, {
            certificate_id: r.id,
            title: r.title,
            invoice_date: end,
            accounting_date: end,
            due_date: '2026-11-30',
            rate: '1',
            rate_date: end,
            rate_source: 'Same-currency example invoice',
            basis: 'Fictional invoice from certified work; not sent to a client.',
            reason: 'Prepare example invoice from frozen certificate.'
          });
          if (i === 1) continue;
          inv = ar.decideInvoice(inv.id, {
            version: inv.version,
            action: 'submit',
            reason: 'Synthetic invoice awaiting independent AR review.'
          });
          if (i === 2) continue;
          finance.decideInvoice(inv.id, {
            version: inv.version,
            action: 'post',
            reason: 'Post only the synthetic local example; no external financial action.'
          });
        }
      }
    }
    db.prepare('INSERT INTO sample_packs(id,installed_at) VALUES(?,?)').run(CERTIFICATE_EXAMPLES, new Date().toISOString());
  });
}
