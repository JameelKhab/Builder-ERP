import { advancesCsv } from '../src/advances-export.js';
import { createService } from '../server/service.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { advances, advanceSettlement } from '../server/advances.mjs';
import { certificates } from '../server/certificates.mjs';
import { clientCorrections } from '../server/client-corrections.mjs';
import { receipts } from '../server/receipts.mjs';
import { ledger } from '../server/ledger.mjs';
import { accessAdmin } from '../server/access-admin.mjs';
import { estimates } from '../server/estimates.mjs';
import { commercial } from '../server/commercial.mjs';
import { sampleEstimate } from '../server/estimates-examples.mjs';
import { recoveryQuote } from '../server/advance-recovery.mjs';
import { certificatesReportCsv, certificateDetailCsv } from '../src/certificates-export.js';
import { D, money, sum } from '../server/money.mjs';
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
  receive(f,i,'350.00','ADV-2');assert.equal(f.writer.detail(r.id).received.paid_principal,'666.66');
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

test('paid advances are frozen at certification, cleared once at invoice posting, and protected from receipt reversal',t=>{
  const f=fixture(t),a=approved(f,{tax_percent:'0',principal:'100'}),i=invoice(f,a);receive(f,i,'100','ADV-RECOVERY-DEPENDENCY');
  const pending=f.db.prepare("SELECT * FROM client_certificates WHERE contract_id=? AND state='technical'").get(f.c.id);
  const technical=certificates(f.db,'example-technical-reviewer',today),maker=certificates(f.db,'example-measurer',today);
  let r=technical.decide(pending.id,{version:pending.version,action:'return',reason});
  r=maker.save(r.id,{...r,period_to:today(),reason});assert.equal(r.recovery,'100.00');
  r=certify(f,r);assert.equal(r.state,'approved');
  assert.equal(f.db.prepare('SELECT principal FROM client_advance_recoveries WHERE certificate_id=?').get(r.id).principal,'100.00');
  const original=f.db.prepare("SELECT * FROM client_receipts WHERE bank_reference='ADV-RECOVERY-DEPENDENCY'").get();
  assert.throws(()=>receipts(f.db,'advance-writer',today).reverse(original.id,{version:original.version,accounting_date:today(),reason}),/Certified advance recovery/);
  const ci=certificateInvoice(f,r);assert.equal(ci.state,'posted');
  assert.equal(ci.journal.find(l=>l.account_id===f.account).debit,'100.00');
  assert.equal(ci.total,'5022.66');
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_advance_recoveries WHERE certificate_id=?').get(r.id).n,1);
  assert.equal(f.post.decideInvoice(ci.id,{version:1,action:'post',reason}).id,ci.id);
  const c=maker.contract(f.c.id);assert.equal(c.paid_advance_principal,'100.00');assert.equal(c.can_measure,true);
  assert.deepEqual(c.advance_position,{paid_principal:'100.00',certified_principal:'100.00',posted_principal:'100.00',available_principal:'0.00'});
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
  f.c={...f.c,...c};
  const gain=f.db.prepare("SELECT id FROM ledger_accounts WHERE company_id='jakh' AND type='income' AND purpose='general' AND id<>?").get(c.policies[0].revenue_account).id;
  const loss=f.db.prepare("SELECT id FROM ledger_accounts WHERE company_id='jakh' AND type='expense' AND purpose='general'").get().id;
  const attempted={contract_id:c.id,title:'Foreign recovery policy check',period_from:today(),period_to:today(),rate:'3.9',rate_date:today(),rate_source:reason,basis:reason,reason,...evidence,lines:c.lines.map(l=>({line_key:l.line_key,cumulative_quantity:l.quantity}))};
  policyForRecovery(f);
  assert.throws(()=>certificates(f.db,'example-measurer',today).save(null,attempted),/historical advance-consideration/);
  policyForRecovery(f,{recovery_fx_basis:'historical_consideration'});
  assert.throws(()=>certificates(f.db,'example-measurer',today).save(null,attempted),/both exchange/);
  policyForRecovery(f,{recovery_fx_basis:'historical_consideration',fx_gain_account:gain,fx_loss_account:loss});
  const measurer=certificates(f.db,'example-measurer',today);
  let m=measurer.save(null,{contract_id:c.id,title:'Foreign advance recovery',period_from:today(),period_to:today(),rate:'3.9',rate_date:today(),rate_source:reason,basis:reason,reason,...evidence,lines:c.lines.map(l=>({line_key:l.line_key,cumulative_quantity:l.quantity}))});
  assert.equal(m.recovery,'123.47');assert.equal(m.snapshot.recovered_tax,'6.17');m=certify(f,m);
  f.db.prepare("UPDATE memberships SET ar_approval_limit='1000000' WHERE user_id='advance-approver'").run();
  const ci=certificateInvoice(f,m,{rate:'3.9'});
  const principal=ci.journal.find(l=>l.account_id===f.account),taxRelease=ci.journal.find(l=>l.account_id===f.tax && new D(l.debit).gt(0));
  assert.equal(principal.base_debit,'456.84');assert.equal(taxRelease.base_debit,'22.83');
  const expectedRevenue=money(new D(m.gross).plus(m.snapshot.work_tax).times('3.9').toDecimalPlaces(2).minus(new D(m.snapshot.work_tax).times('3.9').toDecimalPlaces(2)).minus('481.53').plus('456.84'));
  assert.equal(ci.journal.find(l=>l.account_id===c.policies[0].revenue_account).base_credit,expectedRevenue);
  const fx=ci.journal.find(l=>l.description==='Advance tax carrying exchange difference');assert.equal(fx.base_debit,'1.23');assert.equal(fx.account_id,loss);
  assert.equal(money(sum(ci.journal.map(l=>l.base_debit))),money(sum(ci.journal.map(l=>l.base_credit))));
  assert.equal(f.db.prepare('SELECT base_credit FROM ledger_lines WHERE entry_id=? AND description=?').get(r.journal_id,'Customer settlement exchange difference').base_credit,'20.33');
  const advanceReport=f.writer.report('jakh',{project:'harbour',currency:'USD'});
  assert.equal(advanceReport.tax_reconciliation.difference,'0.00');assert.equal(advanceReport.tax_reconciliation.source_unreleased_tax,'0.00');
  assert.equal(advanceReport.rows.length,1);assert.equal(advanceReport.rows[0].base_invoiced,'456.84');
  assert.equal(advanceReport.rows[0].base_recovered,'456.84');assert.equal(advanceReport.rows[0].paid_principal,'123.47');
  assert.equal(advanceReport.reconciliation.difference,'0.00');assert.equal(advanceReport.reconciliation.ledger_liability,'0.00');
  const excluded=f.writer.report('jakh',{currency:'AED'});assert.equal(excluded.rows.length,0);assert.equal(excluded.reconciliation.ledger_liability,'0.00');
  const correctionMaker=clientCorrections(f.db,'advance-writer',today);
  let correction=correctionMaker.save(null,{certificate_id:m.id,title:'Full foreign certificate correction',effective_date:today(),basis:reason,reason,...evidence});
  correction=decide(correctionMaker,correction,'submit');
  for(const who of ['example-technical-reviewer','example-certificate-commercial','example-client-finance-reviewer'])correction=decide(clientCorrections(f.db,who,today),correction,'accept');
  const reverseLines=f.db.prepare('SELECT * FROM ledger_lines WHERE entry_id=? ORDER BY ordinal').all(correction.journal_id);
  for(const [index,line] of reverseLines.entries())for(const [key,opposite] of [['debit','credit'],['credit','debit'],['base_debit','base_credit'],['base_credit','base_debit']])assert.equal(line[key],ci.journal[index][opposite]);
  const afterCertificate=f.writer.report('jakh',{project:'harbour',currency:'USD'});assert.equal(afterCertificate.reconciliation.difference,'0.00');assert.equal(afterCertificate.tax_reconciliation.difference,'0.00');assert.equal(afterCertificate.rows[0].base_liability,'456.84');
  correction=correctionMaker.save(null,{advance_id:a.id,title:'Full foreign advance credit after recovery correction',effective_date:today(),basis:reason,reason,...evidence});correction=decide(clientCorrections(f.db,'advance-approver',today),decide(correctionMaker,correction,'submit'),'accept');
  const final=f.writer.report('jakh',{project:'harbour',currency:'USD'});assert.equal(final.rows[0].base_liability,'0.00');assert.equal(final.rows[0].customer_credit,'129.64');assert.equal(final.reconciliation.difference,'0.00');assert.equal(final.tax_reconciliation.difference,'0.00');
  assert.equal(receipts(f.db,'advance-approver',today).report('jakh',{project:'harbour'}).reconciliation.difference,'0.00');
  assert.equal(f.db.prepare('SELECT base_credit FROM ledger_lines WHERE entry_id=? AND description=?').get(r.journal_id,'Customer settlement exchange difference').base_credit,'20.33','A full credit must not reverse original bank FX');
});

