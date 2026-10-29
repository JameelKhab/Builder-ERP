import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { ledger, convertJournal } from '../server/ledger.mjs';
import { createService } from '../server/service.mjs';
import { installLedgerExamples } from '../server/ledger-examples.mjs';
import { accessAdmin } from '../server/access-admin.mjs';
import { ledgerCsv } from '../src/ledger-export.js';
const today = () => '2026-10-29';
function fixture(t) {
  const db = openDatabase();
  t.after(() => db.close());
  for (const [id, role, scope] of [['writer', 'accountant', '*'], ['reviewer', 'financial_controller', '*'], ['other', 'financial_controller', '*'], ['project', 'project_accountant', 'harbour']]) {
    db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, id, role);
    db.prepare('INSERT INTO memberships(user_id,company_id,project_id,role_id,ledger_approval_limit) VALUES(?,?,?,?,?)').run(id, 'jakh', scope, role, role === 'financial_controller' ? '100000' : '0');
  }
  const author = ledger(db, 'writer', today),
    reviewer = ledger(db, 'reviewer', today),
    other = ledger(db, 'other', today);
  const expense = reviewer.account(null, {
      company_id: 'jakh',
      code: '5000',
      name: 'Site expense',
      type: 'expense',
      purpose: 'general',
      active: true,
      reason: 'Test account'
    }),
    liability = reviewer.account(null, {
      company_id: 'jakh',
      code: '2000',
      name: 'Accrual',
      type: 'liability',
      purpose: 'general',
      active: true,
      reason: 'Test account'
    });
  const p = reviewer.period({
    company_id: 'jakh',
    name: 'October',
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    reason: 'Test period'
  });
  const input = {
    company_id: 'jakh',
    project_id: 'harbour',
    title: 'Ledger test accrual',
    accounting_date: '2026-10-20',
    currency: 'EUR',
    rate: '4.1',
    rate_date: '2026-10-20',
    rate_source: 'Test accounting rate',
    source_reference: 'WORKSHEET-01',
    explanation: 'Test accrual for accepted site expense',
    lines: [{
      account_id: expense.id,
      description: 'Expense',
      debit: '100.00',
      credit: '0'
    }, {
      account_id: liability.id,
      description: 'Accrual',
      debit: '0',
      credit: '100.00'
    }]
  };
  return {
    db,
    author,
    reviewer,
    other,
    expense,
    liability,
    p,
    input
  };
}
const decide = (svc, r, action) => svc.decide(r.id, {
  version: r.version,
  action,
  reason: 'Recorded test decision'
});
function post(f, input = f.input) {
  let r = f.author.save(null, input);
  r = decide(f.author, r, 'submit');
  return decide(f.reviewer, r, 'post');
}
test('general journals post independently, preserve balanced currencies and source history and reverse at their actual cutoff', t => {
  const f = fixture(t);
  let r = post(f);
  assert.equal(r.number, 'GL/2026/000001');
  assert.equal(r.company_total, '410.00');
  assert.equal(r.lines[0].base_debit, '410.00');
  assert.equal(r.history.length, 3);
  const original = JSON.stringify(r.lines);
  let rev = f.author.reverse(r.id, {
    version: r.version,
    accounting_date: '2026-10-25',
    reason: 'Accrual superseded'
  });
  assert.equal(f.reviewer.report('jakh', {
    to: '2026-10-24'
  }).trial[0].closing, '-410.00');
  rev = decide(f.author, rev, 'submit');
  rev = decide(f.reviewer, rev, 'post');
  assert.equal(rev.number, 'GL/2026/000002');
  assert.equal(JSON.stringify(f.author.detail(r.id).lines), original);
  assert.deepEqual(f.reviewer.report('jakh', {
    from: '2026-10-25',
    to: '2026-10-25'
  }).totals, {
    opening: '0.00',
    debit: '410.00',
    credit: '410.00',
    closing: '0.00'
  });
  const expense = f.reviewer.report('jakh', {
    from: '2026-10-25',
    to: '2026-10-25',
    account: f.expense.id
  });
  assert.equal(expense.totals.opening, '410.00');
  assert.equal(expense.totals.credit, '410.00');
  assert.equal(expense.totals.closing, '0.00');
  assert.equal(f.reviewer.report('jakh', {
    to: '2026-10-24'
  }).rows.length, 2);
  assert.equal(f.reviewer.report('jakh', {
    to: '2026-10-26'
  }).findings[3].source_ids[0], rev.id);
  assert.throws(() => f.author.reverse(rev.id, {
    version: rev.version,
    accounting_date: '2026-10-26',
    reason: 'No chains'
  }), /original posted/);
});
test('exact foreign rounding assigns residual cents visibly and rejects malformed or unbalanced lines', () => {
  const lines = [...Array.from({
    length: 3
  }, () => ({
    account_id: 'a',
    description: 'Tiny expense',
    debit: '0.01',
    credit: '0'
  })), {
    account_id: 'b',
    description: 'Credit',
    debit: '0',
    credit: '0.03'
  }];
  const r = convertJournal(lines, '1.5');
  assert.equal(r.company_total, '0.05');
  assert.equal(r.lines[0].rounding_adjustment, '-0.01');
  assert.deepEqual(r.lines.map(l => l.base_debit), ['0.01', '0.02', '0.02', '0.00']);
  for (const bad of ['1.001', '-1', 'Infinity', '1e2', 1.1]) assert.throws(() => convertJournal([{
    ...lines[0],
    debit: bad
  }, lines[3]], '1'));
  assert.throws(() => convertJournal([{
    ...lines[0],
    credit: '1'
  }, lines[3]], '1'), /either/);
  assert.throws(() => convertJournal([lines[0], lines[3]], '1'), /balance/);
  assert.throws(() => convertJournal(lines, '0.001'), /rounds a line to zero/);
});
test('approval has its own limit, author cannot self-post, stale/repeated writes never create extra facts or numbers', t => {
  const f = fixture(t);
  let r = f.author.save(null, f.input);
  assert.throws(() => f.author.decide(r.id, {
    version: 0,
    action: 'submit',
    reason: 'stale'
  }), /changed/);
  r = decide(f.author, r, 'submit');
  f.db.prepare("UPDATE memberships SET role_id='financial_controller',ledger_approval_limit='999999' WHERE user_id='writer'").run();
  assert.throws(() => decide(f.author, r, 'post'), /independent/);
  f.db.prepare("UPDATE memberships SET ledger_approval_limit='0',budget_approval_limit='999999',approval_limit='999999' WHERE user_id='reviewer'").run();
  assert.throws(() => decide(f.reviewer, r, 'post'), /separate journal/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_lines').get().n, 0);
  f.db.prepare("UPDATE memberships SET ledger_approval_limit='410' WHERE user_id='reviewer'").run();
  const posted = decide(f.reviewer, r, 'post');
  assert.equal(posted.number, 'GL/2026/000001');
  assert.throws(() => decide(f.reviewer, r, 'post'), /changed/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_lines').get().n, 2);
});
test('account and period configuration gates posting; submitted account revisions require renewed preparation', t => {
  const f = fixture(t);
  let r = f.author.save(null, f.input);
  r = decide(f.author, r, 'submit');
  assert.throws(() => f.reviewer.periodDecision(f.p.id, {
    version: 1,
    action: 'close',
    reason: 'Month end'
  }), /submitted/);
  const a = f.reviewer.account(f.expense.id, {
    ...f.expense,
    active: true,
    name: 'Updated expense name',
    reason: 'Clarify account'
  });
  assert.throws(() => decide(f.reviewer, r, 'post'), /account changed/);
  r = decide(f.reviewer, r, 'return');
  r = f.author.save(r.id, {
    ...f.input,
    version: r.version,
    reason: 'Review the new account definition'
  });
  r = decide(f.author, r, 'submit');
  r = decide(f.reviewer, r, 'post');
  assert.equal(r.lines[0].account_name, 'Updated expense name');
  f.reviewer.account(a.id, {
    ...a,
    active: false,
    reason: 'Archive after posting'
  });
  assert.equal(f.author.detail(r.id).lines[0].account_name, 'Updated expense name');
  let rev = f.author.reverse(r.id, {
    version: r.version,
    accounting_date: '2026-10-24',
    reason: 'Reverse original archived account'
  });
  rev = decide(f.author, rev, 'submit');
  rev = decide(f.reviewer, rev, 'post');
  assert.equal(rev.state, 'posted');
  const closed = f.reviewer.periodDecision(f.p.id, {
    version: 1,
    action: 'close',
    reason: 'Close after all reviews'
  });
  assert.throws(() => f.author.save(null, f.input), /active|open/);
  assert.throws(() => f.reviewer.periodDecision(f.p.id, {
    version: closed.version,
    action: 'reopen',
    reason: 'Self reopening'
  }), /Another controller/);
  const opened = f.other.periodDecision(f.p.id, {
    version: closed.version,
    action: 'reopen',
    reason: 'Independent correction window'
  });
  assert.equal(opened.state, 'open');
  assert.equal(opened.history.length, 3);
});
test('configuration blocks overlapping periods, fixed account identity, invalid scopes and manual subledger control postings', t => {
  const f = fixture(t);
  assert.throws(() => f.author.account(null, {
    company_id: 'jakh'
  }), /role/);
  assert.throws(() => f.reviewer.period({
    company_id: 'jakh',
    name: 'Overlap',
    start_date: '2026-10-31',
    end_date: '2026-11-30',
    reason: 'bad'
  }), /overlap/);
  assert.throws(() => f.reviewer.period({
    company_id: 'jakh',
    name: 'Bad',
    start_date: '2026-02-30',
    end_date: '2026-03-31',
    reason: 'bad'
  }), /calendar/);
  assert.throws(() => f.reviewer.account(f.expense.id, {
    ...f.expense,
    active: true,
    type: 'asset',
    reason: 'bad'
  }), /cannot change/);
  const bank = f.reviewer.account(null, {
    company_id: 'jakh',
    code: '1000',
    name: 'Reserved bank',
    type: 'asset',
    purpose: 'bank',
    active: true,
    reason: 'Reserve bank control'
  });
  assert.throws(() => f.author.save(null, {
    ...f.input,
    lines: [{
      ...f.input.lines[0],
      account_id: bank.id
    }, f.input.lines[1]]
  }), /Control accounts/);
  assert.throws(() => f.author.save(null, {
    ...f.input,
    project_id: 'creek'
  }), /role|Project/);
  assert.throws(() => f.author.save(null, {
    ...f.input,
    currency: 'AED',
    rate: '4'
  }), /rate 1/);
  assert.throws(() => f.author.save(null, {
    ...f.input,
    accounting_date: '2026-10-30'
  }), /Future/);
  assert.throws(() => f.author.save(null, {
    ...f.input,
    rate_date: '2026-10-21'
  }), /Rate date/);
  assert.throws(() => f.author.save(null, {
    ...f.input,
    currency: 'JPY'
  }), /Unsupported/);
});
test('posted data and audit evidence resist update/delete; cancelled reversal can be recreated without duplicating active reversals', t => {
  const f = fixture(t),
    r = post(f);
  for (const sql of ["UPDATE ledger_entries SET title='bad' WHERE state='posted'", 'DELETE FROM ledger_entries', 'UPDATE ledger_lines SET base_debit=\'1\'', 'DELETE FROM ledger_lines', "UPDATE ledger_events SET reason='bad'", 'DELETE FROM ledger_events']) assert.throws(() => f.db.exec(sql), /immutable|retained/);
  let rev = f.author.reverse(r.id, {
    version: r.version,
    accounting_date: '2026-10-25',
    reason: 'First correction'
  });
  assert.throws(() => f.author.reverse(r.id, {
    version: r.version,
    accounting_date: '2026-10-26',
    reason: 'Duplicate'
  }), /already exists/);
  assert.throws(() => f.author.save(rev.id, {
    ...f.input,
    version: rev.version
  }), /frozen/);
  rev = decide(f.author, rev, 'cancel');
  const next = f.author.reverse(r.id, {
    version: r.version,
    accounting_date: '2026-10-26',
    reason: 'Correct reversal date'
  });
  assert.notEqual(next.id, rev.id);
  assert.equal(f.author.detail(rev.id).state, 'cancelled');
});
test('project and company scopes protect detail, reports, configuration and search; ledger never overwrites operational cost', t => {
  const f = fixture(t),
    p = ledger(f.db, 'project', today);
  const before = createService(f.db, 'ahmed', today).workspace('jakh').report;
  const own = post(f),
    other = post(f, {
      ...f.input,
      project_id: 'gardens',
      title: 'Secret garden accrual'
    }),
    unallocated = post(f, {
      ...f.input,
      project_id: null,
      title: 'Confidential company entry'
    });
  assert.equal(p.list('jakh').length, 1);
  assert.throws(() => p.detail(other.id), /not available/);
  assert.throws(() => p.detail(unallocated.id), /not available/);
  assert.throws(() => p.report('jakh', {
    project: 'gardens'
  }), /not available/);
  assert.throws(() => p.report('build'), /not available/);
  assert.equal(p.report('jakh').scope.restricted, true);
  assert.equal(p.report('jakh').rows.length, 2);
  assert.deepEqual(createService(f.db, 'project', today).search('jakh', 'Secret'), []);
  assert.equal(createService(f.db, 'project', today).search('jakh', own.id)[0].id, own.id);
  assert.deepEqual(createService(f.db, 'ahmed', today).workspace('jakh').report, before);
  assert.throws(() => ledger(f.db, 'mohammed', today).list('jakh'), /not available/);
  assert.throws(() => ledger(f.db, 'mohammed', today).detail(own.id), /not available/);
  assert.throws(() => p.save(null, {
    ...f.input,
    project_id: null
  }), /role/);
});
test('current revocation, independent return and author withdrawal preserve history and exclude drafts from reports', t => {
  const f = fixture(t);
  let r = f.author.save(null, f.input);
  r = decide(f.author, r, 'submit');
  f.db.prepare("UPDATE memberships SET role_id='accountant' WHERE user_id='reviewer'").run();
  assert.throws(() => decide(f.reviewer, r, 'post'), /authority/);
  r = decide(f.other, r, 'return');
  assert.equal(r.state, 'returned');
  r = f.author.save(r.id, {
    ...f.input,
    version: r.version,
    reason: 'Review again'
  });
  r = decide(f.author, r, 'submit');
  r = decide(f.author, r, 'withdraw');
  assert.equal(r.state, 'draft');
  assert.equal(f.author.report('jakh').rows.length, 0);
  assert.equal(r.history.length, 6);
  f.db.prepare("UPDATE users SET active=0 WHERE id='writer'").run();
  assert.throws(() => f.author.detail(r.id), /unavailable/);
});
test('journal authority is separately reviewed and cannot be attached to an ineligible role', t => {
  const f = fixture(t);
  const admin = accessAdmin(f.db, 'ahmed');
  const u = f.db.prepare("SELECT access_version FROM users WHERE id='other'").get();
  const input = {
    version: u.access_version,
    active: true,
    reason: 'Explicit independent journal authority',
    grants: [{
      company_id: 'jakh',
      project_id: '*',
      role_id: 'financial_controller',
      approval_limit: '0',
      budget_approval_limit: '0',
      ledger_approval_limit: '500'
    }]
  };
  const updated = admin.save('other', input);
  assert.equal(updated.grants[0].ledger_approval_limit, '500.00');
  assert.throws(() => admin.save('other', {
    ...input,
    version: updated.user.access_version,
    grants: [{
      ...input.grants[0],
      role_id: 'project_manager'
    }]
  }), /cannot post/);
});
test('additive examples cover every project, are idempotent and export all facts/findings with safe text', t => {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  const svc = ledger(db, 'ahmed', today),
    counts = () => db.prepare('SELECT count(*) n FROM ledger_entries WHERE source_type=\'manual\'').get().n;
  assert.equal(counts(), 12);
  installLedgerExamples(db);
  assert.equal(counts(), 12);
  for (const p of db.prepare('SELECT * FROM projects').all()) {
    const r = svc.report(p.company_id, {
      project: p.id
    });
    assert.equal(svc.list(p.company_id, p.id).length, 14);
    assert.equal(r.rows.length, p.id === 'harbour' ? 39 : 33);
    assert.equal(r.findings[2].source_ids.length, 1);
    assert.equal(r.findings[3].source_ids.length, 2);
    const csv = ledgerCsv(r);
    assert.ok(csv.indexOf('Findings') < csv.indexOf('Posted journal lines'));
    assert.equal(csv.split('\r\n').filter(l => l.includes('GL/2026/')).length, r.rows.length);
    r.rows[0].description = '=UNSAFE()';
    assert.ok(ledgerCsv(r).includes("'=UNSAFE()"));
  }
  assert.equal(db.prepare('SELECT count(*) n FROM identities').get().n, 0);
  assert.equal(db.prepare("SELECT ledger_approval_limit FROM memberships WHERE user_id='ahmed' LIMIT 1").get().ledger_approval_limit, '0');
});
test('account-filtered findings use only matching pending journals and project reports state their exact boundary', t => {
  const f = fixture(t);
  let r = f.author.save(null, f.input);
  r = decide(f.author, r, 'submit');
  const extra = f.reviewer.account(null, {
    company_id: 'jakh',
    code: '5100',
    name: 'Other expense',
    type: 'expense',
    purpose: 'general',
    active: true,
    reason: 'Separate test account'
  });
  assert.equal(f.author.report('jakh', {
    account: extra.id
  }).findings[2].source_ids.length, 0);
  assert.deepEqual(f.author.report('jakh', {
    account: f.expense.id
  }).findings[2].source_ids, [r.id]);
  const report = f.author.report('jakh', {
    project: 'harbour'
  });
  assert.match(report.limitations[1], /Selected project only/);
  assert.match(report.findings[0].text, /Harbour Tower/);
});
