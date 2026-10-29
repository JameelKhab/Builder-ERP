import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { receipts } from '../server/receipts.mjs';
import { payments } from '../server/payments.mjs';
import { certificates } from '../server/certificates.mjs';
import { ledger } from '../server/ledger.mjs';
import { money, sum } from '../server/money.mjs';
import { receiptsCsv } from '../src/receipts-export.js';
import { installReceiptExamples } from '../server/receipts-examples.mjs';
import { createService } from '../server/service.mjs';
const today = () => '2026-10-29',
  reason = 'Independent test decision with retained evidence';
const evidence = {
  filename: 'fictional-remittance.txt',
  base64: Buffer.from('Fictional bank evidence for local tests only.').toString('base64')
};
function fixture(t) {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  for (const [id, role] of [['receipt-author', 'ar_clerk'], ['receipt-reviewer', 'financial_controller'], ['receipt-recorder', 'treasury_clerk'], ['receipt-banker', 'bank_reconciler'], ['receipt-project', 'ar_clerk']]) {
    db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, id, role);
    for (const c of ['jakh', 'jakh-international']) if (db.prepare('SELECT id FROM companies WHERE id=?').get(c)) db.prepare('INSERT INTO memberships(user_id,company_id,project_id,role_id,receipt_approval_limit) VALUES(?,?,?,?,?)').run(id, c, id === 'receipt-project' ? 'harbour' : '*', role, role === 'financial_controller' ? '1000000.00' : '0.00');
  }
  // Use actual company IDs rather than assumptions for the USD fixture.
  const foreign = db.prepare("SELECT id FROM companies WHERE currency='USD'").get().id;
  for (const [id, role] of [['receipt-author', 'ar_clerk'], ['receipt-reviewer', 'financial_controller'], ['receipt-recorder', 'treasury_clerk'], ['receipt-banker', 'bank_reconciler']]) db.prepare('INSERT OR IGNORE INTO memberships(user_id,company_id,project_id,role_id,receipt_approval_limit) VALUES(?,?,?,?,?)').run(id, foreign, '*', role, role === 'financial_controller' ? '1000000.00' : '0.00');
  const exampleAuthor = receipts(db, 'example-receipt-author', today);
  for (const x of db.prepare("SELECT * FROM client_receipts WHERE author_id='example-receipt-author' AND state IN ('draft','submitted','approved','returned')").all()) {
    let r = x;
    if (['submitted', 'approved'].includes(r.state)) r = exampleAuthor.decide(r.id, {
      version: r.version,
      action: 'withdraw',
      reason
    });
    exampleAuthor.decide(r.id, {
      version: r.version,
      action: 'cancel',
      reason
    });
  }
  const author = receipts(db, 'receipt-author', today),
    reviewer = receipts(db, 'receipt-reviewer', today),
    recorder = receipts(db, 'receipt-recorder', today),
    banker = payments(db, 'receipt-banker', today),
    bank = payments(db, 'example-client-finance-reviewer', today).bank(null, {
      ...db.prepare("SELECT * FROM payment_banks WHERE company_id='jakh'").get(),
      name: 'Receipt test bank',
      active: true,
      reason
    }).id;
  const invoice = author.balances('jakh', 'harbour')[0];
  return {
    db,
    author,
    reviewer,
    recorder,
    banker,
    bank,
    invoice,
    foreign
  };
}
function input(f, allocations = [{
  invoice_id: f.invoice.id,
  amount: '1000.00'
}], extra = {}) {
  return {
    company_id: 'jakh',
    bank_id: f.bank,
    title: 'Fictional customer remittance',
    accounting_date: '2026-10-29',
    bank_amount: money(sum(allocations.map(a => a.amount))),
    bank_rate: '1',
    rate_date: '2026-10-29',
    rate_source: 'Same-currency bank receipt',
    explanation: reason,
    allocations,
    ...extra
  };
}
const decide = (s, r, action, extra = {}) => s.decide(r.id, {
  version: r.version,
  action,
  reason,
  ...extra
});
function approved(f, i = input(f)) {
  return decide(f.reviewer, decide(f.author, f.author.save(null, i), 'submit'), 'approve');
}
function recorded(f, i = input(f), ref = 'TEST-RECEIPT-1') {
  return decide(f.recorder, approved(f, i), 'record', {
    bank_reference: ref,
    file: evidence
  });
}
test('one receipt settles two invoices, keeps revenue unchanged, and exhausts partial/final AR cents', t => {
  const f = fixture(t),
    ar = certificates(f.db, 'example-client-accountant', today),
    finance = certificates(f.db, 'example-client-finance-reviewer', today);
  let next = ar.invoiceList('jakh', 'harbour').find(i => i.state === 'submitted');
  next = finance.decideInvoice(next.id, {
    version: ar.invoice(next.id).version,
    action: 'post',
    reason
  });
  const ids = [f.invoice.id, next.id],
    before = f.db.prepare("SELECT sum(CAST(base_credit AS REAL)) n FROM ledger_lines WHERE account_type='income'").get().n;
  let r = recorded(f, input(f, [{
    invoice_id: ids[0],
    amount: '1000.00'
  }, {
    invoice_id: ids[1],
    amount: '500.00'
  }]));
  assert.equal(r.total, '1500.00');
  assert.equal(r.allocations.length, 2);
  assert.equal(f.author.balances('jakh', 'harbour').find(i => i.id === ids[0]).open, '2415.10');
  assert.equal(f.db.prepare("SELECT sum(CAST(base_credit AS REAL)) n FROM ledger_lines WHERE account_type='income'").get().n, before);
  const final = f.author.balances('jakh', 'harbour').filter(i => ids.includes(i.id)).map(i => ({
    invoice_id: i.id,
    amount: i.open
  }));
  recorded(f, input(f, final), 'TEST-RECEIPT-2');
  assert.ok(f.author.balances('jakh', 'harbour').filter(i => ids.includes(i.id)).every(i => i.open === '0.00' && i.base_open === '0.00'));
  assert.equal(f.author.report('jakh', {
    project: 'harbour'
  }).reconciliation.difference, '0.00');
  assert.throws(() => ledger(f.db, 'receipt-reviewer', today).reverse(r.journal_id, {
    reason,
    accounting_date: '2026-10-29',
    version: 2
  }), /source|typed|subledger/i);
  assert.throws(() => f.db.prepare("UPDATE client_receipts SET title='tampered' WHERE id=?").run(r.id), /immutable/);
  assert.equal(f.recorder.download(r.evidence.id).sha256, r.evidence.sha256);
});
test('receipt authority, independent recording, evidence and idempotent retry are enforced', t => {
  const f = fixture(t);
  let r = f.author.save(null, input(f));
  assert.throws(() => decide(f.author, r, 'approve'), /Independent/);
  r = decide(f.author, r, 'submit');
  f.db.prepare("UPDATE memberships SET receipt_approval_limit='0' WHERE user_id='receipt-reviewer'").run();
  assert.throws(() => decide(f.reviewer, r, 'approve'), /authority/);
  f.db.prepare("UPDATE memberships SET receipt_approval_limit='1000000' WHERE user_id='receipt-reviewer'").run();
  r = decide(f.reviewer, r, 'approve');
  assert.throws(() => decide(f.reviewer, r, 'record', {
    bank_reference: 'REF',
    file: evidence
  }), /different person/);
  assert.throws(() => decide(f.recorder, r, 'record', {
    bank_reference: 'REF'
  }), /evidence/);
  r = decide(f.recorder, r, 'record', {
    bank_reference: 'REF',
    file: evidence
  });
  const count = f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n;
  assert.equal(decide(f.recorder, {
    ...r,
    version: 1
  }, 'record', {
    bank_reference: 'REF',
    file: evidence
  }).id, r.id);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n, count);
  assert.throws(() => decide(f.recorder, r, 'record', {
    bank_reference: 'DIFFERENT',
    file: evidence
  }), /already recorded/);
  assert.throws(() => f.db.prepare('UPDATE client_receipt_evidence SET filename=? WHERE id=?').run('changed.txt', r.evidence.id), /immutable/);
});
test('over-allocation, stale balances, reservations and duplicate references fail atomically', t => {
  const f = fixture(t);
  assert.throws(() => f.author.save(null, input(f, [{
    invoice_id: f.invoice.id,
    amount: '4000'
  }])), /exceeds/);
  let a = approved(f, input(f, [{
    invoice_id: f.invoice.id,
    amount: '3000'
  }]));
  assert.throws(() => approved(f, input(f, [{
    invoice_id: f.invoice.id,
    amount: '500'
  }])), /reserves/);
  const draft = f.author.save(null, input(f, [{
    invoice_id: f.invoice.id,
    amount: '100'
  }]));
  a = decide(f.recorder, a, 'record', {
    bank_reference: 'ONE',
    file: evidence
  });
  assert.throws(() => decide(f.author, draft, 'submit'), /changed/);
  let second = approved(f, input(f, [{
    invoice_id: f.invoice.id,
    amount: '100'
  }]));
  assert.throws(() => decide(f.recorder, second, 'record', {
    bank_reference: 'one',
    file: evidence
  }), /already recorded/);
  assert.equal(f.recorder.detail(second.id).state, 'approved');
  assert.throws(() => f.author.save(null, input(f, [{
    invoice_id: f.invoice.id,
    amount: '1'
  }, {
    invoice_id: f.invoice.id,
    amount: '1'
  }])), /once/);
});
test('mixed-project receipts require company authority and project reports reveal only their allocation', t => {
  const f = fixture(t),
    invoices = f.author.balances('jakh'),
    items = invoices.map(i => ({
      invoice_id: i.id,
      amount: '100'
    }));
  const scoped = receipts(f.db, 'receipt-project', today);
  assert.throws(() => scoped.save(null, input(f, items)), /unavailable/);
  const r = recorded(f, input(f, items));
  assert.equal(r.project_id, null);
  assert.throws(() => scoped.detail(r.id), /unavailable/);
  assert.throws(() => scoped.download(r.evidence.id), /unavailable/);
  const report = scoped.report('jakh');
  const ownRows = report.rows.filter(x => x.receipt_id === r.id);
  assert.equal(ownRows.length, 1);
  assert.equal(ownRows[0].project_id, 'harbour');
  assert.equal(ownRows[0].can_open, false);
  assert.equal(report.reconciliation.difference, '0.00');
  assert.equal(report.totals.net, '100.00');
  assert.equal(ownRows[0].title, 'Customer receipt allocation');
  const visible = scoped.list('jakh').find(x => x.id === r.id);
  assert.equal(visible.total, '100.00');
  assert.equal(visible.bank_amount, '100.00');
  assert.equal(visible.title, 'Customer receipt allocation');
  assert.equal(visible.can_open, false);
  assert.equal(visible.scope_partial, true);
  assert.deepEqual(visible.allocation_project_ids, ['harbour']);
  assert.equal(createService(f.db, 'receipt-project', today).search('jakh', r.id).length, 0);
  const companyView = f.author.list('jakh').find(x => x.id === r.id);
  assert.equal(companyView.total, '200.00');
  assert.equal(companyView.can_open, true);
  assert.equal(companyView.scope_partial, false);
  const projectView = f.author.list('jakh', 'harbour').find(x => x.id === r.id);
  assert.equal(projectView.total, '100.00');
  assert.equal(projectView.can_open, true);
  assert.equal(projectView.scope_partial, true);
  const pending = approved(f, input(f, items, {
    title: 'Private combined customer remittance'
  }));
  const plan = scoped.report('jakh').planned.find(x => x.id === pending.id);
  assert.equal(plan.total, '100.00');
  assert.equal(plan.title, 'Approved customer receipt allocation');
  assert.equal(plan.can_open, false);
  assert.throws(() => receipts(f.db, 'omar', today).detail(r.id), /unavailable/);
});
test('independent bank matching and linked reversal restore AR without resetting the original', t => {
  const f = fixture(t),
    r = recorded(f),
    statement = f.banker.statement({
      bank_id: f.bank,
      reference: 'CUSTOMER-OCT29',
      start_date: '2026-10-29',
      end_date: '2026-10-29',
      opening: '0',
      closing: '1000',
      rows: [{
        date: '2026-10-29',
        direction: 'in',
        amount: '1000',
        reference: 'TEST-RECEIPT-1'
      }],
      reason
    });
  let row = statement.rows[0];
  row = f.banker.match(row.id, {
    version: row.version,
    action: 'match',
    receipt_ids: [r.id],
    reason
  });
  assert.equal(row.matches[0].receipt_id, r.id);
  assert.equal(f.author.report('jakh').totals.cleared, '1000.00');
  assert.throws(() => f.author.reverse(r.id, {
    version: r.version,
    accounting_date: '2026-10-29',
    reason
  }), /Unmatch/);
  assert.throws(() => f.banker.voidStatement(statement.id, {
    reason
  }), /Another|Unmatch/);
  row = f.banker.match(row.id, {
    version: row.version,
    action: 'unmatch',
    reason
  });
  let correction = f.author.reverse(r.id, {
    version: r.version,
    accounting_date: '2026-10-29',
    reason
  });
  correction = decide(f.reviewer, decide(f.author, correction, 'submit'), 'approve');
  correction = decide(f.recorder, correction, 'record', {
    bank_reference: 'REVERSAL-1',
    file: evidence
  });
  assert.equal(f.author.balances('jakh', 'harbour')[0].open, '3415.10');
  assert.equal(f.author.detail(r.id).reversed_by, correction.id);
  assert.equal(f.author.report('jakh').totals.net, '0.00');
  assert.equal(f.author.report('jakh').reconciliation.difference, '0.00');
  assert.throws(() => f.author.reverse(r.id, {
    version: r.version,
    accounting_date: '2026-10-29',
    reason
  }), /Unmatch/);
});
test('foreign bank currency posts the actual company bank amount and separate FX gain; reversal retains original values', t => {
  const f = fixture(t),
    base = f.db.prepare('SELECT * FROM payment_banks WHERE company_id=? ORDER BY rowid LIMIT 1').get(f.foreign),
    bank = payments(f.db, 'receipt-reviewer', today).bank(null, {
      ...base,
      currency: 'EUR',
      name: 'Fictional EUR receipt bank',
      active: true,
      reason
    });
  const invoice = f.author.balances(f.foreign, 'creek')[0],
    i = input(f, [{
      invoice_id: invoice.id,
      amount: '1000'
    }], {
      company_id: f.foreign,
      bank_id: bank.id,
      bank_amount: '900',
      bank_rate: '1.12',
      rate_source: 'Fictional EUR to USD rate'
    }),
    r = recorded(f, i, 'FX-1');
  assert.equal(r.company_total, '1008.00');
  assert.equal(r.allocations[0].base_amount, '1000.00');
  const lines = f.db.prepare('SELECT * FROM ledger_lines WHERE entry_id=?').all(r.journal_id);
  assert.equal(lines.find(l => l.account_id === base.gain_account_id).base_credit, '8.00');
  assert.equal(f.author.report(f.foreign).reconciliation.difference, '0.00');
  let rev = f.author.reverse(r.id, {
    version: r.version,
    accounting_date: '2026-10-29',
    reason
  });
  rev = decide(f.recorder, decide(f.reviewer, decide(f.author, rev, 'submit'), 'approve'), 'record', {
    bank_reference: 'FX-REV',
    file: evidence
  });
  assert.equal(rev.bank_amount, '900.00');
  assert.equal(rev.bank_rate, '1.12');
  assert.equal(f.author.report(f.foreign).totals.net, '0.00');
  assert.throws(() => f.author.save(null, {
    ...i,
    bank_rate: '0'
  }), /greater than zero/);
  assert.throws(() => f.author.save(null, {
    ...i,
    rate_date: '2026-10-30'
  }), /future/);
});
test('revoked author/reviewer, changed bank and closed periods invalidate financial continuation', t => {
  const f = fixture(t);
  let r = approved(f);
  f.db.prepare("UPDATE users SET active=0 WHERE id='receipt-reviewer'").run();
  assert.throws(() => decide(f.recorder, r, 'record', {
    bank_reference: 'BLOCKED',
    file: evidence
  }), /authority/);
  f.db.prepare("UPDATE users SET active=1 WHERE id='receipt-reviewer'").run();
  f.db.prepare("UPDATE users SET active=0 WHERE id='receipt-author'").run();
  assert.throws(() => decide(f.recorder, r, 'record', {
    bank_reference: 'BLOCKED',
    file: evidence
  }), /author/);
  f.db.prepare("UPDATE users SET active=1 WHERE id='receipt-author'").run();
  f.db.prepare("UPDATE ledger_periods SET state='closed' WHERE company_id='jakh'").run();
  assert.throws(() => decide(f.recorder, r, 'record', {
    bank_reference: 'BLOCKED',
    file: evidence
  }), /open company period/);
  f.db.prepare("UPDATE ledger_periods SET state='open' WHERE company_id='jakh'").run();
  f.db.prepare('UPDATE payment_banks SET version=version+1 WHERE id=?').run(f.bank);
  assert.throws(() => decide(f.recorder, r, 'record', {
    bank_reference: 'BLOCKED',
    file: evidence
  }), /configuration changed/);
  r = decide(f.author, r, 'withdraw');
  r = f.author.save(r.id, {
    ...r,
    ...input(f),
    version: r.version
  });
  r = decide(f.reviewer, decide(f.author, r, 'submit'), 'approve');
  assert.equal(decide(f.recorder, r, 'record', {
    bank_reference: 'RESTORED',
    file: evidence
  }).state, 'recorded');
});
test('bank rows match mixed customer and supplier inflows once, and both subledgers protect the same bank reference', t => {
  const f = fixture(t),
    source = f.db.prepare("SELECT * FROM payments WHERE company_id='jakh' AND kind='refund' AND state='recorded' AND reversal_of IS NULL LIMIT 1").get();
  f.bank = source.bank_id;
  let draft = approved(f);
  assert.throws(() => decide(f.recorder, draft, 'record', {
    bank_reference: source.bank_reference,
    file: evidence
  }), /already recorded/);
  const r = decide(f.recorder, draft, 'record', {
      bank_reference: 'MIXED-CUSTOMER',
      file: evidence
    }),
    banker = payments(f.db, 'receipt-banker', () => '2026-10-30'),
    sumAmount = money(sum([r.bank_amount, source.bank_amount]));
  const s = banker.statement({
    bank_id: f.bank,
    reference: 'MIXED-OCT30',
    start_date: '2026-10-30',
    end_date: '2026-10-30',
    opening: '0',
    closing: sumAmount,
    rows: [{
      date: '2026-10-30',
      direction: 'in',
      amount: sumAmount,
      reference: 'Combined bank credit'
    }],
    reason
  });
  let matched = banker.match(s.rows[0].id, {
    version: s.rows[0].version,
    action: 'match',
    payment_ids: [source.id],
    receipt_ids: [r.id],
    reason
  });
  assert.equal(matched.matches.length, 2);
  assert.equal(new Set(matched.matches.map(m => m.source_type)).size, 2);
  assert.throws(() => banker.match(matched.id, {
    version: matched.version,
    action: 'match',
    receipt_ids: [r.id],
    reason
  }), /already matched/);
  // A recorder who later becomes a reconciler still cannot match/unmatch their own evidence.
  f.db.prepare("UPDATE memberships SET role_id='bank_reconciler' WHERE user_id='receipt-recorder'").run();
  assert.throws(() => payments(f.db, 'receipt-recorder', () => '2026-10-30').match(matched.id, {
    version: matched.version,
    action: 'unmatch',
    reason
  }), /independent/);
  assert.throws(() => payments(f.db, 'example-bank-reviewer', () => '2026-10-30').voidStatement(s.id, {
    reason
  }), /Unmatch/);
  matched = banker.match(matched.id, {
    version: matched.version,
    action: 'unmatch',
    reason
  });
  assert.ok(matched.matches.every(m => m.active === 0));
  assert.ok(payments(f.db, 'example-bank-reviewer', () => '2026-10-30').voidStatement(s.id, {
    reason
  }).voided);
});
test('complete cutoff findings, scoped search, CSV safety and additive examples stay aligned', t => {
  const f = fixture(t),
    count = f.db.prepare('SELECT count(*) n FROM client_receipts').get().n;
  installReceiptExamples(f.db);
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_receipts').get().n, count);
  const r = recorded(f, input(f, undefined, {
    title: '=HYPERLINK("bad")'
  }), 'CSV-RECEIPT');
  const current = f.author.report('jakh', {
      project: 'harbour'
    }),
    earlier = f.author.report('jakh', {
      project: 'harbour',
      to: '2026-10-28'
    });
  assert.equal(current.totals.net, '1000.00');
  assert.equal(earlier.totals.net, '0.00');
  assert.equal(earlier.reconciliation.difference, '0.00');
  assert.equal(current.reconciliation.difference, '0.00');
  assert.ok(createService(f.db, 'receipt-project', today).search('jakh', r.id).some(x => x.id === r.id));
  assert.equal(createService(f.db, 'mohammed', today).search('jakh', r.id).length, 0);
  const csv = receiptsCsv(current);
  assert.ok(csv.includes('"\'=HYPERLINK'));
  assert.ok(csv.includes('AR source-to-ledger difference: 0.00'));
  assert.ok(csv.includes(r.id));
  assert.ok(!csv.includes('Garden Residences'));
  assert.throws(() => f.author.report('jakh', {
    to: '2026-02-30'
  }), /calendar date/);
  assert.throws(() => f.author.report('jakh', {
    to: '2026-10-30'
  }), /future/);
  assert.throws(() => receipts(f.db, 'receipt-project', today).report('build'), /unavailable/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM identities').get().n, 0);
  assert.equal(f.db.prepare("SELECT receipt_approval_limit FROM memberships WHERE user_id='ahmed' LIMIT 1").get().receipt_approval_limit, '0.00');
});