function policyForRecovery(f, extra = {}) {
  const setup=certificates(f.db,'example-client-finance-author',today),review=certificates(f.db,'example-client-finance-reviewer',today);
  const previous=setup.contract(f.c.id).policies[0];
  let c=setup.savePolicy(null,{...previous,contract_id:f.c.id,recovery_tax_mode:'original_tax',...extra,reason});
  c=setup.decidePolicy(c.policies[0].id,{version:c.policies[0].version,action:'submit',reason});
  return review.decidePolicy(c.policies[0].id,{version:c.policies[0].version,action:'approve',reason});
}
function measurement(f, extra = {}) {
  const maker=certificates(f.db,'example-measurer',today),technical=certificates(f.db,'example-technical-reviewer',today);
  const pending=maker.list(f.company,f.c.project_id).find(r=>r.contract_id===f.c.id && r.state==='technical');
  const r=technical.decide(pending.id,{version:pending.version,action:'return',reason});
  return maker.save(r.id,{...r,period_to:today(),...extra,reason});
}
function certify(f,r) {
  r=decide(certificates(f.db,'example-measurer',today),r,'submit');
  for(const who of ['example-technical-reviewer','example-certificate-commercial','example-client-finance-reviewer']) r=decide(certificates(f.db,who,today),r,'accept');
  return r;
}
function certificateInvoice(f,r,extra={}) {
  let i=f.ar.saveInvoice(null,{certificate_id:r.id,invoice_date:today(),accounting_date:today(),due_date:today(),rate:'1',rate_date:today(),rate_source:reason,basis:reason,reason,...extra});
  i=f.ar.decideInvoice(i.id,{version:i.version,action:'submit',reason});
  return f.post.decideInvoice(i.id,{version:i.version,action:'post',reason});
}
test('taxed recovery requires elected policy, releases original tax once, and retains source history', t=>{
  const f=fixture(t),a=approved(f,{principal:'100',tax_percent:'5'}),i=invoice(f,a);receive(f,i,'105','ADV-TAX-RECOVERY');
  assert.throws(()=>measurement(f),/original advance-tax/);
  policyForRecovery(f);
  const maker=certificates(f.db,'example-measurer',today),pending=maker.list(f.company,f.c.project_id).find(r=>r.state==='returned');
  let r=maker.save(pending.id,{...maker.detail(pending.id),period_to:today(),reason});
  assert.equal(r.snapshot.work_tax,'256.13');assert.equal(r.snapshot.recovered_tax,'5.00');assert.equal(r.tax,'251.13');assert.equal(r.total,'5017.66');
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_advance_recoveries').get().n,0);
  r=certify(f,r);
  const original=f.db.prepare("SELECT * FROM client_receipts WHERE bank_reference='ADV-TAX-RECOVERY'").get();
  assert.throws(()=>receipts(f.db,'advance-writer',today).reverse(original.id,{version:original.version,accounting_date:today(),reason}),/Certified advance recovery/);
  const ci=certificateInvoice(f,r);
  assert.equal(ci.journal.find(l=>l.account_id===f.tax && l.debit==='5.00').base_debit,'5.00');
  assert.equal(ci.journal.find(l=>l.account_id===f.tax && l.credit!=='0.00').credit,'256.13');
  assert.throws(()=>f.db.prepare('DELETE FROM client_advance_recoveries WHERE certificate_id=?').run(r.id),/retained/);
});
test('an approved pending reversal reduces recovery availability; a draft reversal cannot bypass later certification', t=>{
  const f=fixture(t),a=approved(f,{principal:'100',tax_percent:'0'}),i=invoice(f,a),receipt=receive(f,i,'100','ADV-PENDING-REVERSE');
  const writer=receipts(f.db,'advance-writer',today),review=receipts(f.db,'advance-approver',today);
  let correction=writer.reverse(receipt.id,{version:receipt.version,accounting_date:today(),reason});
  let r=measurement(f);assert.equal(r.recovery,'100.00');
  correction=decide(review,decide(writer,correction,'submit'),'approve');
  assert.throws(()=>decide(certificates(f.db,'example-measurer',today),r,'submit'),/basis.*changed/);
  r=certificates(f.db,'example-measurer',today).save(r.id,{...r,reason});assert.equal(r.recovery,'0.00');
  correction=decide(writer,correction,'withdraw');
  assert.throws(()=>decide(certificates(f.db,'example-measurer',today),r,'submit'),/basis.*changed/);
  r=certificates(f.db,'example-measurer',today).save(r.id,{...r,reason});r=certify(f,r);
  assert.throws(()=>decide(writer,correction,'submit'),/Certified advance recovery/);
  assert.equal(f.db.prepare('SELECT state FROM client_receipts WHERE id=?').get(correction.id).state,'draft');
});
test('new receipts invalidate a pending measurement and earlier cutoffs do not recover future cash',t=>{
  const f=fixture(t),a=approved(f,{principal:'100',tax_percent:'0'}),i=invoice(f,a);
  let r=measurement(f);assert.equal(r.recovery,'0.00');receive(f,i,'50','ADV-STALE-RECOVERY');
  assert.throws(()=>decide(certificates(f.db,'example-measurer',today),r,'submit'),/basis.*changed/);
  r=certificates(f.db,'example-measurer',today).save(r.id,{...r,reason});assert.equal(r.recovery,'50.00');
  r=certificates(f.db,'example-measurer',today).save(r.id,{...r,period_to:'2026-10-28',rate_date:'2026-10-28',reason});assert.equal(r.recovery,'0.00');
});

