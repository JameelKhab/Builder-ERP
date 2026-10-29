import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { identity } from '../server/identity.mjs';
import { createApi } from '../server/http.mjs';
test('individual HTTP identities allocate, approve, record and download receipt evidence with scopes and read-only preview', async t => {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  const today = () => '2026-10-29',
    reason = 'Independent HTTP customer receipt verification',
    password = 'Disposable receipt test passphrase 95!',
    auth = identity(db, {
      sampleMode: true
    });
  const owner = await auth.setup({
      name: 'Receipt test owner',
      login: 'receipt.owner',
      password,
      confirm_password: password,
      company_ids: ['jakh']
    }, 'Isolated test'),
    session = auth.authenticate(owner.session.token),
    users = {};
  for (const [login, role, project] of [['receipt.writer', 'ar_clerk', 'harbour'], ['receipt.reviewer', 'financial_controller', 'harbour'], ['receipt.recorder', 'treasury_clerk', 'harbour'], ['receipt.other', 'ar_clerk', 'gardens']]) {
    const u = auth.provision(session, {
      name: login,
      login,
      job_title: role,
      reason,
      grants: [{
        company_id: 'jakh',
        project_id: project,
        role_id: role,
        approval_limit: '0',
        receipt_approval_limit: role === 'financial_controller' ? '100000' : '0'
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
        headers: res.headers,
        body: res.headers.get('content-type')?.includes('application/json') ? await res.json() : Buffer.from(await res.arrayBuffer())
      };
    };
    assert.equal((await call('/auth/login', {
      login,
      password
    })).status, 200);
    return call;
  }
  const writer = await client('receipt.writer'),
    reviewer = await client('receipt.reviewer'),
    recorder = await client('receipt.recorder'),
    other = await client('receipt.other'),
    admin = await client('receipt.owner');
  const options = (await writer('/customer-receipts/options?company=jakh&project=harbour')).body,
    invoice = options.balances[0];
  let response = await writer('/customer-receipts/documents', {
    company_id: 'jakh',
    bank_id: options.banks[0].id,
    title: 'HTTP fictional remittance',
    accounting_date: '2026-10-29',
    bank_amount: '100',
    bank_rate: '1',
    rate_date: '2026-10-29',
    rate_source: 'Same-currency local evidence',
    explanation: reason,
    allocations: [{
      invoice_id: invoice.id,
      amount: '100'
    }],
    state: 'recorded',
    author_id: 'forged',
    authority_amount: '0',
    payload: '{}'
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  let r = response.body;
  assert.equal(r.state, 'draft');
  assert.notEqual(r.author_id, 'forged');
  assert.equal(r.authority_amount, '100.00');
  response = await writer(`/customer-receipts/documents/${r.id}/decision`, {
    version: r.version,
    action: 'submit',
    reason
  });
  assert.equal(response.status, 200);
  r = response.body;
  assert.equal((await writer(`/customer-receipts/documents/${r.id}/decision`, {
    version: r.version,
    action: 'approve',
    reason
  })).status, 403);
  response = await reviewer(`/customer-receipts/documents/${r.id}/decision`, {
    version: r.version,
    action: 'approve',
    reason
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  r = response.body;
  const file = {
      filename: 'http-remittance.txt',
      base64: Buffer.from('Fictional original remittance for HTTP verification.').toString('base64')
    },
    recordBody = {
      version: r.version,
      action: 'record',
      reason,
      bank_reference: 'HTTP-CUSTOMER-RECEIPT',
      file
    };
  assert.equal((await reviewer(`/customer-receipts/documents/${r.id}/decision`, recordBody)).status, 403);
  assert.equal((await writer(`/customer-receipts/documents/${r.id}/decision`, recordBody)).status, 403);
  response = await recorder(`/customer-receipts/documents/${r.id}/decision`, recordBody);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  r = response.body;
  assert.equal(r.state, 'recorded');
  assert.equal((await recorder(`/customer-receipts/documents/${r.id}/decision`, recordBody)).body.id, r.id);
  const download = await writer('/customer-receipts/evidence/' + r.evidence.id);
  assert.equal(download.status, 200);
  assert.equal(download.body.toString(), 'Fictional original remittance for HTTP verification.');
  assert.ok(download.headers.get('content-disposition').startsWith('attachment;'));
  assert.equal((await other('/customer-receipts/documents/' + r.id)).status, 404);
  assert.equal((await other('/customer-receipts/evidence/' + r.evidence.id)).status, 404);
  assert.equal((await writer('/customer-receipts/report?company=build')).status, 404);
  const report = (await writer('/customer-receipts/report?company=jakh&project=harbour&to=2026-10-29')).body;
  assert.equal(report.reconciliation.difference, '0.00');
  assert.equal(report.totals.net, '100.00');
  assert.equal(report.rows.filter(x => x.receipt_id === r.id).length, 1);
  assert.equal((await writer('/payments/options?company=jakh')).status, 404);
  assert.equal((await writer('/ledger/options?company=jakh')).status, 404);
  assert.equal((await admin('/access/preview', {
    user_id: r.author_id
  })).status, 200);
  assert.equal((await admin('/customer-receipts/documents', {
    company_id: 'jakh'
  })).status, 403);
});
