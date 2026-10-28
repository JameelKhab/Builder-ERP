import { transaction } from './db.mjs';
import { foundations } from './foundations.mjs';
import { money, D } from './money.mjs';
// Fictional reviewed budget examples. Never change an existing person's authority.
export function installFoundationExamples(db) {
  const pack = 'project-budget-v1';
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(pack)) return;
  transaction(db, () => {
    const reviewer = 'example-budget-reviewer';
    if (db.prepare('SELECT id FROM users WHERE id=?').get(reviewer)) throw new Error('Example reviewer identifier is already in use.');
    db.prepare("INSERT INTO users(id,name,role,active,access_version,access_admin,organisation_admin) VALUES(?,?,?,1,1,0,0)").run(reviewer, 'Leila Hassan · example budget reviewer', 'Financial controller');
    const author = foundations(db, 'ahmed'),
      review = foundations(db, reviewer);
    for (const company of db.prepare("SELECT id FROM companies WHERE id IN('jakh','build')").all()) db.prepare("INSERT INTO memberships(user_id,company_id,project_id,can_approve,approval_limit,role_id,budget_approval_limit) VALUES(?,?,'*',0,'0','financial_controller','1000000.00')").run(reviewer, company.id);
    for (const p of db.prepare("SELECT * FROM projects WHERE id IN('harbour','gardens','creek')").all()) {
      if (!p.manager_id && p.version === 1) author.saveProject(p.id, {
        ...p,
        manager_id: 'ahmed',
        planned_start: '2026-01-02',
        planned_end: '2027-12-31',
        customer_reference: `Fictional award ${p.code}`,
        description: 'Synthetic construction project for local workflow examples.',
        reason: 'Complete the fictional project setup example without changing company or budget.'
      });
      const w = author.workspace(p.company_id, p.id).packages.find(w => w.kind === 'item');
      if (!w) continue;
      const input = {
        project_id: p.id,
        kind: 'revision',
        basis: 'Fictional example: release an additional 1,000 of the existing approved budget for upcoming site procurement. Total and original budgets remain unchanged.',
        title: 'Example · release existing budget for buying',
        lines: [{
          work_package_id: w.id,
          proposed_budget: w.position.revised_budget,
          proposed_release: money(new D(w.position.released_capacity).plus(1000)),
          note: 'No increase to the total project budget; only a controlled release.'
        }]
      };
      let d = author.saveBudget(null, input);
      d = author.decideBudget(d.id, {
        version: d.version,
        action: 'submit',
        reason: 'Submit the fictional released-capacity adjustment for independent review.'
      });
      review.decideBudget(d.id, {
        version: d.version,
        action: 'approve',
        reason: 'Illustrative independent budget review. Capacity is within the existing budget.'
      });
      const current = author.workspace(p.company_id, p.id).packages.find(x => x.id === w.id);
      const next = {
        ...input,
        title: 'Example · proposed scope allowance',
        basis: 'Fictional proposal for additional work. It does not affect budget until independently approved.',
        lines: [{
          work_package_id: w.id,
          proposed_budget: money(new D(current.position.revised_budget).plus(25000)),
          proposed_release: current.position.released_capacity,
          note: 'Review the scope basis before approving any increase.'
        }]
      };
      d = author.saveBudget(null, next);
      author.decideBudget(d.id, {
        version: d.version,
        action: 'submit',
        reason: 'Prepared for a separate budget reviewer; no capacity change yet.'
      });
      author.saveBudget(null, {
        ...next,
        title: 'Example · draft budget assessment',
        basis: 'Fictional draft to demonstrate an editable budget assessment before submission.'
      });
    }
    db.prepare('INSERT INTO sample_packs(id,installed_at) VALUES(?,?)').run(pack, new Date().toISOString());
  });
}
