export function installLedger(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=8').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE memberships ADD COLUMN ledger_approval_limit TEXT NOT NULL DEFAULT '0';
      CREATE TABLE ledger_accounts(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),code TEXT NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('asset','liability','equity','income','expense')),purpose TEXT NOT NULL CHECK(purpose IN ('general','bank','payable','receivable','tax','stock')),active INTEGER NOT NULL CHECK(active IN (0,1)),version INTEGER NOT NULL DEFAULT 1,UNIQUE(company_id,code),UNIQUE(id,company_id));
      CREATE TABLE ledger_periods(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),name TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('open','closed')),version INTEGER NOT NULL DEFAULT 1,closed_by TEXT REFERENCES users(id),closed_at TEXT,UNIQUE(id,company_id));
      CREATE TABLE ledger_entries(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT,title TEXT NOT NULL,accounting_date TEXT NOT NULL,currency TEXT NOT NULL,rate TEXT NOT NULL,rate_date TEXT NOT NULL,rate_source TEXT NOT NULL,source_reference TEXT NOT NULL,explanation TEXT NOT NULL,lines_json TEXT NOT NULL,total TEXT NOT NULL,company_total TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL CHECK(state IN ('draft','submitted','returned','posted','cancelled')),version INTEGER NOT NULL DEFAULT 1,reversal_of TEXT REFERENCES ledger_entries(id),number TEXT,period_id TEXT REFERENCES ledger_periods(id),posted_by TEXT REFERENCES users(id),posted_at TEXT,created_at TEXT NOT NULL,UNIQUE(company_id,number),UNIQUE(id,company_id),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
      CREATE UNIQUE INDEX ledger_one_reversal ON ledger_entries(reversal_of) WHERE reversal_of IS NOT NULL AND state<>'cancelled';
      CREATE TABLE ledger_lines(id TEXT PRIMARY KEY,entry_id TEXT NOT NULL,company_id TEXT NOT NULL,project_id TEXT,account_id TEXT NOT NULL,ordinal INTEGER NOT NULL,account_code TEXT NOT NULL,account_name TEXT NOT NULL,account_type TEXT NOT NULL,description TEXT NOT NULL,debit TEXT NOT NULL,credit TEXT NOT NULL,base_debit TEXT NOT NULL,base_credit TEXT NOT NULL,rounding_adjustment TEXT NOT NULL,FOREIGN KEY(entry_id,company_id) REFERENCES ledger_entries(id,company_id),FOREIGN KEY(account_id,company_id) REFERENCES ledger_accounts(id,company_id),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id),UNIQUE(entry_id,ordinal));
      CREATE TABLE ledger_sequences(company_id TEXT NOT NULL REFERENCES companies(id),year TEXT NOT NULL,next_number INTEGER NOT NULL,PRIMARY KEY(company_id,year));
      CREATE TABLE ledger_events(id INTEGER PRIMARY KEY AUTOINCREMENT,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT,actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL,at TEXT NOT NULL);
      CREATE INDEX ledger_scope ON ledger_entries(company_id,project_id,state,accounting_date);
      CREATE TRIGGER ledger_account_identity BEFORE UPDATE ON ledger_accounts WHEN NEW.company_id<>OLD.company_id OR NEW.code<>OLD.code OR NEW.type<>OLD.type OR NEW.purpose<>OLD.purpose BEGIN SELECT RAISE(ABORT,'Account identity is fixed'); END;
      CREATE TRIGGER ledger_period_identity BEFORE UPDATE ON ledger_periods WHEN NEW.company_id<>OLD.company_id OR NEW.start_date<>OLD.start_date OR NEW.end_date<>OLD.end_date BEGIN SELECT RAISE(ABORT,'Period boundaries are fixed'); END;
      CREATE TRIGGER ledger_entry_identity BEFORE UPDATE ON ledger_entries WHEN NEW.company_id<>OLD.company_id OR NEW.project_id IS NOT OLD.project_id OR NEW.author_id<>OLD.author_id OR NEW.reversal_of IS NOT OLD.reversal_of OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Journal identity is fixed'); END;
      CREATE TRIGGER ledger_posted_immutable BEFORE UPDATE ON ledger_entries WHEN OLD.state='posted' BEGIN SELECT RAISE(ABORT,'Posted journals are immutable; use reversal'); END;
      CREATE TRIGGER ledger_lines_posted_insert BEFORE INSERT ON ledger_lines WHEN (SELECT state FROM ledger_entries WHERE id=NEW.entry_id)<>'submitted' BEGIN SELECT RAISE(ABORT,'Ledger lines are inserted only during posting'); END;
    `);
    for (const t of ['ledger_accounts', 'ledger_periods', 'ledger_entries', 'ledger_lines', 'ledger_events']) db.exec(`CREATE TRIGGER ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT,'Accounting records must be retained'); END;`);
    for (const t of ['ledger_lines', 'ledger_events']) db.exec(`CREATE TRIGGER ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT,'Accounting evidence is immutable'); END;`);
    db.exec('INSERT INTO schema_versions VALUES(8); COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
