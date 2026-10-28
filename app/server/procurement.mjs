import { randomUUID } from 'node:crypto';
import { sourcingAvailable } from './cost-ledger.mjs';
import { policy } from './access.mjs';
import { transaction } from './db.mjs';
import { D, decimal, money, price, sum, requireThat } from './money.mjs';
const uid = prefix => `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
const now = () => new Date().toISOString();
function text(value, label, max = 200) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label} is required (up to ${max} characters).`);
  return value.trim();
}
function date(value, label) {
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, `${label} must be a valid date.`);
  return value;
}
export function procurement(db, actorId, today = () => new Date().toISOString().slice(0, 10)) {
  const access = policy(db, actorId);
  access.actor();
  const get = (sql, ...args) => db.prepare(sql).get(...args),
    all = (sql, ...args) => db.prepare(sql).all(...args),
    run = (sql, ...args) => db.prepare(sql).run(...args);
  const scope = (company, project) => {
    requireThat(access.matching(company, project, !project).length, 'Scope is not available.', 404);
    if (project) requireThat(get('SELECT id FROM projects WHERE id=? AND company_id=?', project, company), 'Project is not available.', 404);
  };
  const permit = (cap, row) => {
    scope(row.company_id, row.project_id);
    access.requireCap(cap, row.company_id, row.project_id);
  };
  const version = (row, input) => requireThat(Number.isSafeInteger(input.version) && input.version === row.version, 'This record changed. Reload before continuing.', 409);
  const event = (type, row, action, note) => run('INSERT INTO procurement_events(entity_type,entity_id,company_id,project_id,actor_id,action,version,note,at) VALUES(?,?,?,?,?,?,?,?,?)', type, row.id, row.company_id, row.project_id, actorId, action, row.version, note, now());
  const history = (type, id, priced) => all('SELECT e.*,u.name actor FROM procurement_events e JOIN users u ON u.id=e.actor_id WHERE entity_type=? AND entity_id=? ORDER BY e.id', type, id).map(e => ({
    ...e,
    note: priced ? e.note : 'Event recorded. Commercial notes are restricted.'
  }));
  const request = id => {
    const r = get('SELECT r.*,u.name requester FROM material_requests r JOIN users u ON u.id=r.requester_id WHERE r.id=?', id);
    requireThat(r && access.has('requests.read', r.company_id, r.project_id), 'Request is not available.', 404);
    return r;
  };
  const lines = id => all('SELECT l.*,p.name product,p.uom,w.name work_package,w.cost_item_id,loc.name location,loc.code location_code FROM material_request_lines l JOIN products p ON p.id=l.product_id JOIN work_packages w ON w.id=l.work_package_id JOIN project_locations loc ON loc.id=l.location_id WHERE request_id=? ORDER BY l.rowid', id);
  const allocations = id => all('SELECT a.*,q.vendor_id,q.currency,q.unit_price,q.rate,q.rate_date,q.rate_source,q.valid_until,q.reference,q.author_id quote_author,q.quantity quote_quantity,v.name vendor,l.work_package_id,w.cost_item_id FROM sourcing_allocations a JOIN supplier_quotes q ON q.id=a.quote_id JOIN vendors v ON v.id=q.vendor_id AND v.company_id=q.company_id JOIN material_request_lines l ON l.id=a.line_id JOIN work_packages w ON w.id=l.work_package_id WHERE a.request_id=? ORDER BY a.id', id);
  const validQuote = q => {
    requireThat(q.valid_until >= today(), 'Supplier quotation expired. Obtain a new quotation.');
    requireThat(q.rate_date <= today() && (Date.parse(today()) - Date.parse(q.rate_date)) / 86400000 <= 7, 'The exchange-rate snapshot is stale or future-dated. Obtain a fresh quotation.');
  };
  const allowance = (itemId, exceptRequest = null) => sourcingAvailable(db, itemId, {
    materialRequest: exceptRequest
  });
  const canApprove = r => r.requester_id !== actorId && r.plan_author_id !== actorId && new D(access.approvalLimit(r.company_id, r.project_id)).gte(sum(allocations(r.id).map(a => a.company_amount))) && new D(access.approvalLimit(r.company_id, r.project_id)).gt(0);
  function requestDetail(id) {
    const r = request(id),
      priced = access.has('pricing.read', r.company_id, r.project_id),
      items = lines(id),
      plan = allocations(id);
    const result = {
      ...r,
      lines: items,
      history: history('request', id, priced),
      can_price: priced,
      can_cancel: ['draft', 'submitted', 'awaiting_approval', 'approved'].includes(r.state) && (r.state === 'approved' ? canApprove(r) : r.requester_id === actorId || access.has('procurement.write', r.company_id, r.project_id)),
      can_edit: r.state === 'draft' && r.requester_id === actorId && access.has('requests.write', r.company_id, r.project_id),
      can_source: r.state === 'submitted' && access.has('procurement.write', r.company_id, r.project_id),
      can_approve: r.state === 'awaiting_approval' && canApprove(r),
      can_issue: r.state === 'approved' && access.has('procurement.write', r.company_id, r.project_id),
      orders: all('SELECT id,state,currency FROM purchase_orders WHERE request_id=?', id)
    };
    if (priced) {
      result.quotes = all('SELECT q.*,v.name vendor,p.name product,p.uom FROM supplier_quotes q JOIN vendors v ON v.id=q.vendor_id AND v.company_id=q.company_id JOIN material_request_lines l ON l.id=q.line_id JOIN products p ON p.id=l.product_id WHERE q.request_id=? ORDER BY q.created_at', id);
      result.allocations = plan;
      result.company_amount = plan.length ? money(sum(plan.map(a => a.company_amount))) : null;
    }
    return result;
  }
  function validateLines(input) {
    requireThat(Array.isArray(input.lines) && input.lines.length > 0 && input.lines.length <= 100, 'Add between 1 and 100 requested items.');
    return input.lines.map(l => {
      const product = get('SELECT * FROM products WHERE id=? AND company_id=? AND active=1', l.product_id, input.company_id);
      requireThat(product, 'Choose an active product in this company.');
      requireThat(get('SELECT id FROM work_packages WHERE id=? AND company_id=? AND project_id=?', l.work_package_id, input.company_id, input.project_id), 'Choose a work package in this project.');
      requireThat(get('SELECT id FROM project_locations WHERE id=? AND company_id=? AND project_id=?', l.location_id, input.company_id, input.project_id), 'Choose a location in this project.');
      const quantity = decimal(l.quantity, 'Requested quantity', false).toString();
      requireThat(!l.note || typeof l.note === 'string' && l.note.length <= 500, 'Item note is too long.');
      return {
        id: uid('ML'),
        product_id: product.id,
        work_package_id: l.work_package_id,
        location_id: l.location_id,
        quantity,
        note: l.note || ''
      };
    });
  }
  function createRequest(input) {
    return transaction(db, () => {
      permit('requests.write', input);
      requireThat(input.project_id, 'Select a project.');
      const r = {
          id: uid('MR'),
          company_id: input.company_id,
          project_id: input.project_id,
          title: text(input.title, 'Title'),
          needed_by: date(input.needed_by, 'Needed date')
        },
        items = validateLines(input);
      run('INSERT INTO material_requests(id,company_id,project_id,title,needed_by,requester_id,state,created_at) VALUES(?,?,?,?,?,?,?,?)', r.id, r.company_id, r.project_id, r.title, r.needed_by, actorId, 'draft', now());
      for (const l of items) run('INSERT INTO material_request_lines(id,request_id,company_id,project_id,product_id,work_package_id,location_id,quantity,note) VALUES(?,?,?,?,?,?,?,?,?)', l.id, r.id, r.company_id, r.project_id, l.product_id, l.work_package_id, l.location_id, l.quantity, l.note);
      event('request', {
        ...r,
        version: 1
      }, 'created', 'Unpriced site demand recorded.');
      return requestDetail(r.id);
    });
  }
  function updateRequest(id, input) {
    return transaction(db, () => {
      const r = request(id);
      permit('requests.write', r);
      version(r, input);
      requireThat(r.state === 'draft' && r.requester_id === actorId, 'Only the requester can edit an unsubmitted draft.', 403);
      const title = text(input.title, 'Title'),
        needed = date(input.needed_by, 'Needed date'),
        items = validateLines({
          ...input,
          company_id: r.company_id,
          project_id: r.project_id
        });
      run('DELETE FROM material_request_lines WHERE request_id=?', id);
      for (const l of items) run('INSERT INTO material_request_lines(id,request_id,company_id,project_id,product_id,work_package_id,location_id,quantity,note) VALUES(?,?,?,?,?,?,?,?,?)', l.id, id, r.company_id, r.project_id, l.product_id, l.work_package_id, l.location_id, l.quantity, l.note);
      run('UPDATE material_requests SET title=?,needed_by=?,version=version+1 WHERE id=?', title, needed, id);
      event('request', {
        ...r,
        version: r.version + 1
      }, 'revised', 'Draft quantities revised.');
      return requestDetail(id);
    });
  }
  function addQuote(id, input) {
    return transaction(db, () => {
      const r = request(id);
      permit('procurement.write', r);
      version(r, input);
      requireThat(r.state === 'submitted', 'Quotes can be added while sourcing a submitted request.');
      const line = get('SELECT * FROM material_request_lines WHERE id=? AND request_id=?', input.line_id, id);
      requireThat(line, 'Choose a line in this request.');
      const vendor = get('SELECT * FROM vendors WHERE id=? AND company_id=?', input.vendor_id, r.company_id);
      requireThat(vendor, 'Choose a company-approved vendor.');
      const currency = vendor.currency,
        company = get('SELECT currency FROM companies WHERE id=?', r.company_id);
      const quantity = decimal(input.quantity, 'Quote quantity', false).toString(),
        unitPrice = decimal(input.unit_price, 'Quoted unit price', false).toString();
      const rate = currency === company.currency ? '1' : decimal(input.rate, 'Company-currency conversion rate', false).toString();
      const q = {
        id: uid('SQ'),
        rate_date: date(input.rate_date, 'Rate date'),
        valid_until: date(input.valid_until, 'Quotation expiry')
      };
      validQuote(q);
      requireThat(Number.isInteger(input.lead_days) && input.lead_days >= 0 && input.lead_days <= 730, 'Lead time must be 0–730 whole days.');
      run('INSERT INTO supplier_quotes(id,request_id,line_id,company_id,vendor_id,reference,quantity,unit_price,currency,rate,rate_date,rate_source,valid_until,lead_days,author_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', q.id, id, line.id, r.company_id, vendor.id, text(input.reference, 'Quotation reference', 120), quantity, unitPrice, currency, rate, q.rate_date, text(input.rate_source, 'Rate source', 160), q.valid_until, input.lead_days, actorId, now());
      run('UPDATE material_requests SET version=version+1 WHERE id=?', id);
      event('request', {
        ...r,
        version: r.version + 1
      }, 'quoted', 'Supplier quotation recorded with product, unit, currency and rate snapshot.');
      return requestDetail(id);
    });
  }
  function sourcePlan(id, input) {
    return transaction(db, () => {
      const r = request(id);
      permit('procurement.write', r);
      version(r, input);
      requireThat(r.state === 'submitted', 'Only a submitted request can be sourced.');
      requireThat(Array.isArray(input.allocations) && input.allocations.length > 0 && input.allocations.length <= 200, 'Choose supplier quantities for this request.');
      const used = new Set(),
        plan = input.allocations.map(a => {
          requireThat(!used.has(a.quote_id), 'A quote may appear once in a sourcing plan.');
          used.add(a.quote_id);
          const q = get('SELECT * FROM supplier_quotes WHERE id=? AND request_id=?', a.quote_id, id);
          requireThat(q, 'Quotation is not in this request.');
          validQuote(q);
          const qty = decimal(a.quantity, 'Award quantity', false);
          requireThat(qty.lte(q.quantity), 'Award quantity exceeds the quoted quantity.');
          return {
            id: uid('SA'),
            quote: q,
            quantity: qty.toString(),
            ...price(qty.toString(), q.unit_price, q.rate)
          };
        });
      for (const l of lines(id)) requireThat(sum(plan.filter(a => a.quote.line_id === l.id).map(a => a.quantity)).cmp(l.quantity) === 0, `Supplier quantities must match the requested ${l.quantity} ${l.uom} of ${l.product}.`);
      run('DELETE FROM sourcing_allocations WHERE request_id=?', id);
      for (const a of plan) run('INSERT INTO sourcing_allocations(id,request_id,quote_id,line_id,quantity,amount,company_amount) VALUES(?,?,?,?,?,?,?)', a.id, id, a.quote.id, a.quote.line_id, a.quantity, a.amount, a.companyAmount);
      run("UPDATE material_requests SET state='awaiting_approval',plan_author_id=?,version=version+1 WHERE id=?", actorId, id);
      event('request', {
        ...r,
        version: r.version + 1
      }, 'sourcing_submitted', 'Supplier allocation submitted for independent approval. ' + plan.map(a => `${a.quote.line_id}: quotation ${a.quote.id}, ${a.quantity} at ${a.quote.currency} ${a.quote.unit_price}; award ${a.quote.currency} ${a.amount}; company value ${a.companyAmount}.`).join(' '));
      return requestDetail(id);
    });
  }
  function decide(id, input) {
    return transaction(db, () => {
      const r = request(id);
      version(r, input);
      let state, note;
      if (input.action === 'submit') {
        permit('requests.write', r);
        requireThat(r.state === 'draft' && r.requester_id === actorId, 'Only the requester can submit a draft.', 403);
        state = 'submitted';
        note = 'Unpriced demand submitted to procurement.';
      } else if (input.action === 'approve') {
        requireThat(r.state === 'awaiting_approval', 'This sourcing plan is not awaiting approval.');
        requireThat(canApprove(r), 'An independent reviewer with sufficient company-currency authority is required.', 403);
        const plan = allocations(id);
        for (const q of plan) validQuote(q);
        for (const item of new Set(plan.map(a => a.cost_item_id))) {
          requireThat(get('SELECT release_state FROM work_packages WHERE cost_item_id=?', item).release_state === 'released', 'Work package budget must be released.');
          const required = sum(plan.filter(a => a.cost_item_id === item).map(a => a.company_amount));
          requireThat(required.lte(allowance(item, id)), 'The sourcing plan exceeds the released sourcing allowance. Budget review is required.');
        }
        state = 'approved';
        note = 'Sourcing approved; allowance reserved. No purchase order, cost or cash has been posted.';
      } else if (input.action === 'return') {
        requireThat(r.state === 'awaiting_approval' && canApprove(r), 'An independent authorised reviewer must return this sourcing plan.', 403);
        note = text(input.note, 'Reason', 1000);
        state = 'submitted';
      } else if (input.action === 'cancel') {
        requireThat(['draft', 'submitted', 'awaiting_approval', 'approved'].includes(r.state), 'Issued orders must be resolved through their own workflow.');
        requireThat(r.state === 'approved' ? canApprove(r) : r.requester_id === actorId || access.has('procurement.write', r.company_id, r.project_id), 'You cannot cancel this request.', 403);
        note = text(input.note, 'Cancellation reason', 1000);
        state = 'cancelled';
      } else requireThat(false, 'Unknown request action.');
      run('UPDATE material_requests SET state=?,version=version+1 WHERE id=?', state, id);
      event('request', {
        ...r,
        version: r.version + 1
      }, state, note);
      return requestDetail(id);
    });
  }
  function issueOrders(id, input) {
    return transaction(db, () => {
      const r = request(id);
      permit('procurement.write', r);
      if (r.state === 'ordered') return all('SELECT id FROM purchase_orders WHERE request_id=?', id).map(o => orderDetail(o.id));
      version(r, input);
      requireThat(r.state === 'approved', 'Approve sourcing before creating an order.');
      const plan = allocations(id);
      for (const a of plan) validQuote(a);
      const groups = new Map();
      for (const a of plan) {
        const key = a.vendor_id + ':' + a.currency;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
      }
      const ids = [];
      for (const rows of groups.values()) {
        const id = uid('PO');
        ids.push(id);
        const first = rows[0];
        run('INSERT INTO purchase_orders(id,request_id,company_id,project_id,vendor_id,currency,state,issued_by,issued_at) VALUES(?,?,?,?,?,?,?,?,?)', id, r.id, r.company_id, r.project_id, first.vendor_id, first.currency, 'issued', actorId, now());
        for (const a of rows) {
          const lineId = uid('PL');
          run('INSERT INTO purchase_order_lines(id,order_id,allocation_id,request_line_id,quantity,unit_price,amount,company_amount,rate,rate_date,rate_source) VALUES(?,?,?,?,?,?,?,?,?,?,?)', lineId, id, a.id, a.line_id, a.quantity, a.unit_price, a.amount, a.company_amount, a.rate, a.rate_date, a.rate_source);
          run('INSERT INTO construction_cost_facts(id,company_id,project_id,cost_item_id,kind,amount,source_type,source_id,at) VALUES(?,?,?,?,?,?,?,?,?)', uid('CF'), r.company_id, r.project_id, a.cost_item_id, 'commitment', a.company_amount, 'purchase_order_line', lineId, now());
        }
        event('order', {
          id,
          company_id: r.company_id,
          project_id: r.project_id,
          version: 1
        }, 'issued', 'Local purchase order issued from the approved sourcing plan. No message sent to vendor.');
      }
      run("UPDATE material_requests SET state='ordered',version=version+1 WHERE id=?", r.id);
      event('request', {
        ...r,
        version: r.version + 1
      }, 'ordered', `Reservation converted to ${ids.length} separate vendor/currency order(s).`);
      return ids.map(orderDetail);
    });
  }
  const order = id => {
    const o = get('SELECT o.*,v.name vendor,c.currency company_currency FROM purchase_orders o JOIN vendors v ON v.id=o.vendor_id AND v.company_id=o.company_id JOIN companies c ON c.id=o.company_id WHERE o.id=?', id);
    requireThat(o && (access.has('requests.read', o.company_id, o.project_id) || access.has('materials.read', o.company_id, o.project_id)), 'Order is not available.', 404);
    return o;
  };
  const orderLines = id => all('SELECT ol.*,l.product_id,l.work_package_id,l.location_id,p.name product,p.uom,w.cost_item_id,w.name work_package,loc.name location FROM purchase_order_lines ol JOIN material_request_lines l ON l.id=ol.request_line_id JOIN products p ON p.id=l.product_id JOIN work_packages w ON w.id=l.work_package_id JOIN project_locations loc ON loc.id=l.location_id WHERE order_id=?', id);
  function netAccepted(lineId) {
    const rs = all('SELECT id,accepted FROM material_receipts WHERE order_line_id=?', lineId);
    return sum(rs.map(r => r.accepted)).minus(sum(rs.flatMap(r => all("SELECT quantity FROM stock_movements WHERE receipt_id=? AND kind='return'", r.id).map(m => m.quantity))));
  }
  function lotBalance(id) {
    const rows = all('SELECT * FROM stock_movements WHERE receipt_id=?', id);
    return {
      quantity: rows.reduce((n, r) => r.kind === 'receipt' ? n.plus(r.quantity) : n.minus(r.quantity), new D(0)),
      value: rows.reduce((n, r) => r.kind === 'receipt' ? n.plus(r.company_value) : n.minus(r.company_value), new D(0))
    };
  }
  function orderDetail(id) {
    const o = order(id),
      priced = access.has('pricing.read', o.company_id, o.project_id);
    const rows = orderLines(id).map(l => {
      const received = netAccepted(l.id),
        row = {
          ...l,
          received: received.toString(),
          outstanding: new D(l.quantity).minus(received).toString()
        };
      if (!priced) for (const k of ['unit_price', 'amount', 'company_amount', 'rate', 'rate_date', 'rate_source']) delete row[k];
      return row;
    });
    const receipts = all('SELECT r.*,u.name receiver FROM material_receipts r JOIN users u ON u.id=r.received_by WHERE order_id=? ORDER BY received_at DESC', id).map(r => {
      const b = lotBalance(r.id);
      return {
        ...r,
        available: b.quantity.toString(),
        ...(priced ? {
          stock_value: money(b.value)
        } : {
          company_value: undefined
        })
      };
    });
    return {
      ...o,
      lines: rows,
      receipts,
      movements: all('SELECT m.*,u.name actor,loc.name location FROM stock_movements m JOIN material_receipts r ON r.id=m.receipt_id JOIN users u ON u.id=m.actor_id JOIN project_locations loc ON loc.id=m.location_id WHERE r.order_id=? ORDER BY m.at', id).map(m => priced ? m : {
        ...m,
        company_value: undefined,
        reason: 'Operational movement recorded.'
      }),
      can_price: priced,
      can_receive: o.state === 'issued' && access.has('receipts.write', o.company_id, o.project_id),
      can_move: access.has('stock.write', o.company_id, o.project_id),
      history: history('order', id, priced),
      ...(priced ? {
        amount: money(sum(rows.map(l => l.amount))),
        company_amount: money(sum(rows.map(l => l.company_amount)))
      } : {})
    };
  }
  function receive(id, input) {
    return transaction(db, () => {
      const o = order(id);
      permit('receipts.write', o);
      const key = text(input.command_key, 'Receipt operation key', 100);
      const accepted = decimal(input.accepted, 'Accepted quantity'),
        rejected = decimal(input.rejected, 'Rejected quantity');
      const deliveryRef = text(input.delivery_reference, 'Delivery reference', 160);
      const reason = input.reason ? text(input.reason, 'Inspection reason', 500) : '';
      requireThat(!rejected.gt(0) || reason, 'Rejection reason is required.');
      const prior = get('SELECT * FROM material_receipts WHERE order_id=? AND command_key=?', id, key);
      if (prior) {
        requireThat(prior.order_line_id === input.line_id && new D(prior.accepted).cmp(accepted) === 0 && new D(prior.rejected).cmp(rejected) === 0 && prior.delivery_reference === deliveryRef && prior.reason === reason, 'This operation key was used for a different receipt.', 409);
        return orderDetail(id);
      }
      version(o, input);
      requireThat(o.state === 'issued', 'Only issued orders can be received.');
      const line = orderLines(id).find(l => l.id === input.line_id);
      requireThat(line, 'Choose a line in this order.');
      requireThat(accepted.plus(rejected).gt(0), 'Enter a delivered quantity.');
      requireThat(accepted.plus(rejected).lte(new D(line.quantity).minus(netAccepted(line.id))), 'Delivered quantity exceeds the outstanding order quantity.');
      const receipt = uid('RCV'),
        value = price(accepted.gt(0) ? accepted.toString() : '1', accepted.gt(0) ? line.unit_price : '0', line.rate).companyAmount;
      run('INSERT INTO material_receipts(id,order_id,order_line_id,company_id,project_id,accepted,rejected,company_value,delivery_reference,reason,received_by,received_at,command_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', receipt, id, line.id, o.company_id, o.project_id, accepted.toString(), rejected.toString(), value, deliveryRef, reason, actorId, now(), key);
      if (accepted.gt(0)) run('INSERT INTO stock_movements(id,receipt_id,company_id,project_id,kind,quantity,company_value,location_id,reason,actor_id,at,command_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', uid('MOV'), receipt, o.company_id, o.project_id, 'receipt', accepted.toString(), value, line.location_id, 'Accepted delivery', actorId, now(), `receipt:${receipt}`);
      run('UPDATE purchase_orders SET version=version+1 WHERE id=?', id);
      event('order', {
        ...o,
        version: o.version + 1
      }, 'received', `Receipt ${receipt}: accepted ${accepted}, rejected ${rejected} ${line.uom}.`);
      return orderDetail(id);
    });
  }
  function moveStock(receiptId, input) {
    return transaction(db, () => {
      const r = get('SELECT * FROM material_receipts WHERE id=?', receiptId);
      requireThat(r, 'Receipt is not available.', 404);
      const o = order(r.order_id);
      permit('stock.write', o);
      requireThat(['return', 'issue'].includes(input.kind), 'Choose a supplier return or material issue.');
      const key = text(input.command_key, 'Movement operation key', 100);
      const qty = decimal(input.quantity, 'Movement quantity', false),
        reason = text(input.reason, 'Movement reason', 500);
      const prior = get('SELECT * FROM stock_movements WHERE receipt_id=? AND command_key=?', receiptId, key);
      if (prior) {
        requireThat(prior.kind === input.kind && new D(prior.quantity).cmp(qty) === 0 && prior.location_id === input.location_id && prior.reason === reason, 'This operation key was used for another movement.', 409);
        return orderDetail(o.id);
      }
      version(o, input);
      requireThat(o.state === 'issued', 'Order is closed.');
      const balance = lotBalance(receiptId);
      requireThat(qty.lte(balance.quantity), 'Not enough accepted stock remains in this receipt.');
      const loc = get('SELECT id FROM project_locations WHERE id=? AND company_id=? AND project_id=?', input.location_id, o.company_id, o.project_id);
      requireThat(loc, 'Choose a location in this project.');
      const value = qty.cmp(balance.quantity) === 0 ? money(balance.value) : money(balance.value.times(qty).div(balance.quantity)),
        id = uid('MOV');
      run('INSERT INTO stock_movements(id,receipt_id,company_id,project_id,kind,quantity,company_value,location_id,reason,actor_id,at,command_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', id, receiptId, o.company_id, o.project_id, input.kind, qty.toString(), value, loc.id, reason, actorId, now(), key);
      if (input.kind === 'issue') {
        const line = orderLines(o.id).find(l => l.id === r.order_line_id);
        run('INSERT INTO construction_cost_facts(id,company_id,project_id,cost_item_id,kind,amount,source_type,source_id,at) VALUES(?,?,?,?,?,?,?,?,?)', uid('CF'), o.company_id, o.project_id, line.cost_item_id, 'incurred', value, 'stock_movement', id, now());
      }
      run('UPDATE purchase_orders SET version=version+1 WHERE id=?', o.id);
      event('order', {
        ...o,
        version: o.version + 1
      }, input.kind, `${qty} moved against receipt ${receiptId}. ${reason}`);
      return orderDetail(o.id);
    });
  }
  function workspace(company, project) {
    scope(company, project);
    const permits = cap => access.has(cap, company, project, !project);
    requireThat(permits('requests.read') || permits('materials.read'), 'Procurement workspace is restricted.', 403);
    const inScope = r => r.company_id === company && (!project || r.project_id === project);
    const reqs = all('SELECT * FROM material_requests WHERE company_id=? ORDER BY created_at DESC', company).filter(r => inScope(r) && access.has('requests.read', company, r.project_id)).map(r => requestDetail(r.id));
    const orders = all('SELECT * FROM purchase_orders WHERE company_id=? ORDER BY issued_at DESC', company).filter(r => inScope(r) && (access.has('requests.read', company, r.project_id) || access.has('materials.read', company, r.project_id))).map(r => orderDetail(r.id));
    const locations = all('SELECT * FROM project_locations WHERE company_id=? ORDER BY code', company).filter(r => inScope(r) && (access.has('requests.read', company, r.project_id) || access.has('materials.read', company, r.project_id)));
    const work = all('SELECT * FROM work_packages WHERE company_id=? ORDER BY code', company).filter(r => inScope(r) && access.has('requests.read', company, r.project_id));
    const awaiting = reqs.filter(r => r.can_approve),
      late = orders.filter(o => o.lines.some(l => new D(l.outstanding).gt(0))),
      rejected = orders.flatMap(o => o.receipts).filter(r => new D(r.rejected).gt(0));
    return {
      requests: reqs,
      orders,
      locations,
      work_packages: work,
      creatable_projects: all('SELECT id,name FROM projects WHERE company_id=?', company).filter(p => (!project || p.id === project) && access.has('requests.write', company, p.id)),
      products: all('SELECT id,code,name,uom FROM products WHERE company_id=? AND active=1 ORDER BY name', company),
      vendors: permits('procurement.write') ? all('SELECT id,name,currency FROM vendors WHERE company_id=? ORDER BY name', company) : [],
      capabilities: access.caps(company, project, !project),
      findings: [{
        id: 'reviews',
        text: awaiting.length ? `${awaiting.length} sourcing ${awaiting.length === 1 ? 'plan needs' : 'plans need'} your independent review.` : 'No sourcing plans await your review.',
        sourceIds: awaiting.map(r => r.id)
      }, {
        id: 'supply',
        text: `${late.length} supplier ${late.length === 1 ? 'order has' : 'orders have'} outstanding supply. Deliveries, rejections and returns remain separate.`,
        sourceIds: late.map(o => o.id)
      }, {
        id: 'quality',
        text: `${rejected.length} ${rejected.length === 1 ? 'delivery includes' : 'deliveries include'} rejected goods. Rejected quantities do not enter available stock.`,
        sourceIds: rejected.map(r => r.order_id)
      }]
    };
  }
  return {
    workspace,
    requestDetail,
    createRequest,
    updateRequest,
    addQuote,
    sourcePlan,
    decide,
    issueOrders,
    orderDetail,
    receive,
    moveStock
  };
}
