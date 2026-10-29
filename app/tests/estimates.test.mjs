import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { estimates } from '../server/estimates.mjs';
import { sampleEstimate, installEstimateExamples } from '../server/estimates-examples.mjs';
import { masters } from '../server/masters.mjs';
import { createService } from '../server/service.mjs';
import { estimateRatio, allocateEstimatePool, calculateEstimate } from '../server/estimates-calculation.mjs';
import { estimateRegisterCsv, estimateDetailCsv } from '../src/estimates-export.js';
const today = () => '2026-10-29';
function fixture(t) {
  const db = openDatabase();
  t.after(() => db.close());
  for (const [id, role] of [['estimate-author', 'estimator'], ['estimate-reviewer', 'tendering_manager']]) {
    db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, id, role);
    db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,estimate_approval_limit) VALUES(?,'jakh','*',?,'1000000')").run(id, role);
  }
  const customer = masters(db, 'ahmed', today).saveParty(null, {
    company_id: 'jakh',
    name: 'Test customer',
    customer: true,
    supplier: false,
    subcontractor: false,
    reason: 'Test customer identity'
  });
  const input = sampleEstimate({
    id: 'jakh',
    currency: 'AED'
  }, customer.party_id, today());
  return {
    db,
    input,
    maker: estimates(db, 'estimate-author', today),
    reviewer: estimates(db, 'estimate-reviewer', today),
    pm: estimates(db, 'ahmed', today)
  };
}
const act = (svc, r, action) => svc.decide(r.id, {
  version: r.version,
  action,
  reason: 'Test reviewed quantities, rate evidence and scope'
});
const approved = f => act(f.reviewer, act(f.maker, f.maker.save(null, f.input), 'submit'), 'approve');
const project = {
  code: 'TENDER',
  name: 'Test awarded setup',
  location: 'Fictional site',
  manager_id: 'ahmed',
  planned_start: '2026-11-01',
  planned_end: '2027-10-01'
};
test('source arithmetic: eleven buildings, one variant, assemblies, indirect and ordered pricing', t => {
  const f = fixture(t),
    r = f.maker.save(null, f.input),
    totals = r.calculation.totals;
  assert.equal(totals.direct, '23520.00');
  assert.equal(totals.indirect, '2352.00');
  assert.equal(totals.budget, '25872.00');
  assert.equal(totals.selling, '34151.04');
  assert.equal(totals.margin, '8279.04');
  const l = r.calculation.rows.find(l => l.key === 'structure');
  assert.equal(l.total_quantity, '112');
  assert.equal(l.direct, '8960.00');
  assert.equal(l.indirect, '896.00');
  assert.equal(l.selling, '13009.92');
  assert.equal(l.secondary_quantity, '13440');
  assert.equal(r.calculation.rows[0].budget, totals.budget);
  assert.equal(r.calculation.resource_count, 4);
});
test('exact rational products, fractional price bases and largest-remainder allocation reconcile', () => {
  assert.equal(estimateRatio(['0.000001', '0.000001', '999999999999', '999999999999'], '0.000001'), '999999999998000000.00');
  assert.equal(estimateRatio(['1', '1', '1'], '6'), '0.17');
  assert.deepEqual(allocateEstimatePool('0.02', [{
    key: 'b',
    code: 'B',
    direct: '1'
  }, {
    key: 'a',
    code: 'A',
    direct: '1'
  }, {
    key: 'c',
    code: 'C',
    direct: '1'
  }]), {
    a: '0.01',
    b: '0.01',
    c: '0.00'
  });
  assert.throws(() => allocateEstimatePool('1', [{
    key: 'a',
    code: 'A',
    direct: '0'
  }]), /positive direct/);
});
test('zero overrides, foreign resource FX and multiple pricing stages remain explicit', t => {
  const f = fixture(t),
    input = structuredClone(f.input);
  input.overrides.push({
    line_key: 'finishes',
    building: 10,
    quantity: '0',
    reason: 'Omitted by scope'
  });
  input.resources[0] = {
    ...input.resources[0],
    currency: 'EUR',
    unit_rate: '100',
    price_basis: '10',
    rate: '4'
  };
  input.header_markup = '5';
  input.lines[1].item_markup = '2';
  const r = f.maker.save(null, input);
  assert.equal(r.calculation.rows.find(l => l.key === 'finishes').total_quantity, '204');
  assert.equal(r.calculation.rows.find(l => l.key === 'structure').resources[0].amount, '4480.00');
  assert.equal(r.resources[0].currency, 'EUR');
  assert.equal(r.calculation.policy, 'builder-estimate-v1');
  assert.match(r.calculation.findings[0], /4 explicit/);
});
test('invalid group cycles, units, references, rates, unsupported caps and duplicate overrides are rejected atomically', t => {
  const f = fixture(t);
  for (const edit of [i => i.lines[1].unit = 'unknown', i => i.lines[0].parent_key = 'construction', i => i.lines[1].cost_code_id = 'build-GENERAL', i => i.lines[1].direct_rate = '4', i => i.rate = '2', i => i.rate_date = '2026-12-01', i => i.lines[1].share = '25', i => i.overrides.push({
    ...i.overrides[0]
  }), i => i.overrides[0].building = 12, i => i.resources[0].line_key = 'construction', i => i.resources[0].price_basis = '0']) {
    const i = structuredClone(f.input);
    edit(i);
    assert.throws(() => f.maker.save(null, i));
  }
  assert.equal(f.db.prepare('SELECT count(*) n FROM estimate_versions').get().n, 0);
});
test('independent authority, stale saves and immutable approved input evidence', t => {
  const f = fixture(t);
  let r = f.maker.save(null, f.input);
  assert.throws(() => f.maker.save(r.id, {
    ...r,
    version: 0,
    reason: 'Stale edit'
  }), {
    status: 409
  });
  r = act(f.maker, r, 'submit');
  assert.throws(() => f.maker.save(r.id, {
    ...r,
    reason: 'Forbidden submitted edit'
  }), {
    status: 403
  });
  assert.throws(() => act(f.maker, r, 'approve'), {
    status: 403
  });
  f.db.prepare("UPDATE memberships SET estimate_approval_limit='30000' WHERE user_id='estimate-reviewer'").run();
  assert.throws(() => act(f.reviewer, r, 'approve'), {
    status: 403
  });
  f.db.prepare("UPDATE memberships SET estimate_approval_limit='40000' WHERE user_id='estimate-reviewer'").run();
  r = act(f.reviewer, r, 'approve');
  assert.equal(r.approved_by, 'estimate-reviewer');
  for (const sql of ["UPDATE estimate_versions SET title='X' WHERE id=?", "UPDATE estimate_lines SET description='X' WHERE version_id=?", "DELETE FROM estimate_resources WHERE version_id=?", "DELETE FROM estimate_overrides WHERE version_id=?", "DELETE FROM estimate_events WHERE version_id=?"]) assert.throws(() => f.db.prepare(sql).run(r.id), /immutable|retained/);
  assert.throws(() => act(f.reviewer, r, 'approve'));
});
test('returned drafts refresh customer snapshots and preserve past decisions', t => {
  const f = fixture(t);
  let r = act(f.maker, f.maker.save(null, f.input), 'submit');
  f.db.prepare("UPDATE parties SET name='Renamed',version=version+1 WHERE id=?").run(f.input.customer_id);
  assert.throws(() => act(f.reviewer, r, 'approve'), {
    status: 409
  });
  r = act(f.reviewer, r, 'return');
  r = f.maker.save(r.id, {
    ...r,
    reason: 'Refresh customer after independent return'
  });
  assert.equal(r.customer.name, 'Renamed');
  r = act(f.reviewer, act(f.maker, r, 'submit'), 'approve');
  assert.ok(r.history.some(e => e.action === 'return'));
  assert.equal(r.history.length, 6);
});
test('revision copies stable identities, comparisons and latest-only reports never double count', t => {
  const f = fixture(t),
    old = approved(f);
  let r = f.maker.revise(old.id, {
    version: old.version,
    reason: 'Changed resource quote'
  });
  assert.equal(r.revision, 2);
  assert.deepEqual(r.lines.map(l => l.key), old.lines.map(l => l.key));
  assert.throws(() => f.maker.revise(old.id, {
    version: old.version,
    reason: 'Duplicate revision'
  }));
  r = f.maker.save(r.id, {
    ...r,
    resources: r.resources.map((x, i) => i === 0 ? {
      ...x,
      unit_rate: '42'
    } : x),
    reason: 'Updated material cost'
  });
  const comparison = f.maker.compare(r.id, old.id);
  assert.equal(comparison.rows.length, 3);
  assert.equal(comparison.budget_delta, '224.00');
  assert.equal(comparison.rows.find(r => r.key === 'finishes').cause, 'Indirect allocation changed');
  assert.equal(comparison.rows.find(r => r.key === 'finishes').indirect_delta, '-8.45');
  assert.equal(f.maker.detail(old.id).calculation.totals.budget, '25872.00');
  assert.equal(f.maker.report('jakh').rows.length, 1);
  assert.equal(f.maker.report('jakh').rows[0].revision, 2);
  r = act(f.maker, r, 'cancel');
  assert.equal(f.maker.report('jakh').rows[0].revision, 1);
  assert.equal(f.maker.detail(old.id).can_revise, true);
  assert.equal(f.maker.revise(old.id, {
    version: old.version,
    reason: 'New attempt after cancellation'
  }).revision, 3);
});
test('company and project scope applies to detail, report, search, exports and writes', t => {
  const f = fixture(t),
    company = f.maker.save(null, f.input),
    harbour = f.maker.save(null, {
      ...f.input,
      project_id: 'harbour'
    }),
    gardens = f.maker.save(null, {
      ...f.input,
      project_id: 'gardens'
    });
  f.db.prepare("UPDATE memberships SET project_id='harbour' WHERE user_id='estimate-author'").run();
  assert.throws(() => f.maker.detail(company.id), {
    status: 404
  });
  assert.throws(() => f.maker.detail(gardens.id), {
    status: 404
  });
  assert.throws(() => f.maker.save(null, f.input), {
    status: 403
  });
  assert.throws(() => f.maker.save(null, {
    ...f.input,
    project_id: 'gardens'
  }), {
    status: 403
  });
  const report = f.maker.report('jakh');
  assert.deepEqual(report.rows.map(r => r.id), [harbour.id]);
  assert.ok(!estimateRegisterCsv(report).includes(gardens.id));
  assert.equal(createService(f.db, 'estimate-author', today).search('jakh', company.id).length, 0);
  assert.equal(createService(f.db, 'estimate-author', today).search('jakh', harbour.id).length, 1);
  assert.equal(f.maker.options('jakh').can_create, false);
  assert.equal(f.maker.options('jakh', 'harbour').can_create, true);
});
test('handover creates typed hierarchy, quantities and zero-release draft budget exactly once', t => {
  const f = fixture(t),
    r = approved(f);
  assert.throws(() => f.maker.handover(r.id, {
    version: r.version,
    project,
    reason: 'No project authority'
  }), {
    status: 403
  });
  const h = f.pm.handover(r.id, {
    version: r.version,
    project,
    reason: 'Controlled reviewed study to project setup'
  });
  const p = f.db.prepare('SELECT * FROM projects WHERE id=?').get(h.handover.project_id),
    b = f.db.prepare('SELECT * FROM budget_documents WHERE id=?').get(h.handover.budget_id);
  assert.equal(p.budget_status, 'unapproved');
  assert.equal(b.state, 'draft');
  const lines = f.db.prepare('SELECT * FROM budget_lines WHERE document_id=?').all(b.id);
  assert.equal(lines.length, 3);
  assert.ok(lines.every(l => l.proposed_release === '0.00'));
  assert.equal(f.db.prepare('SELECT count(*) n FROM budget_facts WHERE document_id=?').get(b.id).n, 0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM project_locations WHERE project_id=?').get(p.id).n, 12);
  assert.equal(h.handover.lines.length, 4);
  assert.equal(f.pm.handover(r.id, {
    version: r.version,
    project,
    reason: 'Retry'
  }).handover.project_id, p.id);
  assert.throws(() => f.maker.revise(r.id, {
    version: r.version,
    reason: 'No uncontrolled post-handover revision'
  }));
});
test('handover rolls back on invalid project and rechecks revoked or insufficient estimate approval', t => {
  const f = fixture(t),
    r = approved(f);
  const count = f.db.prepare('SELECT count(*) n FROM projects').get().n;
  assert.throws(() => f.pm.handover(r.id, {
    version: r.version,
    project: {
      ...project,
      manager_id: 'estimate-author'
    },
    reason: 'Bad manager'
  }));
  assert.equal(f.db.prepare('SELECT count(*) n FROM projects').get().n, count);
  f.db.prepare("UPDATE memberships SET estimate_approval_limit='1' WHERE user_id='estimate-reviewer'").run();
  assert.throws(() => f.pm.handover(r.id, {
    version: r.version,
    project,
    reason: 'Revoked value authority'
  }), /authority/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM estimate_handovers').get().n, 0);
});
test('foreign estimate authority uses functional currency and export neutralises formulas', t => {
  const f = fixture(t);
  let r = f.maker.save(null, {
    ...f.input,
    title: '=HYPERLINK(test)',
    currency: 'USD',
    rate: '4',
    resources: f.input.resources.map(x => ({
      ...x,
      currency: 'USD'
    }))
  });
  r = act(f.maker, r, 'submit');
  f.db.prepare("UPDATE memberships SET estimate_approval_limit='100000' WHERE user_id='estimate-reviewer'").run();
  assert.throws(() => act(f.reviewer, r, 'approve'), {
    status: 403
  });
  const csv = estimateDetailCsv(r);
  assert.match(csv, /Resources|Resource line/);
  assert.match(estimateRegisterCsv(f.maker.report('jakh')), /'=HYPERLINK/);
  assert.equal(r.calculation.totals.company_selling, '136604.16');
});
test('additive examples provide approved, returned, FX and revised studies in each existing project', t => {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  const before = db.prepare('SELECT count(*) n FROM estimate_versions').get().n;
  installEstimateExamples(db);
  assert.equal(db.prepare('SELECT count(*) n FROM estimate_versions').get().n, before);
  assert.equal(before, 29);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  for (const p of db.prepare('SELECT * FROM projects').all()) {
    const r = estimates(db, 'ahmed', today).report(p.company_id, {
      project: p.id
    });
    assert.equal(r.rows.length, 8);
    assert.ok(r.rows.some(x => x.state === 'returned'));
    assert.ok(r.rows.some(x => x.revision === 2));
  }
});
test('disabled reviewers cannot authorise handover and live author access is required for approval', t => {
  const f = fixture(t),
    r = approved(f);
  f.db.prepare("UPDATE users SET active=0 WHERE id='estimate-reviewer'").run();
  assert.throws(() => f.pm.handover(r.id, {
    version: r.version,
    project,
    reason: 'Disabled reviewer must not authorise new setup'
  }), /authority/);
  f.db.prepare("UPDATE users SET active=1 WHERE id='estimate-reviewer'").run();
  let next = f.maker.revise(r.id, {
    version: r.version,
    reason: 'Review a fresh resource revision'
  });
  next = act(f.maker, next, 'submit');
  f.db.prepare("UPDATE memberships SET role_id='planner' WHERE user_id='estimate-author'").run();
  assert.throws(() => act(f.reviewer, next, 'approve'), {
    status: 403
  });
  assert.equal(act(f.reviewer, next, 'return').state, 'returned');
});
test('active project studies direct users to budget changes instead of offering duplicate setup', t => {
  const f = fixture(t);
  const r = act(f.reviewer, act(f.maker, f.maker.save(null, {
    ...f.input,
    project_id: 'harbour'
  }), 'submit'), 'approve');
  const d = f.pm.detail(r.id);
  assert.equal(d.can_handover, false);
  assert.match(d.handover_blocker, /budget revision/);
  assert.throws(() => f.pm.handover(r.id, {
    version: r.version,
    reason: 'Must not recreate active setup'
  }), /no work items/);
});
