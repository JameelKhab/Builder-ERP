import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { installCorrectionExamples, CORRECTION_EXAMPLES } from '../server/client-corrections-examples.mjs';
import { clientCorrections } from '../server/client-corrections.mjs';
import { advances } from '../server/advances.mjs';
import { certificates } from '../server/certificates.mjs';
import { receipts } from '../server/receipts.mjs';
import { createService } from '../server/service.mjs';
import { correctionsCsv } from '../src/corrections-export.js';
import { exampleGroups } from '../src/example-guide.js';
import { canCategory } from '../shared/access.mjs';
const today=()=>new Date().toISOString().slice(0,10);

test('correction examples are additive, scoped, reconciled and connected to sources and every project guide',t=>{
  const db=openDatabase(':memory:',{examples:true,advanceExamples:true});t.after(()=>db.close());
  const tables=['users','memberships','client_contracts','client_advances','client_certificates','client_advance_recoveries','client_invoices','client_receipts','bank_receipt_matches','contract_finance_policies'];
  const before=Object.fromEntries(tables.map(k=>[k,db.prepare(`SELECT rowid AS original_row,* FROM ${k}`).all()]));
  installCorrectionExamples(db);
  for(const k of tables)for(const row of before[k])assert.deepEqual(db.prepare(`SELECT rowid AS original_row,* FROM ${k} WHERE rowid=?`).get(row.original_row),row,`${k} existing rows unchanged`);
  assert.equal(db.prepare('SELECT count(*) n FROM identities').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM client_corrections').get().n,27);
  assert.equal(db.prepare('SELECT count(*) n FROM sample_packs WHERE id=?').get(CORRECTION_EXAMPLES).n,1);
  const svc=clientCorrections(db,'ahmed',today);
  for(const p of db.prepare('SELECT * FROM projects').all()) {
    const report=svc.report(p.company_id,{project:p.id});assert.equal(report.rows.length,9);assert.equal(report.reconciliation.difference,'0.00');
    assert.deepEqual([...new Set(report.rows.map(r=>r.state))].sort(),['applied','cancelled','draft','finance','returned','technical']);
    for(const row of report.rows) {
      const r=svc.detail(row.id);
      const source=r.advance_id?advances(db,'ahmed',today).detail(r.advance_id):certificates(db,'ahmed',today).detail(r.certificate_id);
      assert.equal(source.correction_request_id,r.state==='cancelled'?null:r.id);
      if(r.state!=='cancelled')assert.equal(source.can_prepare_correction,false);
      if(r.title.includes('Blocked'))assert.match(r.blockers.join(' '),/certified recovery/);
      if(r.title.includes('Paid invoice credited'))assert.equal(r.snapshot.customer_credit_after,'210.00');
    }
    const workspace=createService(db,'ahmed',today).workspace(p.company_id,p.id);
    assert.equal(workspace.client_corrections.length,9);
    assert.ok(exampleGroups(workspace,p.id,'ahmed').flatMap(([,f])=>f).filter(f=>f.title==='Client corrections').every(f=>f.count===9));
    assert.equal(advances(db,'ahmed',today).report(p.company_id,{project:p.id}).reconciliation.difference,'0.00');
    assert.equal(receipts(db,'ahmed',today).report(p.company_id,{project:p.id}).reconciliation.difference,'0.00');
  }
  const count=db.prepare('SELECT count(*) n FROM client_corrections').get().n;installCorrectionExamples(db);assert.equal(db.prepare('SELECT count(*) n FROM client_corrections').get().n,count);
});

test('correction options, My Work, search and reports enforce source scope and separate preparation/review authority',t=>{
  const db=openDatabase(':memory:',{examples:true,correctionExamples:true});t.after(()=>db.close());
  db.prepare("INSERT INTO users(id,name,role) VALUES('correction-project-reader','Project-only accountant','ar_clerk')").run();
  db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id) VALUES('correction-project-reader','jakh','harbour','ar_clerk')").run();
  const scoped=clientCorrections(db,'correction-project-reader',today), opts=scoped.options('jakh');
  assert.ok(opts.sources.length);assert.ok(opts.sources.every(r=>r.project_id==='harbour'));assert.deepEqual(opts.projects.map(p=>p.id),['harbour']);
  assert.throws(()=>scoped.options('build'),/scope/);assert.throws(()=>scoped.options('jakh','gardens'),/scope/);assert.throws(()=>scoped.options('jakh','unknown'),/scope|Project/);
  assert.ok(scoped.list('jakh').every(r=>r.project_id==='harbour'&&!r.can_review&&!r.my_draft));
  const all=clientCorrections(db,'example-correction-author',today).list('jakh');
  const foreign=all.find(r=>r.project_id==='gardens');assert.throws(()=>scoped.detail(foreign.id),/unavailable/);
  const pending=all.find(r=>r.state==='finance'&&r.project_id==='harbour');
  assert.equal(clientCorrections(db,'example-correction-author',today).detail(pending.id).can_review,false);
  const reviewer=clientCorrections(db,'example-correction-finance',today);assert.equal(reviewer.detail(pending.id).can_accept,true);
  assert.equal(createService(db,'example-correction-finance',today).workspace('jakh','harbour').client_corrections.find(r=>r.id===pending.id).can_review,true);
  assert.ok(createService(db,'correction-project-reader',today).search('jakh',pending.id).some(r=>r.id===pending.id));
  assert.ok(!createService(db,'correction-project-reader',today).search('jakh',foreign.id).some(r=>r.id===foreign.id));
  assert.equal(canCategory(['ar.read'],'Client corrections'),false);assert.equal(canCategory(['ar.read','certificates.read'],'Client corrections'),true);
  db.prepare("INSERT INTO users(id,name,role) VALUES('correction-no-finance','Site test reader','site_engineer')").run();
  db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id) VALUES('correction-no-finance','jakh','harbour','site_engineer')").run();
  assert.throws(()=>clientCorrections(db,'correction-no-finance',today).options('jakh'),/scope/);
  db.prepare("UPDATE memberships SET ar_approval_limit='0' WHERE user_id='example-correction-finance'").run();
  assert.equal(reviewer.detail(pending.id).can_accept,false);
});

