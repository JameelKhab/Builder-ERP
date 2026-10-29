import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { identity } from '../server/identity.mjs';
import { createApi } from '../server/http.mjs';
import { certificates } from '../server/certificates.mjs';
const today = () => '2026-10-29',
  reason = 'Independent local HTTP verification of certified client work';
test('individual HTTP accounts prepare evidence, review each stage, invoice and post with scope and preview protection', async t => {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  const synthetic = certificates(db, 'example-measurer', today),
    pending = synthetic.list('jakh', 'harbour').find(r => r.state === 'technical'),
    saved = synthetic.detail(pending.id);
  synthetic.decide(pending.id, {
    version: pending.version,
    action: 'cancel',
    reason
  });
  const auth = identity(db, {
      sampleMode: true
    }),
    password = 'Disposable client finance test 94!';
  const owner = await auth.setup({
      name: 'Test owner',
      login: 'cert.owner',
      password,
      confirm_password: password,
      company_ids: ['jakh']
    }, 'Isolated test'),
    session = auth.authenticate(owner.session.token),
    users = {};
  for (const [login, role, project] of [['cert.writer', 'quantity_surveyor', 'harbour'], ['cert.technical', 'project_manager', 'harbour'], ['cert.commercial', 'commercial_manager', 'harbour'], ['cert.finance', 'financial_controller', 'harbour'], ['cert.ar', 'ar_clerk', 'harbour'], ['cert.restricted', 'ar_clerk', 'gardens']]) {
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
        certificate_approval_limit: ['commercial_manager', 'financial_controller'].includes(role) ? '1000000' : '0',
        ar_approval_limit: role === 'financial_controller' ? '1000000' : '0'
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
        body: res.headers.get('content-type')?.includes('application/json') ? await res.json() : Buffer.from(await res.arrayBuffer()),
        headers: res.headers
      };
    };
    assert.equal((await call('/auth/login', {
      login,
      password
    })).status, 200);
    return call;
  }
  const writer = await client('cert.writer'),
    technical = await client('cert.technical'),
    commercial = await client('cert.commercial'),
    finance = await client('cert.finance'),
    ar = await client('cert.ar'),
    restricted = await client('cert.restricted'),
    admin = await client('cert.owner');
  let res = await writer('/certificates/measurements', {
    ...saved,
    id: undefined,
    author_id: 'spoof',
    state: 'approved',
    filename: 'http-measurement.txt',
    base64: Buffer.from('FICTIONAL measurement only').toString('base64'),
    reason
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  let r = res.body;
  assert.equal(r.state, 'draft');
  assert.notEqual(r.author_id, 'spoof');
  const file = await writer('/certificates/evidence/' + r.evidence_id);
  assert.equal(file.status, 200);
  assert.equal(file.body.toString(), 'FICTIONAL measurement only');
  assert.equal(file.headers.get('x-content-sha256'), r.evidence[0].sha256);
  assert.equal((await restricted('/certificates/measurements/' + r.id)).status, 404);
  assert.equal((await restricted('/certificates/evidence/' + r.evidence_id)).status, 404);
  assert.equal((await restricted('/certificates/contracts/' + r.contract_id)).status, 404);
  res = await writer(`/certificates/measurements/${r.id}/decision`, {
    version: r.version,
    action: 'submit',
    reason
  });
  assert.equal(res.status, 200);
  r = res.body;
  assert.equal((await writer(`/certificates/measurements/${r.id}/decision`, {
    version: r.version,
    action: 'accept',
    reason
  })).status, 403);
  for (const client of [technical, commercial, finance]) {
    res = await client(`/certificates/measurements/${r.id}/decision`, {
      version: r.version,
      action: 'accept',
      reason
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    r = res.body;
  }
  assert.equal(r.state, 'approved');
  res = await ar('/certificates/invoices', {
    certificate_id: r.id,
    invoice_date: today(),
    accounting_date: today(),
    due_date: '2026-11-28',
    rate: '1',
    rate_date: today(),
    rate_source: 'Same currency test',
    basis: 'Certified work to accounting',
    reason
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  let i = res.body;
  assert.equal((await restricted('/certificates/invoices/' + i.id)).status, 404);
  assert.equal((await ar('/ledger/report?company=jakh')).status, 404);
  assert.equal((await ar('/payables/report?company=jakh')).status, 404);
  res = await ar(`/certificates/invoices/${i.id}/decision`, {
    version: i.version,
    action: 'submit',
    reason
  });
  assert.equal(res.status, 200);
  i = res.body;
  assert.equal((await ar(`/certificates/invoices/${i.id}/decision`, {
    version: i.version,
    action: 'post',
    reason
  })).status, 403);
  res = await finance(`/certificates/invoices/${i.id}/decision`, {
    version: i.version,
    action: 'post',
    reason
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  i = res.body;
  assert.equal(i.state, 'posted');
  const report = await ar('/certificates/report?company=jakh&project=harbour');
  assert.equal(report.body.totals.receivable_difference, '0.00');
  assert.ok(report.body.rows.some(x => x.id === r.id));
  assert.equal((await ar('/certificates/report?company=build')).status, 404);
  const preview = await admin('/access/preview', {
    user_id: r.author_id
  });
  assert.equal(preview.status, 200);
  assert.equal((await admin('/certificates/measurements', {
    ...saved,
    reason
  })).status, 403);
});
