export function installEstimates(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=11').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE memberships ADD COLUMN estimate_approval_limit TEXT NOT NULL DEFAULT '0.00';
      CREATE TABLE estimate_versions(id TEXT PRIMARY KEY,study_id TEXT NOT NULL,revision INTEGER NOT NULL,predecessor_id TEXT REFERENCES estimate_versions(id),company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT,customer_id TEXT NOT NULL REFERENCES parties(id),customer_snapshot TEXT NOT NULL,title TEXT NOT NULL,tender_reference TEXT NOT NULL,due TEXT NOT NULL,currency TEXT NOT NULL,rate TEXT NOT NULL,rate_date TEXT NOT NULL,rate_source TEXT NOT NULL,buildings INTEGER NOT NULL,indirect_pool TEXT NOT NULL,overhead TEXT NOT NULL,profit TEXT NOT NULL,header_markup TEXT NOT NULL,basis TEXT NOT NULL,exclusions TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL CHECK(state IN('draft','submitted','returned','approved','cancelled')),version INTEGER NOT NULL DEFAULT 1,approved_by TEXT REFERENCES users(id),approved_at TEXT,calculation TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(study_id,revision),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id),FOREIGN KEY(customer_id,company_id) REFERENCES party_companies(party_id,company_id));
      CREATE UNIQUE INDEX estimate_one_working_revision ON estimate_versions(study_id) WHERE state IN('draft','submitted','returned');
      CREATE INDEX estimate_scope ON estimate_versions(company_id,project_id,state);
      CREATE TABLE estimate_lines(version_id TEXT NOT NULL REFERENCES estimate_versions(id),key TEXT NOT NULL,position INTEGER NOT NULL,code TEXT NOT NULL,description TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN('item','group')),parent_key TEXT,cost_code_id TEXT NOT NULL REFERENCES cost_codes(id),unit TEXT NOT NULL REFERENCES catalogue_units(id),quantity TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN('direct','assembly')),direct_rate TEXT NOT NULL,item_markup TEXT NOT NULL,secondary_unit TEXT REFERENCES catalogue_units(id),conversion TEXT NOT NULL,PRIMARY KEY(version_id,key),UNIQUE(version_id,code));
      CREATE TABLE estimate_resources(version_id TEXT NOT NULL,line_key TEXT NOT NULL,key TEXT NOT NULL,kind TEXT NOT NULL,description TEXT NOT NULL,unit TEXT NOT NULL REFERENCES catalogue_units(id),consumption TEXT NOT NULL,unit_rate TEXT NOT NULL,price_basis TEXT NOT NULL,currency TEXT NOT NULL,rate TEXT NOT NULL,rate_date TEXT NOT NULL,rate_source TEXT NOT NULL,PRIMARY KEY(version_id,key),FOREIGN KEY(version_id,line_key) REFERENCES estimate_lines(version_id,key));
      CREATE TABLE estimate_overrides(version_id TEXT NOT NULL,line_key TEXT NOT NULL,building INTEGER NOT NULL,quantity TEXT NOT NULL,reason TEXT NOT NULL,PRIMARY KEY(version_id,line_key,building),FOREIGN KEY(version_id,line_key) REFERENCES estimate_lines(version_id,key));
      CREATE TABLE estimate_handovers(version_id TEXT PRIMARY KEY REFERENCES estimate_versions(id),study_id TEXT NOT NULL UNIQUE,company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),budget_id TEXT NOT NULL UNIQUE REFERENCES budget_documents(id),actor_id TEXT NOT NULL REFERENCES users(id),reason TEXT NOT NULL,snapshot TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TABLE estimate_handover_lines(version_id TEXT NOT NULL REFERENCES estimate_handovers(version_id),line_key TEXT NOT NULL,work_package_id TEXT NOT NULL REFERENCES work_packages(id),budget_amount TEXT NOT NULL,PRIMARY KEY(version_id,line_key),FOREIGN KEY(version_id,line_key) REFERENCES estimate_lines(version_id,key));
      CREATE TABLE estimate_events(id INTEGER PRIMARY KEY AUTOINCREMENT,version_id TEXT NOT NULL REFERENCES estimate_versions(id),actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL,at TEXT NOT NULL);
      CREATE TRIGGER estimate_identity BEFORE UPDATE ON estimate_versions WHEN NEW.company_id<>OLD.company_id OR NEW.project_id IS NOT OLD.project_id OR NEW.study_id<>OLD.study_id OR NEW.revision<>OLD.revision OR NEW.predecessor_id IS NOT OLD.predecessor_id OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Estimate identity is fixed'); END;
      CREATE TRIGGER estimate_approved_lock BEFORE UPDATE ON estimate_versions WHEN OLD.state IN('approved','cancelled') BEGIN SELECT RAISE(ABORT,'Approved/cancelled estimate is immutable'); END;
    `);
    for (const t of ['estimate_versions', 'estimate_events', 'estimate_handovers', 'estimate_handover_lines']) db.exec(`CREATE TRIGGER ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT,'Estimate evidence must be retained'); END;`);
    for (const t of ['estimate_events', 'estimate_handovers', 'estimate_handover_lines']) db.exec(`CREATE TRIGGER ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT,'Estimate evidence is immutable'); END;`);
    for (const t of ['estimate_lines', 'estimate_resources', 'estimate_overrides']) for (const action of ['INSERT', 'UPDATE', 'DELETE']) {
      const ref = action === 'INSERT' ? 'NEW' : 'OLD';
      db.exec(`CREATE TRIGGER ${t}_${action}_lock BEFORE ${action} ON ${t} WHEN (SELECT state FROM estimate_versions WHERE id=${ref}.version_id) NOT IN('draft','returned') BEGIN SELECT RAISE(ABORT,'Submitted estimate inputs are immutable'); END;`);
    }
    db.exec('INSERT INTO schema_versions VALUES(11); COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
