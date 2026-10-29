import { policy } from './access.mjs';
import { ROLES, ROLE_BY_ID } from '../shared/access.mjs';
import { requireThat, D, money } from './money.mjs';
import { transaction } from './db.mjs';
export function accessAdmin(db, actorId) {
  const check = () => requireThat(policy(db, actorId).actor().access_admin, 'User administration is restricted.', 403);
  const snapshot = id => ({
    user: db.prepare('SELECT * FROM users WHERE id=?').get(id),
    grants: db.prepare('SELECT * FROM memberships WHERE user_id=? ORDER BY company_id,project_id').all(id)
  });
  return {
    list: () => {
      check();
      return {
        users: db.prepare('SELECT * FROM users ORDER BY name').all().map(u => snapshot(u.id)),
        roles: ROLES,
        companies: db.prepare('SELECT * FROM companies').all(),
        projects: db.prepare('SELECT * FROM projects').all(),
        events: db.prepare('SELECT e.*,u.name actor,v.name subject FROM access_events e JOIN users u ON u.id=e.actor_id JOIN users v ON v.id=e.user_id ORDER BY e.id DESC LIMIT 50').all()
      };
    },
    save: (id, input) => transaction(db, () => {
      check();
      const before = snapshot(id);
      requireThat(before.user, 'User is not available.', 404);
      requireThat(id !== actorId, 'You cannot change your own access. Another administrator must review it.', 403);
      requireThat(!(before.user.access_admin || before.user.organisation_admin) || input.active === true, 'Remove administrative authority through its separate review before disabling this account.', 403);
      requireThat(input.version === before.user.access_version, 'Access changed. Reload before reviewing again.', 409);
      requireThat(typeof input.reason === 'string' && input.reason.trim().length >= 10 && input.reason.length <= 1000, 'Explain the access change in at least 10 characters.');
      requireThat(typeof input.active === 'boolean', 'Choose an account status.');
      requireThat(Array.isArray(input.grants) && input.grants.length <= 30, 'Provide up to 30 access grants.');
      const seen = new Set();
      const grants = input.grants.map(g => {
        const role = ROLE_BY_ID[g.role_id];
        requireThat(role?.available, 'Choose an available reviewed role.');
        requireThat(db.prepare('SELECT id FROM companies WHERE id=?').get(g.company_id), 'Company is not available.');
        requireThat(g.project_id === '*' || db.prepare('SELECT id FROM projects WHERE id=? AND company_id=?').get(g.project_id, g.company_id), 'Project must belong to the selected company.');
        const key = g.company_id + ':' + g.project_id;
        requireThat(!seen.has(key), 'Use one reviewed role per company/project scope.');
        seen.add(key);
        requireThat(typeof g.approval_limit === 'string' && /^\d{1,12}(\.\d{1,2})?$/.test(g.approval_limit), 'Approval limit must be a non-negative amount, with up to two decimals.');
        const limit = money(g.approval_limit);
        requireThat(new D(limit).isZero() || role.capabilities.includes('requests.approve'), 'This role cannot approve requests. Set its limit to zero.');
        const budgetLimit = g.budget_approval_limit ?? '0.00';
        requireThat(typeof budgetLimit === 'string' && /^\d{1,12}(\.\d{1,2})?$/.test(budgetLimit), 'Budget authority must be a non-negative amount with at most two decimals.');
        requireThat(new D(budgetLimit).isZero() || role.capabilities.includes('budgets.approve'), 'This role cannot approve budgets. Set budget authority to zero.');
        const ledgerLimit = g.ledger_approval_limit ?? '0.00';
        requireThat(typeof ledgerLimit === 'string' && /^\d{1,12}(\.\d{1,2})?$/.test(ledgerLimit), 'Journal authority must be a non-negative amount with at most two decimals.');
        requireThat(new D(ledgerLimit).isZero() || role.capabilities.includes('ledger.post'), 'This role cannot post journals. Set journal authority to zero.');
        return {
          ledger_approval_limit: money(ledgerLimit),
          budget_approval_limit: money(budgetLimit),
          user_id: id,
          company_id: g.company_id,
          project_id: g.project_id,
          role_id: g.role_id,
          can_approve: new D(limit).gt(0) ? 1 : 0,
          approval_limit: limit
        };
      });
      db.prepare('DELETE FROM memberships WHERE user_id=?').run(id);
      for (const g of grants) db.prepare('INSERT INTO memberships(user_id,company_id,project_id,role_id,can_approve,approval_limit,budget_approval_limit,ledger_approval_limit) VALUES(?,?,?,?,?,?,?,?)').run(g.user_id, g.company_id, g.project_id, g.role_id, g.can_approve, g.approval_limit, g.budget_approval_limit, g.ledger_approval_limit);
      db.prepare('UPDATE users SET active=?,access_version=access_version+1 WHERE id=?').run(input.active ? 1 : 0, id);
      const after = snapshot(id);
      db.prepare('INSERT INTO access_events(actor_id,user_id,before_json,after_json,reason,at) VALUES(?,?,?,?,?,?)').run(actorId, id, JSON.stringify(before), JSON.stringify(after), input.reason.trim(), new Date().toISOString());
      return after;
    })
  };
}
