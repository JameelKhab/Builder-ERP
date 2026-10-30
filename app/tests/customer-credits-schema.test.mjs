import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { installCustomerCredits } from '../server/customer-credits-schema.mjs';
function baseline(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE schema_versions(version INTEGER PRIMARY KEY);INSERT INTO schema_versions VALUES(18);CREATE TABLE memberships(user_id TEXT);INSERT INTO memberships VALUES('unchanged');CREATE TABLE ledger_accounts(id TEXT PRIMARY KEY,company_id TEXT,code TEXT,name TEXT,type TEXT,purpose TEXT CHECK(purpose IN ('general','client_advance')),active INTEGER,version INTEGER);INSERT INTO ledger_accounts VALUES('old','company','100','Account','asset','general',1,4);CREATE UNIQUE INDEX original_account_index ON ledger_accounts(company_id,code);CREATE TRIGGER original_account_guard BEFORE DELETE ON ledger_accounts BEGIN SELECT RAISE(ABORT,'retained');END;CREATE TABLE payments(id TEXT,bank_id TEXT,reference_key TEXT);CREATE TABLE client_receipts(id TEXT,bank_id TEXT,reference_key TEXT);`);
  return db;
}
test('credit schema preserves accounts, indexes, guards and zero-default authority and is idempotent', t => {
  const db = baseline(t),
    old = db.prepare('SELECT rowid,* FROM ledger_accounts').all();
  installCustomerCredits(db);
  assert.deepEqual(db.prepare('SELECT rowid,* FROM ledger_accounts').all(), old);
  assert.equal(db.prepare('SELECT customer_credit_approval_limit FROM memberships').get().customer_credit_approval_limit, '0.00');
  assert.throws(() => db.prepare('DELETE FROM ledger_accounts').run(), /retained/);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  installCustomerCredits(db);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
});
test('credit schema rolls back replacement and new objects on a late failure, restores FK mode and permits retry', t => {
  const db = baseline(t),
    before = db.prepare('SELECT type,name,sql FROM sqlite_schema ORDER BY name').all();
  const wrapped = new Proxy(db, {
    get(target, key) {
      if (key === 'exec') return sql => {
        if (sql.includes('INSERT INTO schema_versions VALUES(19)')) throw new Error('Injected migration finalisation failure');
        return target.exec(sql);
      };
      const value = target[key];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
  assert.throws(() => installCustomerCredits(wrapped), /Injected/);
  assert.deepEqual(db.prepare('SELECT type,name,sql FROM sqlite_schema ORDER BY name').all(), before);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  assert.equal(db.prepare('SELECT version FROM ledger_accounts').get().version, 4);
  installCustomerCredits(db);
  assert.equal(db.prepare('SELECT max(version) n FROM schema_versions').get().n, 19);
});
