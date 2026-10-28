import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createApi } from '../server/http.mjs';
test('HTTP boundary requires a session, blocks cross-origin writes and scopes direct endpoints', async t => {
  const db = openDatabase(),
    app = createApi(db, {
      actorId: 'mohammed',
      today: () => '2026-10-28'
    });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/api/bootstrap')).status, 401);
  assert.equal((await fetch(base + '/api/local-session', {
    method: 'POST'
  })).status, 403);
  assert.equal((await fetch(base + '/api/local-session', {
    method: 'POST',
    headers: {
      Origin: 'https://untrusted.example',
      'X-Builder-Client': 'local-app'
    }
  })).status, 403);
  const session = await fetch(base + '/api/local-session', {
    method: 'POST',
    headers: {
      'X-Builder-Client': 'local-app'
    }
  });
  assert.equal(session.status, 200);
  const cookie = session.headers.get('set-cookie').split(';')[0];
  assert.match(session.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const headers = {
    Cookie: cookie,
    'X-Builder-Client': 'local-app',
    'Content-Type': 'application/json'
  };
  assert.equal((await fetch(base + '/api/workspace?company=build', {
    headers
  })).status, 404);
  assert.equal((await fetch(base + '/api/records/CO-011', {
    headers
  })).status, 404);
  assert.equal((await fetch(base + '/api/requests/PR-0264/decision', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'approve',
      version: 2
    })
  })).status, 403);
  const report = await fetch(base + '/api/reports/cost?company=jakh', {
    headers
  });
  const data = await report.json();
  assert.equal(report.status, 403);
  assert.match(data.error, /role/);
});
test('access preview is administrator-only, server-enforced read-only, and revocation invalidates sessions', async t => {
  const db = openDatabase(':memory:', {
      examples: true
    }),
    app = createApi(db, {
      today: () => '2026-10-28'
    }),
    server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    'X-Builder-Client': 'local-app',
    'Content-Type': 'application/json'
  };
  const login = await fetch(base + '/api/local-session', {
    method: 'POST',
    headers
  });
  headers.Cookie = login.headers.get('set-cookie').split(';')[0];
  const call = (path, method = 'GET', body) => fetch(base + '/api' + path, {
    method,
    headers,
    ...(body ? {
      body: JSON.stringify(body)
    } : {})
  });
  assert.equal((await call('/access')).status, 200);
  assert.equal((await call('/access/preview', 'POST', {
    user_id: 'mohammed'
  })).status, 200);
  const boot = await (await call('/bootstrap')).json();
  assert.equal(boot.actor.id, 'mohammed');
  assert.ok(boot.preview);
  assert.equal((await call('/access')).status, 403);
  assert.equal((await call('/reports/cost?company=jakh')).status, 403);
  const workspace = await (await call('/workspace?company=jakh')).json();
  assert.equal(workspace.report, null);
  assert.equal(workspace.requests[0].amount, undefined);
  assert.equal((await call('/requests/PR-0264/decision', 'POST', {
    action: 'return',
    version: 2,
    note: 'testing preview'
  })).status, 403);
  assert.equal((await call('/access/users/sara', 'PUT', {
    version: 1
  })).status, 403);
  assert.equal((await call('/access/preview', 'POST', {})).status, 200);
  assert.equal((await (await call('/bootstrap')).json()).actor.id, 'ahmed');
  db.prepare("UPDATE users SET access_version=access_version+1 WHERE id='ahmed'").run();
  assert.equal((await call('/bootstrap')).status, 401);
  assert.equal((await call('/access')).status, 401);
});
test('a normal session cannot impersonate another user and logout revokes its token', async t => {
  const db = openDatabase(),
    server = createApi(db, {
      actorId: 'mohammed'
    }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`,
    headers = {
      'X-Builder-Client': 'local-app',
      'Content-Type': 'application/json'
    };
  const login = await fetch(base + '/api/local-session', {
    method: 'POST',
    headers
  });
  headers.Cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base + '/api/access/preview', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: 'ahmed'
    })
  })).status, 403);
  assert.equal((await fetch(base + '/api/logout', {
    method: 'POST',
    headers,
    body: '{}'
  })).status, 200);
  assert.equal((await fetch(base + '/api/bootstrap', {
    headers
  })).status, 401);
});
