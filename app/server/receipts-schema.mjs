export function installReceipts(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=15').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE memberships ADD COLUMN receipt_approval_limit TEXT NOT NULL DEFAULT '0.00';
      CREATE TABLE client_receipts(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT,customer_id TEXT NOT NULL REFERENCES parties(id),bank_id TEXT NOT NULL REFERENCES payment_banks(id),reversal_of TEXT REFERENCES client_receipts(id),title TEXT NOT NULL,accounting_date TEXT NOT NULL,currency TEXT NOT NULL,total TEXT NOT NULL,bank_amount TEXT NOT NULL,bank_rate TEXT NOT NULL,rate_date TEXT NOT NULL,rate_source TEXT NOT NULL,company_total TEXT NOT NULL,authority_amount TEXT NOT NULL,explanation TEXT NOT NULL,payload TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL CHECK(state IN ('draft','submitted','returned','approved','recorded','cancelled')),version INTEGER NOT NULL DEFAULT 1,approved_by TEXT REFERENCES users(id),recorded_by TEXT REFERENCES users(id),bank_reference TEXT,reference_key TEXT,evidence_id TEXT,journal_id TEXT REFERENCES ledger_entries(id),created_at TEXT NOT NULL,recorded_at TEXT,FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
      CREATE UNIQUE INDEX client_receipt_reference ON client_receipts(bank_id,reference_key) WHERE reference_key IS NOT NULL;
      CREATE UNIQUE INDEX client_receipt_reversal ON client_receipts(reversal_of) WHERE reversal_of IS NOT NULL AND state<>'cancelled';
      CREATE INDEX client_receipt_scope ON client_receipts(company_id,project_id,state,accounting_date);
      CREATE TABLE client_receipt_allocations(id TEXT PRIMARY KEY,receipt_id TEXT NOT NULL REFERENCES client_receipts(id),invoice_id TEXT NOT NULL REFERENCES client_invoices(id),project_id TEXT NOT NULL REFERENCES projects(id),amount TEXT NOT NULL,base_amount TEXT NOT NULL,bank_amount TEXT NOT NULL,bank_base TEXT NOT NULL,effect INTEGER NOT NULL CHECK(effect IN (-1,1)),UNIQUE(receipt_id,invoice_id));
      CREATE TABLE client_receipt_evidence(id TEXT PRIMARY KEY,receipt_id TEXT NOT NULL REFERENCES client_receipts(id),filename TEXT NOT NULL,sha256 TEXT NOT NULL,bytes BLOB NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
      CREATE TABLE client_receipt_events(id INTEGER PRIMARY KEY AUTOINCREMENT,receipt_id TEXT NOT NULL REFERENCES client_receipts(id),company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT,actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TABLE bank_receipt_matches(id INTEGER PRIMARY KEY AUTOINCREMENT,row_id TEXT NOT NULL REFERENCES bank_rows(id),receipt_id TEXT NOT NULL REFERENCES client_receipts(id),active INTEGER NOT NULL CHECK(active IN (0,1)),actor_id TEXT NOT NULL REFERENCES users(id),at TEXT NOT NULL);
      CREATE UNIQUE INDEX bank_receipt_one_match ON bank_receipt_matches(receipt_id) WHERE active=1;
      CREATE TRIGGER client_receipt_identity BEFORE UPDATE ON client_receipts WHEN NEW.company_id<>OLD.company_id OR NEW.project_id IS NOT OLD.project_id OR NEW.customer_id<>OLD.customer_id OR NEW.bank_id<>OLD.bank_id OR NEW.currency<>OLD.currency OR NEW.reversal_of IS NOT OLD.reversal_of OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Receipt identity is fixed'); END;
      CREATE TRIGGER client_receipt_frozen BEFORE UPDATE ON client_receipts WHEN OLD.state IN ('recorded','cancelled') BEGIN SELECT RAISE(ABORT,'Recorded or cancelled receipts are immutable'); END;
      CREATE TRIGGER client_receipt_allocation_post BEFORE INSERT ON client_receipt_allocations WHEN (SELECT state FROM client_receipts WHERE id=NEW.receipt_id)<>'approved' BEGIN SELECT RAISE(ABORT,'Only approved receipts can be recorded'); END;
      CREATE TRIGGER bank_receipt_match_identity BEFORE UPDATE ON bank_receipt_matches WHEN NEW.row_id<>OLD.row_id OR NEW.receipt_id<>OLD.receipt_id OR NEW.actor_id<>OLD.actor_id OR NEW.at<>OLD.at OR OLD.active=0 BEGIN SELECT RAISE(ABORT,'Receipt match evidence is immutable'); END;
      CREATE TRIGGER client_receipt_shared_reference BEFORE UPDATE OF reference_key ON client_receipts WHEN NEW.reference_key IS NOT NULL AND EXISTS(SELECT 1 FROM payments WHERE bank_id=NEW.bank_id AND reference_key=NEW.reference_key) BEGIN SELECT RAISE(ABORT,'Bank reference is already recorded in supplier settlement'); END;
      CREATE TRIGGER payment_shared_reference BEFORE UPDATE OF reference_key ON payments WHEN NEW.reference_key IS NOT NULL AND EXISTS(SELECT 1 FROM client_receipts WHERE bank_id=NEW.bank_id AND reference_key=NEW.reference_key) BEGIN SELECT RAISE(ABORT,'Bank reference is already recorded in customer receipts'); END;
    `);
    for (const t of ['client_receipts', 'client_receipt_allocations', 'client_receipt_evidence', 'client_receipt_events', 'bank_receipt_matches']) db.exec(`CREATE TRIGGER ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT,'Receipt history must be retained'); END;`);
    for (const t of ['client_receipt_allocations', 'client_receipt_evidence', 'client_receipt_events']) db.exec(`CREATE TRIGGER ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT,'Receipt evidence is immutable'); END;`);
    db.exec('INSERT INTO schema_versions VALUES(15); COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
