export function installAdvanceRecovery(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=17').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE contract_finance_policies ADD COLUMN recovery_tax_mode TEXT NOT NULL DEFAULT 'unconfigured' CHECK(recovery_tax_mode IN ('unconfigured','original_tax'));
      ALTER TABLE contract_finance_policies ADD COLUMN recovery_fx_basis TEXT NOT NULL DEFAULT 'unconfigured' CHECK(recovery_fx_basis IN ('unconfigured','historical_consideration'));
      ALTER TABLE contract_finance_policies ADD COLUMN fx_gain_account TEXT REFERENCES ledger_accounts(id);
      ALTER TABLE contract_finance_policies ADD COLUMN fx_loss_account TEXT REFERENCES ledger_accounts(id);
      CREATE TRIGGER client_policy_recovery_frozen BEFORE UPDATE ON contract_finance_policies WHEN OLD.state IN ('active','superseded','cancelled') AND (NEW.recovery_tax_mode<>OLD.recovery_tax_mode OR NEW.recovery_fx_basis<>OLD.recovery_fx_basis OR NEW.fx_gain_account IS NOT OLD.fx_gain_account OR NEW.fx_loss_account IS NOT OLD.fx_loss_account) BEGIN SELECT RAISE(ABORT,'Approved recovery policy is frozen'); END;
      CREATE TABLE client_advance_recoveries(
        certificate_id TEXT NOT NULL REFERENCES client_certificates(id),invoice_id TEXT NOT NULL REFERENCES client_invoices(id),
        company_id TEXT NOT NULL REFERENCES companies(id),project_id TEXT NOT NULL,ordinal INTEGER NOT NULL,
        principal TEXT NOT NULL,tax TEXT NOT NULL,base_principal TEXT NOT NULL,base_tax TEXT NOT NULL,snapshot TEXT NOT NULL,
        actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,
        PRIMARY KEY(certificate_id,invoice_id),UNIQUE(certificate_id,ordinal),FOREIGN KEY(project_id,company_id) REFERENCES projects(id,company_id));
      CREATE TRIGGER client_recovery_source BEFORE INSERT ON client_advance_recoveries WHEN NOT EXISTS(SELECT 1 FROM client_certificates c JOIN client_invoices i ON i.id=NEW.invoice_id WHERE c.id=NEW.certificate_id AND c.state='finance' AND i.state='posted' AND i.advance_id IS NOT NULL AND i.contract_id=c.contract_id AND c.company_id=NEW.company_id AND c.project_id=NEW.project_id AND i.company_id=c.company_id AND i.project_id=c.project_id) BEGIN SELECT RAISE(ABORT,'Recovery freezes only at finance approval against a posted advance in this contract'); END;
      CREATE TRIGGER client_recovery_no_update BEFORE UPDATE ON client_advance_recoveries BEGIN SELECT RAISE(ABORT,'Certified recovery is immutable'); END;
      CREATE TRIGGER client_recovery_no_delete BEFORE DELETE ON client_advance_recoveries BEGIN SELECT RAISE(ABORT,'Recovery history must be retained'); END;
      INSERT INTO schema_versions VALUES(17);
      COMMIT;
    `);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
