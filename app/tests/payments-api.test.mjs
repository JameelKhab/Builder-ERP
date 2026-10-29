import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/payment-fixture.mjs';
import { today } from './helpers/payable-fixture.mjs';
import { identity } from '../server/identity.mjs';
import { createApi } from '../server/http.mjs';
import { paymentsCsv } from '../src/payments-export.js';
test('individual HTTP identities independently prepare, approve, record and reconcile; scope, preview and complete CSV stay aligned', async t => {
  const f = setup(t),
    auth = identity(f.db, {
      sampleMode: true
    }),
    password = 'Disposable payment test passphrase 93!';
  const owner = await auth.setup({
    name: 'Payment test owner',
    login: 'pay.owner',
    password,
    confirm_password: password,
    company_ids: ['jakh']
  }, 'Disposable test');
  const session = auth.authenticate(owner.session.token),
    users = [];
  for (const [login, role, limit, project] of [['pay.writer', 'treasury_clerk', '0', '*'], ['pay.reviewer', 'financial_controller', '100000', '*'], ['pay.bank', 'bank_reconciler', '0', '*'], ['pay.restricted', 'treasury_clerk', '0', 'gardens']]) {
    const u = auth.provision(session, {
      name: login,
      login,
      job_title: role,
      reason: 'Disposable payment role test',
      grants: [{
        company_id: 'jakh',
        project_id: project,
        role_id: role,
        approval_limit: '0',
        payment_approval_limit: limit
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
  const writer = await client('pay.writer'),
    reviewer = await client('pay.reviewer'),
    bank = await client('pay.bank'),
    other = await client('pay.restricted'),
    admin = await client('pay.owner');
  let res = await writer('/payments/documents', {
    ...f.inputPay,
    state: 'recorded',
    authority_amount: '0',
    payload: '{}',
    company_total: '0'
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  let p = res.body;
  assert.equal(p.company_total, '430.00');
  assert.equal(p.state, 'draft');
  assert.equal((await writer('/ledger/report?company=jakh')).status, 404);
  const decision = (call, p, action, extra = {}) => call(`/payments/documents/${p.id}/decision`, {
    version: p.version,
    action,
    reason: 'Individually checked source and payment amount',
    ...extra
  });
  p = (await decision(writer, p, 'submit')).body;
  assert.equal((await decision(writer, p, 'approve')).status, 403);
  assert.equal((await other('/payments/documents/' + p.id)).status, 404);
  assert.equal((await other('/search?company=jakh&q=Partial settlement')).body.length, 0);
  assert.ok((await reviewer('/workspace?company=jakh')).body.payment_documents.some(x => x.id === p.id && x.can_review));
  res = await decision(reviewer, p, 'approve');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  p = res.body;
  assert.equal((await writer('/payments/report?company=jakh')).body.rows.length, 0);
  assert.equal((await decision(reviewer, p, 'record', {
    bank_reference: 'HTTP-PAY-001',
    evidence: 'Fictional statement evidence'
  })).status, 403);
  res = await decision(writer, p, 'record', {
    bank_reference: 'HTTP-PAY-001',
    evidence: 'Fictional offline bank reference'
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  p = res.body;
  assert.equal((await reviewer('/payables/report?company=jakh')).body.totals.difference, '0.00');
  res = await bank('/payments/statements', {
    bank_id: f.bank.id,
    reference: 'HTTP-STMT',
    start_date: today(),
    end_date: today(),
    opening: '1000',
    closing: '570',
    reason: 'Fictional bank evidence',
    rows: [{
      date: today(),
      direction: 'out',
      amount: '430',
      reference: 'HTTP-PAY-001'
    }]
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const row = res.body.rows[0];
  assert.equal((await writer(`/payments/statement-rows/${row.id}/decision`, {
    version: 1,
    action: 'match',
    payment_ids: [p.id],
    reason: 'Test permission'
  })).status, 403);
  res = await bank(`/payments/statement-rows/${row.id}/decision`, {
    version: 1,
    action: 'match',
    payment_ids: [p.id],
    reason: 'Exact reference and amount verified'
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const report = (await writer('/payments/report?company=jakh&project=harbour&to=' + today())).body;
  assert.equal(report.totals.cleared, '430.00');
  assert.ok(paymentsCsv(report).includes('HTTP-STMT'));
  assert.ok(paymentsCsv(report).includes(p.id));
  assert.equal((await other('/payments/report?company=jakh')).body.rows.length, 0);
  assert.equal((await other('/payments/statements?company=jakh')).status, 403);
  await admin('/access/preview', {
    user_id: users[0].user_id
  });
  assert.equal((await admin('/payments/documents', f.inputPay)).status, 403);
});
