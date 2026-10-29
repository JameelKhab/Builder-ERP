import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { advancePaidComponents } from '../server/advance-balances.mjs';
import { installAdvanceRecovery } from '../server/advance-recovery-schema.mjs';
import { D, money } from '../server/money.mjs';

function invoice(principal, tax, base = principal) {
  return { advance_id: 'advance', total: money(new D(principal).plus(tax)),
    snapshot: JSON.stringify({ advance: { principal, tax }, accounts: { advance: { id: 'liability' } } }),
    journal_json: JSON.stringify([{ account_id: 'liability', base_credit: base }]) };
}

test('partial principal stays conservative, leaves no tax-only remainder and preserves original carrying value', () => {
  const source = invoice('0.01', '0.01', '0.04');
  assert.deepEqual(advancePaidComponents(source, '0.00'), { settled: '0.00', paid_principal: '0.00', paid_tax: '0.00', paid_principal_carrying: '0.00' });
  assert.deepEqual(advancePaidComponents(source, '0.01'), { settled: '0.01', paid_principal: '0.00', paid_tax: '0.01', paid_principal_carrying: '0.00' });
  assert.deepEqual(advancePaidComponents(source, '0.02'), { settled: '0.02', paid_principal: '0.01', paid_tax: '0.01', paid_principal_carrying: '0.04' });
  const foreign = invoice('123.47', '6.17', '456.84');
  assert.equal(advancePaidComponents(foreign, '100.00').paid_principal, '95.24');
  assert.equal(advancePaidComponents(foreign, '129.64').paid_principal_carrying, '456.84');
  for (const amount of ['-0.01', '129.65', '0.001']) assert.throws(() => advancePaidComponents(foreign, amount), /balance|precision/);
});

test('every cent of a partial payment conserves settlement and keeps principal and tax monotonic', () => {
  for (const [principal, tax] of [['0.03', '0.01'], ['1.19', '0.06'], ['1.00', '1.00'], ['1.01', '0.00']]) {
    const source = invoice(principal, tax), totalCents = Number(new D(source.total).scaled / 10n ** 10n);
    let previous = advancePaidComponents(source, '0.00');
    for (let cents = 1; cents <= totalCents; cents++) {
      const paid = money(D.raw(BigInt(cents) * 10n ** 10n)), current = advancePaidComponents(source, paid);
      assert.equal(money(new D(current.paid_principal).plus(current.paid_tax)), paid);
      assert.ok(new D(current.paid_principal).gte(previous.paid_principal));
      assert.ok(new D(current.paid_tax).gte(previous.paid_tax));
      assert.ok(new D(current.paid_principal).lte(principal));
      assert.ok(new D(current.paid_tax).lte(tax));
      if (cents < totalCents) assert.ok(new D(current.paid_principal).cmp(principal) < 0);
      previous = current;
    }
    assert.equal(previous.paid_principal, principal); assert.equal(previous.paid_tax, tax);
  }
});

function migrationFixture(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE schema_versions(version INTEGER PRIMARY KEY); INSERT INTO schema_versions VALUES(16);
    CREATE TABLE companies(id TEXT PRIMARY KEY); INSERT INTO companies VALUES('company');
    CREATE TABLE projects(id TEXT, company_id TEXT, PRIMARY KEY(id,company_id)); INSERT INTO projects VALUES('project','company');
    CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('reviewer');
    CREATE TABLE ledger_accounts(id TEXT PRIMARY KEY); INSERT INTO ledger_accounts VALUES('gain');
    CREATE TABLE contract_finance_policies(id TEXT PRIMARY KEY,state TEXT); INSERT INTO contract_finance_policies VALUES('existing','active');
    CREATE TABLE client_certificates(id TEXT PRIMARY KEY,state TEXT,contract_id TEXT,company_id TEXT,project_id TEXT);
    INSERT INTO client_certificates VALUES('certificate','finance','contract','company','project');
    CREATE TABLE client_invoices(id TEXT PRIMARY KEY,state TEXT,advance_id TEXT,contract_id TEXT,company_id TEXT,project_id TEXT);
    INSERT INTO client_invoices VALUES('invoice','posted','advance','contract','company','project');`);
  return db;
}

test('schema 17 upgrade retains policy state, defaults to no tax/FX election and is idempotent', t => {
  const db = migrationFixture(t); installAdvanceRecovery(db); installAdvanceRecovery(db);
  assert.deepEqual({ ...db.prepare('SELECT * FROM contract_finance_policies').get() }, { id: 'existing', state: 'active', recovery_tax_mode: 'unconfigured', recovery_fx_basis: 'unconfigured', fx_gain_account: null, fx_loss_account: null });
  for (const sql of ["recovery_tax_mode='original_tax'", "recovery_fx_basis='historical_consideration'", "fx_gain_account='gain'", "fx_loss_account='gain'"]) assert.throws(() => db.exec(`UPDATE contract_finance_policies SET ${sql}`), /frozen/);
  assert.equal(db.prepare('SELECT count(*) n FROM client_advance_recoveries').get().n, 0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('a failed recovery schema upgrade rolls back every new object and permits retry', t => {
  const db = migrationFixture(t);
  // Deliberate pre-existing name conflict fails after all ALTER statements.
  db.exec('CREATE TABLE client_advance_recoveries(marker TEXT)');
  assert.throws(() => installAdvanceRecovery(db), /already exists/);
  assert.deepEqual(db.prepare('PRAGMA table_info(contract_finance_policies)').all().map(c => c.name), ['id', 'state']);
  assert.equal(db.prepare('SELECT version FROM schema_versions WHERE version=17').get(), undefined);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='client_policy_recovery_frozen'").get(), undefined);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  db.exec('DROP TABLE client_advance_recoveries'); installAdvanceRecovery(db);
  assert.equal(db.prepare('SELECT max(version) version FROM schema_versions').get().version, 17);
});

test('recovery rows accept only posted same-contract advances at finance review and remain immutable', t => {
  const db = migrationFixture(t); installAdvanceRecovery(db);
  const insert = () => db.prepare('INSERT INTO client_advance_recoveries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('certificate', 'invoice', 'company', 'project', 1, '1.00', '0.05', '3.67', '0.18', '{}', 'reviewer', '2026-10-29T00:00:00Z');
  for (const state of ['draft', 'technical', 'approved']) {
    db.prepare('UPDATE client_certificates SET state=?').run(state);
    assert.throws(insert, /finance approval/);
  }
  db.exec("UPDATE client_certificates SET state='finance'; UPDATE client_invoices SET contract_id='other'");
  assert.throws(insert, /this contract/);
  db.exec("UPDATE client_invoices SET contract_id='contract',state='draft'"); assert.throws(insert, /posted advance/);
  db.exec("UPDATE client_invoices SET state='posted',advance_id=NULL"); assert.throws(insert, /posted advance/);
  db.exec("UPDATE client_invoices SET advance_id='advance'"); insert();
  assert.throws(insert, /UNIQUE/);
  assert.throws(() => db.exec("UPDATE client_advance_recoveries SET principal='2.00'"), /immutable/);
  assert.throws(() => db.exec('DELETE FROM client_advance_recoveries'), /retained/);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
