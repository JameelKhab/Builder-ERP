export function installPayments(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=10').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE memberships ADD COLUMN payment_approval_limit TEXT NOT NULL DEFAULT '0';
      CREATE TABLE payment_banks(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),name TEXT NOT NULL,currency TEXT NOT NULL,account_id TEXT NOT NULL,gain_account_id TEXT NOT NULL,loss_account_id TEXT NOT NULL,active INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1,UNIQUE(company_id,name),FOREIGN KEY(account_id,company_id) REFERENCES ledger_accounts(id,company_id),FOREIGN KEY(gain_account_id,company_id) REFERENCES ledger_accounts(id,company_id),FOREIGN KEY(loss_account_id,company_id) REFERENCES ledger_accounts(id,company_id));
      CREATE TABLE payments(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT,vendor_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('payment','refund')),reversal_of TEXT REFERENCES payments(id),bank_id TEXT NOT NULL REFERENCES payment_banks(id),title TEXT NOT NULL,accounting_date TEXT NOT NULL,currency TEXT NOT NULL,total TEXT NOT NULL,bank_amount TEXT NOT NULL,bank_rate TEXT NOT NULL,rate_date TEXT NOT NULL,rate_source TEXT NOT NULL,company_total TEXT NOT NULL,authority_amount TEXT NOT NULL,explanation TEXT NOT NULL,payload TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL CHECK(state IN ('draft','submitted','returned','approved','recorded','cancelled')),version INTEGER NOT NULL DEFAULT 1,approved_by TEXT REFERENCES users(id),recorded_by TEXT REFERENCES users(id),bank_reference TEXT,reference_key TEXT,evidence TEXT,journal_id TEXT REFERENCES ledger_entries(id),created_at TEXT NOT NULL,recorded_at TEXT,FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id),FOREIGN KEY(vendor_id,company_id) REFERENCES vendors(id,company_id));
      CREATE UNIQUE INDEX payment_reversal_once ON payments(reversal_of) WHERE reversal_of IS NOT NULL AND state<>'cancelled';
      CREATE UNIQUE INDEX payment_bank_reference ON payments(bank_id,reference_key) WHERE reference_key IS NOT NULL;
      CREATE INDEX payment_scope ON payments(company_id,project_id,state,accounting_date);
      CREATE TABLE payment_allocations(id TEXT PRIMARY KEY,payment_id TEXT NOT NULL REFERENCES payments(id),bill_id TEXT NOT NULL REFERENCES payable_documents(id),project_id TEXT NOT NULL REFERENCES projects(id),amount TEXT NOT NULL,base_amount TEXT NOT NULL,bank_amount TEXT NOT NULL,bank_base TEXT NOT NULL,effect INTEGER NOT NULL CHECK(effect IN (-1,1)),UNIQUE(payment_id,bill_id));
      CREATE TABLE bank_statements(id TEXT PRIMARY KEY,bank_id TEXT NOT NULL REFERENCES payment_banks(id),company_id TEXT NOT NULL REFERENCES companies(id),reference TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,opening TEXT NOT NULL,closing TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,UNIQUE(bank_id,reference));
      CREATE TABLE bank_statement_voids(statement_id TEXT PRIMARY KEY REFERENCES bank_statements(id),actor_id TEXT NOT NULL REFERENCES users(id),reason TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TABLE bank_rows(id TEXT PRIMARY KEY,statement_id TEXT NOT NULL REFERENCES bank_statements(id),date TEXT NOT NULL,direction TEXT NOT NULL CHECK(direction IN ('in','out')),amount TEXT NOT NULL,reference TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE bank_matches(id INTEGER PRIMARY KEY AUTOINCREMENT,row_id TEXT NOT NULL REFERENCES bank_rows(id),payment_id TEXT NOT NULL REFERENCES payments(id),active INTEGER NOT NULL CHECK(active IN (0,1)),actor_id TEXT NOT NULL REFERENCES users(id),at TEXT NOT NULL);
      CREATE UNIQUE INDEX bank_payment_one_match ON bank_matches(payment_id) WHERE active=1;
      CREATE TABLE payment_events(id INTEGER PRIMARY KEY AUTOINCREMENT,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT,actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TRIGGER payment_identity BEFORE UPDATE ON payments WHEN NEW.company_id<>OLD.company_id OR NEW.project_id IS NOT OLD.project_id OR NEW.vendor_id<>OLD.vendor_id OR NEW.bank_id<>OLD.bank_id OR NEW.kind<>OLD.kind OR NEW.reversal_of IS NOT OLD.reversal_of OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Payment identity is fixed'); END;
      CREATE TRIGGER payment_recorded_immutable BEFORE UPDATE ON payments WHEN OLD.state='recorded' BEGIN SELECT RAISE(ABORT,'Recorded payments are immutable'); END;
      CREATE TRIGGER payment_allocation_post BEFORE INSERT ON payment_allocations WHEN (SELECT state FROM payments WHERE id=NEW.payment_id)<>'approved' BEGIN SELECT RAISE(ABORT,'Only approved payments can be recorded'); END;
      CREATE TRIGGER payment_bank_identity BEFORE UPDATE ON payment_banks WHEN NEW.company_id<>OLD.company_id OR NEW.currency<>OLD.currency OR NEW.account_id<>OLD.account_id OR NEW.gain_account_id<>OLD.gain_account_id OR NEW.loss_account_id<>OLD.loss_account_id BEGIN SELECT RAISE(ABORT,'Bank accounting identity is fixed'); END;
      CREATE TRIGGER bank_row_identity BEFORE UPDATE ON bank_rows WHEN NEW.statement_id<>OLD.statement_id OR NEW.date<>OLD.date OR NEW.direction<>OLD.direction OR NEW.amount<>OLD.amount OR NEW.reference<>OLD.reference BEGIN SELECT RAISE(ABORT,'Statement evidence is immutable'); END;
      CREATE TRIGGER bank_match_identity BEFORE UPDATE ON bank_matches WHEN NEW.row_id<>OLD.row_id OR NEW.payment_id<>OLD.payment_id OR NEW.actor_id<>OLD.actor_id OR NEW.at<>OLD.at OR OLD.active=0 BEGIN SELECT RAISE(ABORT,'Match evidence is immutable'); END;
    `);
    for (const t of ['bank_statement_voids', 'payment_banks', 'payments', 'payment_allocations', 'bank_statements', 'bank_rows', 'bank_matches', 'payment_events']) db.exec(`CREATE TRIGGER ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT,'Payment evidence must be retained'); END;`);
    for (const t of ['bank_statement_voids', 'payment_allocations', 'bank_statements', 'payment_events']) db.exec(`CREATE TRIGGER ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT,'Payment evidence is immutable'); END;`);
    db.exec('INSERT INTO schema_versions VALUES(10); COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
