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
      'X-Jakh-Client': 'local-app'
    }
  })).status, 403);
  const session = await fetch(base + '/api/local-session', {
    method: 'POST',
    headers: {
      'X-Jakh-Client': 'local-app'
    }
  });
  assert.equal(session.status, 200);
  const cookie = session.headers.get('set-cookie').split(';')[0];
  assert.match(session.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const headers = {
    Cookie: cookie,
    'X-Jakh-Client': 'local-app',
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
  assert.equal(data.rows.length, 4);
  assert.equal(data.meta.restricted, true);
});
