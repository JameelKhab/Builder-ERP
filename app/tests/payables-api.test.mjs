import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, returned, today } from './helpers/payable-fixture.mjs';
import { identity } from '../server/identity.mjs';
import { createApi } from '../server/http.mjs';
import { payablesCsv } from '../src/payables-export.js';
test('authenticated supplier bill and partial return credit post independently through HTTP; scopes, source integrity and exports reconcile', async t => {
  const f = fixture(t),
    auth = identity(f.db, {
      sampleMode: true
    }),
    password = 'Disposable AP test passphrase 74!';
  const setup = await auth.setup({
    name: 'Payable test owner',
    login: 'ap.owner',
    password,
    confirm_password: password,
    company_ids: ['jakh']
  }, 'Disposable test');
  const session = auth.authenticate(setup.session.token),
    users = [];
  for (const [login, role, limit, project] of [['ap.writer', 'ap_clerk', '0', 'harbour'], ['ap.controller', 'financial_controller', '100000', 'harbour'], ['ap.otherproject', 'ap_clerk', '0', 'gardens'], ['ap.site', 'site_engineer', '0', 'harbour']]) {
    const u = auth.provision(session, {
      name: login,
      login,
      job_title: role,
      reason: 'Disposable authenticated payable test',
      grants: [{
        company_id: 'jakh',
        project_id: project,
        role_id: role,
        approval_limit: '0',
        ap_approval_limit: limit
      }]
    });
    await auth.activate({
      login,
      code: u.activation_code,
      password,
      confirm_password: password
    });
    users.push(u);
  }
  const server = createApi(f.db, {
    today
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
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
  const author = await client('ap.writer'),
    reviewer = await client('ap.controller'),
    other = await client('ap.otherproject'),
    site = await client('ap.site'),
    owner = await client('ap.owner');
  const sources = (await author('/payables/sources?company=jakh')).body;
  assert.equal(sources.length, 1);
  assert.equal(sources[0].receipts[0].available, '30');
  assert.equal((await author('/ledger/report?company=jakh')).status, 404);
  assert.equal((await site('/payables/report?company=jakh')).status, 404);
  assert.equal((await other('/payables/sources?company=jakh&project=harbour')).status, 404);
  let response = await author('/payables/documents', {
    ...f.input,
    total: '0',
    company_total: '0',
    journal_json: '[]',
    state: 'posted',
    posted_by: users[1].user_id
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  let bill = response.body;
  assert.equal(bill.total, '315.00');
  assert.equal(bill.state, 'draft');
  const decision = async (call, r, action) => call(`/payables/documents/${r.id}/decision`, {
    version: r.version,
    action,
    reason: 'HTTP test source and balances checked'
  });
  bill = (await decision(author, bill, 'submit')).body;
  assert.equal((await decision(author, bill, 'post')).status, 403);
  assert.equal((await other('/payables/documents/' + bill.id)).status, 404);
  assert.ok((await reviewer('/workspace?company=jakh')).body.payable_documents.some(r => r.id === bill.id && r.can_review));
  assert.ok((await author('/search?company=jakh&q=INV-001')).body.some(r => r.id === bill.id));
  response = await decision(reviewer, bill, 'post');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  bill = response.body;
  const journal = (await reviewer('/ledger/entries/' + bill.journal_id)).body;
  assert.equal(journal.source_id, bill.id);
  assert.equal((await reviewer(`/ledger/entries/${journal.id}/reversal`, {
    version: journal.version,
    accounting_date: today(),
    reason: 'Must use typed source'
  })).status, 422);
  returned(f, '5');
  response = await author('/payables/documents', {
    ...f.input,
    kind: 'credit',
    original_id: bill.id,
    reference: 'HTTP-CREDIT-1',
    title: 'HTTP supplier return credit',
    rate: '999',
    lines: [{
      original_line_id: bill.lines[0].id,
      quantity: '5'
    }]
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  let credit = response.body;
  assert.equal(credit.rate, bill.rate);
  credit = (await decision(author, credit, 'submit')).body;
  response = await decision(reviewer, credit, 'post');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const report = (await author('/payables/report?company=jakh&project=harbour&to=2026-10-29')).body;
  assert.equal(report.rows[0].open, '262.50');
  assert.equal(report.totals.difference, '0.00');
  assert.ok(payablesCsv(report).includes('HTTP-CREDIT-1'));
  assert.equal((await other('/payables/report?company=jakh')).body.rows.length, 0);
  assert.equal((await author('/payables/settings/jakh', {
    account_id: f.control.id,
    reason: 'Not permitted'
  }, 'PUT')).status, 403);
  await owner('/access/preview', {
    user_id: users[0].user_id
  });
  assert.equal((await owner('/payables/documents', f.input)).status, 403);
});
