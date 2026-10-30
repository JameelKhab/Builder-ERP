import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/db.mjs';
import {installAdvanceExamples, ADVANCE_EXAMPLES} from '../server/advances-examples.mjs';
import {advances} from '../server/advances.mjs';
import {createService} from '../server/service.mjs';
import {exampleGroups} from '../src/example-guide.js';
const today=()=>new Date().toISOString().slice(0,10);
test('additive advance examples cover both companies and all projects without changing existing policies, users or documents',t=>{
  const db=openDatabase(':memory:',{examples:true});t.after(()=>db.close());
  const tables=['users','memberships','contract_finance_policies','client_certificates','client_invoices','client_receipts','client_contracts'];
  const before=Object.fromEntries(tables.map(k=>[k,db.prepare(`SELECT rowid,* FROM ${k}`).all()]));
  installAdvanceExamples(db);
  for(const k of tables)for(const row of before[k])assert.deepEqual(db.prepare(`SELECT rowid,* FROM ${k} WHERE rowid=?`).get(row.rowid),row,k+' original preserved');
  assert.equal(db.prepare('SELECT count(*) n FROM identities').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM sample_packs WHERE id=?').get(ADVANCE_EXAMPLES).n,1);
  for(const p of db.prepare('SELECT * FROM projects').all()){
    const svc=advances(db,'ahmed',today),rows=svc.list(p.company_id,p.id);assert.equal(rows.length,7);
    assert.deepEqual([...new Set(rows.map(r=>r.state))].sort(),['approved','cancelled','draft','returned','submitted']);
    const r=svc.report(p.company_id,{project:p.id});assert.equal(r.reconciliation.difference,'0.00');
    assert.equal(r.currency_groups[0].approved_principal,'550.00');assert.equal(r.currency_groups[0].invoiced_principal,'450.00');
    assert.equal(r.currency_groups[0].paid_principal,'200.00');assert.equal(r.currency_groups[0].recovered_principal,'136.60');
    assert.equal(r.currency_groups[0].liability_principal,'313.40');assert.equal(r.currency_groups[0].current_available,'63.40');
    const workspace=createService(db,'ahmed',today).workspace(p.company_id,p.id);
    const guide=exampleGroups(workspace,p.id,'ahmed').flatMap(([,features])=>features).filter(f=>f.title==='Client advances');
    assert.ok(guide.length);assert.ok(guide.every(f=>f.count===7));
  }
  const beforeAgain=db.prepare('SELECT count(*) n FROM client_advances').get().n;
  installAdvanceExamples(db);assert.equal(db.prepare('SELECT count(*) n FROM client_advances').get().n,beforeAgain);
});
