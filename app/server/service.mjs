import { payments } from './payments.mjs';
import { payables } from './payables.mjs';
import { ledger } from './ledger.mjs';
import { quality } from './quality.mjs';
import { masters } from './masters.mjs';
import { legacyMaster, freezeMaster, usableSupplier } from './master-rules.mjs';
import { foundations } from './foundations.mjs';
import { procurement } from './procurement.mjs';
import { sourcingAvailable, costPosition } from './cost-ledger.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { D, DomainError, requireThat, money, price, sum } from './money.mjs';
import { transaction } from './db.mjs';
import { policy, safeDetails } from './access.mjs';
import { SAMPLE_DATE } from './seed.mjs';
const readableMoney = value => {
  const [integer, fraction] = money(value).split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === '00' ? '' : '.' + fraction);
};
const requiredText = (value, name, max = 160) => {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${name} is required (maximum ${max} characters).`);
  return value.trim();
};
export function createService(db, actorId, today = () => new Date().toISOString().slice(0, 10)) {
  const access = policy(db, actorId),
    actor = access.actor();
  const memberships = () => access.grants();
  const allowed = (company, project) => memberships().some(m => m.company_id === company && (m.project_id === '*' || project && m.project_id === project));
  const scope = (company, project = null) => {
    requireThat(memberships().some(m => m.company_id === company), 'Company is not available.', 404);
    if (project) requireThat(db.prepare('SELECT id FROM projects WHERE id=? AND company_id=?').get(project, company) && allowed(company, project), 'Project is not available.', 404);
    return {
      company,
      project
    };
  };
  const visible = (rows, company, project) => rows.filter(row => row.company_id === company && (!project || row.project_id === project) && allowed(row.company_id, row.project_id));
  const getRequest = (id, internal = false) => {
    const row = db.prepare('SELECT r.*,u.name requester,v.name vendor_name,c.currency company_currency FROM requests r JOIN companies c ON r.company_id=c.id JOIN users u ON r.requester_id=u.id LEFT JOIN vendors v ON r.vendor_id=v.id AND r.company_id=v.company_id WHERE r.id=?').get(id);
    requireThat(row && allowed(row.company_id, row.project_id) && access.has('requests.read', row.company_id, row.project_id), 'Request is not available.', 404);
    const frozen = legacyMaster(db, id);
    if (Object.hasOwn(frozen, 'vendor')) row.vendor_name = frozen.vendor;
    const history = db.prepare('SELECT e.*,u.name actor FROM events e JOIN users u ON e.actor_id=u.id WHERE request_id=? ORDER BY e.id').all(id);
    const item = costPosition(db, db.prepare('SELECT * FROM cost_items WHERE id=?').get(row.item_id));
    const available = sourcingAvailable(db, row.item_id, {
      legacyRequest: id
    });
    const limit = access.approvalLimit(row.company_id, row.project_id);
    const result = {
      ...row,
      history,
      item,
      available: money(available),
      after_request: money(available.minus(row.company_amount)),
      can_edit: access.has('requests.write', row.company_id, row.project_id) && row.requester_id === actorId && ['draft', 'returned'].includes(row.status),
      can_review: Boolean(new D(limit).gt(0) && row.requester_id !== actorId && row.status === 'submitted' && new D(row.company_amount).lte(limit)),
      approval_limit: limit,
      can_price: access.has('pricing.read', row.company_id, row.project_id),
      can_budget: access.has('cost.read', row.company_id, row.project_id)
    };
    if (internal) return result;
    const publicRow = {
      ...result
    };
    if (!result.can_budget) {
      publicRow.item = {
        id: item.id,
        name: item.name
      };
      for (const field of ['available', 'after_request']) delete publicRow[field];
    }
    if (!result.can_price) {
      publicRow.history = history.map(e => ({
        ...e,
        note: 'Event recorded. Commercial notes are restricted.'
      }));
      for (const field of ['unit_price', 'amount', 'company_amount', 'rate', 'rate_date', 'rate_source', 'quote', 'approval_limit']) delete publicRow[field];
    }
    return publicRow;
  };
  const report = (company, project = null) => {
    scope(company, project);
    access.requireCap('cost.read', company, project, !project);
    const entity = db.prepare('SELECT * FROM companies WHERE id=?').get(company);
    const rows = visible(db.prepare('SELECT * FROM cost_items WHERE company_id=? AND id NOT IN (SELECT cost_item_id FROM work_packages WHERE kind=\'group\') ORDER BY id').all(company), company, project).filter(r => access.has('cost.read', r.company_id, r.project_id)).map(r => costPosition(db, r));
    const totals = {};
    for (const key of ['original_budget', 'revised_budget', 'committed', 'incurred', 'cash', 'forecast']) totals[key] = rows.some(row => row[key] === null) ? null : money(sum(rows.map(row => row[key])));
    const findings = [];
    const complete = rows.filter(r => r.forecast !== null);
    if (rows.some(r => r.revised_budget === null)) findings.push({
      id: 'unapproved_budget',
      severity: 'warning',
      text: 'An original budget has not been approved for one or more work items. A complete budget variance cannot be stated.',
      sourceIds: rows.filter(r => r.revised_budget === null).map(r => r.id)
    });
    if (rows.length === 0) findings.push({
      id: 'empty',
      severity: 'info',
      text: 'No cost items match this authorised scope. This is not a zero-cost conclusion.',
      sourceIds: []
    });else if (complete.length !== rows.length) findings.push({
      id: 'missing',
      severity: 'warning',
      text: `${rows.length - complete.length} cost item(s) have no forecast. A complete forecast and variance cannot be stated.`,
      sourceIds: rows.filter(r => r.forecast === null).map(r => r.id)
    });else {
      const delta = new D(totals.forecast).minus(totals.revised_budget);
      const formatted = delta.abs().gte(1000000) ? `${delta.abs().div(1000000).toFixed(1)}m` : delta.abs().gte(100000) ? `${delta.abs().div(1000000).toFixed(1)}m` : money(delta.abs());
      findings.push({
        id: 'variance',
        severity: delta.gt(0) ? 'warning' : 'info',
        text: delta.isZero() ? 'Forecast matches the revised budget.' : `Forecast is ${entity.currency} ${formatted} ${delta.gt(0) ? 'above' : 'below'} the revised budget.`,
        sourceIds: rows.map(r => r.id),
        value: money(delta)
      });
      const drivers = [...rows].sort((a, b) => new D(b.forecast).minus(b.revised_budget).cmp(new D(a.forecast).minus(a.revised_budget)));
      if (drivers[0] && new D(drivers[0].forecast).gt(drivers[0].revised_budget)) findings.push({
        id: 'driver',
        severity: 'info',
        text: `${drivers[0].name} has the largest forecast overrun: ${entity.currency} ${readableMoney(new D(drivers[0].forecast).minus(drivers[0].revised_budget))}.`,
        sourceIds: [drivers[0].id]
      });
    }
    if (rows.length) findings.push({
      id: 'cash',
      severity: 'info',
      text: `Cash paid is ${entity.currency} ${readableMoney(totals.cash)}. It is recorded separately from incurred cost and commitments.`,
      sourceIds: rows.map(r => r.id)
    });
    const budgetFacts = rows.flatMap(r => r.budget_sources);
    if (budgetFacts.length) findings.push({
      id: 'budget_revisions',
      severity: 'info',
      text: `${budgetFacts.length} approved budget allocation(s) contribute to this view. Original baselines and later changes remain separate.`,
      sourceIds: rows.filter(r => r.budget_sources.length).map(r => r.id)
    });
    const localFacts = rows.flatMap(r => r.transaction_sources);
    if (localFacts.length) findings.push({
      id: 'local_transactions',
      severity: 'info',
      text: `Local records add ${entity.currency} ${readableMoney(sum(localFacts.filter(f => f.kind === 'commitment').map(f => f.amount)))} of issued commitments and ${entity.currency} ${readableMoney(sum(localFacts.filter(f => f.kind === 'incurred').map(f => f.amount)))} of consumed-material cost to the illustrative openings. Cash and completion forecasts remain unchanged.`,
      sourceIds: rows.filter(r => r.transaction_sources.length).map(r => r.id)
    });
    const restricted = !memberships().some(m => m.company_id === company && m.project_id === '*' && access.has('cost.read', company, null));
    const meta = {
      company: entity,
      project: project ? db.prepare('SELECT * FROM projects WHERE id=?').get(project) : null,
      asOf: rows.some(r => r.transaction_sources.length || r.budget_sources.length) ? today() : SAMPLE_DATE,
      currency: entity.currency,
      taxBasis: 'Excluding tax',
      basis: 'Illustrative opening balances plus approved local budget allocations, issued purchase orders and material consumption. Cash and forecasts remain separate.',
      restricted,
      definition: 'cost-position-v3',
      rules: 'findings-v3',
      population: rows.length
    };
    const snapshot = createHash('sha256').update(JSON.stringify({
      meta,
      rows,
      totals,
      findings
    })).digest('hex').slice(0, 16);
    return {
      meta,
      rows,
      totals,
      findings,
      snapshot,
      limitations: ['Sample opening balances are not connected to posted accounting transactions.', 'Local orders add commitments; material consumption adds operational incurred cost. These are not general-ledger postings. Receipt stock is not yet consumed cost.', 'Request approval reserves an allowance. Cash and completion forecasts are not changed by orders or stock movements.']
    };
  };
  const preview = input => {
    const {
      company_id: company,
      project_id: project
    } = input;
    scope(company, project);
    requireThat(project, 'Select a project.');
    access.requireCap('requests.write', company, project);
    requireThat(input.vendor_id || access.has('pricing.read', company, project), 'Select a supplier quotation. Only procurement can enter a provisional price.', 403);
    const item = db.prepare('SELECT * FROM cost_items WHERE id=? AND company_id=? AND project_id=?').get(input.item_id, company, project);
    const work = db.prepare('SELECT * FROM work_packages WHERE cost_item_id=?').get(input.item_id);
    requireThat(!work || work.kind === 'item', 'Select a work item, not a group.');
    requireThat(item, 'Select a cost item belonging to this project.');
    const entity = db.prepare('SELECT * FROM companies WHERE id=?').get(company);
    let vendor = null;
    if (input.vendor_id) {
      vendor = db.prepare('SELECT * FROM vendors WHERE id=? AND company_id=?').get(input.vendor_id, company);
      requireThat(vendor, 'Vendor is not approved for this company.');
      const terms = usableSupplier(db, company, vendor.id, today());
      requireThat(terms.currencies.includes(vendor.currency), 'Legacy quotation currency is no longer permitted. Use a fresh product-specific quotation.');
      requireThat(vendor.valid_until >= today(), 'The quotation has expired. Request an updated quote.');
      requireThat(vendor.rate_date <= today() && (Date.parse(today()) - Date.parse(vendor.rate_date)) / 86400000 <= 7, 'The exchange rate is missing, future-dated or stale. Finance must refresh it.');
    }
    const pricing = price(input.quantity, vendor?.unit_price || input.unit_price, vendor?.rate || '1');
    return {
      ...pricing,
      quantity: input.quantity,
      unit_price: vendor?.unit_price || input.unit_price,
      currency: vendor?.currency || entity.currency,
      rate: vendor?.rate || '1',
      rate_date: vendor?.rate_date || today(),
      rate_source: vendor ? 'Illustrative quote conversion' : 'Company-currency estimate',
      quote: vendor?.quote || null,
      vendor_id: vendor?.id || null,
      vendor_name: vendor?.name || null,
      item_id: item.id
    };
  };
  const event = (id, action, version, note) => db.prepare('INSERT INTO events(request_id,actor_id,action,version,note,at) VALUES(?,?,?,?,?,?)').run(id, actorId, action, version, note, new Date().toISOString());
  const validatedFields = input => {
    const title = requiredText(input.title, 'Description'),
      location = requiredText(input.location, 'Location'),
      unit = requiredText(input.unit, 'Unit', 30);
    requireThat(typeof input.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.due) && !Number.isNaN(Date.parse(input.due)) && new Date(input.due).toISOString().slice(0, 10) === input.due, 'A valid needed-by date is required.');
    return {
      title,
      location,
      unit,
      due: input.due
    };
  };
  const create = input => transaction(db, () => {
    const p = preview(input),
      fields = validatedFields(input),
      id = `PR-${input.company_id.toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const row = {
      id,
      company_id: input.company_id,
      project_id: input.project_id,
      item_id: p.item_id,
      ...fields,
      requester_id: actorId,
      owner: actor.name,
      status: 'draft',
      version: 1,
      vendor_id: p.vendor_id,
      quantity: p.quantity,
      unit_price: p.unit_price,
      currency: p.currency,
      amount: p.amount,
      company_amount: p.companyAmount,
      rate: p.rate,
      rate_date: p.rate_date,
      rate_source: p.rate_source,
      quote: p.quote,
      created_at: new Date().toISOString()
    };
    const keys = Object.keys(row);
    db.prepare(`INSERT INTO requests(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...Object.values(row));
    freezeMaster(db, 'legacy_request', id + '@1', {
      vendor: p.vendor_name,
      terms_id: p.vendor_id ? usableSupplier(db, input.company_id, p.vendor_id, today()).terms.id : null
    });
    event(id, 'created', 1, 'Draft request created.');
    return getRequest(id);
  });
  const update = (id, input) => transaction(db, () => {
    const old = getRequest(id, true);
    requireThat(input.version === old.version, 'This request changed. Reload it before editing.', 409);
    requireThat(old.can_edit, 'Only the requester can edit a draft or returned request.', 403);
    const p = preview({
        ...input,
        company_id: old.company_id,
        project_id: old.project_id
      }),
      fields = validatedFields(input);
    db.prepare("UPDATE requests SET title=?,location=?,unit=?,due=?,item_id=?,vendor_id=?,quantity=?,unit_price=?,currency=?,amount=?,company_amount=?,rate=?,rate_date=?,rate_source=?,quote=?,status='draft',version=version+1 WHERE id=?").run(fields.title, fields.location, fields.unit, fields.due, p.item_id, p.vendor_id, p.quantity, p.unit_price, p.currency, p.amount, p.companyAmount, p.rate, p.rate_date, p.rate_source, p.quote, id);
    freezeMaster(db, 'legacy_request', id + '@' + (old.version + 1), {
      vendor: p.vendor_name,
      terms_id: p.vendor_id ? usableSupplier(db, old.company_id, p.vendor_id, today()).terms.id : null
    });
    event(id, 'revised', old.version + 1, 'Repriced from the selected quote or company-currency estimate. Approval must be requested again.');
    return getRequest(id);
  });
  const decide = (id, input) => transaction(db, () => {
    const old = getRequest(id, true);
    requireThat(input.version === old.version, 'This request changed. Reload it before deciding.', 409);
    requireThat(['submit', 'approve', 'return'].includes(input.action), 'Unknown action.');
    let state, owner, note;
    if (input.action === 'submit') {
      requireThat(old.can_edit, 'Only the requester can submit a draft or returned request.', 403);
      state = 'submitted';
      const reviewers = db.prepare("SELECT u.id,u.name,m.approval_limit FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.company_id=? AND (m.project_id='*' OR m.project_id=?) AND m.user_id<>? AND m.can_approve=1 AND u.active=1 ORDER BY u.name").all(old.company_id, old.project_id, actorId).filter(r => policy(db, r.id).has('requests.approve', old.company_id, old.project_id) && new D(old.company_amount).lte(policy(db, r.id).approvalLimit(old.company_id, old.project_id)));
      requireThat(reviewers.length > 0, 'No independent reviewer has sufficient authority for this company and project. Configure approval authority before submitting.');
      owner = reviewers[0].name;
      note = 'Submitted for independent review.';
    } else {
      requireThat(old.can_review, 'An authorised independent reviewer is required.', 403);
      requireThat(new D(old.company_amount).lte(old.approval_limit), 'This amount exceeds your approval authority.', 403);
      if (input.action === 'approve') {
        requireThat(new D(old.after_request).gte(0), 'This request exceeds the available sourcing allowance. Budget review is required.');
        if (old.vendor_id) {
          const approved = usableSupplier(db, old.company_id, old.vendor_id, today(), legacyMaster(db, id).terms_id);
          requireThat(!legacyMaster(db, id).vendor || legacyMaster(db, id).vendor === approved.name, 'The supplier identity changed. Return this request for repricing.', 409);
          requireThat(approved.currencies.includes(old.currency), 'The quotation currency is no longer permitted.');
          const vendor = db.prepare('SELECT * FROM vendors WHERE id=? AND company_id=?').get(old.vendor_id, old.company_id);
          requireThat(vendor.valid_until >= today(), 'The quotation has expired. Return the request for a revised quote.');
          requireThat((Date.parse(today()) - Date.parse(old.rate_date)) / 86400000 <= 7 && old.rate_date <= today(), 'The saved FX rate is stale or future-dated. Return for repricing.');
          requireThat(vendor.quote === old.quote && vendor.currency === old.currency && new D(vendor.unit_price).cmp(old.unit_price) === 0 && new D(vendor.rate).cmp(old.rate) === 0 && vendor.rate_date === old.rate_date, 'The vendor quotation or conversion has changed. Return the request for repricing before approval.', 409);
        }
        state = 'approved';
        owner = 'Procurement';
        note = 'Sourcing approved. No purchase order, incurred cost or payment created.';
      } else {
        state = 'returned';
        owner = old.requester;
        note = requiredText(input.note, 'Reason for return', 1000);
      }
    }
    db.prepare('UPDATE requests SET status=?,owner=?,version=version+1 WHERE id=?').run(state, owner, id);
    event(id, state, old.version + 1, note);
    return getRequest(id);
  });
  const record = id => {
    const r = db.prepare('SELECT * FROM records WHERE id=?').get(id);
    requireThat(r && allowed(r.company_id, r.project_id) && access.record(r), 'Record is not available.', 404);
    const raw = JSON.parse(r.details);
    const related = (raw._example?.linkedIds || []).map(id => db.prepare('SELECT * FROM records WHERE id=?').get(id)).filter(row => row && allowed(row.company_id, row.project_id) && access.record(row)).map(({
      id,
      title
    }) => ({
      id,
      title
    }));
    const details = safeDetails(raw, access.has('pricing.read', r.company_id, r.project_id));
    if (details._example) details._example.linkedIds = related.map(r => r.id);
    return {
      ...r,
      details,
      related,
      details_restricted: !access.has('pricing.read', r.company_id, r.project_id)
    };
  };
  const records = (company, project = null) => {
    scope(company, project);
    return visible(db.prepare('SELECT * FROM records WHERE company_id=? ORDER BY due,id').all(company), company, project).filter(access.record).map(r => record(r.id));
  };
  const requests = (company, project = null) => {
    scope(company, project);
    return visible(db.prepare('SELECT * FROM requests WHERE company_id=? ORDER BY created_at DESC').all(company), company, project).filter(r => access.has('requests.read', r.company_id, r.project_id)).map(r => getRequest(r.id));
  };
  const vendors = (company, project) => access.has('vendors.read', company, project, !project) ? db.prepare('SELECT * FROM vendors WHERE company_id=?').all(company).filter(v => {
    try {
      const s = usableSupplier(db, company, v.id, today());
      return s.currencies.includes(v.currency) && v.valid_until >= today();
    } catch {
      return false;
    }
  }).map(v => access.has('pricing.read', company, project, !project) ? v : {
    id: v.id,
    company_id: v.company_id,
    name: v.name,
    currency: v.currency
  }) : [];
  return {
    actor,
    scope,
    report,
    create,
    update,
    decide,
    getRequest,
    records,
    requests,
    record,
    preview: input => {
      const p = preview(input);
      return access.has('pricing.read', input.company_id, input.project_id) ? p : {
        quantity: p.quantity,
        currency: p.currency,
        vendor_id: p.vendor_id,
        vendor_name: p.vendor_name,
        item_id: p.item_id,
        priced: true,
        restricted: true
      };
    },
    bootstrap: () => ({
      actor: access.actor(),
      companies: db.prepare('SELECT * FROM companies').all().filter(c => memberships().some(m => m.company_id === c.id)),
      projects: db.prepare('SELECT * FROM projects').all().filter(p => allowed(p.company_id, p.id) && access.has('projects.read', p.company_id, p.id)),
      grants: memberships().map(m => ({
        ...m,
        capabilities: access.caps(m.company_id, m.project_id === '*' ? null : m.project_id)
      })),
      sampleDate: SAMPLE_DATE,
      mode: 'local-sample'
    }),
    workspace: (company, project) => {
      scope(company, project);
      const supply = access.has('requests.read', company, project, !project) || access.has('materials.read', company, project, !project) ? procurement(db, actorId, today).workspace(company, project) : {
        requests: [],
        orders: []
      };
      const foundation = access.has('projects.read', company, project, !project) ? foundations(db, actorId, today).workspace(company, project) : {
        projects: [],
        budgets: []
      };
      return {
        payment_documents: access.has('payments.read', company, project, !project) ? payments(db, actorId, today).list(company, project) : [],
        payable_documents: access.has('ap.read', company, project, !project) ? payables(db, actorId, today).list(company, project) : [],
        ledger_entries: access.has('finance.read', company, project, !project) ? ledger(db, actorId, today).list(company, project) : [],
        quality_cases: access.has('quality.read', company, project, !project) ? quality(db, actorId, today).list(company, project) : [],
        master_reviews: access.has('suppliers.approve', company, null) ? masters(db, actorId, today).workspace(company).pending.filter(p => p.can_decide).map(p => ({
          ...p,
          id: 'MASTER-party:' + p.party_id
        })) : [],
        project_setup: foundation.projects,
        budget_documents: foundation.budgets,
        material_requests: supply.requests,
        purchase_orders: supply.orders,
        capabilities: access.caps(company, project, !project),
        requests: requests(company, project),
        records: records(company, project),
        report: access.has('cost.read', company, project, !project) ? report(company, project) : null,
        vendors: vendors(company, project),
        items: visible(db.prepare('SELECT id,company_id,project_id,name FROM cost_items WHERE company_id=? AND id NOT IN(SELECT cost_item_id FROM work_packages WHERE kind=\'group\')').all(company), company, project).filter(r => access.has('requests.read', company, r.project_id))
      };
    },
    search: (company, term) => {
      scope(company);
      requireThat(typeof term === 'string' && term.length <= 120, 'Search is too long.');
      const q = term.toLowerCase().trim();
      if (!q) return [];
      const supply = access.has('requests.read', company, null, true) || access.has('materials.read', company, null, true) ? procurement(db, actorId, today).workspace(company, null) : {
        requests: [],
        orders: []
      };
      const typed = [...supply.requests, ...supply.orders.map(o => ({
        ...o,
        title: o.vendor + ' · Purchase order',
        vendor_name: o.vendor
      }))].map(r => ({
        ...r,
        location: r.lines.map(l => l.location).join(', ')
      }));
      const budgetDocs = access.has('projects.read', company, null, true) ? foundations(db, actorId, today).workspace(company).budgets.map(d => ({
        ...d,
        category: 'Budget control',
        status: d.state,
        location: 'Project budget',
        owner: d.author
      })) : [];
      const master = access.has('vendors.read', company, null, true) ? masters(db, actorId, today).workspace(company) : {
        contacts: [],
        products: []
      };
      const masterRows = [...master.contacts.map(p => ({
        id: 'MASTER-party:' + p.party_id,
        display_reference: p.reference || 'Contact',
        title: p.name,
        category: 'Contacts & catalogue',
        location: p.country,
        status: p.active ? 'Active' : 'Archived'
      })), ...master.products.map(p => ({
        id: 'MASTER-product:' + p.id,
        display_reference: p.code,
        title: p.name,
        category: 'Contacts & catalogue',
        location: p.kind + ' · ' + p.uom,
        status: p.active ? 'Active' : 'Archived'
      }))];
      const qualityRows = access.has('quality.read', company, null, true) ? quality(db, actorId, today).list(company).map(r => ({
        ...r,
        category: 'Quality & safety',
        status: r.state_label
      })) : [];
      const ledgerRows = access.has('finance.read', company, null, true) ? ledger(db, actorId, today).list(company).map(r => ({
        ...r,
        display_reference: r.number,
        category: 'General ledger',
        status: r.state_label
      })) : [];
      const payableRows = access.has('ap.read', company, null, true) ? payables(db, actorId, today).list(company).map(r => ({...r,display_reference:r.reference,vendor_name:r.vendor,category:'Supplier bills',status:r.state_label})) : [];
      const paymentRows = access.has('payments.read', company, null, true) ? payments(db, actorId, today).list(company).map(r => ({...r,vendor_name:r.vendor,category:'Payments & cash flow',status:r.state_label})) : [];
      return [...paymentRows, ...payableRows, ...ledgerRows, ...qualityRows, ...records(company), ...requests(company), ...typed, ...budgetDocs, ...masterRows].filter(r => [r.id, r.display_reference, r.title, r.location, r.owner, r.vendor_name, r.category].filter(Boolean).join(' ').toLowerCase().includes(q)).slice(0, 30);
    }
  };
}
