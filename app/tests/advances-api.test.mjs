import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openDatabase } from '../server/db.mjs';
import { identity } from '../server/identity.mjs';
import { createApi } from '../server/http.mjs';
import { certificates } from '../server/certificates.mjs';
import { ledger } from '../server/ledger.mjs';

test('individual HTTP identities approve advances, recover paid advances through independent certificates and AR, block unsupported cash corrections and enforce scope', async t => {
  const db = openDatabase(':memory:', { examples:true });t.after(()=>db.close());
  const today=()=> '2026-10-29', reason='Independent authenticated advance journey with retained evidence', password='Disposable local advance test passphrase 83!';
  const auth=identity(db,{sampleMode:true});
  const owner=await auth.setup({name:'Advance test owner',login:'advance.owner',password,confirm_password:password,company_ids:['jakh']},'Isolated test');
  const session=auth.authenticate(owner.session.token), users={};
  for(const [login,role,project] of [['advance.writer','ar_clerk','harbour'],['advance.reviewer','financial_controller','harbour'],['advance.recorder','treasury_clerk','harbour'],['advance.other','ar_clerk','gardens'],['recovery.measure','quantity_surveyor','harbour'],['recovery.technical','project_manager','harbour'],['recovery.commercial','commercial_manager','harbour']]) {
    const u=auth.provision(session,{name:login,login,job_title:role,reason,grants:[{company_id:'jakh',project_id:project,role_id:role,approval_limit:'0',certificate_approval_limit:['financial_controller','commercial_manager'].includes(role)?'100000':'0',advance_approval_limit:role==='financial_controller'?'10000':'0',ar_approval_limit:role==='financial_controller'?'10000':'0',receipt_approval_limit:role==='financial_controller'?'10000':'0'}]});
    await auth.activate({login,code:u.activation_code,password,confirm_password:password});users[login]=u;
  }
  const account=ledger(db,'example-client-finance-reviewer',today).account(null,{company_id:'jakh',code:'2393',name:'Fictional HTTP advance liability',type:'liability',purpose:'client_advance',active:true,reason});
  const contract=db.prepare("SELECT id FROM client_contracts WHERE company_id='jakh' AND project_id='harbour'").get();
  const synthetic=certificates(db,'example-measurer',today),pending=synthetic.list('jakh','harbour').find(r=>r.contract_id===contract.id && r.state==='technical'),savedBasis=synthetic.detail(pending.id);
  synthetic.decide(pending.id,{version:pending.version,action:'cancel',reason});
  const server=createApi(db,{today}).listen(0,'127.0.0.1');
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  async function client(login) {
    let cookie='';
    const call=async(path,body,method='POST')=>{
      const r=await fetch(base+path,{method:body===undefined?'GET':method,headers:{'Content-Type':'application/json','X-Builder-Client':'local-app',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
      if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
      return {status:r.status,headers:r.headers,body:r.headers.get('content-type')?.includes('application/json')?await r.json():Buffer.from(await r.arrayBuffer())};
    };
    assert.equal((await call('/auth/login',{login,password})).status,200);return call;
  }
  const writer=await client('advance.writer'),review=await client('advance.reviewer'),record=await client('advance.recorder'),other=await client('advance.other'),admin=await client('advance.owner');
  const evidence=Buffer.from('Fictional signed advance request. Original retained bytes.');
  const payload={contract_id:contract.id,title:'HTTP mobilisation advance',request_date:today(),principal:'300.03',tax_percent:'0',advance_account:account.id,rate:'1',rate_date:today(),rate_source:reason,basis:reason,filename:'request.txt',base64:evidence.toString('base64'),reason,state:'approved',approved_by:'forged',author_id:'forged',company_id:'build'};
  const saved=await writer('/client-advances/documents',payload);assert.equal(saved.status,201,JSON.stringify(saved.body));let a=saved.body;
  assert.equal(a.state,'draft');assert.equal(a.approved_by,null);assert.equal(a.company_id,'jakh');assert.notEqual(a.author_id,'forged');
  assert.equal((await other('/client-advances/documents/'+a.id)).status,404);
  assert.equal((await other('/client-advances/evidence/'+a.evidence_id)).status,404);
  const file=await writer('/client-advances/evidence/'+a.evidence_id);assert.equal(file.status,200);assert.deepEqual(file.body,evidence);assert.equal(file.headers.get('x-content-sha256'),createHash('sha256').update(evidence).digest('hex'));
  let response=await writer(`/client-advances/documents/${a.id}/decision`,{version:a.version,action:'submit',reason});assert.equal(response.status,200);a=response.body;
  assert.equal((await writer(`/client-advances/documents/${a.id}/decision`,{version:a.version,action:'approve',reason})).status,403);
  response=await review(`/client-advances/documents/${a.id}/decision`,{version:a.version,action:'approve',reason});assert.equal(response.status,200,JSON.stringify(response.body));a=response.body;
  response=await writer('/certificates/invoices',{advance_id:a.id,invoice_date:today(),accounting_date:today(),due_date:'2026-11-28',rate:'1',rate_date:today(),rate_source:reason,basis:reason,reason,journal_json:'forged',total:'0'});assert.equal(response.status,201,JSON.stringify(response.body));let i=response.body;
  assert.equal(i.total,'300.03');assert.equal(i.certificate_id,null);
  response=await writer(`/certificates/invoices/${i.id}/decision`,{version:i.version,action:'submit',reason});assert.equal(response.status,200);i=response.body;
  assert.equal((await writer(`/certificates/invoices/${i.id}/decision`,{version:i.version,action:'post',reason})).status,403);
  response=await review(`/certificates/invoices/${i.id}/decision`,{version:i.version,action:'post',reason});assert.equal(response.status,200,JSON.stringify(response.body));i=response.body;
  const options=(await writer('/customer-receipts/options?company=jakh&project=harbour')).body;
  assert.equal(options.balances.find(x=>x.id===i.id).open,'300.03');
  response=await writer('/customer-receipts/documents',{company_id:'jakh',bank_id:options.banks[0].id,title:'HTTP advance remittance',accounting_date:today(),bank_amount:'100.01',bank_rate:'1',rate_date:today(),rate_source:reason,explanation:reason,allocations:[{invoice_id:i.id,amount:'100.01'}]});assert.equal(response.status,201,JSON.stringify(response.body));let receipt=response.body;
  response=await writer(`/customer-receipts/documents/${receipt.id}/decision`,{version:receipt.version,action:'submit',reason});assert.equal(response.status,200);receipt=response.body;
  response=await review(`/customer-receipts/documents/${receipt.id}/decision`,{version:receipt.version,action:'approve',reason});assert.equal(response.status,200);receipt=response.body;
  response=await record(`/customer-receipts/documents/${receipt.id}/decision`,{version:receipt.version,action:'record',reason,bank_reference:'HTTP-ADVANCE-CASH',file:{filename:'remittance.txt',base64:evidence.toString('base64')}});assert.equal(response.status,200,JSON.stringify(response.body));
  receipt=response.body;
  const result=(await writer('/client-advances/documents/'+a.id)).body;assert.equal(result.received.paid_principal,'100.01');assert.equal(result.received.open_receivable,'200.02');
  const measurer=await client('recovery.measure'),technical=await client('recovery.technical'),commercial=await client('recovery.commercial');
  response=await measurer('/certificates/measurements',{...savedBasis,id:undefined,period_to:today(),filename:'measurement.txt',base64:evidence.toString('base64'),reason,recovery:'0',state:'approved'});
  assert.equal(response.status,201,JSON.stringify(response.body));let certificate=response.body;
  assert.equal(certificate.state,'draft');assert.equal(certificate.recovery,'100.01');
  response=await measurer(`/certificates/measurements/${certificate.id}/decision`,{version:certificate.version,action:'submit',reason});assert.equal(response.status,200,JSON.stringify(response.body));certificate=response.body;
  assert.equal((await measurer(`/certificates/measurements/${certificate.id}/decision`,{version:certificate.version,action:'accept',reason})).status,403);
  for(const actor of [technical,commercial,review]) {response=await actor(`/certificates/measurements/${certificate.id}/decision`,{version:certificate.version,action:'accept',reason});assert.equal(response.status,200,JSON.stringify(response.body));certificate=response.body;}
  assert.equal(certificate.state,'approved');
  assert.equal((await other('/certificates/measurements/'+certificate.id)).status,404);
  response=await writer('/certificates/invoices',{certificate_id:certificate.id,invoice_date:today(),accounting_date:today(),due_date:today(),rate:'1',rate_date:today(),rate_source:reason,basis:reason,reason});assert.equal(response.status,201,JSON.stringify(response.body));let ci=response.body;
  response=await writer(`/certificates/invoices/${ci.id}/decision`,{version:ci.version,action:'submit',reason});assert.equal(response.status,200);ci=response.body;
  response=await review(`/certificates/invoices/${ci.id}/decision`,{version:ci.version,action:'post',reason});assert.equal(response.status,200,JSON.stringify(response.body));ci=response.body;
  assert.equal(ci.journal.find(l=>l.account_id===account.id).base_debit,'100.01');
  response=await writer(`/customer-receipts/documents/${receipt.id}/reversal`,{version:receipt.version,accounting_date:today(),reason});assert.equal(response.status,409,JSON.stringify(response.body));assert.match(response.body.error,/Certified advance recovery/);
  const advancesReport=await review('/client-advances/report?company=jakh&project=harbour&currency=AED&to='+today());
  assert.equal(advancesReport.status,200);assert.equal(advancesReport.body.rows[0].paid_principal,'100.01');
  assert.equal(advancesReport.body.rows[0].recovered_principal,'100.01');assert.equal(advancesReport.body.reconciliation.difference,'0.00');
  assert.equal((await other('/client-advances/report?company=jakh&project=harbour')).status,404);
  assert.equal((await other('/client-advances/report?company=jakh')).body.rows.length,0);
  assert.equal((await other('/client-advances/options?company=jakh')).body.contracts.some(c=>c.project_id==='harbour'),false);
  assert.equal((await writer('/client-advances/documents?company=jakh&project=harbour')).body.length,1);
  assert.equal((await writer('/client-advances/report?company=jakh&to=2026-02-30')).status,422);
  const report=(await review('/certificates/report?company=jakh&project=harbour')).body;assert.equal(report.totals.recovery_difference,'0.00');assert.equal(report.totals.posted_recovery,'100.01');
  assert.equal((await other('/certificates/invoices/'+i.id)).status,404);
  assert.equal((await writer('/ledger/options?company=jakh')).status,404);
  // A paid certificate credit releases its recovery atomically but never erases cash.
  response=await writer('/customer-receipts/documents',{company_id:'jakh',bank_id:options.banks[0].id,title:'Partial payment of measured work',accounting_date:today(),bank_amount:'100',bank_rate:'1',rate_date:today(),rate_source:reason,explanation:reason,allocations:[{invoice_id:ci.id,amount:'100'}]});assert.equal(response.status,201,JSON.stringify(response.body));let workCash=response.body;
  for(const [actor,action] of [[writer,'submit'],[review,'approve']]){response=await actor(`/customer-receipts/documents/${workCash.id}/decision`,{version:workCash.version,action,reason});assert.equal(response.status,200,JSON.stringify(response.body));workCash=response.body;}
  response=await record(`/customer-receipts/documents/${workCash.id}/decision`,{version:workCash.version,action:'record',reason,bank_reference:'HTTP-WORK-CASH',file:{filename:'work-remittance.txt',base64:evidence.toString('base64')}});assert.equal(response.status,200,JSON.stringify(response.body));workCash=response.body;
  const correctionInput={certificate_id:certificate.id,title:'Evidenced full correction of certified period',effective_date:today(),basis:reason,reason,filename:'credit-basis.txt',base64:evidence.toString('base64'),state:'applied',journal_id:'forged'};
  response=await writer('/client-corrections/documents',correctionInput);assert.equal(response.status,201,JSON.stringify(response.body));let credit=response.body;assert.equal(credit.state,'draft');assert.equal(credit.journal_id,null);
  assert.equal((await other('/client-corrections/documents/'+credit.id)).status,404);assert.equal((await other('/client-corrections/evidence/'+credit.evidence_id)).status,404);
  const creditFile=await writer('/client-corrections/evidence/'+credit.evidence_id);assert.deepEqual(creditFile.body,evidence);
  response=await writer(`/client-corrections/documents/${credit.id}/decision`,{version:credit.version,action:'submit',reason});assert.equal(response.status,200,JSON.stringify(response.body));credit=response.body;
  assert.equal((await writer(`/client-corrections/documents/${credit.id}/decision`,{version:credit.version,action:'accept',reason})).status,403);
  for(const actor of [technical,commercial,review]){response=await actor(`/client-corrections/documents/${credit.id}/decision`,{version:credit.version,action:'accept',reason});assert.equal(response.status,200,JSON.stringify(response.body));credit=response.body;}
  assert.equal(credit.state,'applied');assert.ok(credit.journal_id);
  assert.equal((await writer('/certificates/invoices/'+ci.id)).body.settlement.customer_credit,'100.00');
  assert.equal((await writer('/customer-receipts/documents/'+workCash.id)).body.state,'recorded');
  response=await writer('/client-corrections/documents',{...correctionInput,certificate_id:undefined,advance_id:a.id,title:'Annul funded advance after recovery correction'});assert.equal(response.status,201,JSON.stringify(response.body));let advanceCredit=response.body;
  for(const [actor,action] of [[writer,'submit'],[review,'accept']]){response=await actor(`/client-corrections/documents/${advanceCredit.id}/decision`,{version:advanceCredit.version,action,reason});assert.equal(response.status,200,JSON.stringify(response.body));advanceCredit=response.body;}
  assert.equal((await writer('/certificates/invoices/'+i.id)).body.settlement.customer_credit,'100.01');
  const correctionReport=(await review('/client-corrections/report?company=jakh&project=harbour')).body;assert.equal(correctionReport.rows.length,2);assert.equal(correctionReport.reconciliation.difference,'0.00');
  assert.equal((await other('/client-corrections/report?company=jakh')).body.rows.length,0);
  assert.equal((await other('/client-corrections/report?company=jakh&project=harbour')).status,404);
  for(const path of ['/customer-receipts/report?company=jakh&project=harbour','/client-advances/report?company=jakh&project=harbour'])assert.equal((await review(path)).body.reconciliation.difference,'0.00');
  const correctedReport=(await review('/certificates/report?company=jakh&project=harbour')).body;assert.equal(correctedReport.totals.recovery_difference,'0.00');assert.equal(correctedReport.totals.receivable_difference,'0.00');assert.equal(correctedReport.totals.retention_difference,'0.00');assert.equal(correctedReport.totals.posted_recovery,'0.00');
  assert.equal((await admin('/access/preview',{user_id:a.author_id})).status,200);
  assert.equal((await admin('/client-advances/documents',payload)).status,403);
  assert.equal((await admin('/client-corrections/documents',correctionInput)).status,403);
});
