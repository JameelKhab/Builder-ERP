import { transaction } from './db.mjs';
import { quality } from './quality.mjs';
export const QUALITY_EXAMPLES = 'quality-v1';
export function installQualityExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(QUALITY_EXAMPLES)) return;
  transaction(db, () => {
    const reviewer = 'example-quality-reviewer';
    db.prepare("INSERT INTO users(id,name,role,active,access_version,access_admin,organisation_admin) VALUES(?,?,?,1,1,0,0)").run(reviewer, 'Noor Haddad · example quality reviewer', 'Quality & HSE officer');
    for (const company of ['jakh', 'build']) db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,can_approve,approval_limit,budget_approval_limit) VALUES(?,?,'*','quality_hse',0,'0','0')").run(reviewer, company);
    const owner = quality(db, 'ahmed', () => '2026-10-29'),
      qa = quality(db, reviewer, () => '2026-10-29');
    const attach = (svc, r, purpose, action_id) => svc.attach(r.id, {
      version: r.version,
      purpose,
      action_id,
      filename: `example-${purpose}.txt`,
      mime: 'text/plain',
      caption: `Fictional ${purpose} record for local walkthrough`,
      content_base64: Buffer.from(`SYNTHETIC EXAMPLE ONLY\n${purpose}: ${r.title}\nObserved and checked against the example acceptance criteria. No real site inspection or approval.\n`).toString('base64')
    });
    for (const project of db.prepare("SELECT id,company_id FROM projects WHERE id IN ('harbour','gardens','creek')").all()) {
      const opts = owner.options(project.company_id, project.id);
      for (let n = 0; n < 5; n++) {
        let r = owner.save(null, {
          company_id: project.company_id,
          project_id: project.id,
          title: ['Example · Concrete surface defect', 'Example · Waterproofing repair', 'Example · Reopened blockwork alignment', 'Example · Repair awaiting verification', 'Example · Corrective plan awaiting review'][n],
          work_package_id: opts.work_packages[0].id,
          location_id: opts.locations[0].id,
          requirement: 'Example inspection ITP-04 / fictional approved detail revision B',
          observation: 'A fictional site inspection identified a local defect. Use this case to follow the complete NCR process.',
          severity: n === 0 ? 'high' : 'medium',
          observed_on: '2026-10-27',
          due_date: '2026-11-03',
          owner_id: 'ahmed',
          reviewer_id: reviewer
        });
        r = attach(owner, r, 'observation');
        if (n === 0) continue;
        r = owner.decide(r.id, {
          version: r.version,
          action: 'submit',
          note: 'Fictional observation submitted for investigation.'
        });
        r = owner.plan(r.id, {
          version: r.version,
          containment: 'Mark the affected area and hold the next activity pending review.',
          root_cause: 'Example workmanship sequence was not checked at the hold point.',
          disposition: 'rework',
          remedy: 'Rework the affected area to the approved detail and repeat inspection.',
          acceptance: 'Independent visual and dimensional check against the example detail; record pass or failure.',
          reason: 'Fictional corrective and preventive plan.',
          actions: [{
            title: 'Rework the affected area and record the check',
            owner_id: 'ahmed',
            due_date: '2026-11-02'
          }],
          impacts: ['cost', 'waste', 'change', 'delay'].map(kind => ({
            kind,
            assessment: n === 1 && kind === 'waste' ? 'follow_up' : 'none',
            reason: n === 1 && kind === 'waste' ? 'Confirm material recovery and disposal destination.' : 'No downstream consequence expected in this fictional scenario.',
            owner_id: 'ahmed',
            due_date: '2026-11-04'
          }))
        });
        r = attach(owner, r, 'plan');
        r = owner.decide(r.id, {
          version: r.version,
          action: 'submit_plan',
          note: 'Review the corrective plan.'
        });
        if (n === 4) continue;
        r = qa.decide(r.id, {
          version: r.version,
          action: 'approve_plan',
          note: 'Example independent plan review.'
        });
        if (n === 1) continue;
        r = attach(owner, r, 'action', r.actions[0].id);
        r = owner.completeAction(r.id, r.actions[0].id, {
          version: r.version,
          note: 'Example corrective work completed and recorded.'
        });
        r = owner.decide(r.id, {
          version: r.version,
          action: 'request_verification',
          note: 'All example actions are complete.'
        });
        if (n === 3) continue;
        r = attach(qa, r, 'verification');
        r = qa.decide(r.id, {
          version: r.version,
          action: 'close',
          note: 'Fictional independent check satisfied the stated acceptance criteria.'
        });
        qa.decide(r.id, {
          version: r.version,
          action: 'reopen',
          note: 'Later fictional inspection identified recurrence. Investigate a new cycle without deleting the earlier closure.'
        });
      }
    }
    db.prepare('INSERT INTO sample_packs(id,installed_at) VALUES(?,?)').run(QUALITY_EXAMPLES, new Date().toISOString());
  });
}
