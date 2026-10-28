import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createApi } from '../server/http.mjs';
async function client(t, db, actorId) {
  const server = createApi(db, {authMode: 'sample',
    actorId
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));
  const headers = {
      'X-Builder-Client': 'local-app',
      'Content-Type': 'application/json'
    },
    base = `http://127.0.0.1:${server.address().port}/api`;
  const login = await fetch(base + '/local-session', {
    method: 'POST',
    headers
  });
  headers.Cookie = login.headers.get('set-cookie').split(';')[0];
  return async (path, body, method = 'POST') => {
    const res = await fetch(base + path, {
      headers,
      method: body === undefined ? 'GET' : method,
      ...(body === undefined ? {} : {
        body: JSON.stringify(body)
      })
    });
    return {
      status: res.status,
      body: await res.json()
    };
  };
}
test('foundation HTTP endpoints enforce organisation scope, price redaction, preview and budget lookup', async t => {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  const admin = await client(t, db, 'ahmed'),
    site = await client(t, db, 'mohammed');
  assert.equal((await site('/organisation')).status, 403);
  const view = await site('/foundations?company=jakh&project=harbour');
  assert.equal(view.status, 200);
  assert.ok(view.body.packages.every(w => !w.position));
  assert.equal(view.body.budgets.length, 0);
  const key = db.prepare("SELECT id FROM budget_documents WHERE project_id='harbour' AND state='approved'").get().id;
  assert.equal((await site('/budgets/' + key)).status, 404);
  assert.equal((await site('/search?company=jakh&q=' + key)).body.length, 0);
  assert.equal((await admin('/search?company=jakh&q=' + key)).body[0].id, key);
  assert.equal((await admin('/access/preview', {
    user_id: 'mohammed'
  })).status, 200);
  assert.equal((await admin('/projects', {})).status, 403);
  assert.equal((await admin('/organisation/companies', {})).status, 403);
  assert.equal((await admin('/access/preview', {
    user_id: null
  })).status, 200);
  assert.equal((await admin('/budgets/' + key)).body.state, 'approved');
});
test('a new baseline funds an actual request and order through HTTP while preserving cash and original budget', async t => {
  const db = openDatabase();
  t.after(() => db.close());
  db.prepare("UPDATE memberships SET budget_approval_limit='1000000' WHERE user_id='sara'").run();
  const pm = await client(t, db, 'ahmed'),
    review = await client(t, db, 'sara');
  let r = await pm('/projects', {
    company_id: 'jakh',
    name: 'HTTP tower',
    code: 'API-T01',
    location: 'Dubai',
    manager_id: 'ahmed',
    planned_start: '2026-10-29',
    planned_end: '2028-01-01',
    provenance: 'Direct award test',
    reason: 'Create connected tower project.'
  });
  assert.equal(r.status, 201);
  const p = r.body.id;
  r = await pm('/work-packages', {
    project_id: p,
    code: 'BLOCK',
    name: 'Blockwork',
    kind: 'item',
    cost_code_id: 'jakh-GENERAL',
    reason: 'Define work for purchasing.'
  });
  assert.equal(r.status, 201);
  const w = r.body;
  const ws = (await pm(`/foundations?company=jakh&project=${p}`)).body;
  const loc = ws.locations[0].id;
  r = await pm('/budgets', {
    project_id: p,
    kind: 'baseline',
    title: 'Initial blockwork budget',
    basis: '1000 blocks plus installation allowance.',
    lines: [{
      work_package_id: w.id,
      proposed_budget: '50000',
      proposed_release: '40000'
    }]
  });
  assert.equal(r.status, 201);
  let d = r.body;
  r = await pm(`/budgets/${d.id}/decision`, {
    version: d.version,
    action: 'submit',
    reason: 'Submit baseline.'
  });
  assert.equal(r.status, 200);
  d = r.body;
  r = await review(`/budgets/${d.id}/decision`, {
    version: d.version,
    action: 'approve',
    reason: 'Independent baseline review.'
  });
  assert.equal(r.status, 200);
  r = await pm('/material-requests', {
    company_id: 'jakh',
    project_id: p,
    title: 'First blockwork demand',
    needed_by: '2026-11-03',
    lines: [{
      product_id: 'jakh-BLOCK',
      work_package_id: w.id,
      location_id: loc,
      quantity: '20'
    }]
  });
  assert.equal(r.status, 201);
  let mr = r.body;
  r = await pm(`/material-requests/${mr.id}/decision`, {
    version: mr.version,
    action: 'submit'
  });
  assert.equal(r.status, 200);
  mr = r.body;
  const today = new Date().toISOString().slice(0, 10),
    expiry = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  r = await pm(`/material-requests/${mr.id}/quotes`, {
    version: mr.version,
    line_id: mr.lines[0].id,
    vendor_id: 'gulf',
    reference: 'API-QUOTE-1',
    quantity: '20',
    unit_price: '10',
    rate: '1',
    rate_date: today,
    rate_source: 'Same currency',
    valid_until: expiry,
    lead_days: 1
  });
  assert.equal(r.status, 200);
  mr = r.body;
  r = await pm(`/material-requests/${mr.id}/sourcing`, {
    version: mr.version,
    allocations: [{
      quote_id: mr.quotes[0].id,
      quantity: '20'
    }]
  });
  assert.equal(r.status, 200);
  mr = r.body;
  r = await review(`/material-requests/${mr.id}/decision`, {
    version: mr.version,
    action: 'approve'
  });
  assert.equal(r.status, 200);
  mr = r.body;
  r = await pm(`/material-requests/${mr.id}/orders`, {
    version: mr.version
  });
  assert.equal(r.status, 200);
  const report = (await pm(`/reports/cost?company=jakh&project=${p}`)).body;
  assert.equal(report.totals.original_budget, '50000.00');
  assert.equal(report.totals.committed, '200.00');
  assert.equal(report.totals.cash, '0.00');
  assert.equal(report.rows[0].budget_sources.length, 1);
});
