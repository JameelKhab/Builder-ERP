export function installBoqIntake(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=12').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE estimate_lines ADD COLUMN product_id TEXT REFERENCES products(id);
      ALTER TABLE estimate_lines ADD COLUMN product_snapshot TEXT;
      CREATE TABLE boq_intakes(id TEXT PRIMARY KEY,estimate_id TEXT NOT NULL REFERENCES estimate_versions(id),author_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL CHECK(state IN('uploaded','checked','reviewed','returned','committed','cancelled')),version INTEGER NOT NULL DEFAULT 1,current_check_id TEXT,reviewed_by TEXT REFERENCES users(id),reviewed_at TEXT,committed_version INTEGER,created_at TEXT NOT NULL);
      CREATE TABLE boq_intake_files(id TEXT PRIMARY KEY,batch_id TEXT NOT NULL REFERENCES boq_intakes(id),filename TEXT NOT NULL,sha256 TEXT NOT NULL,bytes BLOB NOT NULL,parsed TEXT NOT NULL,UNIQUE(batch_id,sha256));
      CREATE TABLE boq_intake_checks(id TEXT PRIMARY KEY,batch_id TEXT NOT NULL REFERENCES boq_intakes(id),author_id TEXT NOT NULL REFERENCES users(id),estimate_version INTEGER NOT NULL,config TEXT NOT NULL,result TEXT NOT NULL,digest TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TABLE boq_intake_lines(batch_id TEXT NOT NULL REFERENCES boq_intakes(id),file_id TEXT NOT NULL REFERENCES boq_intake_files(id),study_id TEXT NOT NULL,estimate_id TEXT NOT NULL REFERENCES estimate_versions(id),line_key TEXT NOT NULL,source_sheet TEXT NOT NULL,source_row INTEGER NOT NULL,snapshot TEXT NOT NULL,PRIMARY KEY(batch_id,line_key));
      CREATE TABLE boq_intake_events(id INTEGER PRIMARY KEY AUTOINCREMENT,batch_id TEXT NOT NULL REFERENCES boq_intakes(id),actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,reason TEXT NOT NULL,check_id TEXT REFERENCES boq_intake_checks(id),at TEXT NOT NULL);
      CREATE INDEX boq_intake_estimate ON boq_intakes(estimate_id,state);
      CREATE TRIGGER boq_intake_identity BEFORE UPDATE ON boq_intakes WHEN NEW.id<>OLD.id OR NEW.estimate_id<>OLD.estimate_id OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Intake identity is fixed'); END;
      CREATE TRIGGER boq_intake_final BEFORE UPDATE ON boq_intakes WHEN OLD.state IN('committed','cancelled') BEGIN SELECT RAISE(ABORT,'Finished intake is immutable'); END;
    `);
    for (const table of ['boq_intakes', 'boq_intake_files', 'boq_intake_checks', 'boq_intake_lines', 'boq_intake_events']) {
      db.exec(`CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'Intake evidence must be retained'); END;`);
      if (table !== 'boq_intakes') db.exec(`CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'Intake evidence is immutable'); END;`);
    }
    for (const table of ['estimate_lines', 'estimate_resources', 'estimate_overrides']) db.exec(`CREATE TRIGGER ${table}_version_fixed BEFORE UPDATE OF version_id ON ${table} WHEN NEW.version_id<>OLD.version_id BEGIN SELECT RAISE(ABORT,'Estimate child identity is fixed'); END;`);
    db.exec('INSERT INTO schema_versions VALUES(12); COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
