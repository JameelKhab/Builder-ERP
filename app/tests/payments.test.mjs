import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, post, returned, creditInput, today, decide } from './helpers/payable-fixture.mjs';
import { payments } from '../server/payments.mjs';
import { ledger } from '../server/ledger.mjs';
import { D } from '../server/money.mjs';
import { setup, approve, record, statement } from './helpers/payment-fixture.mjs';
test('payments keep approval separate from cash, exact partial balance, FX and typed control', t => {
  const f = setup(t),
    before = f.reviewer.report('jakh').totals.open;
  let p = approve(f);
  assert.equal(p.state, 'approved');
  assert.equal(f.reviewer.report('jakh').totals.open, before);
  assert.equal(f.maker.report('jakh').rows.length, 0);
  assert.throws(() => f.checker.decide(p.id, {
    version: p.version,
    action: 'record',
    reason: 'test',
    bank_reference: 'x',
    evidence: 'x'
  }), /different person/);
  p = record(f, p);
  assert.equal(p.allocations[0].base_amount, '412.35');
  const report = f.reviewer.report('jakh');
  assert.equal(report.rows[0].open, '215.00');
  assert.equal(report.rows[0].base_open, '886.54');
  assert.equal(report.totals.difference, '0.00');
  assert.equal(f.maker.report('jakh').totals.fx, '17.65');
  assert.equal(f.maker.report('jakh').totals.uncleared, '430.00');
  assert.throws(() => f.accounting.reverse(p.journal_id, {
    version: 2,
    accounting_date: today(),
    reason: 'Bypass'
  }), /source|typed|supplier/i);
  assert.throws(() => f.db.prepare("UPDATE payments SET title='changed' WHERE id=?").run(p.id), /immutable/);
  assert.throws(() => f.db.prepare("DELETE FROM payment_allocations WHERE payment_id=?").run(p.id), /retained/);
});
test('payment reservations, stale balance and final residual exhaust transaction and carrying cents', t => {
  const f = setup(t);
  let a = f.maker.save(null, f.inputPay),
    b = f.maker.save(null, {
      ...f.inputPay,
      bank_amount: '1290',
      allocations: [{
        bill_id: f.bill.id,
        amount: '300'
      }]
    });
  b = decide(f.maker, b, 'submit');
  a = decide(f.checker, decide(f.maker, a, 'submit'), 'approve');
  assert.throws(() => decide(f.checker, b, 'approve'), /reserves/);
  a = record(f, a);
  assert.throws(() => decide(f.checker, b, 'approve'), /balance/);
  b = decide(f.maker, b, 'withdraw');
  b = f.maker.save(b.id, {
    ...f.inputPay,
    version: b.version,
    bank_amount: '860',
    allocations: [{
      bill_id: f.bill.id,
      amount: '215'
    }]
  });
  b = decide(f.checker, decide(f.maker, b, 'submit'), 'approve');
  record(f, b, 'BANK-002');
  const r = f.reviewer.report('jakh');
  assert.equal(r.totals.open, '0.00');
  assert.equal(r.totals.difference, '0.00');
  assert.equal(r.rows[0].base_settled, '1298.89');
  assert.throws(() => f.maker.save(null, f.inputPay), /exceeds/);
});
test('post-payment supplier credit becomes negative balance, refund settles original carrying amounts', t => {
  const f = setup(t);
  record(f, approve(f, {
    ...f.inputPay,
    bank_amount: '1290',
    allocations: [{
      bill_id: f.bill.id,
      amount: '315'
    }]
  }));
  returned(f, '10');
  post(f, creditInput(f, f.bill, '10'));
  let r = f.reviewer.report('jakh');
  assert.equal(r.rows[0].open, '-105.00');
  assert.equal(r.totals.difference, '0.00');
  const refund = record(f, approve(f, {
    ...f.inputPay,
    kind: 'refund',
    bank_amount: '420',
    allocations: [{
      bill_id: f.bill.id,
      amount: '105'
    }]
  }), 'REFUND-001');
  assert.equal(refund.direction, 'in');
  r = f.reviewer.report('jakh');
  assert.equal(r.rows[0].open, '0.00');
  assert.equal(r.rows[0].base_open, '0.00');
  assert.equal(r.totals.difference, '0.00');
  assert.equal(f.maker.report('jakh').totals.incoming, '420.00');
});
test('independent bank matching, duplicate rejection, clearance and reversal retain all facts', t => {
  const f = setup(t),
    p = record(f, approve(f)),
    s = statement(f, p);
  assert.throws(() => f.maker.match(s.rows[0].id, {
    version: 1,
    action: 'match',
    payment_ids: [p.id],
    reason: 'Test'
  }), /./);
  let row = f.banker.match(s.rows[0].id, {
    version: 1,
    action: 'match',
    payment_ids: [p.id],
    reason: 'Amount and reference confirmed'
  });
  assert.equal(f.maker.report('jakh').totals.cleared, '430.00');
  assert.throws(() => f.maker.reverse(p.id, {
    version: p.version,
    accounting_date: today(),
    reason: 'test'
  }), /Unmatch/);
  assert.throws(() => f.banker.match(row.id, {
    version: 1,
    action: 'match',
    payment_ids: [p.id],
    reason: 'test'
  }), /changed/);
  row = f.banker.match(row.id, {
    version: row.version,
    action: 'unmatch',
    reason: 'Correct bank mapping'
  });
  let reversal = f.maker.reverse(p.id, {
    version: p.version,
    accounting_date: today(),
    reason: 'Bank transfer returned; evidenced correction'
  });
  reversal = decide(f.checker, decide(f.maker, reversal, 'submit'), 'approve');
  record(f, reversal, 'RETURN-001');
  assert.equal(f.maker.report('jakh').totals.net, '0.00');
  assert.equal(f.reviewer.report('jakh').totals.open, '1298.89');
  assert.equal(f.reviewer.report('jakh').totals.difference, '0.00');
  const rematched = f.banker.match(row.id, {
    version: row.version,
    action: 'match',
    payment_ids: [p.id],
    reason: 'Original bank outflow remains real; reversal inflow awaits its own statement row'
  });
  assert.equal(rematched.matches.filter(m => m.active).length, 1);
  assert.throws(() => f.maker.reverse(p.id, {
    version: p.version,
    accounting_date: today(),
    reason: 'test'
  }), /unreversed/);
  assert.equal(f.banker.statements('jakh')[0].rows[0].matches[0].active, 0);
});
test('least privilege, independent limit, live revocation, company/project scope and bank evidence arithmetic', t => {
  const f = setup(t),
    r = f.maker.save(null, f.inputPay);
  assert.throws(() => payments(f.db, 'ap-author', today).detail(r.id), /unavailable/);
  assert.throws(() => f.maker.statements('jakh'), /role/);
  f.db.prepare("UPDATE memberships SET payment_approval_limit='420' WHERE user_id='ap-reviewer'").run();
  const s = decide(f.maker, r, 'submit');
  assert.throws(() => decide(f.checker, s, 'approve'), /authority/);
  f.db.prepare("UPDATE memberships SET payment_approval_limit='100000' WHERE user_id='ap-reviewer'").run();
  const a = decide(f.checker, s, 'approve');
  f.db.prepare("UPDATE memberships SET payment_approval_limit='0' WHERE user_id='ap-reviewer'").run();
  assert.throws(() => record(f, a), /authority/);
  assert.throws(() => statement(f, {
    bank_amount: '430',
    bank_reference: 'x'
  }, {
    closing: '9999'
  }), /must equal/);
  f.db.prepare("UPDATE memberships SET project_id='gardens' WHERE user_id='treasury'").run();
  assert.throws(() => f.maker.detail(a.id), /unavailable/);
  assert.equal(f.maker.report('jakh').rows.length, 0);
  assert.throws(() => f.maker.options('international'), /unavailable/);
});
test('same-currency bank amounts, duplicate actual reference and closed periods are guarded', t => {
  const f = setup(t);
  const euro = f.checker.bank(null, {
    ...f.bank,
    id: undefined,
    name: 'EUR bank',
    currency: 'EUR',
    active: true,
    reason: 'Test currency'
  });
  assert.throws(() => f.maker.save(null, {
    ...f.inputPay,
    bank_id: euro.id,
    bank_rate: '4.3'
  }), /Same-currency/);
  const p = record(f, approve(f));
  const a = approve(f);
  assert.throws(() => record(f, a, 'bank-001'), /already recorded/);
  f.db.prepare("UPDATE ledger_periods SET state='closed' WHERE id=?").run(f.period.id);
  assert.throws(() => record(f, a, 'BANK-002'), /open company period/);
  assert.equal(f.maker.report('jakh').rows.length, 1);
  assert.equal(f.maker.detail(p.id).state, 'recorded');
});
test('two payments match one bank row exactly; recording author cannot reconcile after a role change', t => {
  const f = setup(t),
    a = record(f, approve(f)),
    b = record(f, approve(f), 'BANK-002');
  const s = statement(f, {
    bank_amount: '860',
    bank_reference: 'BATCH-1'
  });
  f.db.prepare("UPDATE memberships SET role_id='financial_controller' WHERE user_id='treasury'").run();
  assert.throws(() => f.maker.match(s.rows[0].id, {
    version: 1,
    action: 'match',
    payment_ids: [a.id, b.id],
    reason: 'Check independent recorder'
  }), /independent/);
  assert.throws(() => f.banker.match(s.rows[0].id, {
    version: 1,
    action: 'match',
    payment_ids: [a.id],
    reason: 'Partial match forbidden'
  }), /exactly/);
  const r = f.banker.match(s.rows[0].id, {
    version: 1,
    action: 'match',
    payment_ids: [a.id, b.id],
    reason: 'Batch transaction reference verified'
  });
  assert.equal(r.matches.length, 2);
  assert.equal(f.maker.report('jakh').totals.cleared, '860.00');
  assert.throws(() => f.maker.match(r.id, {
    version: r.version,
    action: 'unmatch',
    reason: 'Recorder cannot remove own evidence'
  }), /independent/);
  assert.equal(f.banker.match(r.id, {
    version: r.version,
    action: 'unmatch',
    reason: 'Independent remapping required'
  }).matches.filter(m => m.active).length, 0);
});
test('foreign bank snapshots retain original currency, scope and gain; future cutoffs and config changes fail safely', t => {
  const f = setup(t),
    eur = f.checker.bank(null, {
      ...f.bank,
      name: 'EUR operating bank',
      currency: 'EUR',
      active: true,
      reason: 'Foreign bank example'
    });
  let p = f.maker.save(null, {
    ...f.inputPay,
    bank_id: eur.id,
    bank_amount: '100',
    bank_rate: '4'
  });
  p = decide(f.maker, p, 'submit');
  f.checker.bank(eur.id, {
    version: eur.version,
    name: eur.name,
    active: false,
    reason: 'Archived before approval'
  });
  assert.throws(() => decide(f.checker, p, 'approve'), /inactive/);
  f.checker.bank(eur.id, {
    version: 2,
    name: eur.name,
    active: true,
    reason: 'Restored before revised review'
  });
  assert.throws(() => decide(f.checker, p, 'approve'), /changed/);
  p = decide(f.maker, p, 'withdraw');
  p = f.maker.save(p.id, {
    ...f.inputPay,
    version: p.version,
    bank_id: eur.id,
    bank_amount: '100',
    bank_rate: '4'
  });
  p = record(f, decide(f.checker, decide(f.maker, p, 'submit'), 'approve'));
  assert.equal(p.bank.currency, 'EUR');
  assert.equal(f.maker.report('jakh').totals.fx, '-12.35');
  assert.equal(f.reviewer.report('jakh').totals.difference, '0.00');
  assert.equal(f.maker.report('jakh', {
    to: '2026-10-28'
  }).rows.length, 0);
  assert.throws(() => f.maker.report('jakh', {
    to: '2026-10-30'
  }), /future/);
});
test('multi-bill multi-project payment balances each project and restricts its full batch to company scope', async t => {
  const f = setup(t),
    {
      procurement
    } = await import('../server/procurement.mjs'),
    proc = procurement(f.db, 'sara', today),
    manager = procurement(f.db, 'ahmed', today);
  let req = proc.createRequest({
    company_id: 'jakh',
    project_id: 'gardens',
    title: 'Second project invoice for supplier batch',
    needed_by: '2026-11-06',
    lines: [{
      product_id: 'jakh-BLOCK',
      work_package_id: 'WP-C-201',
      location_id: 'gardens-unit',
      quantity: '10',
      note: 'Multi-project payment test'
    }]
  });
  req = proc.decide(req.id, {
    version: req.version,
    action: 'submit'
  });
  req = proc.addQuote(req.id, {
    version: req.version,
    line_id: req.lines[0].id,
    vendor_id: 'euro',
    reference: 'Batch quote',
    quantity: '10',
    unit_price: '10',
    rate: '4',
    rate_date: today(),
    rate_source: 'Fictional test',
    valid_until: '2026-11-06',
    lead_days: 1
  });
  req = proc.sourcePlan(req.id, {
    version: req.version,
    allocations: [{
      quote_id: req.quotes[0].id,
      quantity: '10'
    }]
  });
  req = manager.decide(req.id, {
    version: req.version,
    action: 'approve'
  });
  let o = proc.issueOrders(req.id, {
    version: req.version
  })[0];
  o = manager.receive(o.id, {
    version: o.version,
    command_key: 'batch-receipt',
    line_id: o.lines[0].id,
    accepted: '10',
    rejected: '0',
    delivery_reference: 'Batch DN',
    reason: 'Accepted test delivery'
  });
  const b = post(f, {
    ...f.input,
    order_id: o.id,
    reference: 'INV-GARDENS',
    lines: [{
      ...f.input.lines[0],
      receipt_id: o.receipts[0].id,
      quantity: '10'
    }]
  });
  const approved = approve(f, {
    ...f.inputPay,
    bank_amount: '645.01',
    allocations: [{
      bill_id: f.bill.id,
      amount: '100'
    }, {
      bill_id: b.id,
      amount: '50'
    }]
  });
  assert.equal(f.maker.report('jakh', {
    project: 'harbour'
  }).planned[0].total, '100.00');
  assert.equal(f.maker.report('jakh', {
    project: 'gardens'
  }).planned[0].total, '50.00');
  const p = record(f, approved);
  assert.equal(p.project_id, null);
  assert.equal(new D(p.allocations[0].bank_base).plus(p.allocations[1].bank_base).toFixed(2), '645.01');
  for (const project of ['harbour', 'gardens']) {
    assert.equal(f.reviewer.report('jakh', {
      project
    }).totals.difference, '0.00');
    const r = f.accounting.report('jakh', {
      project
    });
    assert.equal(r.totals.debit, r.totals.credit);
  }
  f.db.prepare("UPDATE memberships SET project_id='harbour' WHERE user_id='treasury'").run();
  assert.throws(() => f.maker.detail(p.id), /unavailable/);
  assert.equal(f.maker.list('jakh').length, 0);
  const partial = f.maker.report('jakh');
  assert.equal(partial.rows.length, 1);
  assert.equal(partial.rows[0].project_id, 'harbour');
  assert.equal(partial.rows[0].can_open, false);
  assert.ok(!JSON.stringify(partial).includes('INV-GARDENS'));
});
test('statement correction keeps original evidence, requires another reconciler and releases the period for replacement', t => {
  const f = setup(t),
    p = record(f, approve(f)),
    s = statement(f, p);
  assert.throws(() => f.banker.voidStatement(s.id, {
    reason: 'Mistyped section'
  }), /Another reconciler/);
  const row = f.banker.match(s.rows[0].id, {
    version: 1,
    action: 'match',
    payment_ids: [p.id],
    reason: 'Test match'
  });
  assert.throws(() => f.checker.voidStatement(s.id, {
    reason: 'Correct statement'
  }), /Unmatch/);
  f.banker.match(row.id, {
    version: row.version,
    action: 'unmatch',
    reason: 'Wrong source statement'
  });
  assert.ok(f.checker.voidStatement(s.id, {
    reason: 'Preserve and replace erroneous statement'
  }).voided);
  assert.throws(() => f.banker.match(row.id, {
    version: 3,
    action: 'match',
    payment_ids: [p.id],
    reason: 'Cannot use voided evidence'
  }), /voided/);
  const replacement = statement(f, p, {
    reference: 'STMT-CORRECTED'
  });
  assert.notEqual(replacement.id, s.id);
  assert.equal(f.banker.statements('jakh').length, 2);
  assert.throws(() => f.db.prepare('DELETE FROM bank_statement_voids').run(), /retained/);
});
test('payment reversal exactly offsets original account postings, including exchange differences', t => {
  const f = setup(t),
    p = record(f, approve(f));
  let r = f.maker.reverse(p.id, {
    version: p.version,
    accounting_date: today(),
    reason: 'Transfer returned'
  });
  r = record(f, decide(f.checker, decide(f.maker, r, 'submit'), 'approve'), 'RETURN-EXACT');
  const lines = f.db.prepare('SELECT account_id,base_debit,base_credit FROM ledger_lines WHERE entry_id IN (?,?)').all(p.journal_id, r.journal_id);
  for (const account of new Set(lines.map(l => l.account_id))) {
    let balance = new D(0);
    for (const l of lines.filter(l => l.account_id === account)) balance = balance.plus(l.base_debit).minus(l.base_credit);
    assert.equal(balance.toFixed(2), '0.00');
  }
});
test('payment examples cover all projects, partial/cleared/refund/reversal/planned states without real identities or cost duplication', async t => {
  const {
      openDatabase
    } = await import('../server/db.mjs'),
    {
      installPaymentExamples
    } = await import('../server/payments-examples.mjs'),
    db = openDatabase(':memory:', {
      examples: true
    });
  t.after(() => db.close());
  const count = () => db.prepare('SELECT count(*) n FROM payments').get().n;
  assert.equal(count(), 24);
  installPaymentExamples(db);
  assert.equal(count(), 24);
  for (const p of db.prepare('SELECT * FROM projects').all()) {
    const svc = payments(db, 'example-treasury', today),
      r = svc.report(p.company_id, {
        project: p.id
      });
    assert.equal(svc.list(p.company_id, p.id).length, 8);
    assert.equal(r.rows.length, 6);
    assert.equal(r.planned.length, 1);
    assert.ok(r.rows.some(x => x.clearance));
    assert.ok(r.rows.some(x => x.reversal_of));
    assert.ok(r.rows.some(x => x.direction === 'in' && !x.reversal_of));
    assert.equal((await import('../server/payables.mjs')).payables(db, 'example-ap-author', today).report(p.company_id, {
      project: p.id
    }).totals.difference, '0.00');
  }
  assert.equal(db.prepare('SELECT count(*) n FROM identities').get().n, 0);
  assert.equal(db.prepare("SELECT payment_approval_limit FROM memberships WHERE user_id='ahmed' LIMIT 1").get().payment_approval_limit, '0');
});
test('bank auditors have read-only statement access; payment limits remain separate and period closure respects pending plans', async t => {
  const f = setup(t),
    {
      accessAdmin
    } = await import('../server/access-admin.mjs'),
    p = approve(f);
  assert.throws(() => f.accounting.periodDecision(f.period.id, {
    version: f.period.version,
    action: 'close',
    reason: 'Cannot leave approved payment stranded'
  }), /pending payments/);
  const u = f.db.prepare("SELECT * FROM users WHERE id='treasury'").get();
  const admin = accessAdmin(f.db, 'ahmed');
  assert.throws(() => admin.save('treasury', {
    version: u.access_version,
    active: true,
    reason: 'Invalid payment authority for preparer',
    grants: [{
      company_id: 'jakh',
      project_id: '*',
      role_id: 'treasury_clerk',
      approval_limit: '0',
      payment_approval_limit: '1000'
    }]
  }), /cannot approve payments/);
  record(f, p);
  const s = statement(f, f.maker.detail(p.id));
  f.db.prepare("UPDATE memberships SET role_id='auditor' WHERE user_id='treasury'").run();
  assert.equal(f.maker.statements('jakh').length, 1);
  assert.equal(f.maker.options('jakh').can_bank_read, true);
  assert.equal(f.maker.options('jakh').can_reconcile, false);
  assert.throws(() => f.maker.voidStatement(s.id, {
    reason: 'Auditor cannot mutate'
  }), /role/);
  assert.throws(() => f.maker.match(s.rows[0].id, {
    version: 1,
    action: 'match',
    payment_ids: [p.id],
    reason: 'Auditor cannot reconcile'
  }), /role/);
});