test('approved but uninvoiced recovery reserves funds; later certificates consume only residual principal/tax cents',t=>{
  const f=fixture(t);policyForRecovery(f);
  const a=approved(f,{principal:'999.99',tax_percent:'5'}),i=invoice(f,a);receive(f,i,i.total,'ADV-RESIDUAL-CENTS');
  const basis=certificates(f.db,'example-measurer',today).contract(f.c.id),pending=f.db.prepare("SELECT * FROM client_certificates WHERE contract_id=? AND state='technical'").get(f.c.id);
  const half=JSON.parse(pending.lines_json).map(l=>({line_key:l.line_key,cumulative_quantity:new D(l.cumulative_quantity).plus(basis.previous_lines.find(x=>x.line_key===l.line_key).cumulative_quantity).div('2').toString()}));
  let first=measurement(f,{period_to:'2026-10-29',lines:half});assert.equal(first.recovery,'512.26');assert.equal(first.snapshot.recovered_tax,'25.61');first=certify(f,first);
  // The next business day is explicit in this isolated fixture; no system clock override.
  const next=()=> '2026-10-30',maker=certificates(f.db,'example-measurer',next),c=maker.contract(f.c.id);
  let second=maker.save(null,{contract_id:c.id,title:'Remaining work and advance',period_from:next(),period_to:next(),rate:'1',rate_date:next(),rate_source:reason,basis:reason,reason,...evidence,lines:c.lines.map(l=>({line_key:l.line_key,cumulative_quantity:l.quantity}))});
  assert.equal(second.recovery,'487.73');assert.equal(second.snapshot.recovered_tax,'24.39');
  second=decide(maker,second,'submit');for(const who of ['example-technical-reviewer','example-certificate-commercial','example-client-finance-reviewer']) second=decide(certificates(f.db,who,next),second,'accept');
  const totals=f.db.prepare('SELECT principal,tax FROM client_advance_recoveries WHERE invoice_id=?').all(i.id);
  assert.equal(money(sum(totals.map(r=>r.principal))),'999.99');assert.equal(money(sum(totals.map(r=>r.tax))),'50.00');
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_invoices WHERE certificate_id IN (?,?)').get(first.id,second.id).n,0);
  assert.equal(maker.contract(c.id).advance_position.available_principal,'0.00');
});
test('recovery is atomic with finance certification and stale reviewer authority prevents reservation',t=>{
  const f=fixture(t),a=approved(f,{principal:'100',tax_percent:'0'}),i=invoice(f,a);receive(f,i,'100','ADV-ATOMIC');
  let r=measurement(f);r=decide(certificates(f.db,'example-measurer',today),r,'submit');r=decide(certificates(f.db,'example-technical-reviewer',today),r,'accept');r=decide(certificates(f.db,'example-certificate-commercial',today),r,'accept');
  const finance=certificates(f.db,'example-client-finance-reviewer',today);
  f.db.exec("CREATE TRIGGER injected_recovery_failure BEFORE INSERT ON client_advance_recoveries BEGIN SELECT RAISE(ABORT,'Injected recovery failure'); END");
  assert.throws(()=>decide(finance,r,'accept'),/Injected/);
  assert.equal(f.db.prepare('SELECT state FROM client_certificates WHERE id=?').get(r.id).state,'finance');
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_certificate_lines WHERE certificate_id=?').get(r.id).n,0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM client_advance_recoveries WHERE certificate_id=?').get(r.id).n,0);
  f.db.exec('DROP TRIGGER injected_recovery_failure');
  f.db.prepare("UPDATE users SET active=0 WHERE id='example-certificate-commercial'").run();
  assert.throws(()=>decide(finance,r,'accept'),/earlier reviewer/);
  f.db.prepare("UPDATE users SET active=1 WHERE id='example-certificate-commercial'").run();
  r=decide(finance,r,'accept');assert.equal(r.state,'approved');
});

