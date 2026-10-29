import { transaction } from './db.mjs';
import { ledger } from './ledger.mjs';
export const LEDGER_EXAMPLES = 'ledger-v1';
export function installLedgerExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(LEDGER_EXAMPLES)) return;
  transaction(db, () => {
    for (const [id, name, role] of [['example-ledger-author', 'Rana Ali · example accountant', 'accountant'], ['example-ledger-reviewer', 'Omar Saleh · example controller', 'financial_controller']]) {
      db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, name, role);
      for (const company of ['jakh', 'build']) db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,ledger_approval_limit) VALUES(?,?,'*',?,?)").run(id, company, role, role === 'financial_controller' ? '1000000' : '0');
    }
    const author = ledger(db, 'example-ledger-author', () => '2026-10-29'),
      reviewer = ledger(db, 'example-ledger-reviewer', () => '2026-10-29');
    for (const company of ['jakh', 'build']) {
      const accounts = [['5100', 'Example · Site support expense', 'expense'], ['2200', 'Example · Accrued site support', 'liability'], ['5101', 'Example · Testing expense', 'expense']].map(([code, name, type]) => reviewer.account(null, {
        company_id: company,
        code,
        name,
        type,
        purpose: 'general',
        active: true,
        reason: 'Fictional chart for local accounting examples; no production policy inferred.'
      }));
      reviewer.period({
        company_id: company,
        name: 'Example · October 2026',
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        reason: 'Fictional open accounting period for local walkthroughs.'
      });
      for (const p of db.prepare("SELECT id FROM projects WHERE company_id=? AND id IN ('harbour','gardens','creek')").all(company)) {
        for (let n = 0; n < 3; n++) {
          let r = author.save(null, {
            company_id: company,
            project_id: p.id,
            title: ['Example · Site support accrual', 'Example · Review testing accrual', 'Example · Accrual corrected by reversal'][n],
            accounting_date: '2026-10-24',
            currency: 'EUR',
            rate: company === 'jakh' ? '4.266667' : '1.162',
            rate_date: '2026-10-24',
            rate_source: 'Fictional accounting FX snapshot; not a market rate',
            source_reference: 'EXAMPLE-ACCRUAL-WORKSHEET',
            explanation: 'Synthetic accrual only. No supplier bill, actual cash or construction cost opening is created.',
            lines: [{
              account_id: accounts[0].id,
              description: 'Fictional site support',
              debit: '100.01',
              credit: '0'
            }, {
              account_id: accounts[2].id,
              description: 'Fictional testing support',
              debit: '200.02',
              credit: '0'
            }, {
              account_id: accounts[1].id,
              description: 'Fictional accrued obligation',
              debit: '0',
              credit: '300.03'
            }]
          });
          r = author.decide(r.id, {
            version: r.version,
            action: 'submit',
            reason: 'Fictional entry submitted for independent accounting review.'
          });
          if (n === 1) continue;
          r = reviewer.decide(r.id, {
            version: r.version,
            action: 'post',
            reason: 'Independent fictional reviewer confirmed equal sides and the example source.'
          });
          if (n === 2) {
            let rev = author.reverse(r.id, {
              version: r.version,
              accounting_date: '2026-10-26',
              reason: 'Fictional original accrual no longer required; retain both accounting periods.'
            });
            rev = author.decide(rev.id, {
              version: rev.version,
              action: 'submit',
              reason: 'Fictional full reversal for independent review.'
            });
            reviewer.decide(rev.id, {
              version: rev.version,
              action: 'post',
              reason: 'Independent fictional reversal reviewed.'
            });
          }
        }
      }
    }
    db.prepare('INSERT INTO sample_packs(id,installed_at) VALUES(?,?)').run(LEDGER_EXAMPLES, new Date().toISOString());
  });
}
