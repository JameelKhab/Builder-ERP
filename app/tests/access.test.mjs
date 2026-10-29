import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createService } from '../server/service.mjs';
import { policy } from '../server/access.mjs';
import { accessAdmin } from '../server/access-admin.mjs';
import { ROLES, destinationsFor } from '../shared/access.mjs';
const today = () => '2026-10-28';
function fixture(t) {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  return {
    db,
    engineer: createService(db, 'mohammed', today),
    manager: createService(db, 'ahmed', today),
    admin: accessAdmin(db, 'ahmed')
  };
}
const grant = {
  company_id: 'jakh',
  project_id: 'harbour',
  role_id: 'site_engineer',
  approval_limit: '0'
};
const change = (grants = [grant], extra = {}) => ({
  version: 1,
  active: true,
  reason: 'Reviewed construction team assignment.',
  grants,
  ...extra
});
test('site engineer has operational destinations without commercial, HR or admin access', t => {
  const {
      engineer,
      db
    } = fixture(t),
    w = engineer.workspace('jakh', 'harbour');
  assert.equal(w.report, null);
  assert.ok(w.items.length);
  assert.ok(w.records.length);
  assert.ok(!w.records.some(r => ['People', 'Subcontracts', 'Changes & variations', 'Payments & cash flow'].includes(r.category)));
  for (const id of ['commercial', 'people', 'reports', 'finance', 'access']) assert.ok(!destinationsFor(w.capabilities).some(d => d.id === id));
  assert.throws(() => engineer.report('jakh', 'harbour'), {
    status: 403
  });
  assert.throws(() => accessAdmin(db, 'mohammed').list(), {
    status: 403
  });
  for (const id of ['EX-HT-SC-1', 'EX-HT-VO-1', 'EX-HT-PAY-1']) assert.throws(() => engineer.record(id), {
    status: 404
  });
  assert.equal(engineer.search('jakh', 'certificate').length, 0);
});
test('pricing is withheld across request lookup, workspace, search, preview and linked records', t => {
  const {
    engineer
  } = fixture(t);
  const rows = [engineer.getRequest('PR-0264'), ...engineer.workspace('jakh', 'harbour').requests, ...engineer.search('jakh', 'PR-0264')];
  for (const r of rows) {
    for (const k of ['amount', 'company_amount', 'unit_price', 'rate', 'quote', 'available', 'approval_limit']) assert.equal(r[k], undefined, k);
    assert.deepEqual(Object.keys(r.item).sort(), ['id', 'name']);
  }
  assert.ok(engineer.workspace('jakh', 'harbour').vendors.every(v => v.unit_price === undefined && v.rate === undefined));
  const p = engineer.preview({
    company_id: 'jakh',
    project_id: 'harbour',
    item_id: 'C-101',
    quantity: '2',
    vendor_id: 'euro'
  });
  assert.equal(p.restricted, true);
  assert.equal(p.amount, undefined);
  assert.equal(p.currency, 'EUR');
  const asset = engineer.record('EX-HT-AST-2');
  assert.equal(asset.details['Cost example'], undefined);
  assert.equal(asset.details._example, undefined);
  assert.ok(!asset.related.some(r => r.id.includes('PAY')));
  assert.throws(() => engineer.preview({
    company_id: 'jakh',
    project_id: 'harbour',
    item_id: 'C-101',
    quantity: '2',
    unit_price: '1'
  }), {
    status: 403
  });
});
test('HR and system administration do not imply financial access; unknown records fail closed', t => {
  const {
    db,
    manager
  } = fixture(t);
  db.prepare("UPDATE memberships SET role_id='hr_manager' WHERE user_id='mohammed'").run();
  const hr = createService(db, 'mohammed', today);
  assert.equal(hr.bootstrap().projects.length, 0);
  assert.equal(hr.workspace('jakh', 'harbour').report, null);
  assert.equal(hr.requests('jakh').length, 0);
  db.prepare("UPDATE memberships SET role_id='unknown' WHERE user_id='ahmed'").run();
  assert.equal(manager.workspace('jakh', 'harbour').records.length, 0);
  assert.throws(() => manager.report('jakh'), {
    status: 403
  });
  assert.ok(accessAdmin(db, 'ahmed').list().users.length);
});
test('every role has an explicit available capability contract and auditors cannot mutate', t => {
  const {
    db
  } = fixture(t);
  assert.equal(ROLES.length, 29);
  for (const role of ROLES) {
    db.prepare("UPDATE memberships SET role_id=? WHERE user_id='mohammed'").run(role.id);
    const p = policy(db, 'mohammed');
    assert.equal(p.has('made.up', 'jakh', 'harbour'), false);
    assert.deepEqual([...p.caps('jakh', 'harbour')].sort(), [...role.capabilities].sort());
  }
  db.prepare("UPDATE memberships SET role_id='auditor',can_approve=1,approval_limit='999999' WHERE user_id='mohammed'").run();
  assert.equal(policy(db, 'mohammed').approvalLimit('jakh', 'harbour'), '0.00');
  assert.throws(() => createService(db, 'mohammed', today).preview({
    company_id: 'jakh',
    project_id: 'harbour',
    item_id: 'C-101',
    quantity: '2',
    vendor_id: 'euro'
  }), {
    status: 403
  });
});
test('a role in one project cannot widen reporting or record access in another', t => {
  const {
    db,
    admin
  } = fixture(t);
  admin.save('mohammed', change([grant, {
    ...grant,
    project_id: 'gardens',
    role_id: 'commercial_manager',
    approval_limit: '1000'
  }]));
  const s = createService(db, 'mohammed', today);
  const report = s.report('jakh');
  assert.equal(report.meta.restricted, true);
  assert.ok(report.rows.every(r => r.project_id === 'gardens'));
  assert.throws(() => s.report('jakh', 'harbour'), {
    status: 403
  });
  assert.throws(() => s.record('EX-HT-PAY-1'), {
    status: 404
  });
  assert.ok(s.record('EX-GR-PAY-1'));
});
test('reviewed access changes are atomic, versioned, reasoned and recorded with before/after', t => {
  const {
    db,
    admin,
    engineer
  } = fixture(t);
  const after = admin.save('mohammed', change([{
    ...grant,
    role_id: 'document_controller'
  }]));
  assert.equal(after.user.access_version, 2);
  assert.equal(engineer.requests('jakh').length, 0);
  assert.ok(engineer.records('jakh').every(r => ['Documents', 'Handover'].includes(r.area)));
  const e = db.prepare('SELECT * FROM access_events').get();
  assert.equal(JSON.parse(e.before_json).grants[0].role_id, 'site_engineer');
  assert.equal(JSON.parse(e.after_json).grants[0].role_id, 'document_controller');
  assert.throws(() => admin.save('mohammed', change()), {
    status: 409
  });
  assert.equal(db.prepare('SELECT count(*) n FROM access_events').get().n, 1);
  assert.throws(() => db.prepare("UPDATE access_events SET reason='hide' WHERE id=1").run(), /append-only/);
  assert.throws(() => db.prepare('DELETE FROM access_events').run(), /append-only/);
});
test('invalid grants cannot expand authority or partially replace existing permissions', t => {
  const {
    admin,
    db
  } = fixture(t);
  for (const grants of [[{
    ...grant,
    company_id: 'build'
  }], [{
    ...grant,
    role_id: 'ar_clerk'
  }], [{
    ...grant,
    approval_limit: '100'
  }], [grant, grant], [{
    ...grant,
    approval_limit: 'Infinity'
  }]]) assert.throws(() => admin.save('mohammed', change(grants)));
  assert.equal(db.prepare("SELECT role_id FROM memberships WHERE user_id='mohammed'").get().role_id, 'site_engineer');
  assert.throws(() => admin.save('ahmed', change()), {
    status: 403
  });
  assert.throws(() => accessAdmin(db, 'mohammed').save('sara', change()), {
    status: 403
  });
  assert.throws(() => admin.save('mohammed', change([grant], {
    reason: ''
  })));
});
test('revocation takes effect for an existing service and disabled reviewers receive no work', t => {
  const {
    db,
    engineer,
    admin,
    manager
  } = fixture(t);
  admin.save('mohammed', change([grant], {
    active: false
  }));
  assert.throws(() => engineer.bootstrap(), {
    status: 401
  });
  assert.throws(() => engineer.getRequest('PR-0264'), {
    status: 401
  });
  db.prepare("UPDATE users SET active=0 WHERE id IN ('sara','maya')").run();
  const r = manager.create({
    company_id: 'jakh',
    project_id: 'harbour',
    item_id: 'C-101',
    quantity: '2',
    vendor_id: 'euro',
    title: 'Test request',
    location: 'L13',
    unit: 't',
    due: '2026-11-01'
  });
  assert.throws(() => manager.decide(r.id, {
    version: 1,
    action: 'submit'
  }), /No independent reviewer/);
});
test('purchase pricing does not grant budget, forecast or cash access through request details', t => {
  const {
    db
  } = fixture(t);
  db.prepare("UPDATE memberships SET role_id='procurement' WHERE user_id='mohammed'").run();
  const buyer = createService(db, 'mohammed', today),
    request = buyer.getRequest('PR-0264');
  assert.equal(request.amount, '36000.00');
  assert.equal(request.can_budget, false);
  assert.equal(request.item.forecast, undefined);
  assert.equal(request.item.cash, undefined);
  assert.equal(request.available, undefined);
  assert.equal(request.after_request, undefined);
  assert.throws(() => buyer.report('jakh'), {
    status: 403
  });
});
test('removing all grants leaves an active account with no visible companies, projects or records', t => {
  const {
    admin,
    engineer
  } = fixture(t);
  admin.save('mohammed', change([]));
  assert.equal(engineer.bootstrap().companies.length, 0);
  assert.equal(engineer.bootstrap().projects.length, 0);
  assert.throws(() => engineer.workspace('jakh'), {
    status: 404
  });
  assert.throws(() => engineer.getRequest('PR-0264'), {
    status: 404
  });
});
