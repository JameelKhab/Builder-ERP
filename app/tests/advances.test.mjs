import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { advances, advanceSettlement } from '../server/advances.mjs';
import { certificates } from '../server/certificates.mjs';
import { receipts } from '../server/receipts.mjs';
import { ledger } from '../server/ledger.mjs';
import { accessAdmin } from '../server/access-admin.mjs';
import { estimates } from '../server/estimates.mjs';
import { commercial } from '../server/commercial.mjs';
import { sampleEstimate } from '../server/estimates-examples.mjs';
import { sampleOffer } from '../server/commercial-examples.mjs';

const today = () => '2026-10-29', reason = 'Independent advance decision with original supporting evidence';
const evidence = { filename: 'advance-authority.txt', base64: Buffer.from('Fictional advance evidence, no external transaction.').toString('base64') };

function fixture(t, company = 'jakh') {
  const db = openDatabase(':memory:', { examples: true }); t.after(() => db.close());
  for (const [id, role, project] of [['advance-writer','ar_clerk','*'],['advance-approver','financial_controller','*'],['advance-other','ar_clerk','gardens']]) {
    db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id,id,role);
    db.prepare('INSERT INTO memberships(user_id,company_id,project_id,role_id,advance_approval_limit,ar_approval_limit,receipt_approval_limit) VALUES(?,?,?,?,?,?,?)').run(id,company,project,role,'10000','10000','10000');
  }
  const c = db.prepare('SELECT * FROM client_contracts WHERE company_id=? ORDER BY project_id').all(company).find(c=>c.project_id==='harbour') || db.prepare('SELECT * FROM client_contracts WHERE company_id=?').get(company);
  const finance = ledger(db, 'example-client-finance-reviewer', today);
  const a = finance.account(null, { company_id: company, code: '2391', name: 'Fictional client advance control', type: 'liability', purpose: 'client_advance', active: true, reason });
  const account = db.prepare("SELECT id FROM ledger_accounts WHERE company_id=? AND code='2391'").get(company).id;
  const tax = db.prepare("SELECT id FROM ledger_accounts WHERE company_id=? AND purpose='tax' AND type='liability'").get(company).id;
  return { db, c, company, account, tax, writer: advances(db,'advance-writer',today), approver: advances(db,'advance-approver',today), ar: certificates(db,'advance-writer',today), post: certificates(db,'advance-approver',today) };
}
function input(f, extra = {}) { return { contract_id: f.c.id, title: 'Mobilisation advance', request_date: today(), principal: '999.99', tax_percent: '5', tax_account: f.tax, advance_account: f.account, rate: '1', rate_date: today(), rate_source: 'Explicit same-currency rate', basis: 'Fictional agreed mobilisation funding; explicit exclusive five percent tax for calculation testing only', reason, ...evidence, ...extra }; }
const decide = (s,r,action) => s.decide(r.id,{version:r.version,action,reason});
function approved(f, extra = {}) { return decide(f.approver,decide(f.writer,f.writer.save(null,input(f,extra)),'submit'),'approve'); }
function invoice(f, r, extra = {}) {
  let i = f.ar.saveInvoice(null, { advance_id:r.id, invoice_date:today(), accounting_date:today(), due_date:'2026-11-28', rate:'1', rate_date:today(), rate_source:'Explicit dated invoice rate', basis:reason, reason, ...extra });
  i = f.ar.decideInvoice(i.id,{version:i.version,action:'submit',reason});
  return f.post.decideInvoice(i.id,{version:i.version,action:'post',reason});
}
function receive(f,i,amount,ref) {
  const maker = receipts(f.db,'advance-writer',today), review = receipts(f.db,'advance-approver',today), recorder = receipts(f.db,'example-receipt-recorder',today);
  const bank = f.db.prepare('SELECT * FROM payment_banks WHERE company_id=?').get(f.company);
  let r = maker.save(null,{company_id:f.company,bank_id:bank.id,title:'Fictional advance remittance',accounting_date:today(),bank_amount:amount,bank_rate:'1',rate_date:today(),rate_source:'Explicit same-currency bank rate',explanation:reason,allocations:[{invoice_id:i.id,amount}]});
  r=decide(maker,r,'submit');r=decide(review,r,'approve');
  return recorder.decide(r.id,{version:r.version,action:'record',reason,bank_reference:ref,file:evidence});
}
test('approved advance is separate from AR, cash and revenue; canonical partial receipts exhaust principal/tax cents', t=>{
  const f=fixture(t), journals=f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n;
  const r=approved(f);assert.equal(r.state,'approved');assert.equal(r.total,'1049.99');assert.equal(r.received,null);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n,journals);
  const i=invoice(f,r);assert.equal(i.certificate_id,null);assert.equal(i.advance_id,r.id);assert.equal(i.company_retention,'0.00');
  assert.equal(i.journal.find(l=>l.account_id===f.account).credit,'999.99');
  assert.equal(i.journal.some(l=>l.account_type==='income'),false);
  assert.equal(f.ar.saveInvoice(null,{advance_id:r.id}).id,i.id);
  assert.equal(f.post.decideInvoice(i.id,{version:1,action:'post',reason}).id,i.id);
  assert.equal(f.db.prepare('SELECT count(*) n FROM ledger_entries').get().n,journals+1);
  assert.equal(f.writer.detail(r.id).received.paid_principal,'0.00');
  receive(f,i,'350.00','ADV-1');assert.equal(f.writer.detail(r.id).received.paid_principal,'333.33');
  receive(f,i,'350.00','ADV-2');assert.equal(f.writer.detail(r.id).received.paid_principal,'666.67');
  receive(f,i,'349.99','ADV-3');const balance=f.writer.detail(r.id).received;
  assert.equal(balance.paid_principal,'999.99');assert.equal(balance.paid_tax,'50.00');assert.equal(balance.open_receivable,'0.00');
  assert.equal(balance.paid_principal_carrying,'999.99');
  const report=receipts(f.db,'advance-approver',today).report('jakh',{project:'harbour'});
  assert.equal(report.reconciliation.difference,'0.00');
  assert.equal(f.post.report('jakh',{project:'harbour'}).invoices.some(x=>x.id===i.id),false,'Advance charges must not inflate measured-work invoice reporting');
});
test('approval limits default to zero; author independence and aggregate contract ceiling survive competing submissions', t=>{
  const f=fixture(t);const ceiling=JSON.parse(f.c.snapshot).offer.advance_ceiling;
  let a=f.writer.save(null,input(f,{principal:ceiling,tax_percent:'0'}));a=decide(f.writer,a,'submit');
  assert.throws(()=>decide(f.writer,a,'approve'),/different/);
  f.db.prepare("UPDATE memberships SET advance_approval_limit='0' WHERE user_id='advance-approver'").run();
  assert.throws(()=>decide(f.approver,a,'approve'),/sufficient/);
  f.db.prepare("UPDATE memberships SET advance_approval_limit='1000000' WHERE user_id='advance-approver'").run();
  let b=decide(f.writer,f.writer.save(null,input(f,{principal:'0.01',tax_percent:'0'})),'submit');
  a=decide(f.approver,a,'approve');assert.equal(a.state,'approved');
  assert.throws(()=>decide(f.approver,b,'approve'),/insufficient contract allowance/);
  b=decide(f.approver,b,'return');assert.equal(b.state,'returned');
  assert.equal(f.db.prepare("SELECT advance_approval_limit FROM memberships WHERE user_id='example-client-finance-reviewer'").get().advance_approval_limit,'0.00');
});
test('stale source, revoked author and dated policy snapshots block commitment; returns retain original evidence', t=>{
  const f=fixture(t);let r=decide(f.writer,f.writer.save(null,input(f)),'submit');
  f.db.prepare("UPDATE users SET active=0 WHERE id='advance-writer'").run();assert.throws(()=>decide(f.approver,r,'approve'),/author.*scope/);
  f.db.prepare("UPDATE users SET active=1 WHERE id='advance-writer'").run();
  f.db.prepare('UPDATE ledger_accounts SET name=?,version=version+1 WHERE id=?').run('Revised control title',f.account);
  assert.throws(()=>decide(f.approver,r,'approve'),/changed/);
  r=decide(f.approver,r,'return');r=f.writer.save(r.id,{...r,reason,...evidence});
  assert.equal(r.evidence.length,2);assert.throws(()=>decide(f.writer,{...r,version:1},'submit'),/changed/);
  r=decide(f.approver,decide(f.writer,r,'submit'),'approve');
  assert.throws(()=>f.db.prepare('UPDATE client_advances SET principal=? WHERE id=?').run('1.00',r.id),/immutable/);
  assert.throws(()=>f.db.prepare('DELETE FROM client_advance_events WHERE advance_id=?').run(r.id),/retained/);
  assert.equal(f.writer.download(r.evidence_id).bytes.length,Buffer.from(evidence.base64,'base64').length);
});
test('malformed input, missing evidence and cross-project access cannot create or expose advance facts', t=>{
  const f=fixture(t);
  for(const extra of [{principal:'0'},{principal:'1.001'},{tax_percent:'101'},{request_date:'2026-02-30'},{request_date:'2026-10-30'},{rate:'2'},{advance_account:f.tax},{filename:'../private.txt'},{base64:'!bad'}]) assert.throws(()=>f.writer.save(null,input(f,extra)));
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_advances').get().n,0);
  const i=input(f);delete i.base64;delete i.filename;const r=f.writer.save(null,i);
  assert.throws(()=>decide(f.writer,r,'submit'),/evidence/);
  const restricted=advances(f.db,'advance-other',today);
  assert.throws(()=>restricted.detail(r.id),/unavailable/);
  assert.throws(()=>restricted.save(null,input(f)),/permit|permission|access|scope|authoris/i);
});
test('advance invoice rechecks authority and periods, cannot change source or use general journals to edit controls', t=>{
  const f=fixture(t),r=approved(f);
  let i=f.ar.saveInvoice(null,{advance_id:r.id,invoice_date:today(),accounting_date:today(),due_date:today(),rate:'1',rate_date:today(),rate_source:reason,basis:reason,reason});
  assert.throws(()=>f.ar.saveInvoice(null,{advance_id:r.id,certificate_id:f.c.id}),/one invoice source/);
  i=f.ar.decideInvoice(i.id,{version:i.version,action:'submit',reason});
  assert.throws(()=>f.ar.decideInvoice(i.id,{version:i.version,action:'post',reason}),/Independent/);
  f.db.prepare("UPDATE memberships SET advance_approval_limit='0' WHERE user_id='advance-approver'").run();
  assert.throws(()=>f.post.decideInvoice(i.id,{version:i.version,action:'post',reason}),/approver/);
  f.db.prepare("UPDATE memberships SET advance_approval_limit='10000' WHERE user_id='advance-approver'").run();
  f.db.prepare("UPDATE ledger_periods SET state='closed' WHERE company_id='jakh'").run();
  assert.throws(()=>f.post.decideInvoice(i.id,{version:i.version,action:'post',reason}),/open company period/);
  assert.equal(f.db.prepare('SELECT journal_id FROM client_invoices WHERE id=?').get(i.id).journal_id,null);
  f.db.prepare("UPDATE ledger_periods SET state='open' WHERE company_id='jakh'").run();
  i=f.post.decideInvoice(i.id,{version:i.version,action:'post',reason});
  assert.throws(()=>ledger(f.db,'example-client-finance-reviewer',today).reverse(i.journal_id,{version:2,accounting_date:today(),reason}),/typed|source/);
  assert.throws(()=>f.db.prepare('UPDATE client_invoices SET advance_id=NULL WHERE id=?').run(i.id),/immutable|fixed/);
  assert.throws(()=>ledger(f.db,'example-client-finance-reviewer',today).account(null,{company_id:'jakh',code:'2392',name:'Bad asset',type:'asset',purpose:'client_advance',active:true,reason}),/liability/);
});
test('receipt reversal restores advance AR without deleting its original liability or settlement history',t=>{
  const f=fixture(t),a=approved(f,{tax_percent:'0',principal:'111.11'}),i=invoice(f,a),r=receive(f,i,'111.11','ADV-REVERSE-ORIGINAL');
  const maker=receipts(f.db,'advance-writer',today),review=receipts(f.db,'advance-approver',today),recorder=receipts(f.db,'example-receipt-recorder',today);
  let reversal=maker.reverse(r.id,{version:r.version,accounting_date:today(),reason});
  reversal=decide(maker,reversal,'submit');reversal=decide(review,reversal,'approve');
  recorder.decide(reversal.id,{version:reversal.version,action:'record',reason,bank_reference:'ADV-REVERSE-CORRECTION',file:evidence});
  assert.equal(f.writer.detail(a.id).received.paid_principal,'0.00');assert.equal(f.writer.detail(a.id).received.open_receivable,'111.11');
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_receipt_allocations WHERE invoice_id=?').get(i.id).n,2);
  assert.equal(f.db.prepare('SELECT base_credit FROM ledger_lines WHERE entry_id=? AND account_id=?').get(i.journal_id,f.account).base_credit,'111.11');
});

