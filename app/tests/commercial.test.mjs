import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { commercial } from '../server/commercial.mjs';
import { estimates } from '../server/estimates.mjs';
import { masters } from '../server/masters.mjs';
import { sampleEstimate } from '../server/estimates-examples.mjs';
import { sampleOffer, installCommercialExamples } from '../server/commercial-examples.mjs';
import { createService } from '../server/service.mjs';
import { commercialReportCsv, commercialDetailCsv } from '../src/commercial-export.js';
const today = () => '2026-10-29';
const action = (s, r, a) => s.decide(r.id, {
  version: r.version,
  action: a,
  reason: 'Independent test decision with a retained reason'
});
function fixture(t, {
  project = 'harbour',
  currency = 'AED',
  rate = '1'
} = {}) {
  const db = openDatabase();
  t.after(() => db.close());
  for (const [id, role, scope, limit] of [['writer', 'estimator', '*', '0'], ['reviewer', 'tendering_manager', '*', '1000000'], ['other', 'commercial_manager', '*', '1000000'], ['restricted', 'quantity_surveyor', 'gardens', '0'], ['reader', 'quantity_surveyor', 'harbour', '0']]) {
    db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, id, role);
    db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,estimate_approval_limit,commercial_approval_limit) VALUES(?,'jakh',?,?,?,?)").run(id, scope, role, role === 'tendering_manager' ? '1000000' : '0', limit);
  }
  const customer = masters(db, 'ahmed', today).saveParty(null, {
    company_id: 'jakh',
    name: 'Fictional offer client',
    customer: true,
    supplier: false,
    subcontractor: false,
    reason: 'Commercial test identity'
  });
  const maker = estimates(db, 'writer', today),
    reviewer = estimates(db, 'reviewer', today);
  const input = {
    ...sampleEstimate({
      id: 'jakh',
      currency
    }, customer.party_id, today(), project),
    rate
  };
  const e = action(reviewer, action(maker, maker.save(null, input), 'submit'), 'approve');
  const writer = commercial(db, 'writer', today),
    review = commercial(db, 'reviewer', today),
    other = commercial(db, 'other', today);
  return {
    db,
    e,
    input,
    maker,
    estimateReviewer: reviewer,
    writer,
    review,
    other,
    customer,
    offer: () => writer.save(null, sampleOffer(e, today()))
  };
}
function approved(f) {
  return action(f.review, action(f.writer, f.offer(), 'submit'), 'approve');
}
function evidence(o, patch = {}) {
  return {
    version: o.version,
    project_id: o.project_id || 'harbour',
    reference: 'CLIENT-ACCEPT-001',
    accepted_on: today(),
    signatory: 'Fictional client signatory',
    description: 'Local evidence agrees to this exact offer; no real signature.',
    filename: 'acceptance.txt',
    base64: Buffer.from('FICTIONAL ONLY\n' + o.id).toString('base64'),
    mapping: o.lines.map(l => ({
      line_key: l.line_key,
      work_package_id: 'WP-C-101',
      location_id: null
    })),
    reason: 'Record fictional acceptance for test',
    ...patch
  };
}
function recorded(f, o = approved(f), patch = {}) {
  return f.writer.recordAcceptance(o.id, evidence(o, patch));
}
function award(f, o = recorded(f)) {
  return f.review.decideAcceptance(o.acceptances[0].id, {
    version: 1,
    action: 'verify',
    confirmed: true,
    reason: 'Evidence supports exact offer and allocation'
  });
}
test('approved estimate → reviewed offer → evidenced award retains exact BOQ, terms and separate draft cost/cash', t => {
  const f = fixture(t),
    before = f.db.prepare('SELECT * FROM cost_items').all(),
    journals = f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n;
  const o = award(f);
  assert.equal(o.state, 'awarded');
  assert.equal(o.net_amount, '34151.04');
  assert.deepEqual(o.lines.map(l => l.amount), ['13009.92', '13009.92', '8131.20']);
  assert.equal(o.contract.original_value, '34151.04');
  assert.equal(o.contract.lines[0].snapshot.offer_line.source.budget, '9856.00');
  assert.equal(o.contract.snapshot.offer.advance_ceiling, '1000.00');
  assert.equal(o.contract.state_label, 'Finance setup required');
  assert.equal(o.contract.lines.length, 3);
  assert.deepEqual(f.db.prepare('SELECT * FROM cost_items').all(), before);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n, journals);
  assert.match(f.writer.report('jakh').findings.join(' '), /not revenue/);
});
test('new commercial limits default to zero and author/evidence recorder cannot approve own work', t => {
  const f = fixture(t);
  assert.equal(f.db.prepare("SELECT commercial_approval_limit FROM memberships WHERE user_id='ahmed' LIMIT 1").get().commercial_approval_limit, '0.00');
  let o = action(f.writer, f.offer(), 'submit');
  assert.throws(() => action(f.writer, o, 'approve'), /independent/);
  f.db.prepare("UPDATE memberships SET commercial_approval_limit='34151.03' WHERE user_id='reviewer'").run();
  assert.throws(() => action(f.review, o, 'approve'), /authority/);
  f.db.prepare("UPDATE memberships SET commercial_approval_limit='34151.04' WHERE user_id='reviewer'").run();
  o = action(f.review, o, 'approve');
  o = f.other.recordAcceptance(o.id, evidence(o));
  assert.throws(() => f.other.decideAcceptance(o.acceptances[0].id, {
    version: 1,
    action: 'verify',
    confirmed: true,
    reason: 'Self review'
  }), /independent/);
  assert.throws(() => f.review.decideAcceptance(o.acceptances[0].id, {
    version: 1,
    action: 'verify',
    reason: 'Missing confirmation'
  }), /Confirm/);
  assert.equal(award(f, o).state, 'awarded');
});
test('foreign currency keeps source amounts and saved rate; authority and reports use company value', t => {
  const f = fixture(t, {
      currency: 'USD',
      rate: '3.6725'
    }),
    o = approved(f);
  assert.equal(o.currency, 'USD');
  assert.equal(o.net_amount, '34151.04');
  assert.equal(o.company_amount, '125419.69');
  assert.equal(f.writer.report('jakh').totals.open_offers, '125419.69');
  assert.equal(award(f, recorded(f, o)).contract.currency, 'USD');
});
test('invalid terms and duplicate offer creation roll back without changing original scope', t => {
  const f = fixture(t);
  for (const patch of [{
    retention_percent: '101'
  }, {
    retention_percent: '0',
    retention_cap: '10'
  }, {
    advance_ceiling: '40000'
  }, {
    advance_ceiling: '0',
    recovery_percent: '10'
  }, {
    payment_days: 366
  }, {
    valid_until: '2026-02-30'
  }, {
    valid_until: '2026-01-01'
  }]) assert.throws(() => f.writer.save(null, {
    ...sampleOffer(f.e, today()),
    ...patch
  }));
  const o = f.offer();
  assert.throws(() => f.offer(), /current offer/);
  assert.throws(() => f.writer.save(o.id, {
    ...o,
    version: 0,
    reason: 'stale'
  }), /changed/);
  assert.equal(f.writer.detail(o.id).net_amount, '34151.04');
});
test('approval and acceptance respect expiry, approval date and real calendar dates; late recording is explicit', t => {
  const f = fixture(t);
  let o = action(f.writer, f.offer(), 'submit');
  assert.throws(() => action(commercial(f.db, 'reviewer', () => '2027-01-01'), o, 'approve'), /expired/);
  o = action(f.review, o, 'approve');
  for (const d of ['2026-10-28', '2027-01-01', '2026-11-01', '2026-02-30']) assert.throws(() => f.writer.recordAcceptance(o.id, evidence(o, {
    accepted_on: d
  })), /Acceptance|calendar/);
  const late = commercial(f.db, 'writer', () => '2027-01-03');
  o = late.recordAcceptance(o.id, evidence(o, {
    accepted_on: '2026-12-31'
  }));
  assert.equal(o.acceptances[0].accepted_on, '2026-12-31');
  assert.equal(o.acceptances[0].late_recorded, true);
  assert.equal(commercial(f.db, 'writer', () => '2027-01-03').report('jakh').totals.open_offers, '0.00');
});
test('withdrawal, requested changes, revisions and all old snapshots remain distinct', t => {
  const f = fixture(t);
  let o = action(f.writer, f.offer(), 'submit');
  o = action(f.review, o, 'return');
  o = f.writer.save(o.id, {
    ...o,
    payment_days: 45,
    reason: 'Corrected payment days'
  });
  o = action(f.review, action(f.writer, o, 'submit'), 'approve');
  assert.throws(() => f.writer.save(o.id, {
    ...o,
    terms: 'Changed approved terms',
    reason: 'Attempt'
  }), /draft/);
  const revised = f.writer.revise(o.id, {
    ...o,
    version: o.version,
    title: 'Revised offer',
    reason: 'New validity and revised terms'
  });
  assert.equal(revised.revision, 2);
  assert.equal(f.writer.detail(o.id).state, 'superseded');
  assert.equal(f.writer.detail(o.id).payment_days, 45);
  assert.equal(f.writer.list('jakh').length, 1);
  assert.equal(f.writer.list('jakh')[0].id, revised.id);
  const w = action(f.writer, revised, 'withdraw');
  assert.equal(w.state, 'withdrawn');
  assert.equal(f.writer.report('jakh').totals.open_offers, '0.00');
});
test('a newer estimate revision blocks stale offer approval and a new offer revision carries the latest amounts', t => {
  const f = fixture(t);
  let o = approved(f),
    e = f.maker.revise(f.e.id, {
      version: f.e.version,
      reason: 'Updated estimate pricing'
    });
  assert.throws(() => f.writer.recordAcceptance(o.id, evidence(o)), /latest approved/);
  e = f.maker.save(e.id, {
    ...e,
    profit: '21',
    reason: 'New reviewed profit basis'
  });
  e = action(f.estimateReviewer, action(f.maker, e, 'submit'), 'approve');
  o = f.writer.revise(o.id, {
    ...o,
    estimate_id: e.id,
    reason: 'Carry latest approved scope'
  });
  assert.equal(o.estimate_id, e.id);
  assert.notEqual(o.net_amount, '34151.04');
});
test('revoked authority and customer/company changes invalidate further commitment', t => {
  const f = fixture(t),
    o = approved(f);
  f.db.prepare("UPDATE memberships SET commercial_approval_limit='0' WHERE user_id='reviewer'").run();
  assert.throws(() => f.writer.recordAcceptance(o.id, evidence(o)), /approver/);
  f.db.prepare("UPDATE memberships SET commercial_approval_limit='1000000' WHERE user_id='reviewer'").run();
  f.db.prepare('UPDATE parties SET version=version+1 WHERE id=?').run(f.customer.party_id);
  assert.throws(() => f.writer.recordAcceptance(o.id, evidence(o)), /Customer/);
});
test('evidence and allocations are scoped, complete and frozen; changed WBS requires a new submission', t => {
  const f = fixture(t),
    o = approved(f);
  assert.throws(() => recorded(f, o, {
    project_id: 'creek'
  }), /access|project/i);
  assert.throws(() => recorded(f, o, {
    mapping: []
  }), /every BOQ/);
  assert.throws(() => recorded(f, o, {
    mapping: o.lines.map(l => ({
      line_key: l.line_key,
      work_package_id: 'WP-C-301'
    }))
  }), /Work item/);
  assert.throws(() => recorded(f, o, {
    filename: '../bad.txt'
  }), /filename/);
  assert.throws(() => recorded(f, o, {
    base64: '%%'
  }), /base64/);
  const r = recorded(f, o);
  assert.equal(Buffer.from(f.writer.download(r.acceptances[0].id).bytes).toString(), 'FICTIONAL ONLY\n' + o.id);
  f.db.prepare("UPDATE work_packages SET version=version+1 WHERE id='WP-C-101'").run();
  assert.throws(() => award(f, r), /allocation changed/);
  const ret = f.review.decideAcceptance(r.acceptances[0].id, {
    version: 1,
    action: 'return',
    reason: 'Allocation changed; resubmit with fresh source'
  });
  assert.equal(ret.acceptances[0].state, 'returned');
  assert.equal(award(f, recorded(f, ret)).contract.lines.length, 3);
});
test('pending acceptance blocks revision/withdrawal and successful retries create one immutable original contract', t => {
  const f = fixture(t);
  let o = recorded(f);
  assert.throws(() => f.writer.revise(o.id, {
    ...o,
    reason: 'Pending'
  }), /revised/);
  assert.throws(() => action(f.writer, o, 'withdraw'), /pending/);
  assert.throws(() => f.writer.recordAcceptance(o.id, evidence(o)), /pending/);
  const id = o.acceptances[0].id;
  o = award(f, o);
  const retry = f.review.decideAcceptance(id, {
    version: 1,
    action: 'verify',
    confirmed: true,
    reason: 'Retry'
  });
  assert.equal(retry.contract.id, o.contract.id);
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_contracts').get().n, 1);
  assert.throws(() => f.db.prepare("UPDATE client_contracts SET original_value='1' WHERE id=?").run(o.contract.id), /immutable/);
  assert.throws(() => f.db.prepare("UPDATE sales_offer_lines SET amount='1' WHERE offer_id=?").run(o.id), /immutable/);
  assert.throws(() => f.db.prepare("UPDATE sales_acceptances SET bytes=x'31' WHERE id=?").run(id), /immutable/);
  assert.throws(() => f.db.prepare('DELETE FROM commercial_events').run(), /retained/);
  assert.throws(() => action(f.writer, o, 'withdraw'), /unawarded/);
});
test('project scope controls lists, findings, evidence, contract and search; company-origin award becomes visible to its project', t => {
  const f = fixture(t, {
      project: null
    }),
    o = award(f);
  const restricted = commercial(f.db, 'restricted', today),
    reader = commercial(f.db, 'reader', today);
  assert.equal(restricted.list('jakh').length, 0);
  assert.throws(() => restricted.detail(o.id), /unavailable/);
  assert.throws(() => restricted.contract(o.contract.id), /unavailable/);
  assert.throws(() => restricted.download(o.acceptances[0].id), /unavailable/);
  assert.equal(reader.list('jakh', 'harbour').length, 1);
  assert.equal(reader.detail(o.id).contract.id, o.contract.id);
  assert.equal(reader.options('jakh').projects[0].id, 'harbour');
  assert.equal(reader.detail(o.id).can_open_estimate, false);
  assert.equal(createService(f.db, 'restricted', today).search('jakh', o.id).length, 0);
  assert.equal(createService(f.db, 'reader', today).search('jakh', o.id).length, 1);
  assert.throws(() => reader.save(o.id, {
    ...o,
    reason: 'Read only'
  }), /draft/);
});
test('report findings/CSV use full filtered latest population, explicit dates and spreadsheet-safe text', t => {
  const f = fixture(t);
  let o = f.offer();
  o = f.writer.save(o.id, {
    ...o,
    title: '=FORMULA title',
    reason: 'Test literal spreadsheet title'
  });
  o = action(f.review, action(f.writer, o, 'submit'), 'approve');
  const r = f.writer.report('jakh', {
    project: 'harbour',
    from: '2026-10-01',
    to: '2026-10-31'
  });
  assert.equal(r.rows.length, 1);
  assert.equal(r.totals.open_offers, '34151.04');
  assert.match(commercialReportCsv(r), /'=FORMULA/);
  assert.match(commercialDetailCsv(o), /Authoritative net line amount/);
  assert.equal(f.writer.report('jakh', {
    from: '2026-11-01'
  }).rows.length, 0);
  assert.throws(() => f.writer.report('jakh', {
    from: '2026-11-01',
    to: '2026-10-01'
  }), /reversed/);
});
test('commercial examples cover every supplied company/project and reinstall without overwriting work', t => {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  const before = db.prepare('SELECT * FROM sales_offers ORDER BY id').all();
  assert.equal(before.length, 12);
  assert.equal(db.prepare('SELECT count(*) n FROM client_contracts').get().n, 3);
  for (const p of ['harbour', 'gardens', 'creek']) assert.equal(db.prepare('SELECT count(*) n FROM sales_offers WHERE project_id=?').get(p).n, 4);
  installCommercialExamples(db);
  assert.deepEqual(db.prepare('SELECT * FROM sales_offers ORDER BY id').all(), before);
  assert.equal(db.prepare('SELECT count(*) n FROM identities').get().n, 0);
});
test('one client acceptance reference cannot award two studies; cancellation retains evidence and permits correction', t => {
  const f = fixture(t);
  const a = recorded(f);
  let e = action(f.estimateReviewer, action(f.maker, f.maker.save(null, {
    ...f.input,
    title: 'Second package'
  }), 'submit'), 'approve');
  let o = f.writer.save(null, sampleOffer(e, today()));
  o = action(f.review, action(f.writer, o, 'submit'), 'approve');
  assert.throws(() => recorded(f, o, {
    reference: 'client-accept-001'
  }), /already recorded/);
  const cancelled = f.writer.decideAcceptance(a.acceptances[0].id, {
    version: 1,
    action: 'cancel',
    reason: 'Wrong package evidence; retain and correct'
  });
  assert.equal(cancelled.acceptances[0].state, 'cancelled');
  assert.ok(f.writer.download(a.acceptances[0].id).sha256);
  assert.equal(award(f, recorded(f, o)).state, 'awarded');
});
test('company identity, source reviewer and recorder revocation are checked before award without partial contract creation', t => {
  const f = fixture(t);
  let o = approved(f);
  f.db.prepare("UPDATE companies SET version=version+1 WHERE id='jakh'").run();
  assert.throws(() => recorded(f, o), /company information changed/);
  f.db.prepare("UPDATE companies SET version=version-1 WHERE id='jakh'").run();
  f.db.prepare("UPDATE memberships SET estimate_approval_limit='0' WHERE user_id='reviewer'").run();
  assert.throws(() => recorded(f, o), /estimate approval authority/);
  f.db.prepare("UPDATE memberships SET estimate_approval_limit='1000000' WHERE user_id='reviewer'").run();
  o = f.other.recordAcceptance(o.id, evidence(o));
  f.db.prepare("UPDATE users SET active=0 WHERE id='other'").run();
  assert.throws(() => award(f, o), /recorder no longer/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_contracts').get().n, 0);
  assert.equal(f.writer.detail(o.id).acceptances[0].state, 'submitted');
});
