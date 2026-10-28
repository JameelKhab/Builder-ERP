import { randomUUID, createHash } from 'node:crypto';
import { transaction } from './db.mjs';
import { policy } from './access.mjs';
import { D, requireThat, money, sum } from './money.mjs';
import { costPosition, sourcingAvailable } from './cost-ledger.mjs';
import { budgetPosition } from './budget-position.mjs';
const id = prefix => `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
const text = (v, label, max = 160) => {
  requireThat(typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max, `${label} is required (up to ${max} characters).`);
  return v.trim();
};
const optional = (v, label, max = 160) => v ? text(v, label, max) : '';
const code = v => {
  const c = text(v, 'Code', 30).toUpperCase();
  requireThat(/^[A-Z0-9][A-Z0-9._-]*$/.test(c), 'Use letters, numbers, full stops, hyphens or underscores for a code.');
  return c;
};
const amount = v => {
  requireThat(typeof v === 'string' && /^\d{1,12}(\.\d{1,2})?$/.test(v), 'Amounts must be non-negative with at most two decimals.');
  return money(v);
};
const date = v => {
  requireThat(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Use a valid date.');
  return v;
};
const currencies = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'QAR'];
const phases = ['Setup', 'Mobilisation', 'Delivery'];
function hierarchy(rows) {
  const ordered = [],
    seen = new Set();
  const visit = (parent, depth) => {
    for (const row of rows.filter(r => r.parent_id === parent)) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      ordered.push({
        ...row,
        depth
      });
      visit(row.id, depth + 1);
    }
  };
  visit(null, 0);
  for (const row of rows) if (!seen.has(row.id)) ordered.push({
    ...row,
    depth: 0
  });
  return ordered;
}
export function foundations(db, actorId, today = () => new Date().toISOString().slice(0, 10)) {
  const access = policy(db, actorId),
    now = () => new Date().toISOString();
  const org = () => requireThat(access.actor().organisation_admin, 'Organisation administration is restricted.', 403);
  const project = (pid, cap = 'projects.read') => {
    const p = db.prepare('SELECT * FROM projects WHERE id=?').get(pid);
    requireThat(p && access.has(cap, p.company_id, p.id), 'Project is not available for this action.', 404);
    return p;
  };
  const event = (company, pid, type, key, action, version, before, after, reason) => db.prepare('INSERT INTO foundation_events(company_id,project_id,entity_type,entity_id,actor_id,action,version,before_json,after_json,reason,at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(company, pid, type, key, actorId, action, version, before ? JSON.stringify(before) : null, JSON.stringify(after), reason, now());
  const revision = (input, row) => requireThat(input.version === row.version, 'This record changed. Reload before continuing.', 409);
  const history = (type, key) => db.prepare('SELECT e.*,u.name actor FROM foundation_events e JOIN users u ON u.id=e.actor_id WHERE entity_type=? AND entity_id=? ORDER BY e.id').all(type, key);
  const safeProject = p => ({
    ...p,
    manager_name: p.manager_id ? db.prepare('SELECT name FROM users WHERE id=?').get(p.manager_id)?.name : null,
    can_manage: access.has('projects.manage', p.company_id, p.id),
    can_locations: access.has('locations.write', p.company_id, p.id),
    can_wbs: access.has('wbs.write', p.company_id, p.id),
    can_budget: access.has('cost.read', p.company_id, p.id),
    can_prepare_budget: access.has('budgets.write', p.company_id, p.id)
  });
  const managers = (c, pid = null) => db.prepare("SELECT DISTINCT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.company_id=? AND u.active=1 ORDER BY u.name").all(c).filter(u => policy(db, u.id).has('projects.manage', c, pid));
  const locations = pid => hierarchy(db.prepare('SELECT * FROM project_locations WHERE project_id=? ORDER BY code').all(pid));
  const packages = pid => {
    const p = project(pid),
      priced = access.has('cost.read', p.company_id, pid);
    const rows = hierarchy(db.prepare('SELECT w.*,c.code cost_code,c.name cost_code_name FROM work_packages w LEFT JOIN cost_codes c ON c.id=w.cost_code_id WHERE w.project_id=? ORDER BY w.code').all(pid));
    const leafPosition = w => {
      const item = db.prepare('SELECT * FROM cost_items WHERE id=?').get(w.cost_item_id);
      return {
        ...costPosition(db, item),
        available: money(sourcingAvailable(db, item.id))
      };
    };
    return rows.map(w => {
      if (!priced) return {
        ...w,
        cost_item_id: undefined
      };
      if (w.kind === 'item') return {
        ...w,
        position: leafPosition(w)
      };
      const descendants = new Set([w.id]);
      let last;
      do {
        last = descendants.size;
        for (const x of rows) if (descendants.has(x.parent_id)) descendants.add(x.id);
      } while (last !== descendants.size);
      const children = rows.filter(x => x.kind === 'item' && descendants.has(x.id)).map(leafPosition);
      const position = {};
      for (const k of ['original_budget', 'revised_budget', 'released_capacity', 'available', 'committed', 'incurred', 'cash', 'forecast']) position[k] = children.some(x => x[k] === null) ? null : money(sum(children.map(x => x[k])));
      return {
        ...w,
        position,
        rollup: true
      };
    });
  };
  const budgetRows = key => db.prepare('SELECT l.*,w.name,w.code FROM budget_lines l JOIN work_packages w ON w.id=l.work_package_id WHERE document_id=? ORDER BY l.rowid').all(key);
  const snapshot = w => {
    const item = db.prepare('SELECT * FROM cost_items WHERE id=?').get(w.cost_item_id);
    const b = budgetPosition(db, item);
    return {
      original_budget: b.original_budget,
      revised_budget: b.revised_budget,
      released_capacity: b.released_capacity
    };
  };
  const digest = (doc, lines) => createHash('sha256').update(JSON.stringify({
    id: doc.id,
    company: doc.company_id,
    project: doc.project_id,
    kind: doc.kind,
    title: doc.title,
    basis: doc.basis,
    base_revision: doc.base_revision,
    lines: lines.map(l => ({
      id: l.id,
      work: l.work_package_id,
      budget: l.proposed_budget,
      release: l.proposed_release,
      snapshot: l.snapshot_json,
      note: l.note
    }))
  })).digest('hex');
  const authority = lines => money(sum(lines.map(l => {
    const before = JSON.parse(l.snapshot_json);
    const a = new D(l.proposed_budget).minus(before.revised_budget || 0).abs(),
      b = new D(l.proposed_release).minus(before.released_capacity).abs();
    return a.gt(b) ? a : b;
  })));
  const budgetDetail = key => {
    const d = db.prepare('SELECT d.*,u.name author,a.name approver,c.currency FROM budget_documents d JOIN users u ON u.id=d.author_id JOIN companies c ON c.id=d.company_id LEFT JOIN users a ON a.id=d.approved_by WHERE d.id=?').get(key);
    requireThat(d && access.has('cost.read', d.company_id, d.project_id), 'Budget document is not available.', 404);
    const lines = budgetRows(key),
      limit = access.budgetApprovalLimit(d.company_id, d.project_id);
    return {
      ...d,
      lines: lines.map(l => ({
        ...l,
        snapshot: JSON.parse(l.snapshot_json)
      })),
      approval_amount: authority(lines),
      approval_limit: limit,
      can_cancel: access.has('budgets.write', d.company_id, d.project_id) && d.author_id === actorId && ['draft', 'returned', 'submitted'].includes(d.state),
      can_edit: access.has('budgets.write', d.company_id, d.project_id) && d.author_id === actorId && ['draft', 'returned'].includes(d.state),
      can_review: d.state === 'submitted' && d.author_id !== actorId && new D(limit).gt(0) && new D(limit).gte(authority(lines)),
      history: history('budget', key)
    };
  };
  const validateLines = (p, kind, input) => {
    requireThat(Array.isArray(input) && input.length > 0 && input.length <= 100, 'Provide between 1 and 100 work-item budgets.');
    const seen = new Set();
    const lines = input.map(l => {
      const w = db.prepare("SELECT * FROM work_packages WHERE id=? AND project_id=? AND company_id=? AND kind='item'").get(l.work_package_id, p.id, p.company_id);
      requireThat(w, 'Choose an item in this project; group budgets are calculated from their children.');
      requireThat(!seen.has(w.id), 'Each work item can appear once.');
      seen.add(w.id);
      const b = amount(l.proposed_budget),
        r = amount(l.proposed_release);
      requireThat(new D(r).lte(b), 'Released capacity cannot exceed proposed budget.');
      return {
        id: id('BL'),
        work_package_id: w.id,
        proposed_budget: b,
        proposed_release: r,
        note: optional(l.note, 'Line basis', 500),
        snapshot_json: JSON.stringify(snapshot(w))
      };
    });
    if (kind === 'baseline') {
      requireThat(p.budget_status === 'unapproved', 'An original baseline already exists. Use a revision.');
      const all = db.prepare("SELECT id FROM work_packages WHERE project_id=? AND kind='item'").all(p.id);
      requireThat(all.length === seen.size && all.every(w => seen.has(w.id)), 'The original baseline must include every work item.');
    } else requireThat(p.budget_status !== 'unapproved', 'Approve the original project baseline before creating revisions.');
    return lines;
  };
  const checkTargets = (d, lines) => {
    const p = project(d.project_id, 'cost.read');
    requireThat(p.budget_revision === d.base_revision, 'Another budget or work item changed this project. Return and refresh this proposal before approval.', 409);
    for (const l of lines) {
      const w = db.prepare('SELECT * FROM work_packages WHERE id=?').get(l.work_package_id),
        item = db.prepare('SELECT * FROM cost_items WHERE id=?').get(w.cost_item_id),
        s = snapshot(w),
        pos = costPosition(db, item);
      requireThat(JSON.stringify(s) === l.snapshot_json, 'Budget balances changed. Return and refresh this proposal.', 409);
      requireThat(new D(l.proposed_budget).gte(pos.committed) && new D(l.proposed_budget).gte(pos.incurred), 'Proposed budget cannot fall below committed or incurred cost.');
      const held = new D(s.released_capacity).minus(sourcingAvailable(db, item.id));
      requireThat(new D(l.proposed_release).gte(held), 'Released capacity cannot fall below approved reservations and issued commitments.');
      // Opening commitments are already outside the explicitly free opening allowance.
      requireThat(new D(l.proposed_release).plus(new D(item.committed).gt(item.incurred) ? item.committed : item.incurred).lte(l.proposed_budget), 'Released capacity plus opening commitments or incurred cost cannot exceed proposed budget.');
    }
  };
  return {
    organisation: () => {
      org();
      return {
        companies: db.prepare('SELECT * FROM companies ORDER BY name').all(),
        currencies: currencies.filter(c => c !== 'OMR'),
        history: db.prepare("SELECT e.*,u.name actor FROM foundation_events e JOIN users u ON u.id=e.actor_id WHERE entity_type='company' ORDER BY e.id DESC").all()
      };
    },
    saveCompany: (key, input) => transaction(db, () => {
      org();
      const before = key ? db.prepare('SELECT * FROM companies WHERE id=?').get(key) : null;
      if (key) {
        requireThat(before, 'Company not found.', 404);
        revision(input, before);
        requireThat(!input.currency || input.currency === before.currency, 'Functional currency is fixed. Create a distinct legal company for another currency.');
      }
      const currency = before?.currency || input.currency;
      requireThat(currencies.includes(currency) && currency !== 'OMR', 'Choose a supported two-decimal functional currency.');
      const companyId = key || id('CO');
      const row = {
        id: companyId,
        name: text(input.name, 'Display name'),
        legal_name: text(input.legal_name, 'Legal name'),
        currency,
        registration: optional(input.registration, 'Registration', 80),
        country_code: optional(input.country_code, 'Country code', 2).toUpperCase(),
        version: (before?.version || 0) + 1
      };
      requireThat(!row.country_code || /^[A-Z]{2}$/.test(row.country_code), 'Use a two-letter country code.');
      if (before) db.prepare('UPDATE companies SET name=?,legal_name=?,registration=?,country_code=?,version=? WHERE id=?').run(row.name, row.legal_name, row.registration, row.country_code, row.version, key);else {
        db.prepare('INSERT INTO companies(id,name,currency,legal_name,registration,country_code,version) VALUES(?,?,?,?,?,?,?)').run(row.id, row.name, row.currency, row.legal_name, row.registration, row.country_code, row.version);
        db.prepare('INSERT INTO cost_codes VALUES(?,?,?,?)').run(`${row.id}-GENERAL`, row.id, 'GENERAL', 'General construction');
      }
      event(companyId, null, 'company', companyId, before ? 'updated' : 'created', row.version, before, row, text(input.reason, 'Reason', 1000));
      return row;
    }),
    workspace: (company, pid = null) => {
      requireThat(db.prepare('SELECT id FROM companies WHERE id=?').get(company) && access.has('projects.read', company, pid, !pid), 'Project workspace is not available.', 404);
      if (pid) project(pid);
      const ps = db.prepare('SELECT * FROM projects WHERE company_id=? ORDER BY name').all(company).filter(p => (!pid || p.id === pid) && access.has('projects.read', company, p.id));
      const docs = db.prepare('SELECT * FROM budget_documents WHERE company_id=? ORDER BY created_at DESC,id').all(company).filter(d => (!pid || d.project_id === pid) && access.has('cost.read', company, d.project_id)).map(d => budgetDetail(d.id));
      return {
        projects: ps.map(safeProject),
        locations: ps.flatMap(p => locations(p.id)),
        packages: ps.flatMap(p => packages(p.id)),
        budgets: docs,
        managers: access.has('projects.manage', company, pid, !pid) ? [...new Map([...managers(company), ...ps.filter(p => access.has('projects.manage', company, p.id)).flatMap(p => managers(company, p.id))].map(u => [u.id, u])).values()] : [],
        cost_codes: access.has('wbs.write', company, pid, !pid) ? db.prepare('SELECT * FROM cost_codes WHERE company_id=? ORDER BY code').all(company) : [],
        can_create_project: access.has('projects.manage', company, null),
        can_create_cost_code: access.has('wbs.write', company, null),
        findings: [`${ps.length} authorised project${ps.length === 1 ? '' : 's'} in this view.`, `${ps.filter(p => p.budget_status === 'unapproved').length} project${ps.filter(p => p.budget_status === 'unapproved').length === 1 ? ' requires' : 's require'} an original budget approval.`, `${docs.filter(d => d.state === 'submitted').length} budget proposal${docs.filter(d => d.state === 'submitted').length === 1 ? ' is' : 's are'} awaiting independent review.`]
      };
    },
    saveProject: (key, input) => transaction(db, () => {
      const before = key ? project(key, 'projects.manage') : null;
      const company = before?.company_id || input.company_id;
      if (!before) access.requireCap('projects.manage', company, null);else revision(input, before);
      requireThat(!input.company_id || input.company_id === company, 'The project legal company cannot change.');
      const start = date(input.planned_start),
        end = date(input.planned_end);
      requireThat(end >= start, 'End date cannot be before the start date.');
      const manager = text(input.manager_id, 'Project manager');
      requireThat(managers(company, key || null).some(u => u.id === manager), 'Manager must have active project-management access to this company or project.');
      const c = code(input.code);
      requireThat(!db.prepare('SELECT id FROM projects WHERE company_id=? AND code=? AND id<>?').get(company, c, key || ''), 'This company already uses that project code.');
      const phase = before ? input.phase : 'Setup';
      requireThat(phases.includes(phase), 'Choose setup, mobilisation or delivery. Handover and closure require their own controls.');
      const row = {
        id: key || id('PRJ'),
        company_id: company,
        name: text(input.name, 'Project name'),
        code: c,
        location: text(input.location, 'Site location'),
        phase,
        manager_id: manager,
        customer_reference: optional(input.customer_reference, 'Customer reference'),
        planned_start: start,
        planned_end: end,
        description: optional(input.description, 'Description', 3000),
        provenance: before?.provenance || text(input.provenance, 'Award / setup basis', 500),
        version: (before?.version || 0) + 1
      };
      if (before) db.prepare('UPDATE projects SET name=?,code=?,location=?,phase=?,manager_id=?,customer_reference=?,planned_start=?,planned_end=?,description=?,version=? WHERE id=?').run(row.name, row.code, row.location, row.phase, row.manager_id, row.customer_reference, start, end, row.description, row.version, key);else {
        db.prepare("INSERT INTO projects(id,company_id,name,code,location,phase,manager_id,customer_reference,planned_start,planned_end,description,provenance,version,budget_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'unapproved')").run(row.id, company, row.name, c, row.location, row.phase, manager, row.customer_reference, start, end, row.description, row.provenance, 1);
        db.prepare('INSERT INTO project_locations(id,company_id,project_id,parent_id,code,name,kind) VALUES(?,?,?,NULL,?,?,?)').run(id('LOC'), company, row.id, 'SITE', 'Main site', 'site');
      }
      const after = db.prepare('SELECT * FROM projects WHERE id=?').get(row.id);
      event(company, row.id, 'project', row.id, before ? 'updated' : 'created', row.version, before, after, text(input.reason, 'Reason', 1000));
      return safeProject(after);
    }),
    saveLocation: (key, input) => transaction(db, () => {
      const before = key ? db.prepare('SELECT * FROM project_locations WHERE id=?').get(key) : null;
      requireThat(!key || before, 'Location not found.', 404);
      const p = project(before?.project_id || input.project_id, 'locations.write');
      if (before) revision(input, before);
      const parent = input.parent_id || null;
      const all = locations(p.id);
      requireThat(!parent || all.some(l => l.id === parent), 'Parent location must belong to this project.');
      let current = parent;
      const visited = new Set();
      while (current) {
        requireThat(current !== key && !visited.has(current), 'A location cannot be its own ancestor.');
        visited.add(current);
        current = all.find(l => l.id === current)?.parent_id;
      }
      const kind = input.kind;
      requireThat(['site', 'building', 'floor', 'unit', 'zone', 'system'].includes(kind), 'Choose a location type.');
      const c = code(input.code);
      requireThat(!all.some(l => l.code === c && l.id !== key), 'This project already uses that location code.');
      const row = {
        id: key || id('LOC'),
        company_id: p.company_id,
        project_id: p.id,
        parent_id: parent,
        code: c,
        name: text(input.name, 'Location name'),
        kind,
        version: (before?.version || 0) + 1
      };
      if (before) db.prepare('UPDATE project_locations SET parent_id=?,code=?,name=?,kind=?,version=? WHERE id=?').run(parent, c, row.name, kind, row.version, key);else db.prepare('INSERT INTO project_locations(id,company_id,project_id,parent_id,code,name,kind) VALUES(?,?,?,?,?,?,?)').run(row.id, p.company_id, p.id, parent, c, row.name, kind);
      event(p.company_id, p.id, 'location', row.id, before ? 'updated' : 'created', row.version, before, row, text(input.reason, 'Reason', 1000));
      return row;
    }),
    addCostCode: input => transaction(db, () => {
      access.requireCap('wbs.write', input.company_id, null);
      const c = code(input.code);
      requireThat(!db.prepare('SELECT id FROM cost_codes WHERE company_id=? AND code=?').get(input.company_id, c), 'Cost code already exists.');
      const row = {
        id: id('CC'),
        company_id: input.company_id,
        code: c,
        name: text(input.name, 'Cost code name')
      };
      db.prepare('INSERT INTO cost_codes VALUES(?,?,?,?)').run(row.id, row.company_id, row.code, row.name);
      event(row.company_id, null, 'cost_code', row.id, 'created', 1, null, row, text(input.reason, 'Reason', 1000));
      return row;
    }),
    savePackage: (key, input) => transaction(db, () => {
      const before = key ? db.prepare('SELECT * FROM work_packages WHERE id=?').get(key) : null;
      requireThat(!key || before, 'Work package not found.', 404);
      const p = project(before?.project_id || input.project_id, 'wbs.write');
      if (before) revision(input, before);
      const all = db.prepare('SELECT * FROM work_packages WHERE project_id=?').all(p.id);
      const parent = input.parent_id || null;
      requireThat(!parent || all.some(w => w.id === parent && w.kind === 'group'), 'Parent must be a group in this project.');
      let cur = parent;
      const visited = new Set();
      while (cur) {
        requireThat(cur !== key && !visited.has(cur), 'A work package cannot be its own ancestor.');
        visited.add(cur);
        cur = all.find(w => w.id === cur)?.parent_id;
      }
      const kind = before?.kind || input.kind;
      requireThat(['item', 'group'].includes(kind) && (!before || !input.kind || input.kind === before.kind), 'Work item/group type cannot change after creation.');
      const cc = input.cost_code_id;
      requireThat(db.prepare('SELECT id FROM cost_codes WHERE id=? AND company_id=?').get(cc, p.company_id), 'Select a company cost code.');
      const c = code(input.code);
      requireThat(!all.some(w => w.code === c && w.id !== key), 'Work code already exists in this project.');
      const row = {
        id: key || id('WBS'),
        company_id: p.company_id,
        project_id: p.id,
        parent_id: parent,
        code: c,
        name: text(input.name, 'Work name'),
        kind,
        cost_code_id: cc,
        cost_item_id: before?.cost_item_id || id('COST'),
        version: (before?.version || 0) + 1,
        release_state: before?.release_state || 'draft'
      };
      if (before) {
        db.prepare('UPDATE work_packages SET parent_id=?,code=?,name=?,cost_code_id=?,version=? WHERE id=?').run(parent, c, row.name, cc, row.version, key);
        db.prepare('UPDATE cost_items SET name=? WHERE id=?').run(row.name, row.cost_item_id);
      } else {
        db.prepare("INSERT INTO cost_items(id,company_id,project_id,name,location,original_budget,revised_budget,committed,incurred,cash,forecast,request_allowance,source) VALUES(?,?,?,?,?,'0','0','0','0','0',NULL,'0',?)").run(row.cost_item_id, p.company_id, p.id, row.name, p.location, 'New work item; no approved allocation');
        db.prepare('INSERT INTO work_packages(id,company_id,project_id,parent_id,code,name,cost_item_id,release_state,kind,cost_code_id) VALUES(?,?,?,?,?,?,?,?,?,?)').run(row.id, p.company_id, p.id, parent, c, row.name, row.cost_item_id, 'draft', kind, cc);
        db.prepare('UPDATE projects SET budget_revision=budget_revision+1 WHERE id=?').run(p.id);
      }
      event(p.company_id, p.id, 'work_package', row.id, before ? 'updated' : 'created', row.version, before, row, text(input.reason, 'Reason', 1000));
      return row;
    }),
    budgetDetail,
    saveBudget: (key, input) => transaction(db, () => {
      const before = key ? budgetDetail(key) : null;
      const p = project(before?.project_id || input.project_id, 'budgets.write');
      if (before) {
        revision(input, before);
        requireThat(before.can_edit, 'Only the author can change a draft or returned budget.', 403);
      }
      const kind = before?.kind || input.kind;
      requireThat(['baseline', 'revision'].includes(kind), 'Choose original baseline or revision.');
      const lines = validateLines(p, kind, input.lines),
        row = {
          id: key || id('BUD'),
          company_id: p.company_id,
          project_id: p.id,
          kind,
          title: text(input.title, 'Budget title'),
          basis: text(input.basis, 'Budget basis', 3000),
          state: 'draft',
          author_id: actorId,
          version: (before?.version || 0) + 1,
          base_revision: p.budget_revision
        };
      if (before) {
        db.prepare('DELETE FROM budget_lines WHERE document_id=?').run(key);
        db.prepare("UPDATE budget_documents SET title=?,basis=?,state='draft',version=?,base_revision=?,submission_hash=NULL,submitted_at=NULL WHERE id=?").run(row.title, row.basis, row.version, row.base_revision, key);
      } else db.prepare("INSERT INTO budget_documents(id,company_id,project_id,kind,title,basis,state,author_id,version,base_revision,created_at) VALUES(?,?,?,?,?,?,'draft',?,?,?,?)").run(row.id, p.company_id, p.id, kind, row.title, row.basis, actorId, 1, p.budget_revision, now());
      for (const l of lines) db.prepare('INSERT INTO budget_lines(id,document_id,company_id,project_id,work_package_id,proposed_budget,proposed_release,note,snapshot_json) VALUES(?,?,?,?,?,?,?,?,?)').run(l.id, row.id, p.company_id, p.id, l.work_package_id, l.proposed_budget, l.proposed_release, l.note, l.snapshot_json);
      event(p.company_id, p.id, 'budget', row.id, before ? 'revised' : 'created', row.version, before ? {
        version: before.version,
        lines: before.lines,
        basis: before.basis
      } : null, {
        ...row,
        lines
      }, row.basis);
      return budgetDetail(row.id);
    }),
    decideBudget: (key, input) => transaction(db, () => {
      const d = budgetDetail(key);
      revision(input, d);
      const action = input.action,
        reason = text(input.reason, 'Decision reason', 1000),
        lines = budgetRows(key);
      let state;
      if (action === 'submit') {
        requireThat(d.can_edit, 'Only the author can submit this budget.', 403);
        requireThat(d.state === 'draft', 'Save a refreshed draft before resubmitting.');
        checkTargets(d, lines);
        state = 'submitted';
        const hash = digest(d, lines);
        db.prepare('UPDATE budget_documents SET state=?,version=version+1,submission_hash=?,submitted_at=? WHERE id=?').run(state, hash, now(), key);
      } else if (action === 'cancel') {
        requireThat(d.author_id === actorId && access.has('budgets.write', d.company_id, d.project_id) && ['draft', 'returned', 'submitted'].includes(d.state), 'Only the author can cancel an unapproved budget.', 403);
        state = 'cancelled';
        db.prepare('UPDATE budget_documents SET state=?,version=version+1 WHERE id=?').run(state, key);
      } else {
        requireThat(['approve', 'return'].includes(action), 'Choose submit, approve, return or cancel.');
        requireThat(d.state === 'submitted', 'Budget is not awaiting review.', 409);
        requireThat(d.author_id !== actorId, 'The author cannot approve or review their own budget.', 403);
        requireThat(d.can_review, 'A separate budget approval limit is required for this amount and project.', 403);
        requireThat(d.submission_hash === digest(d, lines), 'Submitted content does not match its review snapshot.', 409);
        state = action === 'approve' ? 'approved' : 'returned';
        if (action === 'approve') {
          checkTargets(d, lines);
          const p = project(d.project_id, 'cost.read');
          if (d.kind === 'baseline') requireThat(p.budget_status === 'unapproved', 'Original baseline already approved.', 409);
          const approvedAt = now();
          for (const l of lines) {
            const w = db.prepare('SELECT * FROM work_packages WHERE id=?').get(l.work_package_id),
              s = JSON.parse(l.snapshot_json);
            db.prepare('INSERT INTO budget_facts VALUES(?,?,?,?,?,?,?,?)').run(id('BF'), key, l.id, w.cost_item_id, d.kind === 'baseline' ? l.proposed_budget : '0.00', money(new D(l.proposed_budget).minus(s.revised_budget || 0)), money(new D(l.proposed_release).minus(s.released_capacity)), approvedAt);
            db.prepare("UPDATE work_packages SET release_state='released',version=version+1 WHERE id=?").run(w.id);
          }
          db.prepare("UPDATE projects SET budget_revision=budget_revision+1,budget_status=CASE WHEN budget_status='unapproved' THEN 'approved' ELSE budget_status END WHERE id=?").run(d.project_id);
          db.prepare('UPDATE budget_documents SET state=?,version=version+1,approved_by=?,approved_at=? WHERE id=?').run(state, actorId, approvedAt, key);
        } else db.prepare('UPDATE budget_documents SET state=?,version=version+1 WHERE id=?').run(state, key);
      }
      event(d.company_id, d.project_id, 'budget', key, action, d.version + 1, {
        state: d.state,
        hash: d.submission_hash
      }, {
        state,
        hash: db.prepare('SELECT submission_hash FROM budget_documents WHERE id=?').get(key).submission_hash,
        approval_amount: d.approval_amount
      }, reason);
      return budgetDetail(key);
    }),
    projectHistory: pid => {
      const p = project(pid, 'projects.manage');
      return db.prepare("SELECT e.*,u.name actor FROM foundation_events e JOIN users u ON u.id=e.actor_id WHERE project_id=? AND entity_type<>'budget' ORDER BY e.id DESC").all(p.id);
    }
  };
}