test('tax-inclusive recovery is capped to invoice capacity under differing original and work tax rates',t=>{
  const f=fixture(t);policyForRecovery(f,{tax_percent:'0'});
  const a=approved(f,{principal:'2',tax_percent:'100'}),i=invoice(f,a);receive(f,i,'4','ADV-CAP-TAX');
  const c=certificates(f.db,'example-measurer',today).contract(f.c.id),policy=c.policies[0].snapshot;
  const quote=recoveryQuote(f.db,{...c,terms:{...c.terms,recovery_percent:'100'}},policy,today(),'3.00','0.00');
  assert.equal(quote.principal,'1.50');assert.equal(quote.tax,'1.50');
  assert.equal(quote.allocations[0].base_principal,'1.50');assert.equal(quote.allocations[0].base_tax,'1.50');
});
test('multiple source invoices reconcile certified and posted recovery and export the same complete population',t=>{
  const f=fixture(t);policyForRecovery(f);
  const originals=[];
  for (const [amount,ref] of [['100.01','MULTI-ONE'],['200.02','MULTI-TWO']]) {const a=approved(f,{principal:amount,tax_percent:'5'}),i=invoice(f,a);receive(f,i,i.total,ref);originals.push(i);}
  let r=measurement(f);assert.equal(r.recovery,'300.03');assert.equal(r.snapshot.recovered_tax,'15.00');
  assert.deepEqual(r.snapshot.advance_recovery.allocations.map(a=>a.invoice_id),originals.map(i=>i.id).sort());
  r=certify(f,r);certificateInvoice(f,r);
  const report=f.post.report('jakh',{project:'harbour'});
  assert.equal(report.totals.posted_recovery,'300.03');assert.equal(report.totals.ledger_recovery,'300.03');assert.equal(report.totals.recovery_difference,'0.00');
  assert.equal(report.currencies[0].certified_recovery,'300.03');assert.equal(report.currencies[0].recovered_tax,'15.00');
  assert.ok(report.findings.some(f=>f.includes('300.03')&&f.includes('original')));
  const detail=certificateDetailCsv(r),exported=certificatesReportCsv(report);
  for(const i of originals) assert.ok(detail.includes(i.id));
  assert.ok(exported.includes('Original advance tax released'));assert.ok(exported.includes('300.03'));
  assert.equal(f.post.report('jakh',{project:'gardens'}).totals.posted_recovery,'0.00');
});

