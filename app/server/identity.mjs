import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { transaction } from './db.mjs';
import { policy } from './access.mjs';
import { accessAdmin } from './access-admin.mjs';
import { requireThat } from './money.mjs';
import { hashPassword, verifyPassword, passwordValue } from './passwords.mjs';
const hash = v => createHash('sha256').update(v).digest('hex');
const loginValue = v => {
  requireThat(typeof v === 'string', 'Enter your username.');
  const login = v.trim().toLowerCase();
  requireThat(/^[a-z0-9][a-z0-9._@+-]{2,79}$/.test(login), 'Use 3–80 letters, numbers, or . _ @ + - for the username.');
  return login;
};
const text = (v, label, max = 160) => {
  requireThat(typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= max, `${label} is required (2–${max} characters).`);
  return v.trim();
};
const generic = 'Sign-in details could not be verified.';
export function identity(db, {
  clock = () => Date.now(),
  sampleMode = false
} = {}) {
  const now = () => clock();
  const state = () => db.prepare('SELECT * FROM identity_state WHERE id=1').get();
  const mode = () => state().secured ? 'local' : sampleMode ? 'sample' : 'setup';
  const account = id => db.prepare('SELECT i.*,u.active,u.access_version,u.name,u.access_admin,u.organisation_admin FROM identities i JOIN users u ON u.id=i.user_id WHERE i.user_id=?').get(id);
  const event = (actor, subject, action, details = {}) => db.prepare('INSERT INTO identity_events(actor_id,subject_id,action,detail_json,at) VALUES(?,?,?,?,?)').run(actor, subject, action, JSON.stringify(details), now());
  const limited = (key, max = 8, window = 15 * 60000) => {
    const row = db.prepare('SELECT * FROM identity_limits WHERE key=?').get(key);
    requireThat(!row || row.reset_at <= now() || row.attempts < max, 'Too many attempts. Wait before trying again.', 429);
    db.prepare('INSERT INTO identity_limits(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END').run(key, now() + window, now(), now(), now() + window);
  };
  const rate = (kind, login) => {
    limited('global:' + kind, 60, 5 * 60000);
    limited(kind + ':' + hash(login));
  };
  const code = (uid, kind, actor, expires) => {
    const raw = randomBytes(24).toString('base64url');
    db.prepare('INSERT INTO identity_codes(id,user_id,kind,code_hash,created_at,expires_at,issued_by) VALUES(?,?,?,?,?,?,?)').run(randomUUID(), uid, kind, hash(raw), now(), expires, actor);
    return raw;
  };
  const invalidateCodes = (uid, kinds = ['activation', 'reset', 'recovery']) => {
    for (const kind of kinds) db.prepare('UPDATE identity_codes SET used_at=? WHERE user_id=? AND kind=? AND used_at IS NULL').run(now(), uid, kind);
  };
  const recoveryCodes = uid => {
    invalidateCodes(uid, ['recovery']);
    return Array.from({
      length: 8
    }, () => code(uid, 'recovery', uid, null));
  };
  const revoke = uid => db.prepare('DELETE FROM identity_sessions WHERE user_id=?').run(uid);
  const session = (uid, label = 'Local browser') => {
    const a = account(uid);
    requireThat(a?.active && a.password_hash, 'Sign in to continue.', 401);
    db.prepare('DELETE FROM identity_sessions WHERE expires_at<=? OR last_seen<=?').run(now(), now() - 30 * 60000);
    const rows = db.prepare('SELECT id FROM identity_sessions WHERE user_id=? ORDER BY created_at DESC').all(uid);
    for (const old of rows.slice(9)) db.prepare('DELETE FROM identity_sessions WHERE id=?').run(old.id);
    const raw = randomBytes(32).toString('base64url'),
      sid = randomUUID(),
      time = now();
    db.prepare('INSERT INTO identity_sessions VALUES(?,?,?,?,?,?,?,?,?,?,NULL)').run(sid, hash(raw), uid, a.access_version, a.credential_version, time, time, time + 8 * 60 * 60000, time, String(label).slice(0, 180));
    return {
      token: raw,
      id: sid,
      expires_at: time + 8 * 60 * 60000
    };
  };
  const authenticate = token => {
    requireThat(mode() === 'local' && typeof token === 'string' && token.length <= 200, 'Sign in to continue.', 401);
    const s = db.prepare('SELECT * FROM identity_sessions WHERE token_hash=?').get(hash(token));
    if (!s) requireThat(false, 'Sign in to continue.', 401);
    const a = account(s.user_id);
    if (!a?.active || !a.password_hash || a.credential_version !== s.credential_version || a.access_version !== s.access_version || s.expires_at <= now() || s.last_seen <= now() - 30 * 60000) {
      db.prepare('DELETE FROM identity_sessions WHERE id=?').run(s.id);
      requireThat(false, 'Session expired or access changed. Sign in again.', 401);
    }
    db.prepare('UPDATE identity_sessions SET last_seen=? WHERE id=?').run(now(), s.id);
    return {
      ...s,
      actorId: s.user_id,
      version: s.access_version,
      previewId: s.preview_id
    };
  };
  const currentSession = s => {
    const fresh = db.prepare('SELECT * FROM identity_sessions WHERE id=?').get(s.id),
      a = fresh && account(fresh.user_id);
    requireThat(fresh && a?.active && a.password_hash && a.credential_version === fresh.credential_version && a.access_version === fresh.access_version && fresh.expires_at > now() && fresh.last_seen > now() - 30 * 60000, 'Sign in again before continuing.', 401);
    return fresh;
  };
  const requireRecent = s => {
    const fresh = currentSession(s);
    requireThat(!fresh.preview_id, 'Access preview cannot change sign-in or permissions.', 403);
    requireThat(fresh.reauth_at > now() - 5 * 60000, 'Confirm your password again before changing sensitive settings.', 428);
    return fresh;
  };
  const admin = s => {
    const fresh = requireRecent(s);
    requireThat(policy(db, fresh.user_id).actor().access_admin, 'User administration is restricted.', 403);
    return fresh;
  };
  const userSummary = uid => {
    const a = account(uid);
    return a ? {
      login: a.login,
      status: a.password_hash ? 'active' : 'awaiting_activation',
      password_changed_at: a.password_changed_at,
      credential_version: a.credential_version
    } : null;
  };
  const safeEvents = uid => db.prepare('SELECT action,detail_json,at FROM identity_events WHERE subject_id=? ORDER BY id DESC LIMIT 30').all(uid);
  return {
    mode,
    authenticate,
    requireRecent,
    userSummary,
    status: () => ({
      mode: mode(),
      setup_available: !state().secured
    }),
    setupOptions: () => {
      requireThat(!state().secured, 'Workspace sign-in is already configured.', 409);
      return {
        companies: db.prepare('SELECT id,name,currency FROM companies ORDER BY name').all()
      };
    },
    setup: async (input, label) => {
      requireThat(!state().secured, 'Workspace sign-in is already configured.', 409);
      rate('setup', 'owner');
      const name = text(input.name, 'Your name'),
        login = loginValue(input.login);
      requireThat(input.password === input.confirm_password, 'Passwords do not match.');
      requireThat(Array.isArray(input.company_ids) && input.company_ids.length <= 50 && new Set(input.company_ids).size === input.company_ids.length, 'Review your starting company access.');
      for (const c of input.company_ids) requireThat(db.prepare('SELECT id FROM companies WHERE id=?').get(c), 'Selected company is unavailable.');
      const passwordHash = await hashPassword(input.password);
      return transaction(db, () => {
        requireThat(!state().secured, 'Workspace sign-in was already configured. Sign in instead.', 409);
        const uid = 'USR-' + randomUUID().slice(0, 8).toUpperCase();
        db.prepare('INSERT INTO users(id,name,role,active,access_version,access_admin,organisation_admin) VALUES(?,?,?,1,1,1,1)').run(uid, name, 'Workspace owner');
        db.prepare('INSERT INTO identities VALUES(?,?,?,1,?,?)').run(uid, login, passwordHash, now(), now());
        for (const c of input.company_ids) db.prepare("INSERT INTO memberships(user_id,company_id,project_id,can_approve,approval_limit,role_id,budget_approval_limit) VALUES(?,?,'*',0,'0','project_manager','0')").run(uid, c);
        db.prepare('UPDATE identity_state SET secured=1,owner_id=? WHERE id=1').run(uid);
        event(uid, uid, 'owner_setup', {
          company_ids: input.company_ids,
          role: 'project_manager',
          purchase_limit: '0',
          budget_limit: '0'
        });
        return {
          session: session(uid, label),
          recovery_codes: recoveryCodes(uid)
        };
      });
    },
    signIn: async (input, label) => {
      requireThat(mode() === 'local', 'Set up local sign-in first.', 409);
      let login;
      try {
        login = loginValue(input.login);
      } catch {
        requireThat(false, generic, 401);
      }
      rate('login', login);
      const a = db.prepare('SELECT * FROM identities WHERE login=?').get(login);
      const valid = await verifyPassword(input.password, a?.password_hash);
      const fresh = a && account(a.user_id);
      if (!valid || !fresh?.active || fresh.password_hash !== a.password_hash || fresh.credential_version !== a.credential_version) {
        event(null, a?.user_id || null, 'sign_in_failed');
        requireThat(false, generic, 401);
      }
      return transaction(db, () => {
        const checked = account(a.user_id);
        requireThat(checked?.active && checked.password_hash === a.password_hash && checked.credential_version === a.credential_version, generic, 401);
        db.prepare('DELETE FROM identity_limits WHERE key=?').run('login:' + hash(login));
        event(fresh.user_id, fresh.user_id, 'signed_in');
        return session(fresh.user_id, label);
      });
    },
    reauthenticate: async (s, input) => {
      const current = currentSession(s);
      requireThat(!current.preview_id, 'Access preview cannot confirm credentials.', 403);
      const a = account(current.user_id);
      rate('reauth', a.login);
      const valid = await verifyPassword(input.password, a.password_hash);
      return transaction(db, () => {
        const fresh = currentSession(s),
          updated = account(s.user_id);
        requireThat(valid && updated.password_hash === a.password_hash && updated.credential_version === a.credential_version, generic, 401);
        db.prepare('UPDATE identity_sessions SET reauth_at=? WHERE id=?').run(now(), fresh.id);
        db.prepare('DELETE FROM identity_limits WHERE key=?').run('reauth:' + hash(a.login));
        event(a.user_id, a.user_id, 'reauthenticated');
        return {
          ok: true
        };
      });
    },
    logout: s => {
      db.prepare('DELETE FROM identity_sessions WHERE id=?').run(s.id);
      event(s.user_id, s.user_id, 'signed_out');
    },
    setPreview: (s, uid) => {
      const fresh = currentSession(s);
      requireThat(policy(db, fresh.user_id).actor().access_admin, 'User administration is restricted.', 403);
      if (uid) policy(db, uid).actor();
      db.prepare('UPDATE identity_sessions SET preview_id=? WHERE id=?').run(uid || null, s.id);
    },
    profile: s => {
      const fresh = currentSession(s);
      requireThat(!fresh.preview_id, 'Return to your workspace to manage sign-in.', 403);
      return {
        identity: userSummary(s.user_id),
        sessions: db.prepare('SELECT id,created_at,last_seen,expires_at,client_label FROM identity_sessions WHERE user_id=? AND expires_at>? AND last_seen>? ORDER BY created_at DESC').all(s.user_id, now(), now() - 30 * 60000).map(r => ({
          ...r,
          current: r.id === s.id
        })),
        recovery_codes_remaining: db.prepare("SELECT count(*) n FROM identity_codes WHERE user_id=? AND kind='recovery' AND used_at IS NULL").get(s.user_id).n,
        events: safeEvents(s.user_id)
      };
    },
    revokeSession: (s, sid) => {
      const fresh = currentSession(s);
      requireThat(!fresh.preview_id, 'Access preview cannot change sessions.', 403);
      requireThat(db.prepare('SELECT id FROM identity_sessions WHERE id=? AND user_id=?').get(sid, s.user_id), 'Session is not available.', 404);
      db.prepare('DELETE FROM identity_sessions WHERE id=?').run(sid);
      event(s.user_id, s.user_id, 'session_revoked', {
        current: sid === s.id
      });
      return {
        current: sid === s.id
      };
    },
    changePassword: async (s, input) => {
      const current = currentSession(s);
      requireThat(!current.preview_id, 'Access preview cannot change passwords.', 403);
      const a = account(s.user_id);
      rate('password', a.login);
      requireThat(input.new_password === input.confirm_password, 'Passwords do not match.');
      const valid = await verifyPassword(input.current_password, a.password_hash);
      requireThat(valid, generic, 401);
      requireThat(passwordValue(input.current_password) !== passwordValue(input.new_password, {
        newPassword: true
      }), 'Choose a different password.');
      const encoded = await hashPassword(input.new_password);
      return transaction(db, () => {
        currentSession(s);
        const latest = account(s.user_id);
        requireThat(latest.password_hash === a.password_hash && latest.credential_version === a.credential_version, 'Sign-in changed. Start again.', 409);
        db.prepare('UPDATE identities SET password_hash=?,credential_version=credential_version+1,password_changed_at=? WHERE user_id=?').run(encoded, now(), s.user_id);
        revoke(s.user_id);
        invalidateCodes(s.user_id);
        const codes = recoveryCodes(s.user_id);
        event(s.user_id, s.user_id, 'password_changed');
        return {
          recovery_codes: codes,
          signed_out: true
        };
      });
    },
    replaceRecovery: s => {
      const fresh = requireRecent(s);
      const codes = transaction(db, () => {
        const result = recoveryCodes(fresh.user_id);
        event(fresh.user_id, fresh.user_id, 'recovery_codes_replaced');
        return result;
      });
      return {
        recovery_codes: codes
      };
    },
    activate: async input => {
      requireThat(mode() === 'local', 'Local sign-in is not configured.', 409);
      const login = loginValue(input.login);
      rate('activate', login);
      requireThat(typeof input.code === 'string' && input.code.length <= 200, 'The code could not be verified.', 401);
      requireThat(input.password === input.confirm_password, 'Passwords do not match.');
      const row = db.prepare("SELECT c.*,i.login,i.credential_version FROM identity_codes c JOIN identities i ON i.user_id=c.user_id WHERE c.code_hash=? AND i.login=? AND c.kind IN('activation','reset','recovery')").get(hash(input.code.trim()), login);
      const usable = () => {
        const c = row && db.prepare('SELECT * FROM identity_codes WHERE id=?').get(row.id),
          a = c && account(c.user_id);
        return c && c.used_at === null && (c.expires_at === null || c.expires_at > now()) && a?.active && a.credential_version === row.credential_version;
      };
      requireThat(usable(), 'The code could not be verified. It may have expired or already been used.', 401);
      const encoded = await hashPassword(input.password);
      return transaction(db, () => {
        requireThat(usable(), 'The code could not be verified. It may have expired or already been used.', 401);
        db.prepare('UPDATE identities SET password_hash=?,credential_version=credential_version+1,password_changed_at=? WHERE user_id=?').run(encoded, now(), row.user_id);
        invalidateCodes(row.user_id);
        revoke(row.user_id);
        const codes = recoveryCodes(row.user_id);
        event(row.user_id, row.user_id, row.kind === 'activation' ? 'account_activated' : 'account_recovered');
        return {
          recovery_codes: codes,
          login,
          sign_in_required: true
        };
      });
    },
    provision: (s, input) => transaction(db, () => {
      const actor = admin(s);
      const login = loginValue(input.login),
        name = text(input.name, 'Name');
      requireThat(!db.prepare('SELECT user_id FROM identities WHERE login=?').get(login), 'This username is already assigned.');
      let beforeIdentity = null;
      let uid = input.existing_user_id || 'USR-' + randomUUID().slice(0, 8).toUpperCase();
      if (input.existing_user_id) {
        const u = db.prepare('SELECT * FROM users WHERE id=?').get(uid);
        requireThat(u && !u.access_admin && !u.organisation_admin && uid !== s.user_id, 'This identity cannot be bound through user provisioning.', 403);
        requireThat(!account(uid), 'This user already has sign-in details.');
        requireThat(input.version === u.access_version, 'User access changed. Reload and review again.', 409);
        beforeIdentity = {
          name: u.name,
          job_title: u.role
        };
        db.prepare('UPDATE users SET name=?,role=? WHERE id=?').run(name, text(input.job_title, 'Job title'), uid);
      } else db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(uid, name, text(input.job_title, 'Job title'));
      // The existing validator enforces role/scope/amount policy atomically for the new identity.
      const current = db.prepare('SELECT * FROM users WHERE id=?').get(uid);
      accessAdmin(db, actor.user_id).save(uid, {
        version: current.access_version,
        active: true,
        reason: text(input.reason, 'Reason', 1000),
        grants: input.grants
      });
      db.prepare('INSERT INTO identities(user_id,login,created_at) VALUES(?,?,?)').run(uid, login, now());
      const raw = code(uid, 'activation', actor.user_id, now() + 24 * 60 * 60000);
      event(actor.user_id, uid, 'account_provisioned', {
        login,
        name,
        job_title: input.job_title.trim(),
        before: beforeIdentity,
        existing_identity: !!input.existing_user_id
      });
      return {
        user_id: uid,
        login,
        activation_code: raw,
        expires_at: now() + 24 * 60 * 60000
      };
    }),
    issueActivation: (s, uid, input) => transaction(db, () => {
      const actor = admin(s),
        a = account(uid);
      requireThat(a && a.active && uid !== actor.user_id && !a.access_admin && !a.organisation_admin, 'This user cannot be reset through this action.', 403);
      requireThat(input.credential_version === a.credential_version, 'Sign-in changed. Reload before issuing a code.', 409);
      const reason = text(input.reason, 'Reason', 1000);
      invalidateCodes(uid, ['activation', 'reset']);
      const raw = code(uid, a.password_hash ? 'reset' : 'activation', actor.user_id, now() + 24 * 60 * 60000);
      event(actor.user_id, uid, 'activation_issued', {
        reason
      });
      return {
        user_id: uid,
        login: a.login,
        activation_code: raw,
        expires_at: now() + 24 * 60 * 60000
      };
    }),
    administrativeAuthority: (s, uid, input) => transaction(db, () => {
      const actor = admin(s),
        u = db.prepare('SELECT * FROM users WHERE id=?').get(uid);
      requireThat(u && account(uid)?.password_hash && u.active, 'Activate this account before granting administration.');
      requireThat(uid !== actor.user_id, 'Another administrator must review your own authority.', 403);
      requireThat(input.version === u.access_version, 'Access changed. Reload before reviewing again.', 409);
      requireThat(typeof input.access_admin === 'boolean' && typeof input.organisation_admin === 'boolean', 'Review both administrative authorities.');
      const reason = text(input.reason, 'Reason', 1000);
      db.prepare('UPDATE users SET access_admin=?,organisation_admin=?,access_version=access_version+1 WHERE id=?').run(input.access_admin ? 1 : 0, input.organisation_admin ? 1 : 0, uid);
      revoke(uid);
      event(actor.user_id, uid, 'administrative_authority_changed', {
        before: {
          access_admin: !!u.access_admin,
          organisation_admin: !!u.organisation_admin
        },
        after: {
          access_admin: input.access_admin,
          organisation_admin: input.organisation_admin
        },
        reason
      });
      return {
        ok: true
      };
    }),
    securityEvents: s => {
      const a = currentSession(s);
      requireThat(policy(db, a.user_id).actor().access_admin && !a.preview_id, 'User administration is restricted.', 403);
      return db.prepare('SELECT e.*,u.name actor,v.name subject FROM identity_events e LEFT JOIN users u ON u.id=e.actor_id LEFT JOIN users v ON v.id=e.subject_id ORDER BY e.id DESC LIMIT 100').all();
    }
  };
}
