import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, transaction } from '../server/db.mjs';
import { foundations } from '../server/foundations.mjs';
import { createService } from '../server/service.mjs';
import { procurement } from '../server/procurement.mjs';
import { sourcingAvailable } from '../server/cost-ledger.mjs';
import { accessAdmin } from '../server/access-admin.mjs';
import { installFoundationExamples } from '../server/foundations-examples.mjs';
function fixture(t) {
  const db = openDatabase();
  t.after(() => db.close());
  db.prepare("UPDATE memberships SET budget_approval_limit='100000000' WHERE user_id='sara'").run();
  return {
    db,
    pm: foundations(db, 'ahmed'),
    review: foundations(db, 'sara'),
    site: foundations(db, 'mohammed')
  };
}
const projectInput = {
  company_id: 'jakh',
  name: 'New tower',
  code: 'NT-001',
  location: 'Dubai',
  manager_id: 'ahmed',
  planned_start: '2026-11-01',
  planned_end: '2028-11-01',
  customer_reference: 'Fictional direct award',
  provenance: 'Direct award ABC-01',
  reason: 'Create fictional project for connected acceptance.'
};
function setup(f) {
  const p = f.pm.saveProject(null, projectInput),
    g = f.pm.savePackage(null, {
      project_id: p.id,
      code: 'BUILD',
      name: 'Building works',
      kind: 'group',
      cost_code_id: 'jakh-GENERAL',
      reason: 'Group construction work by scope.'
    });
  const w = f.pm.savePackage(null, {
    project_id: p.id,
    parent_id: g.id,
    code: 'STR',
    name: 'Structural frame',
    kind: 'item',
    cost_code_id: 'jakh-GENERAL',
    reason: 'Create the structural work item.'
  });
  return {
    p,
    g,
    w
  };
}
const makeBudget = (f, p, w, kind = 'baseline', value = '100000', release = '50000') => f.pm.saveBudget(null, {
  project_id: p.id,
  kind,
  title: 'Scope budget',
  basis: 'Detailed fictional estimate approved for scope review.',
  lines: [{
    work_package_id: w.id,
    proposed_budget: value,
    proposed_release: release,
    note: 'Concrete, reinforcement and formwork.'
  }]
});
function approve(f, d) {
  d = f.pm.decideBudget(d.id, {
    version: d.version,
    action: 'submit',
    reason: 'Ready for independent review.'
  });
  return f.review.decideBudget(d.id, {
    version: d.version,
    action: 'approve',
    reason: 'Estimate and scope reviewed independently.'
  });
}
test('organisation administration is separate, currencies fixed, new companies have no automatic grants', t => {
  const f = fixture(t);
  assert.throws(() => f.site.organisation(), {
    status: 403
  });
  assert.throws(() => f.review.organisation(), {
    status: 403
  });
  const c = f.pm.saveCompany(null, {
    name: 'Example Company',
    legal_name: 'Example Construction LLC',
    currency: 'EUR',
    country_code: 'DE',
    reason: 'Create a separate fictional legal entity.'
  });
  assert.equal(f.db.prepare('SELECT count(*) n FROM memberships WHERE company_id=?').get(c.id).n, 0);
  assert.throws(() => f.pm.saveCompany(c.id, {
    ...c,
    currency: 'USD',
    reason: 'Attempt functional currency replacement.'
  }), /currency is fixed/);
  assert.throws(() => f.pm.saveCompany(null, {
    ...c,
    currency: 'OMR',
    reason: 'Unsupported minor units.'
  }), /two-decimal/);
  assert.throws(() => f.site.saveCompany(c.id, {
    ...c,
    reason: 'Invalid actor update.'
  }), {
    status: 403
  });
  assert.equal(f.pm.organisation().history.length, 1);
});
test('project dates, uniqueness, immutable company and company-wide creation rights are enforced', t => {
  const f = fixture(t),
    p = f.pm.saveProject(null, projectInput);
  assert.equal(p.budget_status, 'unapproved');
  assert.equal(f.pm.workspace('jakh', p.id).locations.length, 1);
  assert.throws(() => f.pm.saveProject(null, projectInput), /code/);
  assert.throws(() => f.pm.saveProject(null, {
    ...projectInput,
    code: 'BAD-DATE',
    planned_end: '2026-01-01'
  }), /End date/);
  assert.throws(() => f.pm.saveProject(p.id, {
    ...p,
    company_id: 'build',
    reason: 'Wrong company.'
  }), /legal company/);
  assert.throws(() => f.site.saveProject(null, {
    ...projectInput,
    code: 'UNAUTH'
  }), {
    status: 403
  });
  assert.throws(() => f.pm.saveProject(p.id, {
    ...p,
    phase: 'Completed',
    reason: 'Bypass closeout controls.'
  }), /closure/);
  assert.throws(() => f.pm.saveProject(null, {
    ...projectInput,
    code: 'NO-MGR-SCOPE',
    manager_id: 'mohammed'
  }), /project-management access/);
  const next = f.pm.saveProject(p.id, {
    ...p,
    name: 'Renamed tower',
    reason: 'Correct project title.'
  });
  assert.throws(() => f.pm.saveProject(p.id, {
    ...p,
    name: 'Stale title',
    reason: 'Stale edit.'
  }), {
    status: 409
  });
  assert.equal(next.version, 2);
});
test('location and WBS hierarchies reject cycles, foreign parents, group purchasing and duplicate codes', t => {
  const f = fixture(t),
    {
      p,
      g,
      w
    } = setup(f),
    root = f.pm.workspace('jakh', p.id).locations[0];
  const child = f.pm.saveLocation(null, {
    project_id: p.id,
    parent_id: root.id,
    code: 'L01',
    name: 'Level 1',
    kind: 'floor',
    reason: 'Define site floor.'
  });
  assert.throws(() => f.pm.saveLocation(root.id, {
    ...root,
    parent_id: child.id,
    reason: 'Invalid cyclic edit.'
  }), /ancestor/);
  assert.throws(() => f.pm.saveLocation(null, {
    project_id: p.id,
    parent_id: 'creek-site',
    code: 'BAD',
    name: 'Bad',
    kind: 'floor',
    reason: 'Wrong scope.'
  }), /belong/);
  const hierarchy = f.pm.workspace('jakh', p.id).locations;
  assert.equal(hierarchy[0].id, root.id);
  assert.equal(hierarchy[1].id, child.id);
  assert.equal(hierarchy[1].depth, 1);
  const group = f.pm.savePackage(null, {
    project_id: p.id,
    parent_id: g.id,
    code: 'SUB',
    name: 'Subgroup',
    kind: 'group',
    cost_code_id: 'jakh-GENERAL',
    reason: 'Create nested group.'
  });
  assert.throws(() => f.pm.savePackage(g.id, {
    ...g,
    parent_id: group.id,
    reason: 'Invalid cyclic structure.'
  }), /ancestor/);
  assert.throws(() => f.pm.savePackage(null, {
    project_id: p.id,
    parent_id: w.id,
    code: 'BAD',
    name: 'Child of item',
    kind: 'item',
    cost_code_id: 'jakh-GENERAL',
    reason: 'Invalid parent.'
  }), /Parent must/);
  assert.throws(() => procurement(f.db, 'ahmed').createRequest({
    company_id: 'jakh',
    project_id: p.id,
    title: 'Group request',
    needed_by: '2027-01-01',
    lines: [{
      product_id: 'jakh-BLOCK',
      work_package_id: g.id,
      location_id: root.id,
      quantity: '1'
    }]
  }), /work package/);
  assert.throws(() => createService(f.db, 'ahmed').create({
    company_id: 'jakh',
    project_id: p.id,
    item_id: g.cost_item_id,
    title: 'Group bypass',
    location: 'Site',
    due: '2027-01-01',
    quantity: '1',
    unit: 'unit',
    unit_price: '1'
  }), /not a group/);
});
test('original baseline covers all leaves, excludes group double counting and remains unknown before approval', t => {
  const f = fixture(t),
    {
      p,
      g,
      w
    } = setup(f);
  let report = createService(f.db, 'ahmed').report('jakh', p.id);
  assert.equal(report.rows.length, 1);
  assert.equal(report.totals.original_budget, null);
  assert.equal(report.totals.revised_budget, null);
  assert.ok(report.findings.some(x => x.id === 'unapproved_budget'));
  assert.equal(f.pm.workspace('jakh', p.id).packages.find(x => x.id === g.id).position.revised_budget, null);
  const d = approve(f, makeBudget(f, p, w));
  assert.equal(d.state, 'approved');
  report = createService(f.db, 'ahmed').report('jakh', p.id);
  assert.equal(report.totals.original_budget, '100000.00');
  assert.equal(report.totals.revised_budget, '100000.00');
  assert.equal(report.totals.forecast, null);
  assert.equal(f.pm.workspace('jakh', p.id).packages.find(x => x.id === g.id).position.revised_budget, '100000.00');
  assert.equal(sourcingAvailable(f.db, w.cost_item_id).toFixed(2), '50000.00');
  assert.throws(() => makeBudget(f, p, w), /baseline already/);
  assert.equal(f.db.prepare('PRAGMA foreign_key_check').all().length, 0);
});
test('baseline rejects omissions and stale work additions; independent approval never uses purchase authority', t => {
  const f = fixture(t),
    {
      p,
      w
    } = setup(f);
  let d = makeBudget(f, p, w);
  assert.throws(() => f.pm.decideBudget(d.id, {
    version: d.version,
    action: 'approve',
    reason: 'Self approval.'
  }), /awaiting/);
  d = f.pm.decideBudget(d.id, {
    version: d.version,
    action: 'submit',
    reason: 'Submit baseline.'
  });
  assert.throws(() => f.pm.decideBudget(d.id, {
    version: d.version,
    action: 'approve',
    reason: 'Self approval.'
  }), /author cannot/);
  f.db.prepare("UPDATE memberships SET budget_approval_limit='0' WHERE user_id='sara'").run();
  assert.throws(() => f.review.decideBudget(d.id, {
    version: d.version,
    action: 'approve',
    reason: 'Only purchase limit.'
  }), /separate budget/);
  f.db.prepare("UPDATE memberships SET budget_approval_limit='100000000' WHERE user_id='sara'").run();
  f.pm.savePackage(null, {
    project_id: p.id,
    code: 'MEP',
    name: 'Services',
    kind: 'item',
    cost_code_id: 'jakh-GENERAL',
    reason: 'Additional work scope.'
  });
  assert.throws(() => f.review.decideBudget(d.id, {
    version: d.version,
    action: 'approve',
    reason: 'Stale structure.'
  }), {
    status: 409
  });
  d = f.review.decideBudget(d.id, {
    version: d.version,
    action: 'return',
    reason: 'Refresh for new work item.'
  });
  assert.throws(() => f.pm.saveBudget(d.id, {
    ...d,
    lines: d.lines
  }), /every work item/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM budget_facts').get().n, 0);
});
test('revisions preserve original, freeze submitted content, prevent duplicate and competing approval', t => {
  const f = fixture(t),
    {
      p,
      w
    } = setup(f);
  approve(f, makeBudget(f, p, w));
  let a = makeBudget(f, p, w, 'revision', '120000', '70000'),
    b = makeBudget(f, p, w, 'revision', '130000', '80000');
  a = f.pm.decideBudget(a.id, {
    version: a.version,
    action: 'submit',
    reason: 'First revised scope.'
  });
  b = f.pm.decideBudget(b.id, {
    version: b.version,
    action: 'submit',
    reason: 'Competing revised scope.'
  });
  assert.throws(() => f.db.prepare("UPDATE budget_lines SET proposed_budget='999999' WHERE document_id=?").run(a.id), /immutable/);
  assert.throws(() => f.pm.saveBudget(a.id, {
    ...a
  }), {
    status: 403
  });
  const approved = f.review.decideBudget(a.id, {
    version: a.version,
    action: 'approve',
    reason: 'Approve first proposal.'
  });
  assert.throws(() => f.review.decideBudget(a.id, {
    version: a.version,
    action: 'approve',
    reason: 'Duplicate approval.'
  }), {
    status: 409
  });
  assert.throws(() => f.review.decideBudget(b.id, {
    version: b.version,
    action: 'approve',
    reason: 'Stale parallel proposal.'
  }), {
    status: 409
  });
  const report = createService(f.db, 'ahmed').report('jakh', p.id);
  assert.equal(report.totals.original_budget, '100000.00');
  assert.equal(report.totals.revised_budget, '120000.00');
  assert.equal(report.totals.cash, '0.00');
  assert.equal(report.totals.incurred, '0.00');
  assert.equal(approved.history.at(-1).actor_id, 'sara');
  assert.throws(() => f.db.prepare("UPDATE budget_documents SET title='Changed' WHERE id=?").run(a.id), /immutable/);
  assert.throws(() => f.db.prepare('DELETE FROM budget_facts').run(), /append-only/);
});
test('budget reductions cannot underfund opening commitments, incurred cost, reservations or local orders', t => {
  const f = fixture(t);
  const p = {
      id: 'harbour'
    },
    w = {
      id: 'WP-C-101'
    };
  assert.throws(() => {
    const d = makeBudget(f, p, w, 'revision', '11000000', '100000');
    f.pm.decideBudget(d.id, {
      version: d.version,
      action: 'submit',
      reason: 'Underfund opening cost.'
    });
  }, /committed or incurred/);
  f.db.prepare("UPDATE requests SET status='approved' WHERE id='PR-0264'").run();
  assert.throws(() => {
    const d = makeBudget(f, p, w, 'revision', '18000000', '0');
    f.pm.decideBudget(d.id, {
      version: d.version,
      action: 'submit',
      reason: 'Underfund reservation.'
    });
  }, /reservations/);
  assert.throws(() => {
    const d = makeBudget(f, p, w, 'revision', '18000000', '7000000');
    f.pm.decideBudget(d.id, {
      version: d.version,
      action: 'submit',
      reason: 'Double allocate budget.'
    });
  }, /opening commitments/);
});
test('approval checks live costs after submission and rolls back all facts if any line is invalid', t => {
  const f = fixture(t),
    {
      p,
      w
    } = setup(f);
  approve(f, makeBudget(f, p, w));
  let d = makeBudget(f, p, w, 'revision', '80000', '40000');
  d = f.pm.decideBudget(d.id, {
    version: d.version,
    action: 'submit',
    reason: 'Review reduction.'
  });
  f.db.prepare("INSERT INTO construction_cost_facts VALUES('test-cost','jakh',?,?,'commitment','45000','test','late-order','2026-10-29')").run(p.id, w.cost_item_id);
  assert.throws(() => f.review.decideBudget(d.id, {
    version: d.version,
    action: 'approve',
    reason: 'Costs changed since submission.'
  }), /reservations/);
  assert.equal(f.pm.budgetDetail(d.id).state, 'submitted');
  assert.equal(f.db.prepare('SELECT count(*) n FROM budget_facts WHERE document_id=?').get(d.id).n, 0);
});
test('gross changes determine authority; offsetting revisions cannot conceal a high value change', t => {
  const f = fixture(t),
    {
      p,
      w
    } = setup(f);
  const w2 = f.pm.savePackage(null, {
    project_id: p.id,
    code: 'MEP',
    name: 'MEP',
    kind: 'item',
    cost_code_id: 'jakh-GENERAL',
    reason: 'Add services.'
  });
  let d = f.pm.saveBudget(null, {
    project_id: p.id,
    kind: 'baseline',
    title: 'Two item budget',
    basis: 'Detailed scope baseline.',
    lines: [w, w2].map(x => ({
      work_package_id: x.id,
      proposed_budget: '100000',
      proposed_release: '0'
    }))
  });
  approve(f, d);
  d = f.pm.saveBudget(null, {
    project_id: p.id,
    kind: 'revision',
    title: 'Budget transfer',
    basis: 'Transfer between work items.',
    lines: [{
      work_package_id: w.id,
      proposed_budget: '110000',
      proposed_release: '0'
    }, {
      work_package_id: w2.id,
      proposed_budget: '90000',
      proposed_release: '0'
    }]
  });
  assert.equal(d.approval_amount, '20000.00');
  d = f.pm.decideBudget(d.id, {
    version: d.version,
    action: 'submit',
    reason: 'Submit balanced transfer.'
  });
  f.db.prepare("UPDATE memberships SET budget_approval_limit='15000' WHERE user_id='sara'").run();
  assert.throws(() => f.review.decideBudget(d.id, {
    version: d.version,
    action: 'approve',
    reason: 'Not enough gross authority.'
  }), /separate budget/);
});
test('budget and setup services enforce current scope, redaction and revocation across direct endpoints', t => {
  const f = fixture(t);
  const d = makeBudget(f, {
    id: 'harbour'
  }, {
    id: 'WP-C-101'
  }, 'revision', '18000000', '200000');
  assert.throws(() => f.site.budgetDetail(d.id), {
    status: 404
  });
  const view = f.site.workspace('jakh', 'harbour');
  assert.equal(view.budgets.length, 0);
  assert.ok(view.packages.every(w => w.position === undefined && w.cost_item_id === undefined));
  assert.throws(() => f.site.workspace('jakh', 'gardens'), {
    status: 404
  });
  assert.throws(() => f.pm.saveBudget(null, {
    project_id: 'harbour',
    kind: 'revision',
    title: 'Invalid',
    basis: 'Cross-company injection.',
    lines: [{
      work_package_id: 'WP-C-301',
      proposed_budget: '1',
      proposed_release: '0'
    }]
  }), /this project/);
  const s = f.pm.decideBudget(d.id, {
    version: d.version,
    action: 'submit',
    reason: 'Scope test.'
  });
  f.db.prepare("DELETE FROM memberships WHERE user_id='sara'").run();
  assert.throws(() => f.review.decideBudget(d.id, {
    version: s.version,
    action: 'approve',
    reason: 'Revoked reviewer.'
  }), {
    status: 404
  });
});
test('budget approval grants are reviewed separately with before-after history and validation', t => {
  const f = fixture(t),
    admin = accessAdmin(f.db, 'ahmed');
  const input = {
    version: 1,
    active: true,
    reason: 'Reviewed budget authority assignment.',
    grants: [{
      company_id: 'jakh',
      project_id: 'harbour',
      role_id: 'financial_controller',
      approval_limit: '0',
      budget_approval_limit: '50000'
    }]
  };
  const r = admin.save('mohammed', input);
  assert.equal(r.grants[0].budget_approval_limit, '50000.00');
  assert.equal(r.grants[0].approval_limit, '0.00');
  assert.throws(() => admin.save('mohammed', {
    ...input,
    version: 2,
    grants: [{
      ...input.grants[0],
      role_id: 'site_engineer'
    }]
  }), /cannot approve budgets/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM access_events').get().n, 1);
});
test('foundation examples are meaningful, additive and idempotent with separate fictional reviewer', t => {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  const service = foundations(db, 'ahmed'),
    before = db.prepare('SELECT count(*) n FROM budget_documents').get().n;
  assert.equal(before, 9);
  assert.equal(db.prepare("SELECT budget_approval_limit FROM memberships WHERE user_id='ahmed' LIMIT 1").get().budget_approval_limit, '0.00');
  for (const p of ['harbour', 'gardens', 'creek']) {
    const docs = db.prepare('SELECT state FROM budget_documents WHERE project_id=?').all(p);
    assert.deepEqual(docs.map(d => d.state).sort(), ['approved', 'draft', 'submitted']);
  }
  installFoundationExamples(db);
  assert.equal(db.prepare('SELECT count(*) n FROM budget_documents').get().n, before);
  const report = createService(db, 'ahmed').report('jakh', 'harbour');
  assert.equal(report.totals.original_budget, '47000000.00');
  assert.equal(report.totals.revised_budget, '48000000.00');
  assert.ok(report.findings.some(f => f.id === 'budget_revisions'));
  assert.throws(() => transaction(db, () => {
    service.saveCompany(null, {
      name: 'Rollback',
      legal_name: 'Rollback Company',
      currency: 'AED',
      reason: 'Transaction rollback check.'
    });
    throw Error('rollback');
  }), /rollback/);
  assert.equal(db.prepare("SELECT count(*) n FROM companies WHERE name='Rollback'").get().n, 0);
});