test('advance report separates unpaid liability, actual principal, certified reservations and posted recovery with complete CSV', t=>{
  const f=fixture(t), r=approved(f,{principal:'100',tax_percent:'5',title:'=unsafe spreadsheet title',request_date:'2026-10-28',rate_date:'2026-10-28'}), i=invoice(f,r);
  const before=f.writer.report('jakh',{project:'harbour'});
  assert.equal(before.rows[0].paid_principal,'0.00');assert.equal(before.rows[0].liability_principal,'100.00');
  assert.deepEqual(before.reconciliation,{source_liability:'100.00',ledger_liability:'100.00',difference:'0.00'});
  receive(f,i,'52.50','ADV-REPORT');policyForRecovery(f);
  const cert=certify(f,measurement(f));
  let report=f.writer.report('jakh',{project:'harbour',currency:'AED'}), row=report.rows[0];
  assert.equal(row.paid_principal,'50.00');assert.equal(row.paid_tax,'2.50');assert.equal(row.current_certified,'50.00');
  assert.equal(row.current_available,'0.00');assert.equal(row.recovered_principal,'0.00');assert.equal(row.liability_principal,'100.00');
  certificateInvoice(f,cert);report=f.writer.report('jakh',{project:'harbour'});row=report.rows[0];
  assert.equal(row.recovered_principal,'50.00');assert.equal(row.recovered_tax,'2.50');assert.equal(row.paid_unrecovered,'0.00');
  assert.deepEqual(report.tax_reconciliation,{source_unreleased_tax:'2.50',ledger_unreleased_tax:'2.50',difference:'0.00'});
  assert.equal(row.open_receivable,'52.50');assert.equal(row.base_liability,'50.00');assert.equal(report.reconciliation.difference,'0.00');
  const csv=advancesCsv(report);assert.ok(csv.includes("'=unsafe spreadsheet title"));assert.ok(csv.includes(cert.id));assert.ok(csv.includes(i.id));assert.ok(csv.includes('Company liability'));assert.ok(csv.includes(report.findings[1]));
  const past=f.writer.report('jakh',{to:'2026-10-28'});assert.equal(past.rows.length,1);assert.equal(past.rows[0].current_certified,'50.00');assert.equal(past.rows[0].paid_principal,'0.00');assert.equal(past.rows[0].invoiced_principal,'0.00');assert.equal(past.reconciliation.source_liability,'0.00');assert.equal(past.reconciliation.ledger_liability,'0.00');
  assert.throws(()=>f.writer.report('jakh',{to:'2026-02-30'}),/valid calendar/);assert.throws(()=>f.writer.report('jakh',{to:'2026-10-30'}),/future/);assert.throws(()=>f.writer.report('jakh',{currency:'aed'}),/currency/);
  const detail=f.writer.detail(r.id);assert.equal(detail.receipt_links.length,1);assert.equal(detail.recoveries[0].certificate_id,cert.id);
});

