import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { clientCorrections } from '../server/client-corrections.mjs';
import { certificates } from '../server/certificates.mjs';
import { advances } from '../server/advances.mjs';
import { receipts } from '../server/receipts.mjs';
import { receivableBalance } from '../server/receivable-balance.mjs';
import { effectiveRecoveries } from '../server/client-correction-state.mjs';
import { D, money, sum } from '../server/money.mjs';
const reason = 'Fictional controlled correction test; no external financial transaction.';
const evidence = {
  filename: 'correction-basis.txt',
  base64: Buffer.from(reason).toString('base64')
};
const date = new Date().toISOString().slice(0, 10),
  later = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10),
  today = () => later;
const act = (svc, r, action) => svc.decide(r.id, {
  version: r.version,
  action,
  reason
});
function fixture(t) {
  const db = openDatabase(':memory:', {
    examples: true,
    advanceExamples: true
  });
  t.after(() => db.close());
  db.prepare("UPDATE memberships SET advance_approval_limit='1000000' WHERE user_id='example-client-finance-reviewer'").run();
  db.prepare("INSERT INTO users(id,name,role) VALUES('correction-other','Scoped test user','ar_clerk')").run();
  db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id) VALUES('correction-other','jakh','gardens','ar_clerk')").run();
  for (const company of ['jakh', 'build']) if (!db.prepare("SELECT id FROM ledger_periods WHERE company_id=? AND start_date<=? AND end_date>=?").get(company, later, later)) db.prepare("INSERT INTO ledger_periods(id,company_id,name,start_date,end_date,state) VALUES(?,?,?,?,?,'open')").run('test-period-' + company, company, 'Test next day', later, later);
  const source = db.prepare("SELECT * FROM client_advances WHERE project_id='harbour' AND principal='300.00'").get();
  const certificate = db.prepare("SELECT * FROM client_certificates WHERE contract_id=? AND state='approved'").get(source.contract_id);
  const invoice = db.prepare('SELECT * FROM client_invoices WHERE advance_id=?').get(source.id);
  const svc = who => clientCorrections(db, who, today);
  return {
    db,
    source,
    certificate,
    invoice,
    svc,
    maker: svc('example-advance-author'),
    finance: svc('example-client-finance-reviewer')
  };
}
function request(f, ref, extra = {}) {
  return f.maker.save(null, {
    ...ref,
    title: 'Annul original source with retained evidence',
    effective_date: later,
    basis: reason,
    reason,
    ...evidence,
    ...extra
  });
}
function apply(f, r) {
  r = act(f.maker, r, 'submit');
  if (r.certificate_id) for (const who of ['example-technical-reviewer', 'example-certificate-commercial']) r = act(f.svc(who), r, 'accept');
  return act(f.finance, r, 'accept');
}
function replacement(f, {
  post = false
} = {}) {
  const maker = certificates(f.db, 'example-measurer', today),
    old = f.certificate,
    s = JSON.parse(old.snapshot);
  let r = maker.save(null, {
    contract_id: old.contract_id,
    title: 'Fresh replacement, never reset history',
    period_from: old.period_from,
    period_to: old.period_to,
    rate: old.rate,
    rate_date: old.rate_date,
    rate_source: reason,
    basis: reason,
    reason,
    ...evidence,
    lines: s.lines.map(l => ({
      line_key: l.line_key,
      cumulative_quantity: l.cumulative_quantity
    }))
  });
  r = act(maker, r, 'submit');
  for (const who of ['example-technical-reviewer', 'example-certificate-commercial', 'example-client-finance-reviewer']) r = act(certificates(f.db, who, today), r, 'accept');
  const ar = certificates(f.db, 'example-client-accountant', today);
  let i = ar.saveInvoice(null, {
    certificate_id: r.id,
    title: r.title,
    invoice_date: later,
    accounting_date: later,
    due_date: later,
    rate: '1',
    rate_date: later,
    rate_source: reason,
    basis: reason,
    reason
  });
  if (post) {
    i = ar.decideInvoice(i.id, {
      version: i.version,
      action: 'submit',
      reason
    });
    i = certificates(f.db, 'example-client-finance-reviewer', today).decideInvoice(i.id, {
      version: i.version,
      action: 'post',
      reason
    });
  }
  return {
    r,
    i
  };
}
test('approved unbilled cancellation releases allowance without rewriting approval or inventing accounting', t => {
  const f = fixture(t),
    a = f.db.prepare("SELECT * FROM client_advances WHERE contract_id=? AND principal='100.00'").get(f.source.contract_id),
    before = f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n;
  const original = JSON.stringify(a),
    r = apply(f, request(f, {
      advance_id: a.id
    }));
  assert.equal(r.state, 'applied');
  assert.equal(r.journal_id, null);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n, before);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM client_advances WHERE id=?').get(a.id)), original);
  const view = advances(f.db, 'example-advance-author', today).detail(a.id);
  assert.equal(view.can_invoice, false);
  assert.equal(view.approved_principal, '0.00');
  assert.equal(advances(f.db, 'example-advance-author', today).options('jakh', 'harbour').contracts.find(c => c.id === a.contract_id).approved_principal, '450.00');
  assert.throws(() => certificates(f.db, 'example-client-accountant', today).saveInvoice(null, {
    advance_id: a.id
  }), /annulled/);
  assert.throws(() => f.db.prepare("UPDATE client_corrections SET state='draft' WHERE id=?").run(r.id), /immutable/);
  assert.throws(() => f.db.prepare('DELETE FROM client_correction_evidence WHERE correction_id=?').run(r.id), /retained/);
});
test('unpaid advance credit reverses exact original lines and respects report cutoff', t => {
  const f = fixture(t),
    a = f.db.prepare("SELECT * FROM client_advances WHERE contract_id=? AND principal='150.00'").get(f.source.contract_id),
    invoice = f.db.prepare('SELECT * FROM client_invoices WHERE advance_id=?').get(a.id);
  const r = apply(f, request(f, {
      advance_id: a.id
    })),
    lines = f.db.prepare('SELECT * FROM ledger_lines WHERE entry_id=? ORDER BY ordinal').all(r.journal_id),
    original = JSON.parse(invoice.journal_json);
  for (const [i, l] of lines.entries()) for (const [k, other] of [['debit', 'credit'], ['credit', 'debit'], ['base_debit', 'base_credit'], ['base_credit', 'base_debit']]) assert.equal(l[k], original[i][other]);
  assert.equal(receivableBalance(f.db, invoice, date).open, '157.50');
  assert.equal(receivableBalance(f.db, invoice, later).open, '0.00');
  const service = advances(f.db, 'example-advance-author', today),
    old = service.report('jakh', {
      project: 'harbour',
      to: date
    }),
    current = service.report('jakh', {
      project: 'harbour',
      to: later
    });
  assert.equal(old.rows.find(x => x.id === a.id).liability_principal, '150.00');
  assert.equal(current.rows.find(x => x.id === a.id).liability_principal, '0.00');
  for (const report of [old, current]) {
    assert.equal(report.reconciliation.difference, '0.00');
    assert.equal(report.tax_reconciliation.difference, '0.00');
  }
  assert.equal(act(f.finance, {
    ...r,
    version: 1
  }, 'accept').journal_id, r.journal_id);
});
test('recovered advance needs linked certificate credit; paid cash survives as customer credit and every control reconciles', t => {
  const f = fixture(t),
    originalCertificate = JSON.stringify(f.certificate),
    cash = f.db.prepare('SELECT * FROM client_receipts ORDER BY id').all(),
    allocations = f.db.prepare('SELECT * FROM client_receipt_allocations ORDER BY receipt_id,invoice_id').all();
  let blocked = request(f, {
    advance_id: f.source.id
  });
  assert.match(blocked.blockers.join(' '), /certified recovery/);
  assert.throws(() => act(f.maker, blocked, 'submit'), /certified recovery/);
  const credit = apply(f, request(f, {
    certificate_id: f.certificate.id
  }));
  assert.ok(credit.journal_id);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM client_certificates WHERE id=?').get(f.certificate.id)), originalCertificate);
  assert.equal(effectiveRecoveries(f.db, f.invoice.id).length, 0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_advance_recoveries WHERE certificate_id=?').get(f.certificate.id).n, 1);
  assert.equal(certificates(f.db, 'example-measurer', today).contract(f.source.contract_id).previous, null);
  blocked = f.maker.save(blocked.id, {
    ...blocked,
    reason
  });
  blocked = apply(f, blocked);
  const balance = receivableBalance(f.db, f.invoice);
  assert.equal(balance.settled, '210.00');
  assert.equal(balance.credited, '315.00');
  assert.equal(balance.open, '-210.00');
  assert.equal(balance.debit_open, '0.00');
  assert.equal(balance.customer_credit, '210.00');
  assert.deepEqual(f.db.prepare('SELECT * FROM client_receipts ORDER BY id').all(), cash);
  assert.deepEqual(f.db.prepare('SELECT * FROM client_receipt_allocations ORDER BY receipt_id,invoice_id').all(), allocations);
  const report = advances(f.db, 'example-advance-author', today).report('jakh', {
      project: 'harbour',
      to: later
    }),
    row = report.rows.find(x => x.id === f.source.id);
  assert.equal(row.current_available, '0.00');
  assert.equal(row.current_certified, '0.00');
  assert.equal(row.recovered_principal, '0.00');
  assert.equal(row.paid_principal, '0.00');
  assert.equal(row.customer_credit, '210.00');
  assert.equal(report.reconciliation.difference, '0.00');
  assert.equal(report.tax_reconciliation.difference, '0.00');
  const receiptsReport = receipts(f.db, 'example-receipt-reviewer', today).report('jakh', {
    project: 'harbour',
    to: later
  });
  assert.equal(receiptsReport.reconciliation.difference, '0.00');
  assert.equal(receiptsReport.currency_groups[0].customer_credit, '210.00');
});
test('withdrawal of an uninvoiced certified replacement releases recovery and blocks retained draft invoice', t => {
  const f = fixture(t);
  apply(f, request(f, {
    certificate_id: f.certificate.id
  }));
  const {
    r,
    i
  } = replacement(f);
  assert.throws(() => certificates(f.db, 'example-client-accountant', today).saveInvoice(i.id, {
    ...i,
    accounting_date: date,
    invoice_date: date,
    rate_date: date,
    reason
  }), /must follow the contract correction/);
  assert.equal(r.recovery, '136.60');
  assert.equal(effectiveRecoveries(f.db, f.invoice.id).length, 1);
  const result = apply(f, request(f, {
    certificate_id: r.id
  }));
  assert.equal(result.journal_id, null);
  assert.equal(effectiveRecoveries(f.db, f.invoice.id).length, 0);
  const ar = certificates(f.db, 'example-client-accountant', today);
  assert.equal(ar.invoice(i.id).can_submit, false);
  assert.equal(ar.invoice(i.id).effective_state, 'cancelled');
  assert.throws(() => ar.decideInvoice(i.id, {
    version: i.version,
    action: 'submit',
    reason
  }), /annulled/);
  assert.equal(f.db.prepare('SELECT state FROM client_invoices WHERE id=?').get(i.id).state, 'draft');
});
test('approved cash plans block credit; later recorded cash makes earlier correction basis stale', t => {
  const f = fixture(t),
    a = f.db.prepare("SELECT * FROM client_advances WHERE contract_id=? AND principal='150.00'").get(f.source.contract_id),
    invoice = f.db.prepare('SELECT * FROM client_invoices WHERE advance_id=?').get(a.id);
  const maker = receipts(f.db, 'example-receipt-author', today),
    review = receipts(f.db, 'example-receipt-reviewer', today),
    recorder = receipts(f.db, 'example-receipt-recorder', today);
  const bank = f.db.prepare("SELECT id FROM payment_banks WHERE company_id='jakh' AND name='Example · Receipt demonstration bank'").get();
  let correction = act(f.maker, request(f, {
    advance_id: a.id
  }), 'submit');
  let cash = maker.save(null, {
    company_id: 'jakh',
    bank_id: bank.id,
    title: 'Payment during credit review',
    accounting_date: later,
    bank_amount: '25',
    bank_rate: '1',
    rate_date: later,
    rate_source: reason,
    explanation: reason,
    allocations: [{
      invoice_id: invoice.id,
      amount: '25'
    }]
  });
  cash = act(review, act(maker, cash, 'submit'), 'approve');
  assert.throws(() => act(f.finance, correction, 'accept'), /approved cash plans/);
  recorder.decide(cash.id, {
    version: cash.version,
    action: 'record',
    reason,
    bank_reference: 'CREDIT-PENDING-CASH',
    file: evidence
  });
  assert.throws(() => act(f.finance, correction, 'accept'), /dependencies changed/);
  correction = act(f.finance, correction, 'return');
  correction = f.maker.save(correction.id, {
    ...correction,
    reason
  });
  correction = apply(f, correction);
  assert.equal(correction.snapshot.customer_credit_after, '25.00');
  assert.equal(receivableBalance(f.db, invoice).customer_credit, '25.00');
  assert.equal(f.finance.report('jakh', {
    project: 'harbour',
    to: later
  }).reconciliation.difference, '0.00');
});
test('certificate accounting reports include dated credits independently from original invoice date', t => {
  const f = fixture(t),
    sourceInvoice = f.db.prepare('SELECT * FROM client_invoices WHERE certificate_id=?').get(f.certificate.id),
    r = apply(f, request(f, {
      certificate_id: f.certificate.id
    }));
  const service = certificates(f.db, 'example-client-finance-reviewer', today),
    before = service.report('jakh', {
      project: 'harbour',
      from: date,
      to: date
    }),
    creditOnly = service.report('jakh', {
      project: 'harbour',
      from: later,
      to: later
    });
  assert.equal(before.credits.length, 0);
  assert.equal(creditOnly.invoices.length, 0);
  assert.equal(creditOnly.credits.length, 1);
  assert.equal(creditOnly.credits[0].id, r.id);
  assert.equal(creditOnly.totals.posted_receivable, money(new D(0).minus(sourceInvoice.company_total)));
  assert.equal(creditOnly.totals.posted_recovery, '-136.60');
  for (const report of [before, creditOnly]) for (const key of ['recovery_difference', 'receivable_difference', 'retention_difference']) assert.equal(report.totals[key], '0.00');
});
test('later certificates block earlier annulment and the three review stages remain independent/current', t => {
  const f = fixture(t),
    m = certificates(f.db, 'example-measurer', today),
    c = m.contract(f.source.contract_id);
  let next = m.save(null, {
    contract_id: c.id,
    title: 'Later dependent work',
    period_from: later,
    period_to: later,
    rate: '1',
    rate_date: date,
    rate_source: reason,
    basis: reason,
    reason,
    ...evidence,
    lines: c.lines.map(l => ({
      line_key: l.line_key,
      cumulative_quantity: new D(l.quantity).times('0.03').toString()
    }))
  });
  const blocked = request(f, {
    certificate_id: f.certificate.id
  });
  assert.match(blocked.blockers.join(' '), /pending measurement/);
  assert.throws(() => act(f.maker, blocked, 'submit'), /pending measurement/);
  next = act(m, next, 'submit');
  for (const who of ['example-technical-reviewer', 'example-certificate-commercial', 'example-client-finance-reviewer']) next = act(certificates(f.db, who, today), next, 'accept');
  assert.match(f.maker.detail(blocked.id).blockers.join(' '), /later effective certificate/);
  let r = act(f.maker, request(f, {
    certificate_id: next.id
  }), 'submit');
  assert.throws(() => act(f.maker, r, 'accept'), /different/);
  r = act(f.svc('example-technical-reviewer'), r, 'accept');
  assert.throws(() => act(f.svc('example-technical-reviewer'), r, 'accept'), /different/);
  r = act(f.svc('example-certificate-commercial'), r, 'accept');
  f.db.prepare("UPDATE users SET active=0 WHERE id='example-technical-reviewer'").run();
  assert.throws(() => act(f.finance, r, 'accept'), /Technical reviewer/);
  r = act(f.finance, r, 'return');
  assert.equal(r.state, 'returned');
  f.db.prepare("UPDATE users SET active=1 WHERE id='example-technical-reviewer'").run();
  r = f.maker.save(r.id, {
    ...r,
    reason
  });
  r = apply(f, r);
  assert.equal(r.state, 'applied');
  const original = f.maker.save(blocked.id, {
    ...blocked,
    reason
  });
  assert.equal(apply(f, original).state, 'applied');
});
test('changed invoice or receipt invalidates the entire reviewed basis; returns permit fresh review', t => {
  const f = fixture(t),
    a = f.db.prepare("SELECT * FROM client_advances WHERE contract_id=? AND principal='100.00'").get(f.source.contract_id);
  let r = act(f.maker, request(f, {
    advance_id: a.id
  }), 'submit');
  certificates(f.db, 'example-client-accountant', today).saveInvoice(null, {
    advance_id: a.id,
    title: a.title,
    invoice_date: date,
    accounting_date: date,
    due_date: later,
    rate: '1',
    rate_date: date,
    rate_source: reason,
    basis: reason,
    reason
  });
  assert.throws(() => act(f.finance, r, 'accept'), /dependencies changed/);
  r = act(f.finance, r, 'return');
  r = f.maker.save(r.id, {
    ...r,
    reason
  });
  assert.ok(r.invoice_id);
  assert.equal(apply(f, r).state, 'applied');
});
test('closed periods and injected journal failure cannot leave a partial credit or released recovery', t => {
  const f = fixture(t);
  let r = act(f.maker, request(f, {
    certificate_id: f.certificate.id
  }), 'submit');
  for (const who of ['example-technical-reviewer', 'example-certificate-commercial']) r = act(f.svc(who), r, 'accept');
  f.db.prepare("UPDATE ledger_periods SET state='closed' WHERE company_id='jakh'").run();
  assert.throws(() => act(f.finance, r, 'accept'), /open company period/);
  f.db.prepare("UPDATE ledger_periods SET state='open' WHERE company_id='jakh'").run();
  const sequences = f.db.prepare('SELECT * FROM ledger_sequences ORDER BY company_id,year').all(),
    journals = f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n;
  f.db.exec("CREATE TRIGGER injected_credit_failure BEFORE INSERT ON ledger_lines WHEN NEW.description LIKE 'Original advance tax released%' BEGIN SELECT RAISE(ABORT,'Injected credit failure'); END;");
  assert.throws(() => act(f.finance, r, 'accept'), /Injected credit failure/);
  assert.equal(f.maker.detail(r.id).state, 'finance');
  assert.equal(f.maker.detail(r.id).journal_id, null);
  assert.equal(effectiveRecoveries(f.db, f.invoice.id).length, 1);
  assert.deepEqual(f.db.prepare('SELECT * FROM ledger_sequences ORDER BY company_id,year').all(), sequences);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n, journals);
  f.db.exec('DROP TRIGGER injected_credit_failure');
  assert.equal(act(f.finance, r, 'accept').state, 'applied');
});
test('source scope, evidence, separate credit authority and original author departure are enforced correctly', t => {
  const f = fixture(t),
    a = f.db.prepare("SELECT * FROM client_advances WHERE contract_id=? AND principal='150.00'").get(f.source.contract_id);
  const noFile = {
    advance_id: a.id,
    title: 'Needs evidence',
    effective_date: later,
    basis: reason,
    reason
  };
  let r = f.maker.save(null, noFile);
  assert.throws(() => act(f.maker, r, 'submit'), /evidence/);
  r = f.maker.save(r.id, {
    ...r,
    reason,
    ...evidence
  });
  r = act(f.maker, r, 'submit');
  f.db.prepare("UPDATE memberships SET ar_approval_limit='0' WHERE user_id='example-client-finance-reviewer'").run();
  assert.throws(() => act(f.finance, r, 'accept'), /authorised reviewer/);
  f.db.prepare("UPDATE memberships SET ar_approval_limit='1000000' WHERE user_id='example-client-finance-reviewer'").run();
  f.db.prepare("UPDATE users SET active=0 WHERE id='example-client-accountant'").run();
  assert.equal(act(f.finance, r, 'accept').state, 'applied', 'A retired original invoice author must not prevent an independent historical correction');
  const restricted = f.svc('correction-other');
  assert.throws(() => restricted.detail(r.id), /unavailable/);
  assert.throws(() => restricted.download(r.evidence_id), /unavailable/);
  assert.deepEqual(restricted.report('jakh', {
    to: later
  }).rows, []);
  assert.throws(() => restricted.report('jakh', {
    project: 'harbour',
    to: later
  }), /unavailable/);
  assert.throws(() => f.maker.save(null, {
    ...noFile,
    advance_id: null,
    certificate_id: f.certificate.id,
    effective_date: '2026-02-30'
  }), /valid calendar/);
});
