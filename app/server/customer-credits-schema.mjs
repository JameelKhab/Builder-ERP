export function installCustomerCredits(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=19').get()) return;
  const foreignKeys = db.prepare('PRAGMA foreign_keys').get().foreign_keys;
  db.exec('PRAGMA foreign_keys=OFF');
  if (db.prepare('PRAGMA foreign_keys').get().foreign_keys) throw new Error('Credit migration needs an outermost transaction');
  db.exec('BEGIN IMMEDIATE');
  try {
    const sql = db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='ledger_accounts'").get().sql;
    const objects = db.prepare("SELECT sql FROM sqlite_schema WHERE tbl_name='ledger_accounts' AND type IN ('index','trigger') AND sql IS NOT NULL").all();
    if (!sql.includes("'client_advance'")) throw new Error('Unknown account purpose schema');
    db.exec(sql.replace(/CREATE TABLE (?:"ledger_accounts"|ledger_accounts)\s*\(/, 'CREATE TABLE new_credit_accounts(').replace("'client_advance'", "'client_advance','client_credit_transfer'"));
    db.exec('INSERT INTO new_credit_accounts(rowid,id,company_id,code,name,type,purpose,active,version) SELECT rowid,id,company_id,code,name,type,purpose,active,version FROM ledger_accounts;');
    db.exec('DROP TABLE ledger_accounts; ALTER TABLE new_credit_accounts RENAME TO ledger_accounts;');
    for (const o of objects) db.exec(o.sql);
    db.exec(`
      ALTER TABLE memberships ADD COLUMN customer_credit_approval_limit TEXT NOT NULL DEFAULT '0.00';
      CREATE TABLE client_credit_settlements(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT,customer_id TEXT NOT NULL REFERENCES parties(id),source_invoice_id TEXT NOT NULL REFERENCES client_invoices(id),kind TEXT NOT NULL CHECK(kind IN ('allocation','refund')),bank_id TEXT REFERENCES payment_banks(id),title TEXT NOT NULL,accounting_date TEXT NOT NULL,currency TEXT NOT NULL,total TEXT NOT NULL,authority_amount TEXT NOT NULL,bank_amount TEXT,bank_rate TEXT,rate_date TEXT,rate_source TEXT,company_total TEXT NOT NULL,basis TEXT NOT NULL,payload TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL CHECK(state IN ('draft','submitted','returned','approved','recorded','cancelled')),version INTEGER NOT NULL DEFAULT 1,approved_by TEXT REFERENCES users(id),recorded_by TEXT REFERENCES users(id),instruction_id TEXT,evidence_id TEXT,journal_id TEXT REFERENCES ledger_entries(id),bank_reference TEXT,reference_key TEXT,created_at TEXT NOT NULL,recorded_at TEXT,FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id),CHECK((kind='refund' AND bank_id IS NOT NULL) OR (kind='allocation' AND bank_id IS NULL)));
      CREATE INDEX client_credit_scope ON client_credit_settlements(company_id,project_id,state,accounting_date);
      CREATE UNIQUE INDEX client_credit_reference ON client_credit_settlements(bank_id,reference_key) WHERE reference_key IS NOT NULL;
      CREATE TABLE client_credit_legs(id TEXT PRIMARY KEY,settlement_id TEXT NOT NULL REFERENCES client_credit_settlements(id),invoice_id TEXT NOT NULL REFERENCES client_invoices(id),project_id TEXT NOT NULL REFERENCES projects(id),account_id TEXT NOT NULL REFERENCES ledger_accounts(id),amount TEXT NOT NULL,base_amount TEXT NOT NULL,effect INTEGER NOT NULL CHECK(effect IN (-1,1)),UNIQUE(settlement_id,invoice_id));
      CREATE TABLE client_credit_evidence(id TEXT PRIMARY KEY,settlement_id TEXT NOT NULL REFERENCES client_credit_settlements(id),filename TEXT NOT NULL,sha256 TEXT NOT NULL,bytes BLOB NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
      CREATE TABLE client_credit_events(id INTEGER PRIMARY KEY AUTOINCREMENT,settlement_id TEXT NOT NULL REFERENCES client_credit_settlements(id),actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TABLE bank_credit_matches(id INTEGER PRIMARY KEY AUTOINCREMENT,row_id TEXT NOT NULL REFERENCES bank_rows(id),settlement_id TEXT NOT NULL REFERENCES client_credit_settlements(id),active INTEGER NOT NULL CHECK(active IN (0,1)),actor_id TEXT NOT NULL REFERENCES users(id),at TEXT NOT NULL);
      CREATE UNIQUE INDEX bank_credit_one_match ON bank_credit_matches(settlement_id) WHERE active=1;
      CREATE TRIGGER client_credit_identity BEFORE UPDATE ON client_credit_settlements WHEN NEW.company_id<>OLD.company_id OR NEW.project_id IS NOT OLD.project_id OR NEW.customer_id<>OLD.customer_id OR NEW.source_invoice_id<>OLD.source_invoice_id OR NEW.kind<>OLD.kind OR NEW.bank_id IS NOT OLD.bank_id OR NEW.currency<>OLD.currency OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Credit settlement identity is fixed'); END;
      CREATE TRIGGER client_credit_frozen BEFORE UPDATE ON client_credit_settlements WHEN OLD.state IN ('recorded','cancelled') BEGIN SELECT RAISE(ABORT,'Recorded or cancelled credit settlements are immutable'); END;
      CREATE TRIGGER client_credit_leg_stage BEFORE INSERT ON client_credit_legs WHEN (SELECT state FROM client_credit_settlements WHERE id=NEW.settlement_id)<>'approved' BEGIN SELECT RAISE(ABORT,'Only approved credit settlements can be recorded'); END;
      CREATE TRIGGER bank_credit_identity BEFORE UPDATE ON bank_credit_matches WHEN NEW.row_id<>OLD.row_id OR NEW.settlement_id<>OLD.settlement_id OR NEW.actor_id<>OLD.actor_id OR NEW.at<>OLD.at OR OLD.active=0 BEGIN SELECT RAISE(ABORT,'Credit match evidence is immutable'); END;
    `);
    for (const t of ['client_credit_settlements', 'client_credit_legs', 'client_credit_evidence', 'client_credit_events', 'bank_credit_matches']) db.exec(`CREATE TRIGGER ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT,'Credit settlement history must be retained'); END;`);
    for (const t of ['client_credit_legs', 'client_credit_evidence', 'client_credit_events']) db.exec(`CREATE TRIGGER ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT,'Credit settlement evidence is immutable'); END;`);
    for (const t of ['payments', 'client_receipts', 'client_credit_settlements']) {
      const others = ['payments', 'client_receipts', 'client_credit_settlements'].filter(n => n !== t);
      for (const op of ['INSERT', 'UPDATE OF reference_key']) db.exec(`CREATE TRIGGER ${t}_credit_reference_${op.startsWith('INSERT') ? 'insert' : 'update'} BEFORE ${op} ON ${t} WHEN NEW.reference_key IS NOT NULL AND (${others.map(o => `EXISTS(SELECT 1 FROM ${o} WHERE bank_id=NEW.bank_id AND reference_key=NEW.reference_key)`).join(' OR ')}) BEGIN SELECT RAISE(ABORT,'Bank reference is already recorded'); END;`);
    }
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Credit migration failed foreign-key verification');
    db.exec('INSERT INTO schema_versions VALUES(19); COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.exec(`PRAGMA foreign_keys=${foreignKeys ? 'ON' : 'OFF'}`);
  }
}