test('advance list, options, reports, search and workspace enforce scope and current authority',t=>{
  const f=fixture(t),r=approved(f,{principal:'100',tax_percent:'0'});invoice(f,r);
  const other=advances(f.db,'advance-other',today);
  assert.equal(other.list('jakh').length,0);assert.equal(other.report('jakh').reconciliation.ledger_liability,'0.00');
  assert.ok(other.options('jakh').contracts.every(c=>c.project_id==='gardens'));
  for(const fn of ['list','options']){assert.throws(()=>other[fn]('build'),/unavailable/);assert.throws(()=>other[fn]('jakh','harbour'),/unavailable/);}
  assert.throws(()=>other.report('jakh',{project:'harbour'}),/unavailable/);
  const reader=createService(f.db,'advance-other',today);assert.equal(reader.search('jakh',r.id).length,0);assert.equal(reader.workspace('jakh').client_advances.length,0);
  const own=createService(f.db,'advance-writer',today);assert.equal(own.search('jakh',r.id)[0].id,r.id);assert.equal(own.workspace('jakh','harbour').client_advances.length,1);
  f.db.prepare("UPDATE memberships SET role_id='site_engineer' WHERE user_id='advance-writer'").run();
  assert.throws(()=>f.writer.options('jakh'),/unavailable/);assert.equal(own.workspace('jakh').client_advances.length,0);
});
