export function installQuality(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=7').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
 CREATE TABLE quality_cases(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,work_package_id TEXT NOT NULL,location_id TEXT NOT NULL,receipt_id TEXT REFERENCES material_receipts(id),title TEXT NOT NULL,requirement TEXT NOT NULL,observation TEXT NOT NULL,severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),observed_on TEXT NOT NULL,due_date TEXT NOT NULL,reporter_id TEXT NOT NULL REFERENCES users(id),owner_id TEXT NOT NULL REFERENCES users(id),reviewer_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL CHECK(state IN ('draft','open','plan_review','in_progress','verification','closed','cancelled')),cycle INTEGER NOT NULL DEFAULT 1,version INTEGER NOT NULL DEFAULT 1,containment TEXT NOT NULL DEFAULT '',root_cause TEXT NOT NULL DEFAULT '',disposition TEXT NOT NULL DEFAULT '',remedy TEXT NOT NULL DEFAULT '',acceptance TEXT NOT NULL DEFAULT '',authority_reference TEXT NOT NULL DEFAULT '',plan_author_id TEXT REFERENCES users(id),verification_requested_at TEXT,closed_at TEXT,created_at TEXT NOT NULL,UNIQUE(id,company_id,project_id),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id),FOREIGN KEY(work_package_id,company_id,project_id) REFERENCES work_packages(id,company_id,project_id),FOREIGN KEY(location_id,company_id,project_id) REFERENCES project_locations(id,company_id,project_id));
 CREATE TABLE quality_actions(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES quality_cases(id),cycle INTEGER NOT NULL,title TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id),due_date TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','complete')),completion TEXT NOT NULL DEFAULT '',completed_by TEXT REFERENCES users(id),completed_at TEXT);
 CREATE TABLE quality_impacts(case_id TEXT NOT NULL REFERENCES quality_cases(id),cycle INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('cost','waste','change','delay')),assessment TEXT NOT NULL CHECK(assessment IN ('unknown','none','follow_up')),reason TEXT NOT NULL DEFAULT '',owner_id TEXT REFERENCES users(id),due_date TEXT,PRIMARY KEY(case_id,cycle,kind));
 CREATE TABLE quality_evidence(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES quality_cases(id),cycle INTEGER NOT NULL,purpose TEXT NOT NULL CHECK(purpose IN ('observation','containment','plan','authority','action','verification')),action_id TEXT REFERENCES quality_actions(id),filename TEXT NOT NULL,mime TEXT NOT NULL,sha256 TEXT NOT NULL,size INTEGER NOT NULL,content BLOB NOT NULL,caption TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),case_version INTEGER NOT NULL,at TEXT NOT NULL);
 CREATE TABLE quality_events(id INTEGER PRIMARY KEY AUTOINCREMENT,case_id TEXT NOT NULL REFERENCES quality_cases(id),cycle INTEGER NOT NULL,version INTEGER NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,note TEXT NOT NULL,snapshot TEXT NOT NULL,at TEXT NOT NULL);
 CREATE INDEX quality_scope ON quality_cases(company_id,project_id,state);
 CREATE INDEX quality_evidence_case ON quality_evidence(case_id,cycle);
 CREATE TRIGGER quality_case_identity BEFORE UPDATE ON quality_cases WHEN NEW.company_id<>OLD.company_id OR NEW.project_id<>OLD.project_id OR NEW.reporter_id<>OLD.reporter_id OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'Case identity is fixed'); END;
 CREATE TRIGGER quality_no_delete BEFORE DELETE ON quality_cases BEGIN SELECT RAISE(ABORT,'Cases must be retained'); END;
 `);
    for (const t of ['quality_evidence', 'quality_events']) for (const op of ['UPDATE', 'DELETE']) db.exec(`CREATE TRIGGER ${t}_${op.toLowerCase()} BEFORE ${op} ON ${t} BEGIN SELECT RAISE(ABORT,'Quality evidence and history are append-only'); END;`);
    db.exec('INSERT INTO schema_versions VALUES(7); COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
