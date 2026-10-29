import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { identity } from '../server/identity.mjs';
import { createApi } from '../server/http.mjs';
import { masters } from '../server/masters.mjs';
import { sampleEstimate } from '../server/estimates-examples.mjs';
import { estimateRegisterCsv } from '../src/estimates-export.js';
const today = () => '2026-10-29';
test('individual HTTP users prepare, independently approve and hand over a scoped estimate; API reports and previews stay controlled', async t => {
  const db = openDatabase();
  t.after(() => db.close());
  const customer = masters(db, 'ahmed', today).saveParty(null, {
    company_id: 'jakh',
    name: 'HTTP fictional client',
    customer: true,
    supplier: false,
    subcontractor: false,
    reason: 'Test customer for estimate chain'
  });
  const auth = identity(db, {
      sampleMode: true
    }),
    password = 'Disposable estimate test passphrase 94!';
  const owner = await auth.setup({
    name: 'Estimate test owner',
    login: 'est.owner',
    password,
    confirm_password: password,
    company_ids: ['jakh']
  }, 'Disposable test');
  const session = auth.authenticate(owner.session.token),
    users = {};
  for (const [login, role, limit, project] of [['est.writer', 'estimator', '0', '*'], ['est.reviewer', 'tendering_manager', '1000000', '*'], ['est.manager', 'project_manager', '0', '*'], ['est.restricted', 'estimator', '0', 'gardens']]) {
    const u = auth.provision(session, {
      name: login,
      login,
      job_title: role,
      reason: 'Disposable independent estimate roles',
      grants: [{
        company_id: 'jakh',
        project_id: project,
        role_id: role,
        approval_limit: '0',
        estimate_approval_limit: limit
      }]
    });
    await auth.activate({
      login,
      code: u.activation_code,
      password,
      confirm_password: password
    });
    users[login] = u;
  }
  const server = createApi(db, {
    today
  }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function client(login) {
    let cookie = '';
    const call = async (path, body, method = 'POST') => {
      const res = await fetch(base + path, {
        method: body === undefined ? 'GET' : method,
        headers: {
          'Content-Type': 'application/json',
          'X-Builder-Client': 'local-app',
          Cookie: cookie
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
      return {
        status: res.status,
        body: await res.json()
      };
    };
    assert.equal((await call('/auth/login', {
      login,
      password
    })).status, 200);
    return call;
  }
  const writer = await client('est.writer'),
    reviewer = await client('est.reviewer'),
    manager = await client('est.manager'),
    restricted = await client('est.restricted'),
    admin = await client('est.owner');
  const input = sampleEstimate({
    id: 'jakh',
    currency: 'AED'
  }, customer.party_id, today());
  let res = await writer('/estimates/documents', {
    ...input,
    author_id: 'someone',
    state: 'approved',
    calculation: '{}'
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  let r = res.body;
  assert.equal(r.state, 'draft');
  assert.equal(r.calculation.totals.selling, '34151.04');
  assert.notEqual(r.author_id, 'someone');
  const decide = (call, r, action) => call(`/estimates/documents/${r.id}/decision`, {
    action,
    version: r.version,
    reason: 'Independently reviewed exact estimate'
  });
  r = (await decide(writer, r, 'submit')).body;
  assert.equal((await decide(writer, r, 'approve')).status, 403);
  assert.equal((await restricted('/estimates/documents/' + r.id)).status, 404);
  assert.equal((await restricted('/search?company=jakh&q=' + r.id)).body.length, 0);
  assert.equal((await restricted('/estimates/report?company=jakh')).body.rows.length, 0);
  assert.ok((await reviewer('/workspace?company=jakh')).body.estimate_documents.some(x => x.id === r.id && x.can_review));
  res = await decide(reviewer, r, 'approve');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  r = res.body;
  assert.equal((await writer('/estimates/documents/' + r.id, {
    ...r,
    reason: 'Forbidden update'
  }, 'PUT')).status, 403);
  const report = (await reviewer('/estimates/report?company=jakh')).body;
  assert.equal(report.rows.length, 1);
  assert.match(estimateRegisterCsv(report), /34151.04/);
  assert.equal((await writer(`/estimates/documents/${r.id}/handover`, {
    version: r.version,
    reason: 'Insufficient project rights'
  })).status, 403);
  const managerId = db.prepare("SELECT user_id FROM identities WHERE login='est.manager'").get().user_id;
  res = await manager(`/estimates/documents/${r.id}/handover`, {
    version: r.version,
    reason: 'Controlled project setup from locked estimate',
    project: {
      code: 'HTTP-EST',
      name: 'HTTP estimate project',
      location: 'Fictional site',
      manager_id: managerId,
      planned_start: '2026-11-01',
      planned_end: '2027-11-01'
    }
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const h = res.body.handover;
  assert.equal(db.prepare('SELECT state FROM budget_documents WHERE id=?').get(h.budget_id).state, 'draft');
  assert.equal(db.prepare('SELECT count(*) n FROM budget_facts WHERE document_id=?').get(h.budget_id).n, 0);
  const preview = await admin('/access/preview', {
    user_id: r.author_id
  });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal((await admin('/estimates/documents', input)).status, 403);
  assert.equal((await admin('/estimates/documents/' + r.id)).status, 200);
});
