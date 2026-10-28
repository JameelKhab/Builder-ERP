export function installFoundations(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=4').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE users ADD COLUMN organisation_admin INTEGER NOT NULL DEFAULT 0 CHECK(organisation_admin IN(0,1));
      ALTER TABLE memberships ADD COLUMN budget_approval_limit TEXT NOT NULL DEFAULT '0.00';
      ALTER TABLE companies ADD COLUMN legal_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE companies ADD COLUMN registration TEXT NOT NULL DEFAULT '';
      ALTER TABLE companies ADD COLUMN country_code TEXT NOT NULL DEFAULT '';
      ALTER TABLE companies ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE projects ADD COLUMN manager_id TEXT REFERENCES users(id);
      ALTER TABLE projects ADD COLUMN customer_reference TEXT NOT NULL DEFAULT '';
      ALTER TABLE projects ADD COLUMN planned_start TEXT;
      ALTER TABLE projects ADD COLUMN planned_end TEXT;
      ALTER TABLE projects ADD COLUMN description TEXT NOT NULL DEFAULT '';
      ALTER TABLE projects ADD COLUMN provenance TEXT NOT NULL DEFAULT 'Illustrative opening project';
      ALTER TABLE projects ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE projects ADD COLUMN budget_revision INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE projects ADD COLUMN budget_status TEXT NOT NULL DEFAULT 'opening' CHECK(budget_status IN('unapproved','opening','approved'));
      CREATE UNIQUE INDEX project_company_code ON projects(company_id,code);
      ALTER TABLE project_locations ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
      CREATE TABLE cost_codes(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),code TEXT NOT NULL,name TEXT NOT NULL,UNIQUE(company_id,code),UNIQUE(id,company_id));
      ALTER TABLE work_packages ADD COLUMN kind TEXT NOT NULL DEFAULT 'item' CHECK(kind IN('group','item'));
      ALTER TABLE work_packages ADD COLUMN cost_code_id TEXT REFERENCES cost_codes(id);
      ALTER TABLE work_packages ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
      CREATE TABLE budget_documents(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN('baseline','revision')),title TEXT NOT NULL,basis TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN('draft','submitted','returned','approved','cancelled')),author_id TEXT NOT NULL REFERENCES users(id),version INTEGER NOT NULL DEFAULT 1,base_revision INTEGER NOT NULL,submission_hash TEXT,submitted_at TEXT,approved_by TEXT REFERENCES users(id),approved_at TEXT,created_at TEXT NOT NULL,UNIQUE(id,company_id,project_id),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
      CREATE TABLE budget_lines(id TEXT PRIMARY KEY,document_id TEXT NOT NULL,company_id TEXT NOT NULL,project_id TEXT NOT NULL,work_package_id TEXT NOT NULL,proposed_budget TEXT NOT NULL,proposed_release TEXT NOT NULL,note TEXT NOT NULL,snapshot_json TEXT NOT NULL,UNIQUE(document_id,work_package_id),FOREIGN KEY(document_id,company_id,project_id) REFERENCES budget_documents(id,company_id,project_id),FOREIGN KEY(work_package_id,company_id,project_id) REFERENCES work_packages(id,company_id,project_id));
      CREATE TABLE budget_facts(id TEXT PRIMARY KEY,document_id TEXT NOT NULL REFERENCES budget_documents(id),line_id TEXT NOT NULL UNIQUE REFERENCES budget_lines(id),cost_item_id TEXT NOT NULL REFERENCES cost_items(id),original_delta TEXT NOT NULL,budget_delta TEXT NOT NULL,release_delta TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TABLE foundation_events(id INTEGER PRIMARY KEY AUTOINCREMENT,company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT REFERENCES projects(id),entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,version INTEGER NOT NULL,before_json TEXT,after_json TEXT NOT NULL,reason TEXT NOT NULL,at TEXT NOT NULL);
      CREATE INDEX budget_scope ON budget_documents(company_id,project_id,state);
      CREATE INDEX budget_fact_item ON budget_facts(cost_item_id);
      CREATE TRIGGER budget_document_approved_update BEFORE UPDATE ON budget_documents WHEN OLD.state='approved' BEGIN SELECT RAISE(ABORT,'Approved budget is immutable'); END;
      CREATE TRIGGER budget_document_delete BEFORE DELETE ON budget_documents BEGIN SELECT RAISE(ABORT,'Budget history cannot be deleted'); END;
      CREATE TRIGGER budget_line_update BEFORE UPDATE ON budget_lines WHEN (SELECT state FROM budget_documents WHERE id=OLD.document_id) NOT IN('draft','returned') BEGIN SELECT RAISE(ABORT,'Submitted budget lines are immutable'); END;
      CREATE TRIGGER budget_line_delete BEFORE DELETE ON budget_lines WHEN (SELECT state FROM budget_documents WHERE id=OLD.document_id) NOT IN('draft','returned') BEGIN SELECT RAISE(ABORT,'Submitted budget lines are immutable'); END;
      CREATE TRIGGER budget_line_insert BEFORE INSERT ON budget_lines WHEN (SELECT state FROM budget_documents WHERE id=NEW.document_id) NOT IN('draft','returned') BEGIN SELECT RAISE(ABORT,'Submitted budget lines are immutable'); END;
      UPDATE companies SET legal_name=name;
      UPDATE users SET organisation_admin=1 WHERE id='ahmed' AND access_admin=1;
      INSERT INTO schema_versions VALUES(4);
    `);
    for (const table of ['budget_facts', 'foundation_events']) db.exec(`CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'Approved evidence is append-only'); END; CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'Approved evidence is append-only'); END;`);
    for (const c of db.prepare('SELECT id FROM companies').all()) {
      db.prepare('INSERT INTO cost_codes VALUES(?,?,?,?)').run(`${c.id}-GENERAL`, c.id, 'GENERAL', 'General construction');
      db.prepare('UPDATE work_packages SET cost_code_id=? WHERE company_id=?').run(`${c.id}-GENERAL`, c.id);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
