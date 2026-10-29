// Version 16 keeps the canonical invoice table and all existing receipt references.
// Constrained-table changes follow SQLite's create/copy/replace procedure.
function rebuild(db, table, change) {
  const original = db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name=?").get(table).sql;
  const objects = db.prepare("SELECT sql FROM sqlite_schema WHERE tbl_name=? AND type IN ('index','trigger') AND sql IS NOT NULL").all(table);
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => `"${c.name}"`).join(',');
  const modified = change(original).replace(`CREATE TABLE ${table}(`, `CREATE TABLE new_${table}(`);
  if (modified === original || !modified.startsWith(`CREATE TABLE new_${table}(`)) throw new Error('Unexpected advance migration schema');
  db.exec(modified);
  db.exec(`INSERT INTO new_${table}(rowid,${columns}) SELECT rowid,${columns} FROM ${table}; DROP TABLE ${table}; ALTER TABLE new_${table} RENAME TO ${table};`);
  for (const object of objects) db.exec(object.sql);
}

export function installAdvances(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=16').get()) return;
  const foreignKeys = db.prepare('PRAGMA foreign_keys').get().foreign_keys;
  db.exec('PRAGMA foreign_keys=OFF');
  if (db.prepare('PRAGMA foreign_keys').get().foreign_keys) throw new Error('Advance migration needs an outermost transaction');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE memberships ADD COLUMN advance_approval_limit TEXT NOT NULL DEFAULT '0.00';
      CREATE TABLE client_advances(
        id TEXT PRIMARY KEY,contract_id TEXT NOT NULL REFERENCES client_contracts(id),
        company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT NOT NULL,
        customer_id TEXT NOT NULL REFERENCES parties(id),currency TEXT NOT NULL,
        title TEXT NOT NULL,request_date TEXT NOT NULL,principal TEXT NOT NULL,
        tax_percent TEXT NOT NULL,tax TEXT NOT NULL,total TEXT NOT NULL,
        rate TEXT NOT NULL,rate_date TEXT NOT NULL,rate_source TEXT NOT NULL,company_total TEXT NOT NULL,
        advance_account TEXT NOT NULL REFERENCES ledger_accounts(id),tax_account TEXT REFERENCES ledger_accounts(id),
        policy_id TEXT NOT NULL REFERENCES contract_finance_policies(id),basis TEXT NOT NULL,snapshot TEXT NOT NULL,
        evidence_id TEXT,author_id TEXT NOT NULL REFERENCES users(id),
        state TEXT NOT NULL CHECK(state IN ('draft','submitted','returned','approved','cancelled')),
        version INTEGER NOT NULL DEFAULT 1,approved_by TEXT REFERENCES users(id),approved_at TEXT,created_at TEXT NOT NULL,
        FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
      CREATE INDEX client_advances_scope ON client_advances(company_id,project_id,state,request_date);
      CREATE TABLE client_advance_evidence(id TEXT PRIMARY KEY,advance_id TEXT NOT NULL REFERENCES client_advances(id),filename TEXT NOT NULL,sha256 TEXT NOT NULL,bytes BLOB NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
      CREATE TABLE client_advance_events(id INTEGER PRIMARY KEY AUTOINCREMENT,advance_id TEXT NOT NULL REFERENCES client_advances(id),company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TRIGGER client_advance_identity BEFORE UPDATE ON client_advances WHEN NEW.contract_id<>OLD.contract_id OR NEW.company_id<>OLD.company_id OR NEW.project_id<>OLD.project_id OR NEW.customer_id<>OLD.customer_id OR NEW.currency<>OLD.currency OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Advance identity is fixed'); END;
      CREATE TRIGGER client_advance_frozen BEFORE UPDATE ON client_advances WHEN OLD.state IN ('approved','cancelled') BEGIN SELECT RAISE(ABORT,'Approved or cancelled advances are immutable'); END;
    `);
    rebuild(db, 'ledger_accounts', sql => {
      if (!sql.includes("'tax','stock'")) throw new Error('Unknown ledger account purpose schema');
      return sql.replace("'tax','stock'", "'tax','stock','client_advance'");
    });
    rebuild(db, 'client_invoices', sql => {
      if (!sql.includes('certificate_id TEXT NOT NULL UNIQUE')) throw new Error('Unknown client invoice source schema');
      return sql.replace('certificate_id TEXT NOT NULL UNIQUE', 'certificate_id TEXT UNIQUE').replace('contract_id TEXT NOT NULL', 'advance_id TEXT UNIQUE REFERENCES client_advances(id),contract_id TEXT NOT NULL').replace(/\)$/, ',CHECK((certificate_id IS NOT NULL AND advance_id IS NULL) OR (certificate_id IS NULL AND advance_id IS NOT NULL)))');
    });
    db.exec(`DROP TRIGGER client_invoice_identity;
      CREATE TRIGGER client_invoice_identity BEFORE UPDATE ON client_invoices WHEN NEW.certificate_id IS NOT OLD.certificate_id OR NEW.advance_id IS NOT OLD.advance_id OR NEW.contract_id<>OLD.contract_id OR NEW.company_id<>OLD.company_id OR NEW.project_id<>OLD.project_id OR NEW.customer_id<>OLD.customer_id OR NEW.currency<>OLD.currency OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Invoice source is fixed'); END;
      CREATE TRIGGER client_advance_invoice_source BEFORE INSERT ON client_invoices WHEN NEW.advance_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM client_advances a WHERE a.id=NEW.advance_id AND a.state='approved' AND a.contract_id=NEW.contract_id AND a.company_id=NEW.company_id AND a.project_id=NEW.project_id AND a.customer_id=NEW.customer_id AND a.currency=NEW.currency) BEGIN SELECT RAISE(ABORT,'Invoice must retain its approved advance scope'); END;
    `);
    for (const table of ['client_advances', 'client_advance_evidence', 'client_advance_events']) db.exec(`CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'Advance history must be retained'); END;`);
    for (const table of ['client_advance_evidence', 'client_advance_events']) db.exec(`CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'Advance evidence is immutable'); END;`);
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Advance migration failed foreign-key verification');
    db.exec('INSERT INTO schema_versions VALUES(16); COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec(`PRAGMA foreign_keys=${foreignKeys ? 'ON' : 'OFF'}`);
  }
}
