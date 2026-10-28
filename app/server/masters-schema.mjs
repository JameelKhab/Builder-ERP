// Original company masters. Historical transaction rows are never rewritten.
// product_packs.supplier_code is the initial storage name for a generic pack reference.
// It is never inferred as a vendor item code; quote_pack_details.supplier_code is entered per supplier quote.
export function installMasters(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=6').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
 CREATE TABLE parties(id TEXT PRIMARY KEY,name TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE party_companies(party_id TEXT NOT NULL REFERENCES parties(id),company_id TEXT NOT NULL REFERENCES companies(id),vendor_id TEXT NOT NULL,reference TEXT NOT NULL DEFAULT '',supplier INTEGER NOT NULL DEFAULT 0,customer INTEGER NOT NULL DEFAULT 0,subcontractor INTEGER NOT NULL DEFAULT 0,email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',country TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,blocked INTEGER NOT NULL DEFAULT 0,current_terms_id TEXT REFERENCES supplier_terms(id),version INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(party_id,company_id),UNIQUE(vendor_id,company_id),FOREIGN KEY(vendor_id,company_id) REFERENCES vendors(id,company_id));
 CREATE TABLE supplier_terms(id TEXT PRIMARY KEY,party_id TEXT NOT NULL,company_id TEXT NOT NULL,preferred_currency TEXT NOT NULL,currencies TEXT NOT NULL,payment_days INTEGER,effective_from TEXT NOT NULL,effective_until TEXT,author_id TEXT REFERENCES users(id),base_version INTEGER NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL,provenance TEXT NOT NULL CHECK(provenance IN ('opening','proposal')),FOREIGN KEY(party_id,company_id) REFERENCES party_companies(party_id,company_id));
 CREATE TABLE supplier_term_decisions(id TEXT PRIMARY KEY,terms_id TEXT NOT NULL UNIQUE REFERENCES supplier_terms(id),decision TEXT NOT NULL CHECK(decision IN ('approved','returned')),reviewer_id TEXT NOT NULL REFERENCES users(id),reason TEXT NOT NULL,at TEXT NOT NULL);
 CREATE TABLE catalogue_units(id TEXT PRIMARY KEY,name TEXT NOT NULL,dimension TEXT NOT NULL,precision INTEGER NOT NULL);
 CREATE TABLE product_categories(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,version INTEGER NOT NULL DEFAULT 1,UNIQUE(id,company_id),UNIQUE(company_id,name));
 ALTER TABLE products ADD COLUMN kind TEXT NOT NULL DEFAULT 'material';
 ALTER TABLE products ADD COLUMN precision INTEGER NOT NULL DEFAULT 6;
 ALTER TABLE products ADD COLUMN category_id TEXT REFERENCES product_categories(id);
 ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT '';
 ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
 CREATE TABLE product_packs(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),name TEXT NOT NULL,base_quantity TEXT NOT NULL,supplier_code TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,version INTEGER NOT NULL DEFAULT 1,UNIQUE(product_id,name));
 CREATE TABLE master_events(id INTEGER PRIMARY KEY AUTOINCREMENT,company_id TEXT NOT NULL REFERENCES companies(id),entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,version INTEGER NOT NULL,reason TEXT NOT NULL,before_json TEXT,after_json TEXT NOT NULL,at TEXT NOT NULL);
 CREATE TABLE document_master_snapshots(entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,payload TEXT NOT NULL,provenance TEXT NOT NULL,PRIMARY KEY(entity_type,entity_id));
 CREATE TABLE quote_pack_details(quote_id TEXT PRIMARY KEY REFERENCES supplier_quotes(id),pack_id TEXT REFERENCES product_packs(id),pack_name TEXT NOT NULL,base_quantity TEXT NOT NULL,quoted_quantity TEXT NOT NULL,quoted_price TEXT NOT NULL,supplier_code TEXT NOT NULL DEFAULT '');
 CREATE INDEX party_company_scope ON party_companies(company_id,active);
 CREATE INDEX master_event_scope ON master_events(company_id,entity_type,entity_id);
 `);
    const units = [['unit', 'Unit', 'count', 0], ['panel', 'Panel', 'count', 0], ['kg', 'Kilogram', 'mass', 3], ['tonne', 'Tonne', 'mass', 6], ['m', 'Metre', 'length', 3], ['m2', 'Square metre', 'area', 3], ['m3', 'Cubic metre', 'volume', 3], ['litre', 'Litre', 'volume', 3], ['hour', 'Hour', 'time', 2], ['day', 'Day', 'time', 2], ['lump', 'Lump sum', 'lump', 0]];
    for (const u of units) db.prepare('INSERT INTO catalogue_units VALUES(?,?,?,?)').run(...u);
    for (const p of db.prepare('SELECT DISTINCT uom FROM products').all()) db.prepare('INSERT OR IGNORE INTO catalogue_units VALUES(?,?,?,?)').run(p.uom, p.uom, 'legacy', 6);
    for (const c of db.prepare('SELECT id FROM companies').all()) {
      db.prepare('INSERT INTO product_categories(id,company_id,name) VALUES(?,?,?)').run(c.id + '-materials', c.id, 'Construction materials');
      db.prepare('UPDATE products SET category_id=? WHERE company_id=?').run(c.id + '-materials', c.id);
    }
    // Opening terms preserve local availability, explicitly not an invented review.
    for (const v of db.prepare('SELECT * FROM vendors').all()) {
      const party = 'PARTY-' + v.company_id + '-' + v.id,
        terms = 'TERMS-' + v.company_id + '-' + v.id;
      db.prepare('INSERT INTO parties(id,name) VALUES(?,?)').run(party, v.name);
      db.prepare('INSERT INTO party_companies(party_id,company_id,vendor_id,supplier) VALUES(?,?,?,1)').run(party, v.company_id, v.id);
      db.prepare("INSERT INTO supplier_terms VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(terms, party, v.company_id, v.currency, JSON.stringify([v.currency]), null, '1900-01-01', null, null, 1, 'Existing local supplier preference; payment term was not recorded, left unknown. Not a migrated approval.', new Date().toISOString(), 'opening');
      db.prepare('UPDATE party_companies SET current_terms_id=? WHERE party_id=? AND company_id=?').run(terms, party, v.company_id);
    }
    const snap = (type, id, data) => db.prepare('INSERT INTO document_master_snapshots VALUES(?,?,?,?)').run(type, id, JSON.stringify(data), 'baseline_at_schema_6');
    for (const l of db.prepare('SELECT l.id,p.name product,p.code,p.uom,p.precision FROM material_request_lines l JOIN products p ON p.id=l.product_id').all()) snap('line', l.id, l);
    for (const q of db.prepare('SELECT q.id,q.line_id,v.name vendor,pc.address,pc.current_terms_id terms_id FROM supplier_quotes q JOIN vendors v ON v.id=q.vendor_id AND v.company_id=q.company_id JOIN party_companies pc ON pc.vendor_id=q.vendor_id AND pc.company_id=q.company_id').all()) snap('quote', q.id, {
      ...q,
      payment_days: null
    });
    for (const o of db.prepare('SELECT o.id,v.name vendor,pc.address,pc.current_terms_id terms_id FROM purchase_orders o JOIN vendors v ON v.id=o.vendor_id AND v.company_id=o.company_id JOIN party_companies pc ON pc.vendor_id=o.vendor_id AND pc.company_id=o.company_id').all()) snap('order', o.id, {
      ...o,
      payment_days: null
    });
    for (const r of db.prepare('SELECT r.id,v.name vendor,pc.current_terms_id terms_id FROM requests r LEFT JOIN vendors v ON v.id=r.vendor_id AND v.company_id=r.company_id LEFT JOIN party_companies pc ON pc.vendor_id=r.vendor_id AND pc.company_id=r.company_id').all()) snap('legacy_request', r.id, r);
    for (const table of ['supplier_terms', 'supplier_term_decisions', 'master_events', 'document_master_snapshots', 'quote_pack_details']) db.exec(`CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'Master evidence is append-only'); END; CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'Master evidence is append-only'); END;`);
    db.exec(`CREATE TRIGGER pack_factor_fixed BEFORE UPDATE OF product_id,name,base_quantity,supplier_code ON product_packs BEGIN SELECT RAISE(ABORT,'Create a new pack to change its definition'); END;
 CREATE TRIGGER product_unit_fixed BEFORE UPDATE OF company_id,code,uom,kind,precision ON products WHEN NEW.company_id<>OLD.company_id OR NEW.code<>OLD.code OR NEW.uom<>OLD.uom OR NEW.kind<>OLD.kind OR NEW.precision<>OLD.precision BEGIN SELECT RAISE(ABORT,'Product code, type, unit and precision are fixed'); END;
 INSERT INTO schema_versions VALUES(6); COMMIT;`);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
