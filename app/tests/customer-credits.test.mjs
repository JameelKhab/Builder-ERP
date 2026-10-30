import { customerCreditsCsv } from '../src/customer-credits-export.js';
import { identity } from '../server/identity.mjs';
import { createApi } from '../server/http.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { customerCredits } from '../server/customer-credits.mjs';
import { receivableBalance } from '../server/receivable-balance.mjs';
import { receipts } from '../server/receipts.mjs';
import { payments } from '../server/payments.mjs';
import { ledger } from '../server/ledger.mjs';
import { advanceSettlement } from '../server/advance-balances.mjs';
import { clientCorrections } from '../server/client-corrections.mjs';
import { D, sum, money } from '../server/money.mjs';
const date = '2026-10-29',
  today = () => date,
  reason = 'Fictional customer credit instructions reviewed independently',
  file = {
    filename: 'customer-instruction.txt',
    base64: Buffer.from(reason).toString('base64')
  };
const act = (s, r, action, x = {}) => s.decide(r.id, {
  version: r.version,
  action,
  reason,
  ...x
});
function fixture(t) {
  const db = openDatabase(':memory:', {
    examples: true,
    correctionExamples: true
  });
  t.after(() => db.close());
  for (const [id, role, project] of [['credit-author', 'ar_clerk', '*'], ['credit-reviewer', 'financial_controller', '*'], ['credit-recorder', 'financial_controller', '*'], ['credit-banker', 'bank_reconciler', '*'], ['credit-project', 'ar_clerk', 'harbour']]) {
    db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, id, role);
    db.prepare('INSERT INTO memberships(user_id,company_id,project_id,role_id,customer_credit_approval_limit) VALUES(?,?,?,?,?)').run(id, 'jakh', project, role, id === 'credit-reviewer' ? '1000000' : '0');
  }
  const svc = who => customerCredits(db, who, today),
    author = svc('credit-author'),
    reviewer = svc('credit-reviewer'),
    recorder = svc('credit-recorder'),
    banker = payments(db, 'credit-banker', today);
  const invoices = db.prepare("SELECT * FROM client_invoices WHERE company_id='jakh' AND state='posted'").all(),
    source = invoices.find(i => i.project_id === 'harbour' && receivableBalance(db, i).customer_credit === '210.00'),
    target = invoices.find(i => i.project_id === 'gardens' && i.advance_id && receivableBalance(db, i).debit_open === '157.50');
  const transfer = ledger(db, 'example-client-finance-reviewer', today).account(null, {
      company_id: 'jakh',
      code: '1398',
      name: 'Customer credit transfer',
      type: 'asset',
      purpose: 'client_credit_transfer',
      active: true,
      reason
    }),
    bank = db.prepare("SELECT * FROM payment_banks WHERE company_id='jakh' AND active=1").get();
  const input = {
    company_id: 'jakh',
    kind: 'allocation',
    source_invoice_id: source.id,
    title: 'Allocate instructed credit',
    accounting_date: date,
    basis: reason,
    allocations: [{
      invoice_id: target.id,
      amount: '100.01'
    }],
    transfer_account: transfer.id,
    gain_account: bank.gain_account_id,
    loss_account: bank.loss_account_id,
    file
  };
  const refund = {
    company_id: 'jakh',
    kind: 'refund',
    source_invoice_id: source.id,
    bank_id: bank.id,
    title: 'Refund instructed credit',
    accounting_date: date,
    basis: reason,
    amount: '100.01',
    bank_amount: '100.01',
    bank_rate: '1',
    rate_date: date,
    rate_source: reason,
    beneficiary: 'Fictional client account; verify signed instructions',
    file
  };
  return {
    db,
    svc,
    author,
    reviewer,
    recorder,
    banker,
    source,
    target,
    bank,
    input,
    refund
  };
}
function approve(f, input = f.input) {
  return act(f.reviewer, act(f.author, f.author.save(null, input), 'submit'), 'approve');
}
function record(f, input = f.input, ref = 'CREDIT-TEST-1') {
  return act(f.recorder, approve(f, input), 'record', input.kind === 'refund' ? {
    bank_reference: ref,
    file
  } : {});
}
function reconcile(f) {
  for (const project of [null, 'harbour', 'gardens']) {
    assert.equal(f.author.report('jakh', {
      project
    }).reconciliation.difference, '0.00');
    assert.equal(receipts(f.db, 'credit-author', today).report('jakh', {
      project
    }).reconciliation.difference, '0.00');
  }
}
test('cross-project allocation balances each project, preserves cash, funds advances and exhausts final cents', t => {
  const f = fixture(t),
    cash = receipts(f.db, 'credit-author', today).report('jakh').totals.net;
  let r = record(f);
  assert.equal(r.state, 'recorded');
  assert.equal(r.project_id, null);
  assert.equal(r.bank_reference, null);
  const b = receivableBalance(f.db, f.source),
    target = receivableBalance(f.db, f.target);
  assert.equal(b.customer_credit, '109.99');
  assert.equal(b.settled, '210.00');
  assert.equal(b.credit_applied, '100.01');
  assert.equal(target.debit_open, '57.49');
  assert.equal(target.credit_received, '100.01');
  assert.equal(advanceSettlement(f.db, f.target).paid_principal, '95.24');
  for (const project of ['harbour', 'gardens']) {
    const lines = f.db.prepare('SELECT * FROM ledger_lines WHERE entry_id=? AND project_id=?').all(r.journal_id, project);
    assert.equal(money(sum(lines.map(l => new D(l.base_debit).minus(l.base_credit)))), '0.00');
  }
  const other = f.db.prepare("SELECT * FROM client_invoices WHERE project_id='harbour' AND title LIKE '%measured work 1' AND state='posted'").get();
  record(f, {
    ...f.input,
    allocations: [{
      invoice_id: f.target.id,
      amount: '57.49'
    }, {
      invoice_id: other.id,
      amount: '52.50'
    }]
  });
  assert.equal(receivableBalance(f.db, f.source).open, '0.00');
  assert.equal(receivableBalance(f.db, f.source).base_open, '0.00');
  assert.equal(receivableBalance(f.db, f.target).open, '0.00');
  assert.equal(advanceSettlement(f.db, f.target).paid_principal, '150.00');
  assert.equal(receipts(f.db, 'credit-author', today).report('jakh').totals.net, cash);
  reconcile(f);
  assert.throws(() => f.db.prepare("UPDATE client_credit_settlements SET state='draft' WHERE id=?").run(r.id), /immutable/);
  assert.throws(() => ledger(f.db, 'credit-recorder', today).reverse(r.journal_id, {
    version: 2,
    accounting_date: date,
    reason
  }), /source|typed|subledger/i);
});
test('project scope protects combined documents and instructions but reports only permitted legs', t => {
  const f = fixture(t),
    r = record(f),
    project = f.svc('credit-project');
  assert.throws(() => project.detail(r.id), /unavailable/);
  assert.throws(() => project.download(r.instruction_id), /unavailable/);
  assert.throws(() => project.save(null, f.input), /unavailable|permission|allowed|scope/i);
  const report = project.report('jakh');
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].project_id, 'harbour');
  assert.equal(report.rows[0].can_open, false);
  assert.equal(report.rows[0].title, 'Customer credit allocation');
  assert.equal(report.reconciliation.difference, '0.00');
  assert.equal(project.list('jakh').length, 0);
  const csv = customerCreditsCsv({
    ...report,
    rows: report.rows.map(x => ({
      ...x,
      title: '=unsafe'
    }))
  });
  assert.ok(csv.includes("'=unsafe"));
  assert.ok(csv.indexOf('Findings') < csv.indexOf('Settlement'));
  assert.ok(!csv.includes(f.target.id));
  assert.ok(project.options('jakh').invoices.every(i => i.project_id === 'harbour'));
  assert.throws(() => project.report('build'), /unavailable/);
  assert.throws(() => project.report('jakh', {
    project: 'gardens'
  }), /unavailable/);
});
test('refund separates approval, cash and independent bank clearance; exact foreign-bank FX and idempotent retry', t => {
  const f = fixture(t),
    bank = payments(f.db, 'credit-reviewer', today).bank(null, {
      ...f.bank,
      name: 'Foreign refund bank',
      currency: 'USD',
      active: true,
      reason
    });
  let r = approve(f, {
    ...f.refund,
    bank_id: bank.id,
    bank_amount: '27.23',
    bank_rate: '3.6725'
  });
  assert.equal(receivableBalance(f.db, f.source).customer_credit, '210.00');
  assert.equal(f.author.report('jakh').rows.length, 0);
  assert.throws(() => act(f.reviewer, r, 'record', {
    bank_reference: 'REFUND-1',
    file
  }), /another person/);
  const existingRef = f.db.prepare('SELECT bank_reference FROM client_receipts WHERE bank_id=? AND reference_key IS NOT NULL').get(f.bank.id).bank_reference;
  const sameBankRequest = approve(f, {
    ...f.refund,
    amount: '10',
    bank_amount: '10'
  });
  assert.throws(() => act(f.recorder, sameBankRequest, 'record', {
    bank_reference: existingRef,
    file
  }), /already recorded/);
  act(f.author, sameBankRequest, 'withdraw');
  r = act(f.recorder, r, 'record', {
    bank_reference: 'REFUND-1',
    file
  });
  assert.equal(r.company_total, '100.00');
  assert.equal(receivableBalance(f.db, f.source).refunded, '100.01');
  assert.equal(receivableBalance(f.db, f.source).customer_credit, '109.99');
  const lines = f.db.prepare('SELECT * FROM ledger_lines WHERE entry_id=?').all(r.journal_id);
  assert.ok(lines.some(l => l.account_id === bank.gain_account_id && l.base_credit === '0.01'));
  assert.equal(act(f.recorder, r, 'record', {
    bank_reference: 'REFUND-1',
    file
  }).journal_id, r.journal_id);
  assert.throws(() => act(f.recorder, r, 'record', {
    bank_reference: 'DIFFERENT',
    file
  }), /different evidence/);
  let s = f.banker.statement({
    company_id: 'jakh',
    bank_id: bank.id,
    reference: 'REFUND-STATEMENT',
    start_date: date,
    end_date: date,
    opening: '100',
    closing: '72.77',
    rows: [{
      date,
      direction: 'out',
      amount: '27.23',
      reference: 'REFUND-1'
    }],
    reason
  });
  assert.throws(() => payments(f.db, 'credit-recorder', today).match(s.rows[0].id, {
    version: s.rows[0].version,
    action: 'match',
    credit_ids: [r.id],
    reason
  }), /independent/);
  let b = f.banker.match(s.rows[0].id, {
    version: s.rows[0].version,
    action: 'match',
    credit_ids: [r.id],
    reason
  });
  assert.equal(b.matches[0].settlement_id, r.id);
  assert.ok(f.author.detail(r.id).clearance);
  assert.throws(() => payments(f.db, 'credit-reviewer', today).voidStatement(s.id, {
    reason
  }), /Unmatch/);
  b = f.banker.match(b.id, {
    version: b.version,
    action: 'unmatch',
    reason
  });
  assert.equal(f.author.detail(r.id).clearance, null);
  payments(f.db, 'credit-reviewer', today).voidStatement(s.id, {
    reason
  });
  reconcile(f);
});
test('separate credit authority, live reviewers/authors, evidence, periods and versions fail closed', t => {
  const f = fixture(t);
  let r = f.author.save(null, {
    ...f.input,
    file: undefined
  });
  assert.throws(() => act(f.author, r, 'submit'), /instruction/);
  r = f.author.save(r.id, {
    ...f.input,
    version: r.version
  });
  r = act(f.author, r, 'submit');
  f.db.prepare("UPDATE memberships SET customer_credit_approval_limit='0',receipt_approval_limit='1000000',ar_approval_limit='1000000' WHERE user_id='credit-reviewer'").run();
  assert.throws(() => act(f.reviewer, r, 'approve'), /credit authority/);
  f.db.prepare("UPDATE memberships SET customer_credit_approval_limit='1000000' WHERE user_id='credit-reviewer'").run();
  r = act(f.reviewer, r, 'approve');
  f.db.prepare("UPDATE users SET active=0 WHERE id='credit-reviewer'").run();
  assert.throws(() => act(f.recorder, r, 'record'), /authority/);
  f.db.prepare("UPDATE users SET active=1 WHERE id='credit-reviewer'").run();
  f.db.prepare("UPDATE users SET active=0 WHERE id='credit-author'").run();
  assert.throws(() => act(f.recorder, r, 'record'), /Author/);
  f.db.prepare("UPDATE users SET active=1 WHERE id='credit-author'").run();
  assert.throws(() => f.recorder.decide(r.id, {
    version: r.version - 1,
    action: 'record',
    reason
  }), /changed/);
  f.db.prepare("UPDATE ledger_periods SET state='closed' WHERE company_id='jakh'").run();
  assert.throws(() => act(f.recorder, r, 'record'), /period/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_credit_legs').get().n, 0);
});
test('competing plans reserve both sides and prevent unsafe receipt reversal and source credit', t => {
  const f = fixture(t),
    a = f.author.save(null, f.input),
    b = f.author.save(null, {
      ...f.refund,
      amount: '150',
      bank_amount: '150'
    });
  let r = act(f.reviewer, act(f.author, a, 'submit'), 'approve');
  assert.throws(() => act(f.author, b, 'submit'), /reserves/);
  const original = f.db.prepare('SELECT r.* FROM client_receipts r JOIN client_receipt_allocations a ON a.receipt_id=r.id WHERE a.invoice_id=? AND r.reversal_of IS NULL').get(f.source.id);
  assert.throws(() => receipts(f.db, 'credit-author', today).reverse(original.id, {
    version: original.version,
    accounting_date: date,
    reason
  }), /credit has been used or reserved/);
  const rec = receipts(f.db, 'credit-author', today);
  let cash = rec.save(null, {
    company_id: 'jakh',
    bank_id: f.bank.id,
    title: 'Competing receipt',
    accounting_date: date,
    bank_amount: '100',
    bank_rate: '1',
    rate_date: date,
    rate_source: reason,
    explanation: reason,
    allocations: [{
      invoice_id: f.target.id,
      amount: '100'
    }]
  });
  assert.throws(() => act(rec, cash, 'submit'), /reserves/);
  const correction = clientCorrections(f.db, 'example-correction-author', today).save(null, {
    advance_id: f.target.advance_id,
    title: 'Competing target correction',
    effective_date: date,
    basis: reason,
    reason,
    filename: file.filename,
    base64: file.base64
  });
  assert.ok(correction.blockers.some(x => x.includes('credit settlements')));
  r = act(f.author, r, 'withdraw');
  assert.equal(act(f.author, b, 'submit').state, 'submitted');
});
test('atomic failures roll back all postings; changed balances invalidate approved plans and reports honour cutoff', t => {
  const f = fixture(t),
    r = approve(f),
    before = f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n;
  f.db.exec("CREATE TRIGGER test_credit_failure BEFORE INSERT ON client_credit_legs BEGIN SELECT RAISE(ABORT,'Injected atomic failure'); END");
  assert.throws(() => act(f.recorder, r, 'record'), /Injected/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n, before);
  assert.equal(f.author.detail(r.id).state, 'approved');
  assert.equal(receivableBalance(f.db, f.source).customer_credit, '210.00');
  f.db.exec('DROP TRIGGER test_credit_failure');
  record(f, {
    ...f.refund,
    amount: '10',
    bank_amount: '10'
  });
  assert.throws(() => act(f.recorder, r, 'record'), /changed/);
  assert.equal(f.author.report('jakh', {
    to: '2026-10-28'
  }).rows.length, 0);
  assert.equal(f.author.report('jakh', {
    currency: 'USD'
  }).rows.length, 0);
  assert.throws(() => f.author.report('jakh', {
    to: '2026-02-30'
  }), /calendar/);
});
test('individual HTTP identities settle credits with separate authority, original evidence, scoped reports and read-only preview', async t => {
  const f = fixture(t),
    auth = identity(f.db, {
      sampleMode: true
    }),
    password = 'Disposable credit journey passphrase 47!';
  const owner = await auth.setup({
    name: 'Credit test owner',
    login: 'credit.owner',
    password,
    confirm_password: password,
    company_ids: ['jakh']
  }, 'Isolated test');
  const session = auth.authenticate(owner.session.token),
    users = {};
  for (const [login, role, project] of [['credit.writer', 'ar_clerk', '*'], ['credit.finance', 'financial_controller', '*'], ['credit.cash', 'treasury_clerk', '*'], ['credit.other', 'ar_clerk', 'gardens']]) {
    const u = auth.provision(session, {
      name: login,
      login,
      job_title: role,
      reason,
      grants: [{
        company_id: 'jakh',
        project_id: project,
        role_id: role,
        approval_limit: '0',
        customer_credit_approval_limit: role === 'financial_controller' ? '100000' : '0'
      }]
    });
    await auth.activate({
      login,
      code: u.activation_code,
      password,
      confirm_password: password
    });
    users[login] = u;
  }
  const server = createApi(f.db, {
    today
  }).listen(0, '127.0.0.1');
  await new Promise((res, rej) => {
    server.once('listening', res);
    server.once('error', rej);
  });
  t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function client(login) {
    let cookie = '';
    const call = async (path, body, method = 'POST') => {
      const r = await fetch(base + path, {
        method: body === undefined ? 'GET' : method,
        headers: {
          'Content-Type': 'application/json',
          'X-Builder-Client': 'local-app',
          Cookie: cookie
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
      return {
        status: r.status,
        body: r.headers.get('content-type')?.includes('application/json') ? await r.json() : Buffer.from(await r.arrayBuffer())
      };
    };
    assert.equal((await call('/auth/login', {
      login,
      password
    })).status, 200);
    return call;
  }
  const writer = await client('credit.writer'),
    finance = await client('credit.finance'),
    cash = await client('credit.cash'),
    other = await client('credit.other'),
    admin = await client('credit.owner');
  const ok = (res, status = 200) => {
    assert.equal(res.status, status, JSON.stringify(res.body));
    return res.body;
  };
  let r = ok(await writer('/customer-credits/documents', {
    ...f.refund,
    amount: '10',
    bank_amount: '10',
    state: 'recorded',
    journal_id: 'forged'
  }), 201);
  assert.equal(r.state, 'draft');
  assert.equal(r.journal_id, null);
  assert.equal((await other('/customer-credits/documents/' + r.id)).status, 404);
  assert.equal((await other('/customer-credits/evidence/' + r.instruction_id)).status, 404);
  assert.deepEqual(ok(await writer('/customer-credits/evidence/' + r.instruction_id)), Buffer.from(reason));
  for (const [call, action] of [[writer, 'submit'], [finance, 'approve']]) r = ok(await call(`/customer-credits/documents/${r.id}/decision`, {
    version: r.version,
    action,
    reason
  }));
  assert.equal((await finance(`/customer-credits/documents/${r.id}/decision`, {
    version: r.version,
    action: 'record',
    reason,
    bank_reference: 'HTTP-CREDIT',
    file
  })).status, 403);
  r = ok(await cash(`/customer-credits/documents/${r.id}/decision`, {
    version: r.version,
    action: 'record',
    reason,
    bank_reference: 'HTTP-CREDIT',
    file
  }));
  assert.equal(r.state, 'recorded');
  assert.equal(ok(await cash(`/customer-credits/documents/${r.id}/decision`, {
    version: 1,
    action: 'record',
    reason,
    bank_reference: 'HTTP-CREDIT',
    file
  })).journal_id, r.journal_id);
  let a = ok(await writer('/customer-credits/documents', f.input), 201);
  for (const [call, action] of [[writer, 'submit'], [finance, 'approve'], [cash, 'record']]) a = ok(await call(`/customer-credits/documents/${a.id}/decision`, {
    version: a.version,
    action,
    reason
  }));
  assert.equal(a.state, 'recorded');
  assert.equal((await other('/customer-credits/documents/' + a.id)).status, 404);
  const partial = ok(await other('/customer-credits/report?company=jakh'));
  assert.equal(partial.rows.length, 1);
  assert.equal(partial.rows[0].project_id, 'gardens');
  assert.equal(partial.rows[0].can_open, false);
  assert.equal(partial.reconciliation.difference, '0.00');
  assert.equal(ok(await writer('/customer-receipts/report?company=jakh')).reconciliation.difference, '0.00');
  assert.equal((await writer('/customer-credits/report?company=jakh&to=2026-02-30')).status, 422);
  assert.equal((await other('/customer-credits/options?company=jakh&project=harbour')).status, 404);
  ok(await admin('/access/preview', {
    user_id: a.author_id
  }));
  assert.equal((await admin('/customer-credits/documents', f.input)).status, 403);
});
test('pre-settlement correction review snapshots remain valid when no new credit facts exist', t => {
  const f = fixture(t),
    pending = f.db.prepare("SELECT * FROM client_corrections WHERE state='finance'").all();
  assert.ok(pending.length);
  for (const r of pending) {
    const s = JSON.parse(r.snapshot);
    if (s.settlement) for (const key of ['funded', 'credit_received', 'credit_applied', 'refunded', 'credit_legs']) delete s.settlement[key];
    f.db.prepare('UPDATE client_corrections SET snapshot=? WHERE id=?').run(JSON.stringify(s), r.id);
    const current = clientCorrections(f.db, 'example-correction-finance', today).detail(r.id);
    assert.deepEqual(current.blockers, []);
    assert.equal(current.can_accept, true);
  }
});
