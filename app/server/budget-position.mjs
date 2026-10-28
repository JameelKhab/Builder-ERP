import { D, sum, money } from './money.mjs';
export function budgetPosition(db, item) {
  const facts = db.prepare('SELECT f.*,d.title,d.kind,d.approved_by FROM budget_facts f JOIN budget_documents d ON d.id=f.document_id WHERE f.cost_item_id=? ORDER BY f.at,f.id').all(item.id);
  const total = (opening, key) => money(new D(opening).plus(sum(facts.map(f => f[key]))));
  const project = item.project_id && db.prepare('SELECT budget_status FROM projects WHERE id=?').get(item.project_id);
  return {
    original_budget: project?.budget_status === 'unapproved' ? null : total(item.original_budget, 'original_delta'),
    revised_budget: project?.budget_status === 'unapproved' ? null : total(item.revised_budget, 'budget_delta'),
    released_capacity: total(item.request_allowance, 'release_delta'),
    budget_sources: facts
  };
}
