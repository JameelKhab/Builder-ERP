export function installProcurement(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=3').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
 CREATE TABLE products(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),code TEXT NOT NULL,name TEXT NOT NULL,uom TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,UNIQUE(company_id,code),UNIQUE(id,company_id));
 CREATE TABLE project_locations(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,parent_id TEXT REFERENCES project_locations(id),code TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,UNIQUE(project_id,code),UNIQUE(id,company_id,project_id),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
 CREATE TABLE work_packages(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,parent_id TEXT REFERENCES work_packages(id),code TEXT NOT NULL,name TEXT NOT NULL,cost_item_id TEXT NOT NULL UNIQUE REFERENCES cost_items(id),release_state TEXT NOT NULL CHECK(release_state IN ('draft','released')),UNIQUE(project_id,code),UNIQUE(id,company_id,project_id),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
 CREATE TABLE material_requests(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,title TEXT NOT NULL,needed_by TEXT NOT NULL,requester_id TEXT NOT NULL REFERENCES users(id),plan_author_id TEXT REFERENCES users(id),state TEXT NOT NULL CHECK(state IN ('draft','submitted','awaiting_approval','approved','ordered','cancelled')),version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,UNIQUE(id,company_id,project_id),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
 CREATE TABLE material_request_lines(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES material_requests(id),company_id TEXT NOT NULL,project_id TEXT NOT NULL,product_id TEXT NOT NULL,work_package_id TEXT NOT NULL,location_id TEXT NOT NULL,quantity TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',UNIQUE(id,request_id),FOREIGN KEY(request_id,company_id,project_id) REFERENCES material_requests(id,company_id,project_id),FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id),FOREIGN KEY(work_package_id,company_id,project_id) REFERENCES work_packages(id,company_id,project_id),FOREIGN KEY(location_id,company_id,project_id) REFERENCES project_locations(id,company_id,project_id));
 CREATE TABLE supplier_quotes(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES material_requests(id),line_id TEXT NOT NULL,company_id TEXT NOT NULL,vendor_id TEXT NOT NULL,reference TEXT NOT NULL,quantity TEXT NOT NULL,unit_price TEXT NOT NULL,currency TEXT NOT NULL,rate TEXT NOT NULL,rate_date TEXT NOT NULL,rate_source TEXT NOT NULL,valid_until TEXT NOT NULL,lead_days INTEGER NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,FOREIGN KEY(line_id,request_id) REFERENCES material_request_lines(id,request_id),FOREIGN KEY(vendor_id,company_id) REFERENCES vendors(id,company_id));
 CREATE TABLE sourcing_allocations(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES material_requests(id),quote_id TEXT NOT NULL REFERENCES supplier_quotes(id),line_id TEXT NOT NULL REFERENCES material_request_lines(id),quantity TEXT NOT NULL,amount TEXT NOT NULL,company_amount TEXT NOT NULL,UNIQUE(request_id,quote_id));
 CREATE TABLE purchase_orders(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES material_requests(id),company_id TEXT NOT NULL,project_id TEXT NOT NULL,vendor_id TEXT NOT NULL,currency TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('issued','closed')),version INTEGER NOT NULL DEFAULT 1,issued_by TEXT NOT NULL REFERENCES users(id),issued_at TEXT NOT NULL,UNIQUE(id,company_id,project_id),UNIQUE(request_id,vendor_id,currency),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id),FOREIGN KEY(vendor_id,company_id) REFERENCES vendors(id,company_id));
 CREATE TABLE purchase_order_lines(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES purchase_orders(id),allocation_id TEXT NOT NULL UNIQUE REFERENCES sourcing_allocations(id),request_line_id TEXT NOT NULL REFERENCES material_request_lines(id),quantity TEXT NOT NULL,unit_price TEXT NOT NULL,amount TEXT NOT NULL,company_amount TEXT NOT NULL,rate TEXT NOT NULL,rate_date TEXT NOT NULL,rate_source TEXT NOT NULL);
 CREATE TABLE material_receipts(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES purchase_orders(id),order_line_id TEXT NOT NULL REFERENCES purchase_order_lines(id),company_id TEXT NOT NULL,project_id TEXT NOT NULL,accepted TEXT NOT NULL,rejected TEXT NOT NULL,company_value TEXT NOT NULL,delivery_reference TEXT NOT NULL,reason TEXT NOT NULL,received_by TEXT NOT NULL REFERENCES users(id),received_at TEXT NOT NULL,command_key TEXT NOT NULL,UNIQUE(order_id,command_key),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
 CREATE TABLE stock_movements(id TEXT PRIMARY KEY,receipt_id TEXT NOT NULL REFERENCES material_receipts(id),company_id TEXT NOT NULL,project_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('receipt','return','issue')),quantity TEXT NOT NULL,company_value TEXT NOT NULL,location_id TEXT NOT NULL,reason TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),at TEXT NOT NULL,command_key TEXT NOT NULL,UNIQUE(receipt_id,command_key),FOREIGN KEY(location_id,company_id,project_id) REFERENCES project_locations(id,company_id,project_id));
 CREATE TABLE construction_cost_facts(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,cost_item_id TEXT NOT NULL REFERENCES cost_items(id),kind TEXT NOT NULL CHECK(kind IN ('commitment','incurred')),amount TEXT NOT NULL,source_type TEXT NOT NULL,source_id TEXT NOT NULL,at TEXT NOT NULL,UNIQUE(kind,source_type,source_id),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
 CREATE TABLE procurement_events(id INTEGER PRIMARY KEY AUTOINCREMENT,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT NOT NULL REFERENCES projects(id),actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,version INTEGER NOT NULL,note TEXT NOT NULL,at TEXT NOT NULL);
 CREATE INDEX material_request_scope ON material_requests(company_id,project_id,state);
 CREATE INDEX po_scope ON purchase_orders(company_id,project_id);
 CREATE INDEX stock_scope ON stock_movements(company_id,project_id,receipt_id);
 CREATE INDEX cost_fact_item ON construction_cost_facts(cost_item_id,kind);
 INSERT INTO schema_versions VALUES(3);`);
    for (const table of ['supplier_quotes', 'material_receipts', 'stock_movements', 'construction_cost_facts', 'procurement_events', 'purchase_order_lines']) {
      db.exec(`CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'Posted evidence is append-only'); END; CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'Posted evidence is append-only'); END;`);
    }
    // Explicitly synthetic master data only; existing flat balances remain untouched.
    for (const c of db.prepare('SELECT * FROM companies').all()) {
      for (const [code, name, uom] of [['STEEL', 'Reinforcement steel B500B', 'tonne'], ['BLOCK', 'Concrete block 200 mm', 'unit'], ['FORM', 'Reusable formwork panel', 'panel']]) db.prepare('INSERT INTO products(id,company_id,code,name,uom) VALUES(?,?,?,?,?)').run(`${c.id}-${code}`, c.id, code, name, uom);
    }
    for (const p of db.prepare('SELECT * FROM projects').all()) {
      const insert = db.prepare('INSERT INTO project_locations(id,company_id,project_id,parent_id,code,name,kind) VALUES(?,?,?,?,?,?,?)');
      insert.run(`${p.id}-site`, p.company_id, p.id, null, 'SITE', 'Main site', 'site');
      insert.run(`${p.id}-tower`, p.company_id, p.id, `${p.id}-site`, 'A', 'Building A', 'building');
      insert.run(`${p.id}-level`, p.company_id, p.id, `${p.id}-tower`, 'A-L12', 'Level 12', 'floor');
      insert.run(`${p.id}-unit`, p.company_id, p.id, `${p.id}-level`, 'A-1204', 'Unit 1204', 'unit');
    }
    for (const c of db.prepare('SELECT * FROM cost_items WHERE project_id IS NOT NULL').all()) db.prepare('INSERT INTO work_packages(id,company_id,project_id,parent_id,code,name,cost_item_id,release_state) VALUES(?,?,?,?,?,?,?,?)').run(`WP-${c.id}`, c.company_id, c.project_id, null, c.id, c.name, c.id, 'released');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
