import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createApi } from '../server/http.mjs';
import { identity } from '../server/identity.mjs';
import { ledger } from '../server/ledger.mjs';
import { ledgerCsv } from '../src/ledger-export.js';
test('authenticated HTTP journals require separate independent authority, post/reverse, reconcile reports/exports and reject preview writes', async t => {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  const password = 'Disposable ledger test password 86!';
  const auth = identity(db, {
    sampleMode: true
  });
  const setup = await auth.setup({
    name: 'Ledger test owner',
    login: 'ledger.owner',
    password,
    confirm_password: password,
    company_ids: ['jakh']
  }, 'Disposable test');
  const session = auth.authenticate(setup.session.token);
  const users = [];
  for (const [login, role, limit] of [['ledger.preparer', 'accountant', '0'], ['ledger.controller', 'financial_controller', '100000'], ['ledger.site', 'site_engineer', '0']]) {
    const u = auth.provision(session, {
      name: login,
      login,
      job_title: role,
      reason: 'Disposable HTTP test account and independent authority',
      grants: [{
        company_id: 'jakh',
        project_id: '*',
        role_id: role,
        approval_limit: '0',
        budget_approval_limit: '0',
        ledger_approval_limit: limit
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
  const server = createApi(db, {
    today: () => '2026-10-29'
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
  const author = await client('ledger.preparer'),
    reviewer = await client('ledger.controller'),
    site = await client('ledger.site'),
    owner = await client('ledger.owner');
  const opts = (await author('/ledger/options?company=jakh')).body;
  const expense = ledger(db, users[1].user_id, () => '2026-10-29').account(null, {company_id:'jakh',code:'5199',name:'HTTP isolated test expense',type:'expense',purpose:'general',active:true,reason:'Dedicated test source to isolate the reversal result'}),
    liability = opts.accounts.find(a => a.type === 'liability' && a.purpose === 'general');
  let response = await author('/ledger/entries', {
    company_id: 'jakh',
    project_id: 'harbour',
    title: 'HTTP independently posted accrual',
    accounting_date: '2026-10-28',
    currency: 'USD',
    rate: '3.6725',
    rate_date: '2026-10-28',
    rate_source: 'Fictional test accounting rate',
    source_reference: 'HTTP-WORKSHEET-17',
    explanation: 'Synthetic local independent accounting test',
    lines: [{
      account_id: expense.id,
      description: 'Testing expense',
      debit: '40.01',
      credit: '0'
    }, {
      account_id: liability.id,
      description: 'Testing accrual',
      debit: '0',
      credit: '40.01'
    }]
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  let r = response.body;
  response = await author(`/ledger/entries/${r.id}/decision`, {
    version: r.version,
    action: 'submit',
    reason: 'Independent review requested'
  });
  assert.equal(response.status, 200);
  r = response.body;
  assert.equal((await author(`/ledger/entries/${r.id}/decision`, {
    version: r.version,
    action: 'post',
    reason: 'Self posting forbidden'
  })).status, 403);
  assert.equal((await site('/ledger/report?company=jakh')).status, 404);
  assert.equal((await site('/ledger/entries/' + r.id)).status, 404);
  assert.ok((await reviewer('/workspace?company=jakh')).body.ledger_entries.some(e => e.id === r.id && e.can_review));
  response = await reviewer(`/ledger/entries/${r.id}/decision`, {
    version: r.version,
    action: 'post',
    reason: 'Source and accounting conversion independently checked'
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  r = response.body;
  assert.equal(r.state, 'posted');
  assert.equal(r.company_total, '146.94');
  const filtered = (await reviewer('/ledger/report?company=jakh&project=harbour&from=2026-10-28&to=2026-10-28')).body;
  assert.deepEqual(filtered.totals, {
    opening: '0.00',
    debit: '146.94',
    credit: '146.94',
    closing: '0.00'
  });
  assert.equal(filtered.rows.length, 2);
  assert.ok(ledgerCsv(filtered).includes(r.number));
  assert.ok((await reviewer('/search?company=jakh&q=HTTP%20independently')).body.some(e => e.id === r.id));
  let reversal = (await author(`/ledger/entries/${r.id}/reversal`, {
    version: r.version,
    accounting_date: '2026-10-29',
    reason: 'Full reversal verified by another user'
  })).body;
  assert.equal(reversal.reversal_of, r.id);
  reversal = (await author(`/ledger/entries/${reversal.id}/decision`, {
    version: reversal.version,
    action: 'submit',
    reason: 'Review this correction'
  })).body;
  response = await reviewer(`/ledger/entries/${reversal.id}/decision`, {
    version: reversal.version,
    action: 'post',
    reason: 'Original and opposite amounts verified'
  });
  assert.equal(response.status, 200);
  const accountReport = (await reviewer(`/ledger/report?company=jakh&project=harbour&from=2026-10-29&to=2026-10-29&account=${expense.id}`)).body;
  assert.equal(accountReport.totals.credit, '146.94');
  assert.equal(accountReport.totals.debit, '0.00');
  const foreign = ledger(db, 'example-ledger-author', () => '2026-10-29').list('build')[0];
  assert.equal((await reviewer('/ledger/entries/' + foreign.id)).status, 404);
  assert.equal((await reviewer('/ledger/report?company=build')).status, 404);
  await owner('/access/preview', {
    user_id: users[1].user_id
  });
  assert.equal((await owner('/ledger/accounts', {
    company_id: 'jakh'
  })).status, 403);
});
