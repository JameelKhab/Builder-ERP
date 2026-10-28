import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/db.mjs';
import { createService } from '../server/service.mjs';
import { price } from '../server/money.mjs';
const today = () => '2026-10-28';
function fixture(t) {
  const db = openDatabase();
  t.after(() => db.close());
  return {
    db,
    manager: createService(db, 'ahmed', today),
    engineer: createService(db, 'mohammed', today),
    commercial: createService(db, 'sara', today)
  };
}
const draft = {
  company_id: 'jakh',
  project_id: 'harbour',
  item_id: 'C-101',
  title: 'B500B reinforcement',
  location: 'Level 13',
  due: '2026-11-02',
  unit: 'tonnes',
  quantity: '40',
  vendor_id: 'euro',
  unit_price: '0'
};
test('money uses exact decimal arithmetic and rounds the document amount before conversion', () => {
  assert.deepEqual(price('3', '0.10', '3.6725'), {
    amount: '0.30',
    companyAmount: '1.10'
  });
  assert.deepEqual(price('40', '900', '4.00'), {
    amount: '36000.00',
    companyAmount: '144000.00'
  });
  for (const bad of ['NaN', 'Infinity', '-1', '1e10', '1.0000001', null, 4]) assert.throws(() => price(bad, '900', '4'));
});
test('company and project permissions apply to direct lookup, search, reports and creation', t => {
  const {
    engineer
  } = fixture(t);
  assert.equal(engineer.bootstrap().companies.length, 1);
  assert.throws(() => engineer.report('build', 'creek'), {
    status: 404
  });
  assert.throws(() => engineer.record('CO-011'), {
    status: 404
  });
  assert.throws(() => engineer.search('build', 'foundation'), {
    status: 404
  });
  assert.throws(() => engineer.create({
    ...draft,
    project_id: 'gardens'
  }), {
    status: 404
  });
  const company = engineer.report('jakh');
  assert.equal(company.meta.restricted, true);
  assert.equal(company.rows.length, 4);
  assert.ok(company.rows.every(r => r.project_id === 'harbour'));
});
test('cross-company vendor, project and cost-item references are rejected', t => {
  const {
    manager
  } = fixture(t);
  assert.throws(() => manager.preview({
    ...draft,
    vendor_id: 'world'
  }));
  assert.throws(() => manager.preview({
    ...draft,
    project_id: 'creek'
  }));
  assert.throws(() => manager.preview({
    ...draft,
    item_id: 'C-301'
  }));
});
test('currency and price come from the selected company vendor quote, not client amounts', t => {
  const {
    manager
  } = fixture(t);
  const euro = manager.preview({
    ...draft,
    currency: 'USD',
    amount: '1',
    unit_price: '1',
    rate: '0.1'
  });
  assert.equal(euro.currency, 'EUR');
  assert.equal(euro.amount, '36000.00');
  assert.equal(euro.companyAmount, '144000.00');
  const local = manager.preview({
    ...draft,
    vendor_id: 'gulf'
  });
  assert.equal(local.currency, 'AED');
  assert.equal(local.amount, '148000.00');
});
test('vendor optional estimates use company currency; missing quantity and price are rejected', t => {
  const {
    manager
  } = fixture(t);
  const r = manager.preview({
    ...draft,
    vendor_id: '',
    unit_price: '10.25',
    quantity: '3'
  });
  assert.equal(r.currency, 'AED');
  assert.equal(r.companyAmount, '30.75');
  assert.equal(r.quote, null);
  assert.throws(() => manager.preview({
    ...draft,
    vendor_id: '',
    unit_price: ''
  }));
});
test('stale rates and expired quotations block repricing and approval', t => {
  const {
      db
    } = fixture(t),
    later = createService(db, 'ahmed', () => '2026-11-10');
  assert.throws(() => later.preview(draft), /expired/);
  assert.throws(() => later.decide('PR-0264', {
    action: 'approve',
    version: 2
  }), /expired/);
  db.prepare("UPDATE vendors SET valid_until='2026-12-01'").run();
  assert.throws(() => later.preview(draft), /stale/);
  assert.throws(() => later.decide('PR-0264', {
    action: 'approve',
    version: 2
  }), /stale/);
});
test('independent approval persists a versioned event and does not manufacture costs or cash', t => {
  const {
    manager
  } = fixture(t);
  const before = manager.report('jakh', 'harbour');
  const r = manager.decide('PR-0264', {
    action: 'approve',
    version: 2
  });
  assert.equal(r.status, 'approved');
  assert.equal(r.version, 3);
  assert.equal(r.history.at(-1).actor_id, 'ahmed');
  assert.equal(r.after_request, '56000.00');
  assert.deepEqual(manager.report('jakh', 'harbour').totals, before.totals);
  assert.throws(() => manager.decide(r.id, {
    action: 'approve',
    version: 2
  }), {
    status: 409
  });
  assert.throws(() => manager.decide(r.id, {
    action: 'approve',
    version: 3
  }), {
    status: 403
  });
});
test('changed vendor terms cannot be approved using an earlier request snapshot', t => {
  const { db, manager } = fixture(t);
  const original = db.prepare("SELECT * FROM vendors WHERE id='euro' AND company_id='jakh'").get();
  const before = manager.getRequest('PR-0264');
  for (const [field, replacement] of [['quote', 'REVISED-QUOTE'], ['unit_price', '1000'], ['currency', 'USD'], ['rate', '4.2'], ['rate_date', '2026-10-27']]) {
    db.prepare(`UPDATE vendors SET ${field}=? WHERE id='euro' AND company_id='jakh'`).run(replacement);
    assert.throws(() => manager.decide('PR-0264', { action: 'approve', version: 2 }), /changed.*repricing/);
    assert.deepEqual(manager.getRequest('PR-0264').history, before.history);
    assert.equal(manager.getRequest('PR-0264').status, 'submitted');
    db.prepare(`UPDATE vendors SET ${field}=? WHERE id='euro' AND company_id='jakh'`).run(original[field]);
  }
});
test('self approval and role escalation via client payload are forbidden', t => {
  const {
    manager,
    engineer
  } = fixture(t);
  assert.throws(() => engineer.decide('PR-0264', {
    action: 'approve',
    version: 2,
    can_approve: true
  }), {
    status: 403
  });
  const created = manager.create(draft),
    submitted = manager.decide(created.id, {
      action: 'submit',
      version: 1
    });
  assert.equal(submitted.can_review, false);
  assert.throws(() => manager.decide(created.id, {
    action: 'approve',
    version: 2
  }), {
    status: 403
  });
});
test('submission does not route to a reviewer outside the company', t => {
  const {manager}=fixture(t);
  const r=manager.create({...draft,company_id:'build',project_id:'creek',item_id:'C-301',vendor_id:'world',quantity:'2'});
  assert.equal(r.company_currency,'USD');
  assert.throws(()=>manager.decide(r.id,{action:'submit',version:1}),/No independent reviewer/);
  assert.equal(manager.getRequest(r.id).status,'draft');
});
test('return, reprice, resubmit and approval preserve history and enforce current revision', t => {
  const {
    manager,
    engineer
  } = fixture(t);
  assert.throws(() => manager.decide('PR-0264', {
    action: 'return',
    version: 2,
    note: ' '
  }));
  manager.decide('PR-0264', {
    action: 'return',
    version: 2,
    note: 'Compare the local supplier quote.'
  });
  const revised = engineer.update('PR-0264', {
    ...draft,
    vendor_id: 'gulf',
    version: 3
  });
  assert.equal(revised.currency, 'AED');
  assert.equal(revised.amount, '148000.00');
  assert.equal(revised.status, 'draft');
  assert.throws(() => manager.decide('PR-0264', {
    action: 'approve',
    version: 3
  }), {
    status: 409
  });
  const submitted = engineer.decide('PR-0264', {
    action: 'submit',
    version: 4
  });
  const approved = manager.decide('PR-0264', {
    action: 'approve',
    version: submitted.version
  });
  assert.equal(approved.version, 6);
  assert.equal(approved.history.length, 6);
  assert.throws(() => engineer.update('PR-0264', {
    ...draft,
    version: 6
  }), {
    status: 403
  });
});
test('concurrent reviewers cannot approve the same revision twice', t => {
  const {
    manager,
    commercial
  } = fixture(t);
  manager.decide('PR-0264', {
    action: 'approve',
    version: 2
  });
  assert.throws(() => commercial.decide('PR-0264', {
    action: 'approve',
    version: 2
  }), {
    status: 409
  });
  assert.equal(manager.getRequest('PR-0264').history.filter(e => e.action === 'approved').length, 1);
});
test('budget reservations are transactional and prevent another approval exceeding allowance', t => {
  const {
    manager,
    engineer
  } = fixture(t);
  manager.decide('PR-0264', {
    action: 'approve',
    version: 2
  });
  const second = engineer.create({
    ...draft,
    quantity: '20'
  });
  engineer.decide(second.id, {
    action: 'submit',
    version: 1
  });
  assert.throws(() => manager.decide(second.id, {
    action: 'approve',
    version: 2
  }), /allowance/);
  assert.equal(manager.getRequest(second.id).status, 'submitted');
  assert.equal(manager.getRequest(second.id).history.length, 2);
});
test('approval limits apply to converted company amount', t => {
  const {
    db,
    manager
  } = fixture(t);
  db.prepare("UPDATE requests SET company_amount='250000.01' WHERE id='PR-0264'").run();
  assert.throws(() => manager.decide('PR-0264', {
    action: 'approve',
    version: 2
  }), {
    status: 403
  });
});
test('the complete report, source rows and findings share one versioned snapshot', t => {
  const {
    manager,
    db
  } = fixture(t);
  const r = manager.report('jakh', 'harbour');
  assert.equal(r.rows.length, 4);
  assert.equal(r.totals.revised_budget, '48000000.00');
  assert.equal(r.totals.forecast, '48600000.00');
  assert.equal(r.totals.cash, '19400000.00');
  assert.equal(r.findings[0].value, '600000.00');
  assert.equal(r.findings[0].sourceIds.length, 4);
  assert.equal(r.snapshot, manager.report('jakh', 'harbour').snapshot);
  db.prepare("UPDATE cost_items SET forecast='18500000' WHERE id='C-101'").run();
  const changed = manager.report('jakh', 'harbour');
  assert.notEqual(changed.snapshot, r.snapshot);
  assert.equal(changed.findings[0].value, '700000.00');
});
test('company reports include non-project overheads and do not mix legal currencies', t => {
  const {
    manager
  } = fixture(t);
  const c = manager.report('jakh');
  assert.equal(c.rows.length, 6);
  assert.equal(c.totals.revised_budget, '50800000.00');
  assert.ok(c.rows.some(r => r.project_id === null));
  const usd = manager.report('build');
  assert.equal(usd.meta.currency, 'USD');
  assert.equal(usd.totals.revised_budget, '4200000.00');
  assert.equal(usd.rows.length, 1);
});
test('missing forecasts remain unknown, never zero or an apparently complete partial total', t => {
  const {
    db,
    manager
  } = fixture(t);
  db.prepare("UPDATE cost_items SET forecast=NULL WHERE id='C-101'").run();
  const r = manager.report('jakh', 'harbour');
  assert.equal(r.totals.forecast, null);
  assert.equal(r.findings[0].id, 'missing');
  assert.ok(!r.findings.some(f => f.id === 'variance'));
});
test('invalid dates and oversized descriptions fail without creating records', t => {
  const {
    manager
  } = fixture(t);
  const count = manager.requests('jakh').length;
  for (const change of [{
    due: '2026-02-30'
  }, {
    due: 'garbage'
  }, {
    title: 'x'.repeat(161)
  }, {
    title: ' '
  }]) assert.throws(() => manager.create({
    ...draft,
    ...change
  }));
  assert.equal(manager.requests('jakh').length, count);
});
test('history cannot be edited or deleted through normal database statements', t => {
  const {
    db
  } = fixture(t);
  assert.throws(() => db.prepare("UPDATE events SET note='changed' WHERE id=1").run(), /append-only/);
  assert.throws(() => db.prepare('DELETE FROM events WHERE id=1').run(), /append-only/);
});
test('local changes survive database reopen without fixture reseeding', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jakh-persistence-'));
  const path = join(dir, 'test.sqlite');
  let db;
  try {
    db = openDatabase(path);
    createService(db, 'ahmed', today).decide('PR-0264', {
      action: 'approve',
      version: 2
    });
    db.close();
    db = openDatabase(path);
    assert.equal(createService(db, 'ahmed', today).getRequest('PR-0264').status, 'approved');
    assert.equal(db.prepare('SELECT count(*) n FROM companies').get().n, 2);
  } finally {
    db?.close();
    rmSync(dir, {
      recursive: true,
      force: true
    });
  }
});
