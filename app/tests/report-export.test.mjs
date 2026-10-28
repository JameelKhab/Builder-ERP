import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/db.mjs';
import {createService} from '../server/service.mjs';
import {costReportCsv} from '../src/report-export.js';

test('export includes full-scope findings before all rows, even when the UI is paginated',()=>{
  const db=openDatabase();
  try {
    const report=createService(db,'ahmed',()=> '2026-10-28').report('jakh');
    const csv=costReportCsv(report);
    assert.ok(csv.indexOf(report.findings[0].text)<csv.indexOf('"Item","Location"'));
    assert.ok(csv.includes('Company overheads'));
    assert.ok(csv.includes(report.snapshot));
    assert.ok(csv.includes('C-101, C-102, C-103, C-104, C-201, C-900'));
    report.rows[0].name='=HYPERLINK("untrusted")';
    assert.ok(costReportCsv(report).includes('"\'=HYPERLINK(""untrusted"")"'));
  } finally {db.close();}
});
