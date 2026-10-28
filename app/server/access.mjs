import { ROLE_BY_ID, CATEGORY_CAPABILITY } from '../shared/access.mjs';
import { requireThat, D, money } from './money.mjs';
export function installAccess(db) {
  if (db.prepare('SELECT version FROM schema_versions WHERE version=2').get()) return;
  try {
    db.exec(`BEGIN IMMEDIATE;
    ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1));
    ALTER TABLE users ADD COLUMN access_version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE users ADD COLUMN access_admin INTEGER NOT NULL DEFAULT 0 CHECK(access_admin IN (0,1));
    ALTER TABLE memberships ADD COLUMN role_id TEXT NOT NULL DEFAULT 'none';
    CREATE TABLE access_events(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT NOT NULL REFERENCES users(id),user_id TEXT NOT NULL REFERENCES users(id),before_json TEXT NOT NULL,after_json TEXT NOT NULL,reason TEXT NOT NULL,at TEXT NOT NULL);
    CREATE TRIGGER no_access_update BEFORE UPDATE ON access_events BEGIN SELECT RAISE(ABORT,'Access history is append-only'); END;
    CREATE TRIGGER no_access_delete BEFORE DELETE ON access_events BEGIN SELECT RAISE(ABORT,'Access history is append-only'); END;
    UPDATE memberships SET role_id=CASE (SELECT lower(role) FROM users WHERE users.id=memberships.user_id) WHEN 'project manager' THEN 'project_manager' WHEN 'site engineer' THEN 'site_engineer' WHEN 'commercial manager' THEN 'commercial_manager' ELSE 'none' END;
    UPDATE users SET access_admin=1 WHERE id='ahmed';
    INSERT INTO schema_versions VALUES(2);
    COMMIT;`);
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw error;
  }
}
export function policy(db, actorId) {
  const actor = () => {
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(actorId);
    requireThat(u?.active, 'This account is unavailable.', 401);
    return u;
  };
  const grants = () => {
    actor();
    return db.prepare('SELECT * FROM memberships WHERE user_id=?').all(actorId);
  };
  const matching = (company, project, aggregate = false) => grants().filter(m => m.company_id === company && (aggregate || m.project_id === '*' || project && m.project_id === project));
  const has = (cap, company, project, aggregate = false) => matching(company, project, aggregate).some(m => ROLE_BY_ID[m.role_id]?.available && ROLE_BY_ID[m.role_id].capabilities.includes(cap));
  const caps = (company, project, aggregate = false) => [...new Set(matching(company, project, aggregate).flatMap(m => ROLE_BY_ID[m.role_id]?.available ? ROLE_BY_ID[m.role_id].capabilities : []))];
  const requireCap = (cap, company, project, aggregate = false) => requireThat(has(cap, company, project, aggregate), 'Your role does not permit this action.', 403);
  const record = r => Boolean(r && has(CATEGORY_CAPABILITY[r.category], r.company_id, r.project_id));
  const approvalLimit = (company, project) => matching(company, project).filter(m => m.can_approve && ROLE_BY_ID[m.role_id]?.capabilities.includes('requests.approve')).reduce((n, m) => new D(m.approval_limit).gt(n) ? money(m.approval_limit) : n, '0.00');
  const budgetApprovalLimit = (company, project) => matching(company, project).filter(m => ROLE_BY_ID[m.role_id]?.capabilities.includes('budgets.approve')).reduce((n, m) => new D(m.budget_approval_limit || '0').gt(n) ? money(m.budget_approval_limit) : n, '0.00');
  return {
    budgetApprovalLimit,
    actor,
    grants,
    matching,
    has,
    caps,
    requireCap,
    record,
    approvalLimit
  };
}
// Explicit allowlist for unpriced operational sample details. Unknown fields remain private.
const SAFE_FIELDS = new Set(['Baseline', 'Current forecast', 'Constraint', 'Responsibility', 'Mitigation', 'Resolution', 'Effect', 'Schedule control', 'Definition', 'Population', 'Period', 'Main observation', 'Follow-up', 'Cutoff', 'Aggregation', 'Work completed', 'People & plant', 'Weather', 'Material use', 'Blocker', 'Evidence', 'Resources', 'Review', 'Safety', 'Requirement', 'Observation', 'Containment', 'Cause & disposition', 'Remedy', 'Acceptance', 'Correction', 'Verification', 'Reopening', 'Quantity balance', 'Reuse', 'Disposal', 'Origin', 'Condition', 'Movement', 'Asset', 'Meter', 'Use', 'Availability', 'Hire period', 'Custody', 'Control', 'Document', 'Change', 'Revision history', 'Distribution', 'Superseded by', 'Question', 'Reason', 'Requested response', 'Commercial link', 'Response', 'Closure', 'Location', 'Defect', 'Assignment', 'Evidence needed', 'Rectification', 'Boundary', 'System', 'Prerequisites', 'Test', 'Witness', 'Handover', 'Test record', 'Outstanding pack']);
export function safeDetails(details, priced) {
  if (priced) return details;
  return Object.fromEntries(Object.entries(details).filter(([k]) => SAFE_FIELDS.has(k)));
}
