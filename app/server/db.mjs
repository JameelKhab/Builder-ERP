import { installReceipts } from './receipts-schema.mjs';
import { installReceiptExamples } from './receipts-examples.mjs';
import { installCertificateExamples } from './certificates-examples.mjs';
import { installCertificates } from './certificates-schema.mjs';
import { installCommercialExamples } from './commercial-examples.mjs';
import { installCommercial } from './commercial-schema.mjs';
import { installBoqIntake } from './boq-intake-schema.mjs';
import { installBoqExamples } from './boq-intake-examples.mjs';
import { installEstimateExamples } from './estimates-examples.mjs';
import { installEstimates } from './estimates-schema.mjs';
import { installPaymentExamples } from './payments-examples.mjs';
import { installPayments } from './payments-schema.mjs';
import { installPayableExamples } from './payables-examples.mjs';
import { installPayables } from './payables-schema.mjs';
import { installLedger } from './ledger-schema.mjs';
import { installLedgerExamples } from './ledger-examples.mjs';
import { installQualityExamples } from './quality-examples.mjs';
import { installQuality } from './quality-schema.mjs';
import { installMasterExamples } from './masters-examples.mjs';
import { installMasters } from './masters-schema.mjs';
import { installIdentity } from './identity-schema.mjs';
import { installFoundationExamples } from './foundations-examples.mjs';
import { installFoundations } from './foundations-schema.mjs';
import { DatabaseSync } from 'node:sqlite';
import { installProcurementExamples } from './procurement-examples.mjs';
import { installProcurement } from './procurement-schema.mjs';
import { seed } from './seed.mjs';
import { installAccess } from './access.mjs';
import { installExamples } from './examples.mjs';
export function openDatabase(path = ':memory:', {
  examples = false
} = {}) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, currency TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), name TEXT NOT NULL, code TEXT NOT NULL, location TEXT NOT NULL, phase TEXT NOT NULL, UNIQUE(id,company_id));
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS memberships (user_id TEXT NOT NULL REFERENCES users(id), company_id TEXT NOT NULL REFERENCES companies(id), project_id TEXT NOT NULL, can_approve INTEGER NOT NULL DEFAULT 0, approval_limit TEXT NOT NULL DEFAULT '0', PRIMARY KEY(user_id,company_id,project_id));
    CREATE TABLE IF NOT EXISTS vendors (id TEXT NOT NULL, company_id TEXT NOT NULL REFERENCES companies(id), name TEXT NOT NULL, currency TEXT NOT NULL, unit_price TEXT NOT NULL, rate TEXT NOT NULL, rate_date TEXT NOT NULL, valid_until TEXT NOT NULL, quote TEXT NOT NULL, PRIMARY KEY(id,company_id));
    CREATE TABLE IF NOT EXISTS cost_items (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), project_id TEXT, name TEXT NOT NULL, location TEXT NOT NULL, original_budget TEXT NOT NULL, revised_budget TEXT NOT NULL, committed TEXT NOT NULL, incurred TEXT NOT NULL, cash TEXT NOT NULL, forecast TEXT, request_allowance TEXT NOT NULL, source TEXT NOT NULL, FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
    CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), project_id TEXT NOT NULL, item_id TEXT NOT NULL REFERENCES cost_items(id), title TEXT NOT NULL, location TEXT NOT NULL, due TEXT NOT NULL, requester_id TEXT NOT NULL REFERENCES users(id), owner TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','submitted','approved','returned')), version INTEGER NOT NULL DEFAULT 1, vendor_id TEXT, quantity TEXT NOT NULL, unit TEXT NOT NULL, unit_price TEXT NOT NULL, currency TEXT NOT NULL, amount TEXT NOT NULL, company_amount TEXT NOT NULL, rate TEXT NOT NULL, rate_date TEXT NOT NULL, rate_source TEXT NOT NULL, quote TEXT, created_at TEXT NOT NULL, FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id), FOREIGN KEY(vendor_id,company_id) REFERENCES vendors(id,company_id));
    CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL REFERENCES requests(id), actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, version INTEGER NOT NULL, note TEXT NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), project_id TEXT, area TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, location TEXT NOT NULL, owner TEXT NOT NULL, due TEXT, status TEXT NOT NULL, next_action TEXT NOT NULL, details TEXT NOT NULL, FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
    CREATE INDEX IF NOT EXISTS request_scope ON requests(company_id,project_id,status);
    CREATE INDEX IF NOT EXISTS record_scope ON records(company_id,project_id,area);
    CREATE TRIGGER IF NOT EXISTS no_event_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'History is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS no_event_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'History is append-only'); END;
    INSERT OR IGNORE INTO schema_versions VALUES(1);
  `);
  if (!db.prepare('SELECT id FROM companies LIMIT 1').get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      seed(db);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  if (examples) installExamples(db);
  installAccess(db);
  installProcurement(db);
  installFoundations(db);
  installIdentity(db);
  installMasters(db);
  installQuality(db);
  installLedger(db);
  installPayables(db);
  installPayments(db);
  installEstimates(db);
  installBoqIntake(db);
  installCommercial(db);
  installCertificates(db);
  installReceipts(db);
  if (examples) {
    installProcurementExamples(db);
    installFoundationExamples(db);
    installMasterExamples(db);
    installQualityExamples(db);
    installLedgerExamples(db);
    installPayableExamples(db);
    installPaymentExamples(db);
    installEstimateExamples(db);
    installBoqExamples(db);
    installCommercialExamples(db);
    installCertificateExamples(db);
    installReceiptExamples(db);
  }
  return db;
}
const transactionDepth = new WeakMap();
export function transaction(db, fn) {
  const depth = transactionDepth.get(db) || 0,
    savepoint = `builder_nested_${depth}`;
  db.exec(depth ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
  transactionDepth.set(db, depth + 1);
  try {
    const result = fn();
    db.exec(depth ? `RELEASE SAVEPOINT ${savepoint}` : 'COMMIT');
    return result;
  } catch (error) {
    db.exec(depth ? `ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}` : 'ROLLBACK');
    throw error;
  } finally {
    transactionDepth.set(db, depth);
  }
}
