import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, decide, post, returned, creditInput, today } from './helpers/payable-fixture.mjs';
import { payables, payableRatio } from '../server/payables.mjs';
import { ledger } from '../server/ledger.mjs';
import { createService } from '../server/service.mjs';
import { openDatabase } from '../server/db.mjs';
import { installPayableExamples } from '../server/payables-examples.mjs';
import { D, sum, money } from '../server/money.mjs';
import { payablesCsv } from '../src/payables-export.js';
import { accessAdmin } from '../server/access-admin.mjs';
test('matched supplier bill posts once, balances both currencies, freezes source and leaves cash/operational cost unchanged', t => {
  const f = fixture(t),
    cost = JSON.stringify(createService(f.db, 'ahmed', today).report('jakh')),
    bill = post(f);
  assert.equal(bill.total, '315.00');
  assert.equal(bill.company_total, '1298.89');
  assert.equal(bill.lines[0].net, '300.00');
  assert.equal(bill.lines[0].tax, '15.00');
  assert.equal(bill.state, 'posted');
  assert.equal(f.author.detail(bill.id).can_open_ledger, false);
  assert.equal(sum(bill.journal.map(l => l.base_debit)).cmp(sum(bill.journal.map(l => l.base_credit))), 0);
  assert.equal(bill.journal.filter(l => new D(l.credit).gt(0))[0].account_id, f.control.id);
  const journal = f.accounting.detail(bill.journal_id);
  assert.equal(journal.source_id, bill.id);
  assert.equal(journal.source_type, 'payable');
  assert.equal(journal.can_reverse, false);
  for (const action of [() => f.accounting.reverse(journal.id, {
    version: journal.version,
    accounting_date: today(),
    reason: 'Bad correction'
  }), () => f.accounting.decide(journal.id, {
    version: journal.version,
    action: 'post',
    reason: 'Repeat'
  }), () => f.accounting.save(journal.id, {})]) assert.throws(action, /source document/);
  assert.throws(() => decide(f.reviewer, bill, 'post'), {
    status: 403
  });
  assert.equal(JSON.stringify(createService(f.db, 'ahmed', today).report('jakh')), cost);
  const r = f.author.report('jakh');
  assert.equal(r.totals.open, '1298.89');
  assert.equal(r.totals.difference, '0.00');
  assert.equal(r.rows[0].open, '315.00');
  assert.equal(f.manager.orderDetail(f.order.id).receipts[0].net_billed, '30');
});
test('receipt ceilings exclude rejected and returned stock, include consumed stock and recheck competing submissions atomically', t => {
  const f = fixture(t);
  assert.throws(() => f.author.save(null, {
    ...f.input,
    lines: [{
      ...f.input.lines[0],
      quantity: '35'
    }]
  }), /net accepted/);
  const first = decide(f.author, f.author.save(null, f.input), 'submit'),
    second = decide(f.author, f.author.save(null, {
      ...f.input,
      reference: 'INV-002'
    }), 'submit');
  const o = f.manager.orderDetail(f.order.id);
  f.manager.moveStock(o.receipts[0].id, {
    version: o.version,
    command_key: 'consume',
    kind: 'issue',
    quantity: '10',
    location_id: 'harbour-unit',
    reason: 'Consumed goods still billable'
  });
  decide(f.reviewer, first, 'post');
  const count = f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n;
  assert.throws(() => decide(f.reviewer, second, 'post'), /net accepted/);
  assert.equal(f.author.detail(second.id).state, 'submitted');
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n, count);
  assert.throws(() => f.author.save(null, {
    ...f.input,
    reference: 'INV-003',
    lines: [f.input.lines[0], f.input.lines[0]]
  }), /each receipt/);
});
test('separate AP authority, current role/scope and independent preparer are enforced; old limits do not imply AP posting', t => {
  const f = fixture(t),
    r = decide(f.author, f.author.save(null, f.input), 'submit');
  f.db.prepare("UPDATE memberships SET role_id='financial_controller',ledger_approval_limit='999999',approval_limit='999999',budget_approval_limit='999999',ap_approval_limit='0' WHERE user_id='ap-reviewer'").run();
  assert.throws(() => decide(f.reviewer, r, 'post'), {
    status: 403
  });
  f.db.prepare("UPDATE memberships SET ap_approval_limit='1298.88' WHERE user_id='ap-reviewer'").run();
  assert.throws(() => decide(f.reviewer, r, 'post'), {
    status: 403
  });
  f.db.prepare("UPDATE memberships SET role_id='financial_controller',ap_approval_limit='999999' WHERE user_id='ap-author'").run();
  assert.throws(() => decide(f.author, r, 'post'), {
    status: 403
  });
  f.db.prepare("UPDATE memberships SET ap_approval_limit='1298.89' WHERE user_id='ap-reviewer'").run();
  assert.equal(decide(f.reviewer, r, 'post').state, 'posted');
});
test('source identity and legal reference are controlled; invalid dates, quantity precision, taxes and price variances fail without a draft', t => {
  const f = fixture(t);
  for (const patch of [{
    document_date: '2026-02-30'
  }, {
    due_date: '2026-01-01'
  }, {
    accounting_date: '2026-10-28'
  }, {
    rate_date: '2026-10-30'
  }, {
    rate: '0'
  }, {
    kind: 'unknown'
  }, {
    order_id: 'other'
  }]) assert.throws(() => f.author.save(null, {
    ...f.input,
    ...patch
  }));
  for (const patch of [{
    quantity: '1.0000001'
  }, {
    price_basis: '0'
  }, {
    unit_price: '11'
  }, {
    account_id: f.control.id
  }, {
    tax_id: 'unknown'
  }]) assert.throws(() => f.author.save(null, {
    ...f.input,
    lines: [{
      ...f.input.lines[0],
      ...patch
    }]
  }));
  const a = f.author.save(null, {
    ...f.input,
    reference: ' Inv-001  '
  });
  assert.throws(() => f.author.save(null, {
    ...f.input,
    reference: 'inv-001'
  }), /already exists/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM payable_documents').get().n, 1);
  decide(f.author, a, 'cancel');
  assert.equal(f.author.save(null, f.input).state, 'draft');
});
test('exact price basis and configured nonrecoverable tax do not round a unit price before multiplication', t => {
  const f = fixture(t);
  assert.equal(payableRatio('3', '10', '3'), '10.00');
  assert.equal(payableRatio('1', '10', '3'), '3.33');
  const tax = f.reviewer.tax(null, {
    company_id: 'jakh',
    code: 'HALF',
    name: 'Half recovery test',
    rate: '5',
    recoverable: '50',
    account_id: f.taxAccount.id,
    effective_from: '2026-01-01',
    active: true,
    reason: 'Test mixed recovery'
  });
  const r = post(f, {
    ...f.input,
    lines: [{
      ...f.input.lines[0],
      quantity: '3',
      unit_price: '10',
      price_basis: '3',
      tax_id: tax.id,
      variance_reason: 'Explicit supplier price variance'
    }]
  });
  assert.equal(r.lines[0].net, '10.00');
  assert.equal(r.lines[0].tax, '0.50');
  assert.equal(r.lines[0].recoverable, '0.25');
  assert.equal(r.lines[0].cost, '10.25');
  assert.equal(r.total, '10.50');
  assert.equal(r.lines[0].variance, '-20.00');
});
test('tax/account/control version changes require preparation again, while blocked new-purchase suppliers still permit issued-order liabilities', t => {
  const f = fixture(t);
  let r = decide(f.author, f.author.save(null, f.input), 'submit');
  f.reviewer.tax(f.tax.id, {
    version: f.tax.version,
    active: true,
    name: 'Renamed treatment',
    reason: 'Test review invalidation'
  });
  assert.throws(() => decide(f.reviewer, r, 'post'), /Tax code changed/);
  r = decide(f.reviewer, r, 'return');
  r = f.author.save(r.id, {
    ...f.input,
    version: r.version
  });
  r = decide(f.author, r, 'submit');
  f.accounting.account(f.expense.id, {
    ...f.expense,
    active: true,
    name: 'Renamed expense',
    reason: 'Test account invalidation'
  });
  assert.throws(() => decide(f.reviewer, r, 'post'), /account changed/);
  r = decide(f.reviewer, r, 'return');
  r = f.author.save(r.id, {
    ...f.input,
    version: r.version
  });
  r = decide(f.author, r, 'submit');
  f.db.prepare("UPDATE party_companies SET blocked=1 WHERE company_id='jakh' AND vendor_id='euro'").run();
  assert.equal(decide(f.reviewer, r, 'post').state, 'posted');
});
test('return credits require physical overbilling, preserve original values and exhaust cents exactly across partial credits', t => {
  const f = fixture(t),
    bill = post(f);
  assert.throws(() => f.author.save(null, creditInput(f, bill, '1')), /returned overbilled/);
  returned(f, '30');
  const credits = ['7', '7', '7', '9'].map((q, i) => post(f, creditInput(f, bill, q, 'CR-' + i)));
  for (const key of ['net', 'tax', 'recoverable', 'cost', 'gross', 'base_cost', 'base_recoverable', 'base_gross']) assert.equal(money(sum(credits.map(c => c.lines[0][key]))), bill.lines[0][key], key);
  assert.equal(f.author.report('jakh').totals.open, '0.00');
  assert.equal(f.author.report('jakh').totals.difference, '0.00');
  assert.equal(f.manager.orderDetail(f.order.id).receipts[0].net_billed, '0');
  assert.throws(() => f.author.save(null, creditInput(f, bill, '1', 'extra')), /remainder/);
  assert.equal(f.db.prepare("SELECT count(*) n FROM stock_movements WHERE kind='return'").get().n, 1);
});
test('returns before billing cannot be reused to claim credit; concurrent drafts refresh residual cents after another credit posts', t => {
  const f = fixture(t);
  returned(f, '5');
  const bill = post(f, {
    ...f.input,
    lines: [{
      ...f.input.lines[0],
      quantity: '25'
    }]
  });
  assert.throws(() => f.author.save(null, creditInput(f, bill, '5')), /overbilled/);
  returned(f, '5');
  let a = decide(f.author, f.author.save(null, creditInput(f, bill, '2', 'CR-A')), 'submit'),
    b = decide(f.author, f.author.save(null, creditInput(f, bill, '2', 'CR-B')), 'submit');
  decide(f.reviewer, a, 'post');
  // A source-value allocation may remain identical; either identical safe allocation or stale refusal is permitted, never excess.
  try {
    b = decide(f.reviewer, b, 'post');
  } catch (e) {
    assert.equal(e.status, 409);
    b = decide(f.reviewer, b, 'return');
    b = f.author.save(b.id, {
      ...creditInput(f, bill, '2', 'CR-B'),
      version: b.version
    });
    b = decide(f.reviewer, decide(f.author, b, 'submit'), 'post');
  }
  assert.equal(b.state, 'posted');
  assert.throws(() => post(f, creditInput(f, bill, '2', 'CR-C')), /overbilled/);
  assert.equal(f.author.report('jakh').totals.difference, '0.00');
});
test('period close blocks submitted payables, closed periods block posting and failed posting consumes no number', t => {
  const f = fixture(t);
  let r = decide(f.author, f.author.save(null, f.input), 'submit');
  assert.throws(() => f.accounting.periodDecision(f.period.id, {
    version: 1,
    action: 'close',
    reason: 'Month end'
  }), /supplier bills/);
  r = decide(f.author, r, 'withdraw');
  f.accounting.periodDecision(f.period.id, {
    version: 1,
    action: 'close',
    reason: 'Month end'
  });
  r = decide(f.author, r, 'submit');
  assert.throws(() => decide(f.reviewer, r, 'post'), /open company period/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_sequences').get().n, 0);
});
test('AP clerk scope hides general ledger, customer/HR, foreign documents, source lots, search and export data', t => {
  const f = fixture(t),
    bill = post(f),
    other = payables(f.db, 'ap-project', today),
    site = payables(f.db, 'mohammed', today);
  assert.throws(() => ledger(f.db, 'ap-author', today).list('jakh'), {
    status: 404
  });
  for (const svc of [other, site]) {
    assert.throws(() => svc.detail(bill.id), {
      status: 404
    });
    assert.throws(() => svc.sources('jakh', 'harbour'), {
      status: 404
    });
  }
  assert.equal(other.list('jakh').length, 0);
  assert.equal(other.report('jakh').rows.length, 0);
  assert.equal(createService(f.db, 'ap-project', today).search('jakh', 'INV-001').length, 0);
  const w = createService(f.db, 'ap-author', today).workspace('jakh');
  assert.equal(w.ledger_entries.length, 0);
  assert.equal(w.records.length, 0);
  assert.equal(w.payable_documents.length, 1);
  assert.throws(() => f.author.settings('jakh', {
    account_id: f.control.id,
    reason: 'Attempt'
  }), {
    status: 403
  });
  f.db.prepare("UPDATE users SET active=0 WHERE id='ap-author'").run();
  assert.throws(() => f.author.detail(bill.id));
});
test('posted documents, lines and history are immutable; scoped report and CSV reconcile credits by accounting date', t => {
  const f = fixture(t),
    bill = post(f);
  returned(f, '5');
  post(f, creditInput(f, bill, '5'));
  for (const sql of ["UPDATE payable_documents SET total='0' WHERE state='posted'", 'DELETE FROM payable_documents', 'DELETE FROM payable_lines', "UPDATE payable_lines SET quantity='0'", 'DELETE FROM payable_events', "UPDATE payable_events SET reason='bad'"]) assert.throws(() => f.db.exec(sql), /immutable|retained/);
  const r = f.author.report('jakh', {
    project: 'harbour',
    to: today()
  });
  assert.equal(r.rows[0].open, '262.50');
  assert.equal(r.totals.difference, '0.00');
  assert.equal(r.rows[0].credits.length, 1);
  assert.equal(f.author.report('jakh', {
    to: '2026-10-28'
  }).rows.length, 0);
  r.rows[0].reference = '=UNSAFE()';
  const csv = payablesCsv(r);
  assert.ok(csv.indexOf('Findings') < csv.indexOf('Bill ID'));
  assert.ok(csv.includes("'=UNSAFE()"));
  assert.ok(csv.includes('Linked return credits'));
});
test('AP access limit defaults to zero, validates role and persists through independent reviewed grant changes', t => {
  const f = fixture(t);
  f.db.prepare("UPDATE users SET access_admin=1 WHERE id='ahmed'").run();
  const admin = accessAdmin(f.db, 'ahmed');
  const u = admin.list().users.find(u => u.user.id === 'ap-reviewer').user;
  const data = {
    version: u.access_version,
    active: true,
    reason: 'Reviewed supplier posting authority',
    grants: [{
      company_id: 'jakh',
      project_id: '*',
      role_id: 'financial_controller',
      approval_limit: '0',
      ap_approval_limit: '500'
    }]
  };
  const updated = admin.save('ap-reviewer', data);
  assert.equal(updated.grants[0].ap_approval_limit, '500.00');
  assert.equal(updated.grants[0].ledger_approval_limit, '0.00');
  assert.throws(() => admin.save('ap-reviewer', {
    ...data,
    version: updated.user.access_version,
    grants: [{
      ...data.grants[0],
      role_id: 'ap_clerk'
    }]
  }), /cannot post supplier/);
});
test('payable examples are additive, independent, scoped to every supplied project and idempotent', t => {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  const count = () => db.prepare('SELECT count(*) n FROM payable_documents').get().n;
  assert.equal(count(), 18);
  installPayableExamples(db);
  assert.equal(count(), 18);
  for (const p of db.prepare('SELECT * FROM projects').all()) {
    const s = payables(db, 'example-ap-author', today),
      r = s.report(p.company_id, {
        project: p.id
      });
    assert.equal(s.list(p.company_id, p.id).length, 6);
    assert.equal(r.totals.difference, '0.00');
    assert.equal(r.rows.length, 2);
    assert.ok(r.exceptions.some(e => new D(e.credit_needed).gt(0)));
    assert.equal(r.pending, 1);
  }
  assert.equal(db.prepare('SELECT count(*) n FROM identities').get().n, 0);
  assert.equal(db.prepare("SELECT ap_approval_limit FROM memberships WHERE user_id='ahmed' LIMIT 1").get().ap_approval_limit, '0');
});
