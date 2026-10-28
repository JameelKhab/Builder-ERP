import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/db.mjs';
import { installExamples } from '../server/examples.mjs';
import { createService } from '../server/service.mjs';
import { price } from '../server/money.mjs';
import { CATEGORIES } from '../src/catalogue.js';
import { exampleGroups } from '../src/example-guide.js';

const today = () => '2026-10-28';
test('every visible feature has examples in every sample company and project', t => {
  const db = openDatabase(':memory:', { examples: true }); t.after(() => db.close());
  const service = createService(db, 'ahmed', today);
  for (const project of service.bootstrap().projects) {
    const scope = service.workspace(project.company_id, project.id);
    for (const [area, categories] of Object.entries(CATEGORIES)) {
      for (const [category] of categories) {
        const rows = category === 'Purchase requests' ? scope.material_requests : category === 'Orders & deliveries' ? scope.purchase_orders : category === 'Cost report' ? scope.report.rows : scope.records.filter(r => r.area === area && r.category === category);
        assert.ok(rows.length >= (['Cost report', 'Purchase requests','Orders & deliveries'].includes(category) ? 1 : 2), `${project.id} / ${category} lacks examples`);
      }
    }
    assert.deepEqual([...new Set(scope.requests.map(r => r.status))].sort(), ['approved', 'draft', 'returned', 'submitted']);
    for (const [, features] of exampleGroups(service.workspace(project.company_id), project.id, 'ahmed')) {
      for (const f of features) assert.ok(f.count > 0, `${project.id} / guide ${f.title} is empty`);
    }
  }
});

test('example records contain substantive detail, history and resolvable scoped relationships', t => {
  const db = openDatabase(':memory:', { examples: true }); t.after(() => db.close());
  const service = createService(db, 'ahmed', today);
  const rows = db.prepare("SELECT id,company_id,project_id FROM records WHERE id LIKE 'EX-%' AND project_id IS NOT NULL").all();
  assert.equal(rows.length, 78);
  for (const row of rows) {
    const record = service.record(row.id);
    assert.ok(Object.keys(record.details).length >= 5);
    assert.equal(record.details._example.timeline.length, 2);
    assert.ok(record.related.length > 0);
    for (const related of record.related) {
      const target = service.record(related.id);
      assert.equal(target.company_id, row.company_id);
      assert.equal(target.project_id, row.project_id);
    }
  }
});

test('expanded examples respect company and project permissions, including related work', t => {
  const db = openDatabase(':memory:', { examples: true }); t.after(() => db.close());
  const engineer = createService(db, 'mohammed', today);
  assert.throws(() => engineer.record('EX-CO-NCR-1'), { status: 404 });
  assert.throws(() => engineer.record('EX-GR-NCR-1'), { status: 404 });
  assert.equal(engineer.search('jakh', 'EX-GR').length, 0);
  const original = engineer.record('EX-HT-NCR-1');
  const raw=JSON.parse(db.prepare('SELECT details FROM records WHERE id=?').get(original.id).details);
  raw._example.linkedIds.push('EX-CO-NCR-1');
  db.prepare('UPDATE records SET details=? WHERE id=?').run(JSON.stringify(raw), original.id);
  const after = engineer.record(original.id);
  assert.ok(after.related.every(r => !r.id.startsWith('EX-CO')));
  assert.equal(after.details._example,undefined);
});

test('request examples reconcile currencies and have valid independent approval histories', t => {
  const db = openDatabase(':memory:', { examples: true }); t.after(() => db.close());
  const service = createService(db, 'ahmed', today);
  for (const row of db.prepare("SELECT id FROM requests WHERE id LIKE 'PR-EX-%'").all()) {
    const request = service.getRequest(row.id);
    const priced = price(request.quantity, request.unit_price, request.rate);
    assert.equal(request.amount, priced.amount);
    assert.equal(request.company_amount, priced.companyAmount);
    assert.equal(request.version, request.history.length);
    if (['draft', 'returned'].includes(request.status)) assert.equal(request.can_edit, true);
    if (request.status === 'submitted') assert.equal(request.can_review, true);
    if (['returned', 'approved'].includes(request.status)) assert.notEqual(request.history.at(-1).actor_id, request.requester_id);
  }
  const reviewer = createService(db, 'maya', today);
  const edited = service.update('PR-EX-CO-RETURNED', { ...service.getRequest('PR-EX-CO-RETURNED'), quantity: '10' });
  const submitted = service.decide(edited.id, { action: 'submit', version: edited.version });
  assert.equal(submitted.owner, 'Maya Chen');
  assert.equal(reviewer.decide(submitted.id, { action: 'approve', version: submitted.version }).status, 'approved');
});

test('installing examples upgrades existing data once without overwriting work or financial snapshots', t => {
  const dir = mkdtempSync(join(tmpdir(), 'builder-examples-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'test.sqlite'); let db = openDatabase(path);
  const service = createService(db, 'ahmed', today);
  const userRequest = service.create({ company_id: 'jakh', project_id: 'harbour', item_id: 'C-104', title: 'User-created draft', location: 'Site office', due: '2026-11-03', quantity: '3', unit: 'sets', unit_price: '42', vendor_id: '' });
  db.prepare("UPDATE records SET title='Preserved title' WHERE id='NCR-018'").run();
  const report = service.report('jakh');
  db.close(); db = openDatabase(path, { examples: true });
  const updated = createService(db, 'ahmed', today);
  assert.equal(updated.getRequest(userRequest.id).title, 'User-created draft');
  assert.equal(updated.record('NCR-018').title, 'Preserved title');
  const afterReport=updated.report('jakh');
  for(const row of report.rows){const after=afterReport.rows.find(r=>r.id===row.id);for(const key of ['original_budget','revised_budget','opening_committed','opening_incurred','cash','forecast'])assert.equal(after[key],row[key]);}
  assert.equal(afterReport.totals.committed,'32105280.00');
  assert.equal(afterReport.totals.incurred,'25351880.00');
  const factCount=db.prepare('SELECT count(*) n FROM construction_cost_facts').get().n;
  const count = () => db.prepare('SELECT COUNT(*) n FROM records').get().n;
  const before = count();
  db.prepare("UPDATE records SET title='Preserve example edits' WHERE id='EX-HT-NCR-1'").run();
  installExamples(db);
  assert.equal(count(), before);
  assert.equal(updated.record('EX-HT-NCR-1').title, 'Preserve example edits');
  db.close(); db = openDatabase(path, { examples: true });
  assert.equal(count(), before); assert.equal(db.prepare('SELECT count(*) n FROM construction_cost_facts').get().n,factCount); db.close();
});
