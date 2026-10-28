import test from 'node:test';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createApi } from '../server/http.mjs';
const password = 'Temporary test-only river 48!';
async function fixture(t) {
  const db = openDatabase();
  t.after(() => db.close());
  let time = Date.now();
  const server = createApi(db, {
    authMode: 'sample',
    clock: () => time
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const client = () => {
    let cookie = '';
    return async (path, body, method = 'POST', extra = {}) => {
      const r = await fetch(base + path, {
        method: body === undefined ? 'GET' : method,
        headers: {
          'Content-Type': 'application/json',
          'X-Builder-Client': 'local-app',
          Cookie: cookie,
          ...extra
        },
        ...(body === undefined ? {} : {
          body: JSON.stringify(body)
        })
      });
      if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
      return {
        status: r.status,
        body: await r.json(),
        headers: r.headers
      };
    };
  };
  const owner = client();
  const r = await owner('/auth/setup', {
    name: 'HTTP Owner',
    login: 'http.owner',
    password,
    confirm_password: password,
    company_ids: ['jakh']
  });
  assert.equal(r.status, 201);
  const rawStatus = headers => new Promise((resolve, reject) => {
    const req = request(base + '/auth/status', {
      headers
    }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
  return {
    db,
    client,
    owner,
    rawStatus,
    advance: n => {
      time += n;
    }
  };
}
async function person(f, login, grants) {
  const added = await f.owner('/access/accounts', {
    name: login,
    login,
    job_title: 'Test reviewer',
    reason: 'Independent reviewed test account.',
    grants
  });
  assert.equal(added.status, 201);
  const c = f.client();
  let r = await c('/auth/activate', {
    login,
    code: added.body.activation_code,
    password,
    confirm_password: password
  });
  assert.equal(r.status, 200);
  r = await c('/auth/login', {
    login,
    password
  });
  assert.equal(r.status, 200);
  return {
    c,
    id: added.body.user_id
  };
}
test('two authenticated people independently approve a budget and purchase, then reports reconcile the transaction', async t => {
  const f = await fixture(t),
    pm = f.owner;
  const {
    c: review,
    id: reviewerId
  } = await person(f, 'http.reviewer', [{
    company_id: 'jakh',
    project_id: '*',
    role_id: 'project_manager',
    approval_limit: '1000000',
    budget_approval_limit: '1000000'
  }]);
  let r = await pm('/projects', {
    company_id: 'jakh',
    name: 'Authenticated tower',
    code: 'AUTH-T01',
    location: 'Dubai',
    manager_id: (await pm('/bootstrap')).body.actor.id,
    planned_start: '2026-10-29',
    planned_end: '2028-01-01',
    provenance: 'Synthetic direct-award test',
    reason: 'Create authenticated approval journey.'
  });
  assert.equal(r.status, 201);
  const p = r.body.id;
  r = await pm('/work-packages', {
    project_id: p,
    code: 'BLOCK',
    name: 'Blockwork',
    kind: 'item',
    cost_code_id: 'jakh-GENERAL',
    reason: 'Create controlled work item.'
  });
  assert.equal(r.status, 201);
  const w = r.body.id;
  const loc = (await pm(`/foundations?company=jakh&project=${p}`)).body.locations[0].id;
  r = await pm('/budgets', {
    project_id: p,
    kind: 'baseline',
    title: 'Authenticated baseline',
    basis: 'Twenty blocks with delivery allowance.',
    lines: [{
      work_package_id: w,
      proposed_budget: '50000',
      proposed_release: '40000'
    }]
  });
  assert.equal(r.status, 201);
  let b = r.body;
  r = await pm(`/budgets/${b.id}/decision`, {
    version: b.version,
    action: 'submit',
    reason: 'Submit independently.'
  });
  assert.equal(r.status, 200);
  b = r.body;
  assert.equal((await pm(`/budgets/${b.id}/decision`, {
    version: b.version,
    action: 'approve',
    reason: 'Self approval forbidden.'
  })).status, 403);
  r = await review(`/budgets/${b.id}/decision`, {
    version: b.version,
    action: 'approve',
    reason: 'Independent authenticated review.'
  });
  assert.equal(r.status, 200);
  assert.equal(f.db.prepare('SELECT approved_by FROM budget_documents WHERE id=?').get(b.id).approved_by, reviewerId);
  r = await pm('/material-requests', {
    company_id: 'jakh',
    project_id: p,
    title: 'Authenticated site demand',
    needed_by: '2026-11-20',
    lines: [{
      product_id: 'jakh-BLOCK',
      work_package_id: w,
      location_id: loc,
      quantity: '20'
    }]
  });
  assert.equal(r.status, 201);
  let m = r.body;
  r = await pm(`/material-requests/${m.id}/decision`, {
    version: m.version,
    action: 'submit'
  });
  assert.equal(r.status, 200);
  m = r.body;
  const today = new Date().toISOString().slice(0, 10),
    expiry = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  r = await pm(`/material-requests/${m.id}/quotes`, {
    version: m.version,
    line_id: m.lines[0].id,
    vendor_id: 'gulf',
    reference: 'AUTH-Q1',
    quantity: '20',
    unit_price: '10',
    rate: '1',
    rate_date: today,
    rate_source: 'Same currency',
    valid_until: expiry,
    lead_days: 1
  });
  assert.equal(r.status, 200);
  m = r.body;
  r = await pm(`/material-requests/${m.id}/sourcing`, {
    version: m.version,
    allocations: [{
      quote_id: m.quotes[0].id,
      quantity: '20'
    }]
  });
  assert.equal(r.status, 200);
  m = r.body;
  assert.equal((await pm(`/material-requests/${m.id}/decision`, {
    version: m.version,
    action: 'approve'
  })).status, 403);
  r = await review(`/material-requests/${m.id}/decision`, {
    version: m.version,
    action: 'approve'
  });
  assert.equal(r.status, 200);
  m = r.body;
  r = await pm(`/material-requests/${m.id}/orders`, {
    version: m.version
  });
  assert.equal(r.status, 200);
  const report = (await review(`/reports/cost?company=jakh&project=${p}`)).body;
  assert.equal(report.totals.original_budget, '50000.00');
  assert.equal(report.totals.committed, '200.00');
  assert.equal(report.totals.cash, '0.00');
  assert.ok(report.findings.length);
  assert.equal((await review('/reports/cost?company=build')).status, 404);
  assert.equal((await review('/access')).status, 403);
});
test('HTTP rejects sample backdoors, unsafe origins/hosts and preview writes; cookie identity cannot be spoofed', async t => {
  const f = await fixture(t),
    pm = f.owner,
    anonymous = f.client();
  assert.equal((await anonymous('/local-session', {})).status, 403);
  assert.equal((await anonymous('/bootstrap', undefined, 'GET', {
    'X-Actor-Id': 'ahmed'
  })).status, 401);
  assert.equal((await pm('/auth/setup-options')).status, 409);
  const profile = await pm('/auth/profile');
  assert.equal(profile.status, 200);
  assert.equal(profile.body.identity.login, 'http.owner');
  assert.equal((await pm('/auth/recovery-codes', {}, 'POST', {
    Origin: 'https://untrusted.invalid'
  })).status, 403);
  assert.equal(await f.rawStatus({
    Host: 'untrusted.invalid'
  }), 403);
  assert.equal((await pm('/auth/status', undefined, 'GET', {
    'Sec-Fetch-Site': 'cross-site'
  })).status, 403);
  assert.equal((await pm('/logout', {}, 'POST', {
    'X-Builder-Client': ''
  })).status, 403);
  assert.equal((await pm('/access/preview', {
    user_id: 'mohammed'
  })).status, 200);
  assert.equal((await pm('/bootstrap')).body.actor.id, 'mohammed');
  assert.equal((await pm('/auth/profile')).status, 403);
  assert.equal((await pm('/auth/recovery-codes', {})).status, 403);
  assert.equal((await pm('/access/preview', {
    user_id: null
  })).status, 200);
  const all = await pm('/access');
  assert.ok(!/password_hash|token_hash|code_hash|recovery_codes/.test(JSON.stringify(all.body)));
  f.advance(5 * 60000 + 1);
  assert.equal((await pm('/auth/recovery-codes', {})).status, 428);
  assert.equal((await pm('/auth/reauthenticate', {
    password
  })).status, 200);
  const result = await pm('/auth/login', {
    login: 'http.owner',
    password
  });
  assert.match(result.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Path=\/api/);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal((await pm('/logout', {})).status, 200);
  assert.equal((await pm('/bootstrap')).status, 401);
  assert.equal((await pm('/auth/profile')).body.code, 'session_expired');
});
test('company/project grants, session revocation and price redaction apply to activated accounts through HTTP', async t => {
  const f = await fixture(t),
    {
      c: site,
      id
    } = await person(f, 'http.engineer', [{
      company_id: 'jakh',
      project_id: 'harbour',
      role_id: 'site_engineer',
      approval_limit: '0',
      budget_approval_limit: '0'
    }]);
  const b = (await site('/bootstrap')).body;
  assert.deepEqual(b.projects.map(p => p.id), ['harbour']);
  assert.equal((await site('/reports/cost?company=jakh&project=harbour')).status, 403);
  const data = (await site('/foundations?company=jakh&project=harbour')).body;
  assert.ok(data.packages.every(w => !w.position));
  assert.equal(data.budgets.length, 0);
  const second = f.client();
  await second('/auth/login', {
    login: 'http.engineer',
    password
  });
  const sessions = (await site('/auth/profile')).body.sessions;
  const other = sessions.find(s => !s.current);
  assert.equal((await site(`/auth/sessions/${other.id}/revoke`, {})).status, 200);
  assert.equal((await second('/bootstrap')).status, 401);
  const version = f.db.prepare('SELECT access_version FROM users WHERE id=?').get(id).access_version;
  assert.equal((await f.owner(`/access/users/${id}`, {
    version,
    active: false,
    grants: [],
    reason: 'Disable test identity and scopes.'
  }, 'PUT')).status, 200);
  assert.equal((await site('/bootstrap')).status, 401);
  assert.equal((await site('/auth/login', {
    login: 'http.engineer',
    password
  })).status, 401);
});
