export function installIdentity(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=5').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
  CREATE TABLE identity_state(id INTEGER PRIMARY KEY CHECK(id=1),secured INTEGER NOT NULL DEFAULT 0,owner_id TEXT REFERENCES users(id));
  INSERT INTO identity_state VALUES(1,0,NULL);
  CREATE TABLE identities(user_id TEXT PRIMARY KEY REFERENCES users(id),login TEXT NOT NULL UNIQUE,password_hash TEXT,credential_version INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,password_changed_at INTEGER);
  CREATE TABLE identity_sessions(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,user_id TEXT NOT NULL REFERENCES users(id),access_version INTEGER NOT NULL,credential_version INTEGER NOT NULL,created_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,expires_at INTEGER NOT NULL,reauth_at INTEGER NOT NULL,client_label TEXT NOT NULL,preview_id TEXT REFERENCES users(id));
  CREATE INDEX identity_sessions_user ON identity_sessions(user_id);
  CREATE TABLE identity_codes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN('activation','reset','recovery')),code_hash TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL,expires_at INTEGER,used_at INTEGER,issued_by TEXT REFERENCES users(id));
  CREATE TABLE identity_limits(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset_at INTEGER NOT NULL);
  CREATE TABLE identity_events(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT REFERENCES users(id),subject_id TEXT REFERENCES users(id),action TEXT NOT NULL,detail_json TEXT NOT NULL,at INTEGER NOT NULL);
  CREATE TRIGGER identity_event_update BEFORE UPDATE ON identity_events BEGIN SELECT RAISE(ABORT,'Identity history is append-only'); END;
  CREATE TRIGGER identity_event_delete BEFORE DELETE ON identity_events BEGIN SELECT RAISE(ABORT,'Identity history is append-only'); END;
  INSERT INTO schema_versions VALUES(5);
 `);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
