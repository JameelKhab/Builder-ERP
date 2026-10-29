import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { certificates } from '../server/certificates.mjs';
import { installCertificateExamples } from '../server/certificates-examples.mjs';
import { ledger } from '../server/ledger.mjs';
import { createService } from '../server/service.mjs';
import { D } from '../server/money.mjs';
const today = () => '2026-10-29',
  reason = 'A clear independent test decision with evidence';
const ids = {
  maker: 'example-measurer',
  technical: 'example-technical-reviewer',
  commercial: 'example-certificate-commercial',
  finance: 'example-client-finance-reviewer',
  setup: 'example-client-finance-author',
  ar: 'example-client-accountant'
};
function fixture(t) {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  const s = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, certificates(db, id, today)]));
  const pending = s.maker.list('jakh', 'harbour').find(r => r.state === 'technical');
  return {
    db,
    ...s,
    pending,
    contract: s.maker.contract(pending.contract_id)
  };
}
const decide = (s, r, action = 'accept') => s.decide(r.id, {
  version: r.version,
  action,
  reason
});
function approved(f) {
  let r = decide(f.technical, f.pending);
  r = decide(f.commercial, r);
  return decide(f.finance, r);
}
const invoiceInput = r => ({
  certificate_id: r.id,
  invoice_date: '2026-10-29',
  accounting_date: '2026-10-29',
  due_date: '2026-11-28',
  rate: r.rate || '1',
  rate_date: '2026-10-29',
  rate_source: 'Fictional dated test rate',
  basis: 'Typed certified work, separate accounting decision',
  reason
});
function draft(f) {
  const r = decide(f.technical, f.pending, 'return');
  return f.maker.save(r.id, {
    ...r,
    reason
  });
}
test('cumulative measurement follows approved predecessor, independent stages and separate typed client invoice', t => {
  const f = fixture(t),
    before = f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n;
  const r = approved(f);
  assert.equal(r.state, 'approved');
  assert.equal(r.snapshot.previous_gross, '8537.76');
  assert.equal(r.snapshot.gross, '5122.66');
  assert.equal(r.snapshot.retention, '256.13');
  assert.equal(r.snapshot.tax, '256.13');
  assert.equal(r.snapshot.total, '5122.66');
  assert.equal(r.snapshot.recovery, '0.00');
  assert.equal(r.snapshot.eligible_advance, '0.00');
  assert.equal(r.snapshot.lines[0].previous_quantity, '28');
  assert.equal(r.snapshot.lines[0].cumulative_quantity, '44.8');
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n, before);
  let i = f.ar.saveInvoice(null, invoiceInput(r));
  assert.equal(i.state, 'draft');
  assert.equal(f.ar.saveInvoice(null, invoiceInput(r)).id, i.id);
  assert.equal(i.company_total, '5122.66');
  i = f.ar.decideInvoice(i.id, {
    version: i.version,
    action: 'submit',
    reason
  });
  i = f.finance.decideInvoice(i.id, {
    version: i.version,
    action: 'post',
    reason
  });
  assert.equal(i.state, 'posted');
  assert.equal(f.db.prepare('SELECT source_type FROM ledger_entries WHERE id=?').get(i.journal_id).source_type, 'client_invoice');
  assert.equal(f.finance.decideInvoice(i.id, {
    version: 1,
    action: 'post',
    reason
  }).id, i.id);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n, before + 1);
  const report = f.finance.report('jakh', {
    project: 'harbour'
  });
  assert.equal(report.totals.receivable_difference, '0.00');
  assert.equal(report.totals.retention_difference, '0.00');
  assert.match(report.findings.join(' '), /not receipts/);
  assert.throws(() => ledger(f.db, ids.finance, today).reverse(i.journal_id, {
    version: 2,
    accounting_date: today(),
    reason
  }), /source|typed|document/i);
});
test('measurement ceiling, full line set, periods, stale versions and immutable evidence are enforced', t => {
  const f = fixture(t),
    r = draft(f);
  const input = {
    ...r,
    reason
  };
  assert.throws(() => f.maker.save(r.id, {
    ...input,
    lines: r.lines.slice(1)
  }), /every/);
  assert.throws(() => f.maker.save(r.id, {
    ...input,
    lines: r.lines.map((l, i) => ({
      ...l,
      cumulative_quantity: i === 0 ? '113' : l.cumulative_quantity
    }))
  }), /contracted/);
  assert.throws(() => f.maker.save(r.id, {
    ...input,
    lines: r.lines.map((l, i) => ({
      ...l,
      cumulative_quantity: i === 0 ? '27' : l.cumulative_quantity
    }))
  }), /previous/);
  assert.throws(() => f.maker.save(r.id, {
    ...input,
    period_from: '2026-10-21'
  }), /overlaps/);
  assert.throws(() => f.maker.save(r.id, {
    ...input,
    period_to: '2026-02-30'
  }), /calendar/);
  assert.throws(() => f.maker.save(r.id, {
    ...input,
    version: 1
  }), /changed/);
  const e = f.maker.download(r.evidence_id);
  assert.ok(e.bytes.length);
  assert.equal(e.sha256.length, 64);
  assert.throws(() => f.db.prepare('UPDATE client_measurement_evidence SET filename=? WHERE id=?').run('changed.txt', e.id), /immutable/);
  assert.throws(() => f.maker.save(r.id, {
    ...input,
    filename: '../bad.txt',
    base64: 'eA=='
  }), /filename/);
});
test('returns preserve cycles, all reviewers are independent and live earlier authority is rechecked', t => {
  const f = fixture(t);
  assert.throws(() => decide(f.maker, f.pending), /different/);
  let r = decide(f.technical, f.pending);
  assert.throws(() => decide(f.technical, r), /different/);
  f.db.prepare("UPDATE memberships SET certificate_approval_limit='0' WHERE user_id=?").run(ids.commercial);
  assert.throws(() => decide(f.commercial, r), /authorised/);
  f.db.prepare("UPDATE memberships SET certificate_approval_limit='1000000' WHERE user_id=?").run(ids.commercial);
  r = decide(f.commercial, r);
  f.db.prepare('UPDATE users SET active=0 WHERE id=?').run(ids.technical);
  assert.throws(() => decide(f.finance, r), /earlier reviewer/);
  r = decide(f.finance, r, 'return');
  f.db.prepare('UPDATE users SET active=1 WHERE id=?').run(ids.technical);
  r = f.maker.save(r.id, {
    ...r,
    reason
  });
  assert.equal(r.cycle, 1);
  assert.equal(r.technical_by, null);
  r = decide(f.maker, r, 'submit');
  assert.equal(r.cycle, 2);
  assert.ok(r.history.some(h => h.action.includes('Returned')));
});
test('finance policy needs independent contract authority and current account snapshots', t => {
  const f = fixture(t),
    p = f.contract.policies[0],
    input = {
      ...p,
      contract_id: f.contract.id,
      reason
    };
  let c = f.setup.savePolicy(null, input),
    q = c.policies[0];
  assert.equal(q.state, 'draft');
  c = f.setup.decidePolicy(q.id, {
    version: q.version,
    action: 'submit',
    reason
  });
  q = c.policies[0];
  assert.throws(() => f.setup.decidePolicy(q.id, {
    version: q.version,
    action: 'approve',
    reason
  }), /independent/);
  f.db.prepare("UPDATE memberships SET certificate_approval_limit='1' WHERE user_id=?").run(ids.finance);
  assert.throws(() => f.finance.decidePolicy(q.id, {
    version: q.version,
    action: 'approve',
    reason
  }), /sufficient/);
  f.db.prepare("UPDATE memberships SET certificate_approval_limit='1000000' WHERE user_id=?").run(ids.finance);
  c = f.finance.decidePolicy(q.id, {
    version: q.version,
    action: 'approve',
    reason
  });
  assert.equal(c.policies[0].state, 'active');
  assert.equal(c.policies[1].state, 'superseded');
  assert.throws(() => decide(f.technical, f.pending), /policy changed/);
  let r = draft(f);
  r = decide(f.maker, r, 'submit');
  const a = c.policies[0].snapshot.accounts.revenue;
  f.db.prepare('UPDATE ledger_accounts SET version=version+1 WHERE id=?').run(a.id);
  assert.throws(() => decide(f.technical, r), /account changed/i);
});
test('whole final quantity exhausts authoritative line cents and retention, not rounded unit rates', t => {
  const f = fixture(t),
    d = draft(f);
  let r = f.maker.save(d.id, {
    ...d,
    lines: f.contract.lines.map(l => ({
      line_key: l.line_key,
      cumulative_quantity: l.quantity
    })),
    reason
  });
  r = decide(f.maker, r, 'submit');
  r = decide(f.technical, r);
  r = decide(f.commercial, r);
  r = decide(f.finance, r);
  assert.equal(r.snapshot.cumulative_gross, f.contract.original_value);
  assert.equal(r.snapshot.cumulative_retention, '1707.55');
  for (const l of r.snapshot.lines) {
    assert.equal(l.cumulative_amount, l.amount);
    assert.equal(l.remaining_quantity, '0');
  }
  assert.equal(new D(r.snapshot.previous_gross).plus(r.snapshot.gross).toFixed(2), '34151.04');
});
test('missing measurement evidence blocks submission and replaced evidence stays available', t => {
  const f = fixture(t);
  decide(f.maker, f.pending, 'cancel');
  const base = {
    ...f.pending,
    contract_id: f.contract.id,
    lines: f.contract.lines.map(l => ({
      line_key: l.line_key,
      cumulative_quantity: new D(l.quantity).times('0.4').toString()
    })),
    rate: '1',
    rate_date: '2026-10-28',
    rate_source: 'Same currency',
    basis: 'Measured work with original evidence',
    reason
  };
  let r = f.maker.save(null, base);
  assert.throws(() => decide(f.maker, r, 'submit'), /evidence/);
  r = f.maker.save(r.id, {
    ...r,
    filename: 'first.txt',
    base64: 'eA==',
    reason
  });
  const first = r.evidence_id;
  r = f.maker.save(r.id, {
    ...r,
    filename: 'second.txt',
    base64: 'eQ==',
    reason
  });
  assert.equal(r.evidence.length, 2);
  assert.notEqual(first, r.evidence_id);
  assert.equal(f.maker.download(first).bytes.toString(), '120'); // SQLite returns Uint8Array
});
test('project/company scope applies to contracts, evidence, invoices, search and complete report', t => {
  const f = fixture(t);
  f.db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run('limited', 'Limited AR', 'ar_clerk');
  f.db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id) VALUES('limited','jakh','gardens','ar_clerk')").run();
  const s = certificates(f.db, 'limited', today);
  assert.throws(() => s.contract(f.contract.id), /unavailable/);
  assert.throws(() => s.download(f.maker.detail(f.pending.id).evidence_id), /unavailable/);
  assert.equal(s.report('jakh').rows.every(r => r.project_id === 'gardens'), true);
  assert.throws(() => s.report('build'), /unavailable/);
  const restricted = createService(f.db, 'limited', today);
  assert.equal(restricted.search('jakh', 'harbour').length, 0);
  const c = s.contract(s.list('jakh')[0].contract_id);
  assert.ok(!JSON.stringify(c).includes('award_cost'));
  assert.ok(!JSON.stringify(c).includes('resource_type'));
  assert.ok(c.lines.every(l => !l.source));
});
test('invoice posting checks independent separate limit, period, current author, immutability and exact FX', t => {
  const f = fixture(t),
    r = approved(f); // Changing invoice currency is never accepted: it comes from the contract.
  let i = f.ar.saveInvoice(null, {
    ...invoiceInput(r),
    currency: 'USD'
  });
  assert.equal(i.currency, 'AED');
  assert.throws(() => f.ar.saveInvoice(i.id, {
    ...i,
    reason,
    rate: '3.67'
  }), /rate 1/);
  i = f.ar.decideInvoice(i.id, {
    version: i.version,
    action: 'submit',
    reason
  });
  assert.throws(() => f.ar.decideInvoice(i.id, {
    version: i.version,
    action: 'post',
    reason
  }), /Independent/);
  f.db.prepare("UPDATE memberships SET ar_approval_limit='0' WHERE user_id=?").run(ids.finance);
  assert.throws(() => f.finance.decideInvoice(i.id, {
    version: i.version,
    action: 'post',
    reason
  }), /Independent/);
  f.db.prepare("UPDATE memberships SET ar_approval_limit='1000000' WHERE user_id=?").run(ids.finance);
  f.db.prepare("UPDATE ledger_periods SET state='closed' WHERE company_id='jakh'").run();
  assert.throws(() => f.finance.decideInvoice(i.id, {
    version: i.version,
    action: 'post',
    reason
  }), /open company period/);
  f.db.prepare("UPDATE ledger_periods SET state='open' WHERE company_id='jakh'").run();
  f.db.prepare('UPDATE users SET active=0 WHERE id=?').run(ids.ar);
  assert.throws(() => f.finance.decideInvoice(i.id, {
    version: i.version,
    action: 'post',
    reason
  }), /author/);
  f.db.prepare('UPDATE users SET active=1 WHERE id=?').run(ids.ar);
  i = f.finance.decideInvoice(i.id, {
    version: i.version,
    action: 'post',
    reason
  });
  assert.throws(() => f.db.prepare("UPDATE client_invoices SET total='1' WHERE id=?").run(i.id), /immutable/);
  assert.throws(() => f.db.prepare("UPDATE client_certificates SET state='draft' WHERE id=?").run(r.id), /immutable/);
  assert.throws(() => f.db.prepare('DELETE FROM client_certificate_lines WHERE certificate_id=?').run(r.id), /retained/);
});
test('reports separate accounting date population, preserve filtered totals and reject invalid ranges', t => {
  const f = fixture(t),
    r = f.finance.report('jakh', {
      project: 'harbour',
      state: 'technical',
      from: '2026-10-22',
      to: '2026-10-29'
    });
  assert.equal(r.rows.length, 1);
  assert.equal(r.invoices.length, 0);
  assert.equal(r.currencies[0].certified_gross, '0.00');
  assert.throws(() => f.finance.report('jakh', {
    from: '2026-10-29',
    to: '2026-10-01'
  }), /reversed/);
  assert.throws(() => f.finance.report('jakh', {
    state: 'invented'
  }), /Unknown/);
  assert.equal(f.finance.report('build').rows.length, 4);
  const all = f.finance.report('jakh');
  assert.equal(all.rows.length, 8);
  assert.equal(all.invoices.length, 6);
  assert.equal(all.totals.receivable_difference, '0.00');
});
test('additive examples are idempotent and every supplied project has an invoiced, draft and review example', t => {
  const f = fixture(t),
    before = f.db.prepare('SELECT count(*) n FROM client_certificates').get().n;
  installCertificateExamples(f.db);
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_certificates').get().n, before);
  for (const p of ['harbour', 'gardens', 'creek']) {
    assert.equal(f.db.prepare('SELECT count(*) n FROM client_certificates WHERE project_id=?').get(p).n, 4);
    assert.equal(f.db.prepare("SELECT count(*) n FROM client_invoices WHERE project_id=? AND state='posted'").get(p).n, 1);
  }
  assert.equal(f.db.prepare('SELECT count(*) n FROM identities').get().n, 0);
  assert.equal(f.db.prepare("SELECT certificate_approval_limit,ar_approval_limit FROM memberships WHERE user_id='ahmed' LIMIT 1").get().certificate_approval_limit, '0.00');
});
async function foreignCertificate(f, {
  offer = {},
  tax_basis = 'gross',
  tax_percent = '5'
} = {}) {
  const {
      estimates
    } = await import('../server/estimates.mjs'),
    {
      commercial
    } = await import('../server/commercial.mjs'),
    {
      sampleEstimate
    } = await import('../server/estimates-examples.mjs'),
    {
      sampleOffer
    } = await import('../server/commercial-examples.mjs');
  const customer = f.contract.customer_id,
    em = estimates(f.db, 'ahmed', today),
    er = estimates(f.db, 'example-estimate-reviewer', today);
  let e = em.save(null, {
    ...sampleEstimate({
      id: 'jakh',
      currency: 'USD'
    }, customer, today(), 'harbour'),
    rate: '3.6725',
    rate_source: 'Fictional USD offer conversion'
  });
  e = em.decide(e.id, {
    version: e.version,
    action: 'submit',
    reason
  });
  e = er.decide(e.id, {
    version: e.version,
    action: 'approve',
    reason
  });
  const sm = commercial(f.db, 'ahmed', today),
    sr = commercial(f.db, 'example-commercial-reviewer', today);
  let o = sm.save(null, {
    ...sampleOffer(e, today()),
    ...offer
  });
  o = sm.decide(o.id, {
    version: o.version,
    action: 'submit',
    reason
  });
  o = sr.decide(o.id, {
    version: o.version,
    action: 'approve',
    reason
  });
  o = sm.recordAcceptance(o.id, {
    version: o.version,
    project_id: 'harbour',
    mapping: o.lines.map(l => ({
      line_key: l.line_key,
      work_package_id: 'WP-C-101',
      location_id: null
    })),
    reference: 'TEST-USD-ACCEPT',
    accepted_on: today(),
    signatory: 'Fictional client',
    description: 'Local test of foreign-currency original terms',
    filename: 'acceptance.txt',
    base64: 'eA==',
    reason
  });
  o = sr.decideAcceptance(o.acceptances[0].id, {
    version: 1,
    action: 'verify',
    confirmed: true,
    reason
  });
  let c = f.setup.savePolicy(null, {
    ...f.contract.policies[0],
    contract_id: o.contract.id,
    tax_basis,
    tax_percent,
    reason
  });
  let p = c.policies[0];
  c = f.setup.decidePolicy(p.id, {
    version: p.version,
    action: 'submit',
    reason
  });
  p = c.policies[0];
  c = f.finance.decidePolicy(p.id, {
    version: p.version,
    action: 'approve',
    reason
  });
  let r = f.maker.save(null, {
    contract_id: c.id,
    title: 'Foreign measurement',
    period_from: today(),
    period_to: today(),
    rate: '3.6725',
    rate_date: today(),
    rate_source: 'Fictional certificate rate',
    basis: 'All original work measured in the test',
    filename: 'measurement.txt',
    base64: 'eA==',
    lines: c.lines.map(l => ({
      line_key: l.line_key,
      cumulative_quantity: l.quantity
    })),
    reason
  });
  r = decide(f.maker, r, 'submit');
  r = decide(f.technical, r);
  r = decide(f.commercial, r);
  r = decide(f.finance, r);
  return r;
}
test('foreign contract and separately dated invoice FX preserve balanced company AR and retention cents', async t => {
  const f = fixture(t),
    r = await foreignCertificate(f);
  assert.equal(r.snapshot.company_gross, '125419.69');
  let i = f.ar.saveInvoice(null, {
    ...invoiceInput(r),
    rate: '3.7'
  });
  i = f.ar.decideInvoice(i.id, {
    version: i.version,
    action: 'submit',
    reason
  });
  i = f.finance.decideInvoice(i.id, {
    version: i.version,
    action: 'post',
    reason
  });
  assert.equal(i.currency, 'USD');
  assert.equal(i.company_total, '126358.84');
  assert.equal(i.company_retention, '6317.94');
  assert.equal(i.journal.find(l => l.description === 'Certified client receivable').rounding_adjustment, '-0.01');
  assert.equal(i.journal.reduce((s, l) => s.plus(l.base_debit).minus(l.base_credit), new D(0)).toFixed(2), '0.00');
  assert.equal(f.finance.report('jakh').totals.receivable_difference, '0.00');
});
test('certificate and invoice findings export the complete filtered population with safe spreadsheet text', async t => {
  const f = fixture(t),
    {
      certificatesReportCsv,
      certificateDetailCsv
    } = await import('../src/certificates-export.js');
  const r = f.finance.report('jakh', {
      project: 'harbour'
    }),
    csv = certificatesReportCsv(r);
  assert.ok(csv.indexOf('Findings') < csv.indexOf('Certificate","Title'));
  for (const x of r.rows) assert.ok(csv.includes(x.id));
  for (const x of r.invoices) assert.ok(csv.includes(x.id));
  r.rows[0].title = '=SUM(1)';
  assert.ok(certificatesReportCsv(r).includes("'=SUM(1)"));
  const d = f.maker.detail(f.pending.id);
  assert.ok(certificateDetailCsv(d).includes(d.evidence[0].sha256));
});
test('retention stops at its agreed cap and exclusive net-basis tax uses the net measured amount', async t => {
  const f = fixture(t),
    r = await foreignCertificate(f, {
      offer: {
        retention_cap: '200'
      },
      tax_basis: 'net'
    });
  assert.equal(r.snapshot.retention, '200.00');
  assert.equal(r.snapshot.net, '33951.04');
  assert.equal(r.snapshot.tax, '1697.55');
  assert.equal(r.snapshot.total, '35648.59');
  assert.equal(r.snapshot.recovery, '0.00');
});
test('fully retained zero-tax work posts retention and revenue without manufacturing an AR balance', async t => {
  const f = fixture(t),
    r = await foreignCertificate(f, {
      offer: {
        retention_percent: '100',
        retention_cap: '34151.04'
      },
      tax_basis: 'net',
      tax_percent: '0'
    });
  assert.equal(r.snapshot.total, '0.00');
  let i = f.ar.saveInvoice(null, {
    ...invoiceInput(r),
    rate: '3.7'
  });
  assert.equal(i.journal.length, 2);
  assert.equal(i.company_total, '0.00');
  i = f.ar.decideInvoice(i.id, {
    version: i.version,
    action: 'submit',
    reason
  });
  i = f.finance.decideInvoice(i.id, {
    version: i.version,
    action: 'post',
    reason
  });
  assert.equal(i.state, 'posted');
  assert.equal(i.company_retention, '126358.85');
  assert.equal(f.finance.report('jakh').totals.receivable_difference, '0.00');
});
