import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { masters } from '../server/masters.mjs';
import { estimates } from '../server/estimates.mjs';
import { boqIntake } from '../server/boq-intake.mjs';
import { readBoqWorkbook } from '../server/boq-workbook.mjs';
import { suggestBoqMapping } from '../shared/boq-intake.mjs';
import { sampleEstimate } from '../server/estimates-examples.mjs';
import { workbookFixture, zipFixture } from './boq-fixture.mjs';
import { installBoqExamples } from '../server/boq-intake-examples.mjs';
import { boqIntakeCsv } from '../src/boq-intake-export.js';
const today = () => '2026-10-29',
  reason = 'Reconciled source rows and exact totals';
function fixture(t) {
  const db = openDatabase();
  t.after(() => db.close());
  for (const [id, role, project] of [['writer', 'estimator', '*'], ['reviewer', 'tendering_manager', '*'], ['restricted', 'estimator', 'gardens']]) {
    db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id, id, role);
    db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,estimate_approval_limit) VALUES(?,'jakh',?,?,'1000000')").run(id, project, role);
  }
  const customer = masters(db, 'ahmed', today).saveParty(null, {
    company_id: 'jakh',
    name: 'Intake test customer',
    customer: true,
    supplier: false,
    subcontractor: false,
    reason
  });
  const svc = estimates(db, 'writer', today),
    e = svc.save(null, {
      ...sampleEstimate({
        id: 'jakh',
        currency: 'AED'
      }, customer.party_id, today(), 'harbour'),
      buildings: 2,
      overrides: []
    }),
    p = db.prepare("SELECT * FROM products WHERE company_id='jakh' AND active=1 LIMIT 1").get(),
    cc = db.prepare("SELECT * FROM cost_codes WHERE company_id='jakh' LIMIT 1").get();
  const text = (code = 'IN-1', unit = p.uom, qty = '2', rate = '12.50') => `Code,Description,Quantity,Unit cost,Unit,Cost code,Product\n${code},Fictional item,${qty},${rate},${unit},${cc.code},${p.code}\n`;
  const maker = boqIntake(db, 'writer', today),
    reviewer = boqIntake(db, 'reviewer', today),
    upload = (contents = text(), name = 'test.csv') => maker.upload(e.id, {
      estimate_version: e.version,
      reason,
      files: [{
        filename: name,
        base64: Buffer.from(contents).toString('base64')
      }]
    }),
    check = (b, total = '50') => maker.check(b.id, {
      version: b.version,
      reason,
      configs: b.configs.map(c => ({
        ...c,
        expected_total: total
      }))
    }),
    approve = b => reviewer.decide(b.id, {
      version: b.version,
      action: 'review',
      confirmed: true,
      reason
    });
  return {
    db,
    e,
    svc,
    p,
    cc,
    text,
    maker,
    reviewer,
    upload,
    check,
    approve
  };
}
test('XLSX reads stored/deflated cells and rejects cached formulas at row validation; CSV preserves quoted text and Arabic headings', () => {
  const bytes = workbookFixture('<row r="1"><c r="A1" t="inlineStr"><is><t>Code</t></is></c><c r="B1" t="inlineStr"><is><t>Description</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>TEST</t></is></c><c r="B2"><f>1+1</f><v>2</v></c></row>');
  const w = readBoqWorkbook('test.xlsx', bytes);
  assert.equal(w.sheets[0].rows[1].cells[1].formula, true);
  assert.equal(w.sheets[0].rows[1].cells[1].value, '2');
  const c = readBoqWorkbook('ar.csv', Buffer.from('Example\r\nالبند,الوصف,الكمية,الوحدة\r\nA,"Text, quoted\nsecond line",2,m3\r\n'));
  assert.equal(c.sheets[0].rows[2].cells[1].value, 'Text, quoted\nsecond line');
  assert.equal(suggestBoqMapping(c).header, 2);
  assert.deepEqual(suggestBoqMapping(c).mapping, {
    code: 0,
    description: 1,
    quantity: 2,
    unit: 3
  });
});
test('file parser rejects ZIP bombs, checksums, traversal, external payloads, DTDs and invalid CSV', () => {
  const b = workbookFixture('<row r="1"><c r="A1"><v>1</v></c></row>');
  const corrupt = Buffer.from(b);
  corrupt[60] ^= 1;
  assert.throws(() => readBoqWorkbook('x.xlsx', corrupt));
  assert.throws(() => readBoqWorkbook('x.xlsx', zipFixture({
    '../x': 'x'
  })), /Unsafe/);
  assert.throws(() => readBoqWorkbook('x.xlsx', workbookFixture('', {
    'xl/externalLinks/externalLink1.xml': 'x'
  })), /external/);
  assert.throws(() => readBoqWorkbook('x.xlsx', workbookFixture('', {
    'xl/workbook.xml': '<!DOCTYPE a [<!ENTITY x "x">]><workbook/>'
  })), /entities/);
  const bomb = zipFixture({
    'large': 'x'.repeat(17 * 1024 * 1024)
  }, true);
  assert.throws(() => readBoqWorkbook('x.xlsx', bomb), /expands/);
  assert.throws(() => readBoqWorkbook('x.csv', Buffer.from('A,"unterminated')), /unclosed/);
  assert.throws(() => readBoqWorkbook('x.xls', b), /XLSX/);
});
test('invalid unit is quarantined with workbook/sheet/row/cell and no target changes', t => {
  const f = fixture(t),
    b = f.check(f.upload(f.text('BAD', 'unknown')));
  assert.ok(b.result.issues.some(i => i.filename === 'test.csv' && i.sheet === 'CSV' && i.row === 2 && i.cell === 'E2' && /Unknown/.test(i.message)));
  assert.equal(f.svc.detail(f.e.id).version, f.e.version);
  assert.throws(() => f.approve(b), /Rows, masters/);
  assert.throws(() => f.maker.commit(b.id, {
    version: b.version,
    reason
  }), /review/);
  assert.deepEqual(f.maker.download(b.files[0].id).bytes, new Uint8Array(Buffer.from(f.text('BAD', 'unknown'))));
});
test('clean intake needs independent review and commits once with exact totals/product/source lineage', t => {
  const f = fixture(t);
  let b = f.check(f.upload());
  assert.equal(b.result.files[0].direct, '50.00');
  assert.equal(b.result.issues.length, 0);
  assert.equal(b.result.rows.length, 1);
  assert.throws(() => f.maker.decide(b.id, {
    version: b.version,
    action: 'review',
    confirmed: true,
    reason
  }), {
    status: 403
  });
  b = f.approve(b);
  const version = b.version;
  b = f.maker.commit(b.id, {
    version,
    reason
  });
  assert.equal(b.state, 'committed');
  const e = f.svc.detail(f.e.id);
  assert.equal(e.lines.length, f.e.lines.length + 1);
  assert.equal(e.intake_sources[0].source_row, 2);
  assert.equal(e.lines.at(-1).product_id, f.p.id);
  assert.deepEqual(e.calculation.totals, b.result.calculation.totals);
  assert.deepEqual(e.resources, f.e.resources);
  assert.equal(f.maker.commit(b.id, {
    version,
    reason
  }).committed_version, e.version);
  assert.equal(f.svc.detail(e.id).lines.length, e.lines.length);
  assert.throws(() => f.maker.upload(e.id, {
    estimate_version: e.version,
    reason,
    files: [{
      filename: 'renamed.csv',
      base64: Buffer.from(f.text()).toString('base64')
    }]
  }), /already added/);
  assert.throws(() => f.db.prepare("UPDATE boq_intake_files SET filename='tampered' WHERE id=?").run(b.files[0].id), /immutable/);
  assert.throws(() => f.db.prepare('DELETE FROM boq_intake_lines WHERE batch_id=?').run(b.id), /retained/);
});
test('multiple files reconcile atomically and cross-file duplicate codes block all rows', t => {
  const f = fixture(t),
    upload = bad => f.maker.upload(f.e.id, {
      estimate_version: f.e.version,
      reason,
      files: [{
        filename: 'one.csv',
        base64: Buffer.from(f.text('ONE')).toString('base64')
      }, {
        filename: 'two.csv',
        base64: Buffer.from(f.text(bad ? 'ONE' : 'TWO', bad ? 'invalid' : f.p.uom)).toString('base64')
      }]
    });
  const b = f.check(upload(true));
  assert.equal(b.result.rows.length, 1);
  assert.ok(b.result.issues.some(i => /already exists/.test(i.message)));
  assert.throws(() => f.approve(b));
  assert.equal(f.svc.detail(f.e.id).lines.length, f.e.lines.length);
  const clean = f.approve(f.check(upload(false)));
  f.maker.commit(clean.id, {
    version: clean.version,
    reason
  });
  assert.equal(f.svc.detail(f.e.id).lines.length, f.e.lines.length + 2);
});
test('missing/zero/mismatched expected totals, currencies and unit dimensions never silently reconcile', t => {
  const f = fixture(t),
    b = f.upload();
  assert.ok(f.check(b, '').result.issues.length);
  const latest = f.maker.detail(b.id);
  assert.ok(f.check(latest, '0').result.issues.some(i => /Difference/.test(i.message)));
  const zero = f.check(f.upload(f.text('ZERO', f.p.uom, '0', '12.5')), '0');
  assert.equal(zero.result.issues.length, 0);
  const currency = f.check(f.upload(f.text().replace('Product\n', 'Product,Currency\n').replace(/\n$/, 'AED\n')));
  assert.ok(currency.result.issues.some(i => /Unmapped column/.test(i.message)));
  const mismatch = f.check(f.upload(f.text('DIFF', f.p.uom === 'm3' ? 'kg' : 'm3')));
  assert.ok(mismatch.result.issues.some(i => /no unit conversion/.test(i.message)));
});
test('formulas, duplicate headers, unknown columns and legacy caps/shares are blockers', t => {
  const f = fixture(t);
  for (const contents of [f.text('FORM', f.p.uom, '=1+1'), f.text().replace('Product\n', 'Product,Notes\n'), f.text().replace('Product\n', 'Product,Group\n').replace(/\n$/, ',yes\n'), f.text().replace('Product\n', 'Product,Parent %\n').replace(/\n$/, ',25\n'), f.text().replace('Quantity', 'Code')]) {
    const b = f.check(f.upload(contents));
    assert.ok(b.result.issues.length);
    assert.throws(() => f.approve(b));
  }
});
test('a new mapping check retains earlier error evidence and clears previous review', t => {
  const f = fixture(t);
  let b = f.upload(f.text().replace('Unit cost', 'Quoted rate'));
  b = f.check(b);
  assert.ok(b.result.issues.length);
  const old = b.current_check_id;
  b = f.maker.check(b.id, {
    version: b.version,
    reason,
    configs: b.configs.map(c => ({
      ...c,
      mapping: {
        ...c.mapping,
        direct_rate: 3
      }
    }))
  });
  assert.equal(b.result.issues.length, 0);
  b = f.approve(b);
  b = f.check(b);
  assert.equal(b.state, 'checked');
  assert.equal(b.reviewed_by, null);
  assert.ok(f.maker.previousCheck(b.id, old).result.issues.length);
  assert.equal(b.checks.length, 3);
});
test('estimate changes, master changes and reviewer revocation invalidate a previously reviewed intake', t => {
  const f = fixture(t);
  let b = f.approve(f.check(f.upload()));
  f.db.prepare('UPDATE products SET name=?,version=version+1 WHERE id=?').run('Updated product', f.p.id);
  assert.throws(() => f.maker.commit(b.id, {
    version: b.version,
    reason
  }), {
    status: 409
  });
  b = f.approve(f.check(b));
  f.db.prepare("UPDATE memberships SET role_id='estimator' WHERE user_id='reviewer'").run();
  assert.throws(() => f.maker.commit(b.id, {
    version: b.version,
    reason
  }), {
    status: 403
  });
  f.db.prepare("UPDATE memberships SET role_id='tendering_manager' WHERE user_id='reviewer'").run();
  f.svc.save(f.e.id, {
    ...f.e,
    title: 'Changed scope',
    reason
  });
  assert.throws(() => f.maker.commit(b.id, {
    version: b.version,
    reason
  }), {
    status: 409
  });
  assert.equal(f.maker.detail(b.id).stale, true);
});
test('scope and author controls apply to list, detail, download, check history and mutations', t => {
  const f = fixture(t),
    b = f.check(f.upload()),
    limited = boqIntake(f.db, 'restricted', today);
  assert.equal(limited.list('jakh').length, 0);
  for (const fn of [() => limited.detail(b.id), () => limited.download(b.files[0].id), () => limited.previousCheck(b.id, b.current_check_id)]) assert.throws(fn, {
    status: 404
  });
  assert.throws(() => f.reviewer.check(b.id, {
    version: b.version,
    reason,
    configs: b.configs
  }), {
    status: 403
  });
  f.svc.decide(f.e.id, {
    version: f.e.version,
    action: 'submit',
    reason
  });
  assert.throws(() => f.approve(b), {
    status: 409
  });
  assert.throws(() => f.upload(), {
    status: 403
  });
  assert.equal(f.maker.decide(b.id, {
    version: b.version,
    action: 'cancel',
    reason: 'Withdraw this unapplied intake; preserve submitted estimate'
  }).state, 'cancelled');
  assert.equal(f.svc.detail(f.e.id).state, 'submitted');
});
test('source lineage survives approved revisions and historical snapshots do not follow later product names', t => {
  const f = fixture(t);
  let b = f.approve(f.check(f.upload()));
  f.maker.commit(b.id, {
    version: b.version,
    reason
  });
  let e = f.svc.detail(f.e.id);
  e = f.svc.decide(e.id, {
    version: e.version,
    action: 'submit',
    reason
  });
  e = estimates(f.db, 'reviewer', today).decide(e.id, {
    version: e.version,
    action: 'approve',
    reason
  });
  f.db.prepare('UPDATE products SET name=?,version=version+1 WHERE id=?').run('New current product name', f.p.id);
  const revision = f.svc.revise(e.id, {
    version: e.version,
    reason
  });
  assert.equal(revision.intake_sources.length, 1);
  assert.equal(JSON.parse(f.svc.detail(e.id).lines.at(-1).product_snapshot).name, f.p.name);
});
test('examples cover each project/company with blocked, ready-for-review and committed intake; reinstall preserves all work', t => {
  const db = openDatabase(':memory:', {
    examples: true
  });
  t.after(() => db.close());
  const before = db.prepare('SELECT * FROM boq_intakes ORDER BY id').all();
  installBoqExamples(db);
  assert.deepEqual(db.prepare('SELECT * FROM boq_intakes ORDER BY id').all(), before);
  for (const p of db.prepare('SELECT id,company_id FROM projects').all()) {
    const rows = boqIntake(db, 'ahmed', today).list(p.company_id, p.id);
    assert.equal(rows.length, 3);
    assert.ok(rows.some(r => r.state === 'committed'));
    assert.ok(rows.some(r => r.issue_count > 0));
    assert.ok(rows.some(r => r.state === 'checked' && r.issue_count === 0));
  }
  assert.equal(db.prepare('SELECT count(*) n FROM identities').get().n, 0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
test('XLSX date/percentage formats, hidden rows and cached formulas cannot become valid cost inputs', t => {
  const f = fixture(t),
    heads = ['Code', 'Description', 'Quantity', 'Unit cost', 'Unit', 'Cost code', 'Product'];
  const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  const row = (n, values, hidden = false) => `<row r="${n}"${hidden ? ' hidden="1"' : ''}>` + values.map((v, i) => `<c r="${String.fromCharCode(65 + i)}${n}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join('') + '</row>';
  const header = row(1, heads),
    values = ['XLSX-1', 'Workbook work', '2', '12.50', f.p.uom, f.cc.code, f.p.code],
    plain = row(2, values);
  const b = f.check(f.upload(workbookFixture(header + plain), 'original.xlsx'));
  assert.equal(b.result.issues.length, 0);
  assert.equal(b.result.files[0].direct, '50.00');
  for (const unsafe of [plain.replace('<c r="C2" t="inlineStr"><is><t>2</t></is></c>', '<c r="C2"><f>1+1</f><v>2</v></c>'), row(2, values, true), plain.replace('<c r="C2" t="inlineStr"><is><t>2</t></is></c>', '<c r="C2" s="0"><v>2</v></c>')]) {
    const blocked = f.check(f.upload(workbookFixture(header + unsafe, {
      'xl/styles.xml': '<styleSheet><cellXfs><xf numFmtId="14"/></cellXfs></styleSheet>'
    }), 'blocked.xlsx'));
    assert.ok(blocked.result.issues.length);
    assert.throws(() => f.approve(blocked));
  }
});
test('intake export includes scoped findings, exact file totals, source rows and neutralised spreadsheet formulas', t => {
  const f = fixture(t),
    b = f.check(f.upload());
  const out = boqIntakeCsv({
    ...b,
    title: '=HYPERLINK("external")'
  });
  assert.match(out, /"50.00"/);
  assert.match(out, /"CSV","2","IN-1"/);
  assert.match(out, /"\x27=HYPERLINK/);
  assert.match(out, /Candidate items/);
  assert.ok(out.indexOf('findings') < out.indexOf('File reconciliation'));
});
