export function installClientCorrections(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=18').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TABLE client_corrections(
        id TEXT PRIMARY KEY,advance_id TEXT REFERENCES client_advances(id),
        certificate_id TEXT REFERENCES client_certificates(id),invoice_id TEXT REFERENCES client_invoices(id),
        contract_id TEXT NOT NULL REFERENCES client_contracts(id),company_id TEXT NOT NULL REFERENCES companies(id),
        project_id TEXT NOT NULL,currency TEXT NOT NULL,title TEXT NOT NULL,effective_date TEXT NOT NULL,
        basis TEXT NOT NULL,snapshot TEXT NOT NULL,evidence_id TEXT,
        author_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL CHECK(state IN ('draft','technical','commercial','finance','returned','applied','cancelled')),
        version INTEGER NOT NULL DEFAULT 1,cycle INTEGER NOT NULL DEFAULT 0,
        technical_by TEXT REFERENCES users(id),commercial_by TEXT REFERENCES users(id),
        applied_by TEXT REFERENCES users(id),applied_at TEXT,journal_id TEXT REFERENCES ledger_entries(id),created_at TEXT NOT NULL,
        CHECK((advance_id IS NOT NULL AND certificate_id IS NULL) OR (advance_id IS NULL AND certificate_id IS NOT NULL)),
        FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
      CREATE UNIQUE INDEX client_correction_advance_live ON client_corrections(advance_id) WHERE state<>'cancelled';
      CREATE UNIQUE INDEX client_correction_certificate_live ON client_corrections(certificate_id) WHERE state<>'cancelled';
      CREATE INDEX client_correction_scope ON client_corrections(company_id,project_id,state,effective_date);
      CREATE TABLE client_correction_evidence(id TEXT PRIMARY KEY,correction_id TEXT NOT NULL REFERENCES client_corrections(id),filename TEXT NOT NULL,sha256 TEXT NOT NULL,bytes BLOB NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
      CREATE TABLE client_correction_events(id INTEGER PRIMARY KEY AUTOINCREMENT,correction_id TEXT NOT NULL REFERENCES client_corrections(id),actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TRIGGER client_correction_identity BEFORE UPDATE ON client_corrections WHEN NEW.advance_id IS NOT OLD.advance_id OR NEW.certificate_id IS NOT OLD.certificate_id OR NEW.contract_id<>OLD.contract_id OR NEW.company_id<>OLD.company_id OR NEW.project_id<>OLD.project_id OR NEW.currency<>OLD.currency OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Correction source is fixed'); END;
      CREATE TRIGGER client_correction_frozen BEFORE UPDATE ON client_corrections WHEN OLD.state IN ('applied','cancelled') BEGIN SELECT RAISE(ABORT,'Applied or cancelled corrections are immutable'); END;
      CREATE TRIGGER client_correction_apply_stage BEFORE UPDATE ON client_corrections WHEN NEW.state='applied' AND OLD.state<>'finance' BEGIN SELECT RAISE(ABORT,'Corrections require finance review'); END;
      CREATE TRIGGER client_correction_source BEFORE INSERT ON client_corrections WHEN
        (NEW.advance_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM client_advances a WHERE a.id=NEW.advance_id AND a.state='approved' AND a.contract_id=NEW.contract_id AND a.company_id=NEW.company_id AND a.project_id=NEW.project_id AND a.currency=NEW.currency)) OR
        (NEW.certificate_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM client_certificates c WHERE c.id=NEW.certificate_id AND c.state='approved' AND c.contract_id=NEW.contract_id AND c.company_id=NEW.company_id AND c.project_id=NEW.project_id AND c.currency=NEW.currency))
        BEGIN SELECT RAISE(ABORT,'Correction must retain its approved source scope'); END;
    `);
    for (const t of ['client_corrections', 'client_correction_evidence', 'client_correction_events']) db.exec(`CREATE TRIGGER ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT,'Correction history must be retained'); END;`);
    for (const t of ['client_correction_evidence', 'client_correction_events']) db.exec(`CREATE TRIGGER ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT,'Correction evidence is immutable'); END;`);
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Client correction migration failed foreign-key verification');
    db.exec('INSERT INTO schema_versions VALUES(18); COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