test('paid advances cannot silently leave later certificates at zero recovery while allocation integration is pending',t=>{
  const f=fixture(t),a=approved(f,{tax_percent:'0',principal:'100'}),i=invoice(f,a);receive(f,i,'100','ADV-RECOVERY-DEPENDENCY');
  const pending=f.db.prepare("SELECT * FROM client_certificates WHERE contract_id=? AND state='technical'").get(f.c.id);
  const technical=certificates(f.db,'example-technical-reviewer',today),maker=certificates(f.db,'example-measurer',today);
  let r=technical.decide(pending.id,{version:pending.version,action:'return',reason});
  assert.throws(()=>maker.save(r.id,{...r,period_to:today(),reason}),/connected certificate recovery/);
  const c=maker.contract(f.c.id);assert.equal(c.paid_advance_principal,'100.00');assert.equal(c.can_measure,false);
  assert.equal(advanceSettlement(f.db,f.db.prepare('SELECT * FROM client_invoices WHERE id=?').get(i.id),'2026-10-28').paid_principal,'0.00');
});
test('reviewed access preserves explicit advance limits, rejects non-finance grants, and records the change',t=>{
  const f=fixture(t),admin=accessAdmin(f.db,'ahmed'),user=f.db.prepare("SELECT * FROM users WHERE id='advance-approver'").get();
  const grant={company_id:'jakh',project_id:'*',role_id:'financial_controller',approval_limit:'0',advance_approval_limit:'17.25'};
  const result=admin.save(user.id,{version:user.access_version,active:true,grants:[grant],reason});
  assert.equal(result.grants[0].advance_approval_limit,'17.25');
  for(const g of [{...grant,advance_approval_limit:'1.001'},{...grant,role_id:'ar_clerk'}]) assert.throws(()=>admin.save(user.id,{version:result.user.access_version,active:true,grants:[g],reason}),/Advance authority|approve client advances/);
});
test('foreign advance uses separate request, invoice and bank rates without revaluing its liability from cash',t=>{
  const f=fixture(t),em=estimates(f.db,'ahmed',today),er=estimates(f.db,'example-estimate-reviewer',today);
  let e=em.save(null,{...sampleEstimate({id:'jakh',currency:'USD'},f.c.customer_id,today(),'harbour'),rate:'3.6725',rate_source:reason});
  e=decide(er,decide(em,e,'submit'),'approve');
  const sm=commercial(f.db,'ahmed',today),sr=commercial(f.db,'example-commercial-reviewer',today);
  let o=sm.save(null,sampleOffer(e,today()));o=decide(sr,decide(sm,o,'submit'),'approve');
  o=sm.recordAcceptance(o.id,{version:o.version,project_id:'harbour',mapping:o.lines.map(l=>({line_key:l.line_key,work_package_id:'WP-C-101',location_id:null})),reference:'ADV-FX-ACCEPT',accepted_on:today(),signatory:'Fictional customer',description:reason,...evidence,reason});
  o=sr.decideAcceptance(o.acceptances[0].id,{version:1,action:'verify',confirmed:true,reason});
  const setup=certificates(f.db,'example-client-finance-author',today),finance=certificates(f.db,'example-client-finance-reviewer',today),previous=setup.contract(f.c.id).policies[0];
  let c=setup.savePolicy(null,{...previous,contract_id:o.contract.id,reason});
  c=setup.decidePolicy(c.policies[0].id,{version:c.policies[0].version,action:'submit',reason});
  c=finance.decidePolicy(c.policies[0].id,{version:c.policies[0].version,action:'approve',reason});
  const a=approved(f,{contract_id:c.id,principal:'123.47',rate:'3.6725'}),i=invoice(f,a,{rate:'3.7'});
  assert.equal(a.company_total,'476.10');assert.equal(i.company_total,'479.67');assert.equal(i.currency,'USD');
  assert.equal(i.journal.find(l=>l.account_id===f.account).base_credit,'456.84');
  const maker=receipts(f.db,'advance-writer',today),review=receipts(f.db,'advance-approver',today),recorder=receipts(f.db,'example-receipt-recorder',today),bank=f.db.prepare("SELECT id FROM payment_banks WHERE company_id='jakh' AND currency='AED'").get();
  let r=maker.save(null,{company_id:'jakh',bank_id:bank.id,title:'USD advance into AED bank',accounting_date:today(),bank_amount:'500.00',bank_rate:'1',rate_date:today(),rate_source:reason,explanation:reason,allocations:[{invoice_id:i.id,amount:i.total}]});
  r=decide(review,decide(maker,r,'submit'),'approve');r=recorder.decide(r.id,{version:r.version,action:'record',reason,bank_reference:'ADV-FOREIGN-BANK',file:evidence});
  const b=f.writer.detail(a.id).received;assert.equal(b.paid_principal,'123.47');assert.equal(b.paid_principal_carrying,'456.84');
  const journal=f.db.prepare('SELECT * FROM ledger_lines WHERE entry_id=?').all(r.journal_id);
  assert.equal(journal.find(l=>l.description==='Customer settlement exchange difference').base_credit,'20.33');
  assert.equal(journal.some(l=>l.account_id===f.account),false);
});