test('complete correction findings and CSV preserve cutoff, separate currencies, safety and original cash',t=>{
  const db=openDatabase(':memory:',{examples:true,correctionExamples:true});t.after(()=>db.close());
  const svc=clientCorrections(db,'example-correction-author',today), report=svc.report('jakh');
  assert.equal(report.rows.length,18);assert.equal(report.reconciliation.difference,'0.00');assert.equal(report.currency_groups.length,1);
  const draft=report.rows.find(r=>r.state==='draft'),d=svc.detail(draft.id);
  svc.save(d.id,{version:d.version,title:'=unsafe spreadsheet formula',effective_date:d.effective_date,basis:d.basis,reason:'Verify safe CSV text'});
  const csv=correctionsCsv(svc.report('jakh'));
  assert.ok(csv.indexOf('Findings')<csv.indexOf('Proposed or applied credit'));assert.match(csv,/"'=unsafe spreadsheet formula"/);
  for(const row of report.rows)assert.ok(csv.includes(row.id));
  const old=svc.report('jakh',{to:'2026-10-28'});assert.equal(old.rows.length,0);assert.equal(old.reconciliation.source_credit,'0.00');
  const none=svc.report('jakh',{currency:'USD'});assert.equal(none.rows.length,0);assert.equal(none.reconciliation.ledger_credit,'0.00');
  assert.throws(()=>svc.report('jakh',{currency:'AED/USD'}),/currency/);assert.throws(()=>svc.report('jakh',{to:'2026-02-30'}),/calendar/);
  assert.equal(receipts(db,'ahmed',today).report('jakh').reconciliation.difference,'0.00');
  const original=svc.detail(report.rows.find(r=>r.title.includes('Paid invoice credited')).id).snapshot;
  assert.equal(original.settlement.settled,'210.00');
  assert.equal(db.prepare('SELECT count(*) n FROM client_receipts WHERE state=\'recorded\' AND id IN (SELECT receipt_id FROM client_receipt_allocations WHERE invoice_id=?)').get(original.invoice.id).n,1);
});
