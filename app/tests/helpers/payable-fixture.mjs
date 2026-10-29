import { openDatabase } from '../../server/db.mjs';
import { procurement } from '../../server/procurement.mjs';
import { ledger } from '../../server/ledger.mjs';
import { payables } from '../../server/payables.mjs';
export const today = () => '2026-10-29';
export function fixture(t) {
  const db = openDatabase();
  t.after(() => db.close());
  for (const [id, role, scope] of [['ap-author', 'ap_clerk', '*'], ['ap-reviewer', 'financial_controller', '*'], ['ap-other', 'financial_controller', '*'], ['ap-project', 'ap_clerk', 'gardens']]) {
    db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, id, role);
    db.prepare('INSERT INTO memberships(user_id,company_id,project_id,role_id,ap_approval_limit) VALUES(?,?,?,?,?)').run(id, 'jakh', scope, role, role === 'financial_controller' ? '100000' : '0');
  }
  const accounting = ledger(db, 'ap-reviewer', today),
    author = payables(db, 'ap-author', today),
    reviewer = payables(db, 'ap-reviewer', today);
  const create = (code, type, purpose) => accounting.account(null, {
    company_id: 'jakh',
    code,
    name: 'Test ' + code,
    type,
    purpose,
    active: true,
    reason: 'Test accounting source'
  });
  const expense = create('5000', 'expense', 'general'),
    control = create('2100', 'liability', 'payable'),
    taxAccount = create('1400', 'asset', 'tax');
  const period = accounting.period({
    company_id: 'jakh',
    name: 'October',
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    reason: 'Test period'
  });
  reviewer.settings('jakh', {
    account_id: control.id,
    reason: 'Test AP control'
  });
  const tax = reviewer.tax(null, {
    company_id: 'jakh',
    code: 'TEST5',
    name: 'Test exclusive 5%',
    rate: '5',
    recoverable: '100',
    account_id: taxAccount.id,
    effective_from: '2026-01-01',
    effective_until: null,
    active: true,
    reason: 'Test configured arithmetic'
  });
  const site = procurement(db, 'mohammed', today),
    buyer = procurement(db, 'sara', today),
    manager = procurement(db, 'ahmed', today);
  let req = site.createRequest({
    company_id: 'jakh',
    project_id: 'harbour',
    title: 'Receipt matching test',
    needed_by: '2026-11-06',
    lines: [{
      product_id: 'jakh-BLOCK',
      work_package_id: 'WP-C-103',
      location_id: 'harbour-unit',
      quantity: '100',
      note: 'Test accepted quantities'
    }]
  });
  req = site.decide(req.id, {
    version: req.version,
    action: 'submit'
  });
  req = buyer.addQuote(req.id, {
    version: req.version,
    line_id: req.lines[0].id,
    vendor_id: 'euro',
    reference: 'Test quote',
    quantity: '100',
    unit_price: '10',
    rate: '4',
    rate_date: today(),
    rate_source: 'Test PO FX',
    valid_until: '2026-11-06',
    lead_days: 1
  });
  req = buyer.sourcePlan(req.id, {
    version: req.version,
    allocations: [{
      quote_id: req.quotes[0].id,
      quantity: '100'
    }]
  });
  req = manager.decide(req.id, {
    version: req.version,
    action: 'approve'
  });
  let order = buyer.issueOrders(req.id, {
    version: req.version
  })[0];
  order = manager.receive(order.id, {
    version: order.version,
    command_key: 'receipt-test',
    line_id: order.lines[0].id,
    accepted: '30',
    rejected: '5',
    delivery_reference: 'Test DN',
    reason: 'Rejected five blocks'
  });
  const input = {
    kind: 'bill',
    order_id: order.id,
    title: 'Receipt matched bill',
    reference: 'INV-001',
    document_date: today(),
    accounting_date: today(),
    due_date: '2026-11-01',
    rate: '4.123456',
    rate_date: today(),
    rate_source: 'Test independent accounting FX',
    explanation: 'Test liability without cash or duplicated operational cost',
    lines: [{
      receipt_id: order.receipts[0].id,
      quantity: '30',
      unit_price: '10',
      price_basis: '1',
      account_id: expense.id,
      tax_id: tax.id,
      variance_reason: ''
    }]
  };
  return {
    db,
    author,
    reviewer,
    accounting,
    expense,
    control,
    taxAccount,
    tax,
    period,
    site,
    buyer,
    manager,
    order,
    input
  };
}
export const decide = (svc, r, action) => svc.decide(r.id, {
  version: r.version,
  action,
  reason: 'Test independently checked source and result'
});
export function post(f, input = f.input) {
  return decide(f.reviewer, decide(f.author, f.author.save(null, input), 'submit'), 'post');
}
export function returned(f, quantity) {
  const o = f.manager.orderDetail(f.order.id);
  return f.manager.moveStock(o.receipts[0].id, {
    version: o.version,
    command_key: 'return-' + o.version,
    kind: 'return',
    quantity,
    location_id: 'harbour-unit',
    reason: 'Test physical return after billing'
  });
}
export const creditInput = (f, bill, quantity, reference = 'CR-001') => ({
  ...f.input,
  kind: 'credit',
  original_id: bill.id,
  reference,
  title: 'Linked return credit',
  lines: [{
    original_line_id: bill.lines[0].id,
    quantity
  }]
});
