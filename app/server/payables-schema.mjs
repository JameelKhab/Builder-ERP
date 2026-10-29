export function installPayables(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=9').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE memberships ADD COLUMN ap_approval_limit TEXT NOT NULL DEFAULT '0';
      ALTER TABLE ledger_entries ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual';
      ALTER TABLE ledger_entries ADD COLUMN source_id TEXT;
      CREATE UNIQUE INDEX ledger_source ON ledger_entries(source_type,source_id) WHERE source_id IS NOT NULL;
      CREATE TRIGGER ledger_source_identity BEFORE UPDATE ON ledger_entries WHEN NEW.source_type<>OLD.source_type OR NEW.source_id IS NOT OLD.source_id BEGIN SELECT RAISE(ABORT,'Journal source is fixed'); END;
      CREATE TABLE payable_settings(company_id TEXT PRIMARY KEY REFERENCES companies(id),account_id TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,FOREIGN KEY(account_id,company_id) REFERENCES ledger_accounts(id,company_id));
      CREATE TABLE payable_tax_codes(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),code TEXT NOT NULL,name TEXT NOT NULL,rate TEXT NOT NULL,recoverable TEXT NOT NULL,account_id TEXT,effective_from TEXT NOT NULL,effective_until TEXT,active INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1,UNIQUE(company_id,code),FOREIGN KEY(account_id,company_id) REFERENCES ledger_accounts(id,company_id));
      CREATE TABLE payable_documents(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,order_id TEXT NOT NULL REFERENCES purchase_orders(id),vendor_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('bill','credit')),original_id TEXT REFERENCES payable_documents(id),reference TEXT NOT NULL,reference_key TEXT NOT NULL,title TEXT NOT NULL,document_date TEXT NOT NULL,accounting_date TEXT NOT NULL,due_date TEXT NOT NULL,currency TEXT NOT NULL,rate TEXT NOT NULL,rate_date TEXT NOT NULL,rate_source TEXT NOT NULL,explanation TEXT NOT NULL,source_json TEXT NOT NULL,lines_json TEXT NOT NULL,journal_json TEXT NOT NULL,total TEXT NOT NULL,company_total TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL CHECK(state IN ('draft','submitted','returned','posted','cancelled')),version INTEGER NOT NULL DEFAULT 1,journal_id TEXT REFERENCES ledger_entries(id),posted_by TEXT REFERENCES users(id),posted_at TEXT,created_at TEXT NOT NULL,FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id),FOREIGN KEY(vendor_id,company_id) REFERENCES vendors(id,company_id));
      CREATE UNIQUE INDEX payable_legal_reference ON payable_documents(company_id,vendor_id,kind,reference_key) WHERE state<>'cancelled';
      CREATE INDEX payable_scope ON payable_documents(company_id,project_id,state,accounting_date);
      CREATE TABLE payable_lines(id TEXT PRIMARY KEY,document_id TEXT NOT NULL REFERENCES payable_documents(id),receipt_id TEXT NOT NULL REFERENCES material_receipts(id),original_line_id TEXT REFERENCES payable_lines(id),quantity TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(document_id,receipt_id));
      CREATE TABLE payable_events(id INTEGER PRIMARY KEY AUTOINCREMENT,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT,actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TRIGGER payable_identity BEFORE UPDATE ON payable_documents WHEN NEW.company_id<>OLD.company_id OR NEW.project_id<>OLD.project_id OR NEW.order_id<>OLD.order_id OR NEW.vendor_id<>OLD.vendor_id OR NEW.kind<>OLD.kind OR NEW.original_id IS NOT OLD.original_id OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Payable source identity is fixed'); END;
      CREATE TRIGGER payable_posted_immutable BEFORE UPDATE ON payable_documents WHEN OLD.state='posted' BEGIN SELECT RAISE(ABORT,'Posted payables are immutable; use linked credit'); END;
      CREATE TRIGGER payable_lines_insert BEFORE INSERT ON payable_lines WHEN (SELECT state FROM payable_documents WHERE id=NEW.document_id)<>'submitted' BEGIN SELECT RAISE(ABORT,'Payable lines are inserted only during posting'); END;
      CREATE TRIGGER payable_tax_identity BEFORE UPDATE ON payable_tax_codes WHEN NEW.company_id<>OLD.company_id OR NEW.code<>OLD.code OR NEW.rate<>OLD.rate OR NEW.recoverable<>OLD.recoverable OR NEW.account_id IS NOT OLD.account_id OR NEW.effective_from<>OLD.effective_from OR NEW.effective_until IS NOT OLD.effective_until BEGIN SELECT RAISE(ABORT,'Tax rules are fixed; create a new code'); END;
    `);
    for (const t of ['payable_settings', 'payable_tax_codes', 'payable_documents', 'payable_lines', 'payable_events']) db.exec(`CREATE TRIGGER ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT,'Payable evidence must be retained'); END;`);
    for (const t of ['payable_lines', 'payable_events']) db.exec(`CREATE TRIGGER ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT,'Payable evidence is immutable'); END;`);
    db.exec('INSERT INTO schema_versions VALUES(9); COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
