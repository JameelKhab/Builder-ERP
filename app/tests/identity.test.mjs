import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/db.mjs';
import { identity } from '../server/identity.mjs';
import { hashPassword, verifyPassword, passwordValue } from '../server/passwords.mjs';
import { accessAdmin } from '../server/access-admin.mjs';
import { policy } from '../server/access.mjs';

// Disposable synthetic credentials only; these are never installed in the running workspace.
const password = 'Disposable river stone 48!';
const replacement = 'Disposable mountain trail 92!';
const ownerInput = {
  name: 'Test Owner',
  login: 'test.owner',
  password,
  confirm_password: password,
  company_ids: ['jakh']
};
const grant = {
  company_id: 'jakh',
  project_id: 'harbour',
  role_id: 'site_engineer',
  approval_limit: '0',
  budget_approval_limit: '0'
};
async function fixture(t) {
  const db = openDatabase();
  t.after(() => db.close());
  let time = Date.now();
  const auth = identity(db, {
    clock: () => time,
    sampleMode: true
  });
  const owner = await auth.setup(ownerInput, 'Test browser');
  return {
    db,
    auth,
    owner,
    s: auth.authenticate(owner.session.token),
    advance: n => {
      time += n;
    }
  };
}
function provision(f, extra = {}) {
  return f.auth.provision(f.s, {
    name: 'Test Engineer',
    login: 'test.engineer',
    job_title: 'Site engineer',
    reason: 'Reviewed test-only site access.',
    grants: [grant],
    ...extra
  });
}
async function activate(f, user) {
  const result = await f.auth.activate({
    login: user.login,
    code: user.activation_code,
    password,
    confirm_password: password
  });
  const session = await f.auth.signIn({
    login: user.login,
    password
  }, 'Engineer browser');
  return {
    ...result,
    session,
    s: f.auth.authenticate(session.token)
  };
}
test('password hashing uses distinct salts, fixed work factors, Unicode normalization and strict length validation', async () => {
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.match(a, /^scrypt\$131072\$8\$1\$/);
  assert.ok(!a.includes(password));
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword('incorrect long password', a), false);
  assert.equal(await verifyPassword(password, null), false);
  assert.equal(passwordValue('cafe\u0301 long passphrase', {
    newPassword: true
  }), 'café long passphrase');
  for (const invalid of ['short', 'passwordpassword', '123456789012345', 'a'.repeat(129), 12, null]) assert.throws(() => passwordValue(invalid, {
    newPassword: true
  }));
});
test('first owner is installed once with explicitly selected scope and no financial approval authority', async t => {
  const f = await fixture(t);
  assert.equal(f.auth.mode(), 'local');
  assert.equal(f.owner.recovery_codes.length, 8);
  const actor = policy(f.db, f.s.user_id).actor();
  assert.equal(actor.access_admin, 1);
  assert.equal(actor.organisation_admin, 1);
  const grants = f.db.prepare('SELECT * FROM memberships WHERE user_id=?').all(f.s.user_id);
  assert.equal(grants.length, 1);
  assert.equal(grants[0].approval_limit, '0');
  assert.equal(grants[0].budget_approval_limit, '0');
  await assert.rejects(() => f.auth.setup(ownerInput), {
    status: 409
  });
  assert.throws(() => f.auth.setupOptions(), {
    status: 409
  });
  const dump = JSON.stringify(f.db.prepare('SELECT * FROM identity_sessions').all()) + JSON.stringify(f.db.prepare('SELECT * FROM identity_codes').all()) + JSON.stringify(f.db.prepare('SELECT * FROM identity_events').all());
  for (const secret of [password, f.owner.session.token, ...f.owner.recovery_codes]) assert.ok(!dump.includes(secret));
  assert.throws(() => f.db.exec('DELETE FROM identity_events'), /append-only/);
});
test('concurrent first-owner attempts have one winner and no second identity or grants', async t => {
  const db = openDatabase();
  t.after(() => db.close());
  const auth = identity(db);
  const results = await Promise.allSettled([auth.setup(ownerInput), auth.setup({
    ...ownerInput,
    login: 'second.owner'
  })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  assert.equal(db.prepare('SELECT count(*) n FROM identities').get().n, 1);
});
test('provisioning is reviewed and atomic; activation grants no extra authority and consumes its code once', async t => {
  const f = await fixture(t),
    before = f.db.prepare('SELECT count(*) n FROM users').get().n;
  assert.throws(() => provision(f, {
    grants: [{
      ...grant,
      company_id: 'build'
    }]
  }));
  assert.equal(f.db.prepare('SELECT count(*) n FROM users').get().n, before);
  const u = provision(f);
  assert.equal(f.auth.userSummary(u.user_id).status, 'awaiting_activation');
  await assert.rejects(() => f.auth.signIn({
    login: u.login,
    password
  }), {
    status: 401
  });
  const active = await activate(f, u);
  assert.equal(f.auth.userSummary(u.user_id).status, 'active');
  assert.equal(policy(f.db, u.user_id).actor().access_admin, 0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM memberships WHERE user_id=?').get(u.user_id).n, 1);
  await assert.rejects(() => f.auth.activate({
    login: u.login,
    code: u.activation_code,
    password: replacement,
    confirm_password: replacement
  }), {
    status: 401
  });
  assert.throws(() => f.auth.provision(active.s, {
    login: 'unpermitted'
  }), {
    status: 403
  });
  assert.throws(() => f.auth.administrativeAuthority(f.s, f.s.user_id, {
    version: 1,
    access_admin: true,
    organisation_admin: true,
    reason: 'Self elevation forbidden.'
  }), {
    status: 403
  });
});
test('existing identity binding records previous labels and preserves referenced transaction identity', async t => {
  const f = await fixture(t);
  const u = provision(f, {
    existing_user_id: 'mohammed',
    version: 1,
    name: 'Reviewed Engineer',
    job_title: 'Construction Engineer'
  });
  assert.equal(u.user_id, 'mohammed');
  const e = f.db.prepare("SELECT detail_json FROM identity_events WHERE action='account_provisioned'").get();
  assert.equal(JSON.parse(e.detail_json).before.name, 'Mohammed Khan');
  assert.throws(() => provision(f, {
    existing_user_id: 'ahmed',
    version: 1,
    login: 'sample.admin'
  }), {
    status: 403
  });
});
test('activation expiry, replacement and recovery invalidate old codes but preserve roles', async t => {
  const f = await fixture(t),
    u = provision(f);
  f.advance(24 * 60 * 60000 + 1);
  await assert.rejects(() => f.auth.activate({
    login: u.login,
    code: u.activation_code,
    password,
    confirm_password: password
  }), {
    status: 401
  });
  const session = await f.auth.signIn({
    login: ownerInput.login,
    password
  });
  f.s = f.auth.authenticate(session.token);
  const next = f.auth.issueActivation(f.s, u.user_id, {
    credential_version: 1,
    reason: 'Expired test activation replacement.'
  });
  const active = await activate(f, next);
  const before = JSON.stringify(f.db.prepare('SELECT * FROM memberships WHERE user_id=?').all(u.user_id));
  const code = f.auth.issueActivation(f.s, u.user_id, {
    credential_version: 2,
    reason: 'Manual test recovery review.'
  });
  assert.equal(f.auth.authenticate(active.session.token).user_id, u.user_id); // Merely requesting reset cannot log out a victim.
  await f.auth.activate({
    login: u.login,
    code: code.activation_code,
    password: replacement,
    confirm_password: replacement
  });
  assert.throws(() => f.auth.authenticate(active.session.token), {
    status: 401
  });
  await assert.rejects(() => f.auth.signIn({
    login: u.login,
    password
  }), {
    status: 401
  });
  assert.equal(before, JSON.stringify(f.db.prepare('SELECT * FROM memberships WHERE user_id=?').all(u.user_id)));
  await assert.rejects(() => f.auth.activate({
    login: u.login,
    code: active.recovery_codes[0],
    password,
    confirm_password: password
  }), {
    status: 401
  });
});
test('password change revokes every session and old code; one-use recovery requires a fresh sign-in', async t => {
  const f = await fixture(t),
    second = await f.auth.signIn({
      login: ownerInput.login,
      password
    });
  const changed = await f.auth.changePassword(f.s, {
    current_password: password,
    new_password: replacement,
    confirm_password: replacement
  });
  for (const token of [f.owner.session.token, second.token]) assert.throws(() => f.auth.authenticate(token), {
    status: 401
  });
  await assert.rejects(() => f.auth.activate({
    login: ownerInput.login,
    code: f.owner.recovery_codes[0],
    password,
    confirm_password: password
  }), {
    status: 401
  });
  const recovered = await f.auth.activate({
    login: ownerInput.login,
    code: changed.recovery_codes[0],
    password,
    confirm_password: password
  });
  assert.equal(recovered.sign_in_required, true);
  await assert.rejects(() => f.auth.activate({
    login: ownerInput.login,
    code: changed.recovery_codes[0],
    password: replacement,
    confirm_password: replacement
  }), {
    status: 401
  });
  assert.ok(await f.auth.signIn({
    login: ownerInput.login,
    password
  }));
});
test('sensitive administration requires fresh password; preview cannot change identity or inspect personal sessions', async t => {
  const f = await fixture(t);
  f.advance(5 * 60000 + 1);
  f.s = f.auth.authenticate(f.owner.session.token);
  assert.throws(() => provision(f), {
    status: 428
  });
  await f.auth.reauthenticate(f.s, {
    password
  });
  const u = provision(f);
  f.auth.setPreview(f.s, u.user_id);
  assert.throws(() => provision(f, {
    login: 'other.person'
  }), {
    status: 403
  });
  assert.throws(() => f.auth.profile(f.s), {
    status: 403
  });
  await assert.rejects(() => f.auth.reauthenticate(f.s, {
    password
  }), {
    status: 403
  });
  f.auth.setPreview(f.s, null);
  assert.ok(f.auth.profile(f.s).sessions[0].current);
});
test('another administrator can maintain owner business scope, but self elevation and direct admin disable remain blocked', async t => {
  const f = await fixture(t),
    u = provision(f, {
      grants: []
    }),
    a = await activate(f, u);
  f.auth.administrativeAuthority(f.s, u.user_id, {
    version: 2,
    access_admin: true,
    organisation_admin: false,
    reason: 'Reviewed second administrator.'
  });
  assert.throws(() => f.auth.authenticate(a.session.token), {
    status: 401
  });
  const auth2 = f.auth.authenticate((await f.auth.signIn({
    login: u.login,
    password
  })).token);
  const changed = accessAdmin(f.db, u.user_id).save(f.s.user_id, {
    version: 1,
    active: true,
    grants: [{
      ...grant,
      project_id: '*',
      role_id: 'project_manager'
    }],
    reason: 'Independent owner scope review.'
  });
  assert.equal(changed.user.access_admin, 1);
  assert.throws(() => f.auth.authenticate(f.owner.session.token), {
    status: 401
  });
  assert.throws(() => accessAdmin(f.db, u.user_id).save(f.s.user_id, {
    version: 2,
    active: false,
    grants: [],
    reason: 'Cannot disable administrator.'
  }), {
    status: 403
  });
  assert.throws(() => f.auth.administrativeAuthority(auth2, u.user_id, {
    version: 3,
    access_admin: false,
    organisation_admin: false,
    reason: 'Cannot remove own authority.'
  }), {
    status: 403
  });
});
test('login errors are generic and rate limits persist; current revocations win over password hashing', async t => {
  const f = await fixture(t);
  const unknown = await f.auth.signIn({
    login: 'unknown.person',
    password
  }).catch(e => e.message);
  const wrong = await f.auth.signIn({
    login: ownerInput.login,
    password: replacement
  }).catch(e => e.message);
  assert.equal(unknown, wrong);
  const pending = f.auth.signIn({
    login: ownerInput.login,
    password
  });
  f.db.prepare('UPDATE users SET active=0 WHERE id=?').run(f.s.user_id);
  await assert.rejects(() => pending, {
    status: 401
  });
  assert.equal(await f.auth.signIn({
    login: ownerInput.login,
    password
  }).catch(e => e.message), wrong);
  for (let i = 0; i < 5; i++) await assert.rejects(() => f.auth.signIn({
    login: ownerInput.login,
    password
  }), {
    status: 401
  });
  await assert.rejects(() => identity(f.db).signIn({
    login: ownerInput.login,
    password
  }), {
    status: 429
  });
});
test('activation and password reauthentication recheck revocation after asynchronous hashing', async t => {
  const f = await fixture(t),
    u = provision(f);
  const pending = f.auth.activate({
    login: u.login,
    code: u.activation_code,
    password,
    confirm_password: password
  });
  f.db.prepare('UPDATE users SET active=0 WHERE id=?').run(u.user_id);
  await assert.rejects(() => pending, {
    status: 401
  });
  assert.equal(f.auth.userSummary(u.user_id).status, 'awaiting_activation');
  const reauth = f.auth.reauthenticate(f.s, {
    password
  });
  f.auth.logout(f.s);
  await assert.rejects(() => reauth, {
    status: 401
  });
});
test('sessions survive service restart and enforce idle, absolute, own-session and access-version boundaries', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'builder-identity-'));
  t.after(() => rmSync(dir, {
    recursive: true,
    force: true
  }));
  const file = join(dir, 'test.sqlite');
  let db = openDatabase(file),
    time = Date.now(),
    auth = identity(db, {
      clock: () => time
    });
  const owner = await auth.setup(ownerInput);
  db.close();
  db = openDatabase(file);
  t.after(() => db.close());
  auth = identity(db, {
    clock: () => time,
    sampleMode: true
  });
  assert.equal(auth.mode(), 'local');
  let s = auth.authenticate(owner.session.token);
  assert.equal(s.user_id, db.prepare('SELECT owner_id FROM identity_state').get().owner_id);
  time += 30 * 60000;
  assert.throws(() => auth.authenticate(owner.session.token), {
    status: 401
  });
  const fresh = await auth.signIn({
    login: ownerInput.login,
    password
  });
  s = auth.authenticate(fresh.token);
  assert.throws(() => auth.revokeSession(s, 'another-person-session'), {
    status: 404
  });
  for (let n = 0; n < 23; n++) {
    time += 20 * 60000;
    auth.authenticate(fresh.token);
  }
  time += 20 * 60000;
  assert.throws(() => auth.authenticate(fresh.token), {
    status: 401
  });
  const latest = await auth.signIn({
    login: ownerInput.login,
    password
  });
  db.prepare('UPDATE users SET access_version=access_version+1 WHERE id=?').run(s.user_id);
  assert.throws(() => auth.authenticate(latest.token), {
    status: 401
  });
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});
