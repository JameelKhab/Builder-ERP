import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openDatabase } from '../server/db.mjs';
import { identity } from '../server/identity.mjs';
import { createApi } from '../server/http.mjs';
import { ledger } from '../server/ledger.mjs';

test('individual HTTP identities approve advances, post canonical AR and record cash with scoped evidence and preview denial', async t => {
  const db = openDatabase(':memory:', { examples:true });t.after(()=>db.close());
  const today=()=> '2026-10-29', reason='Independent authenticated advance journey with retained evidence', password='Disposable local advance test passphrase 83!';
  const auth=identity(db,{sampleMode:true});
  const owner=await auth.setup({name:'Advance test owner',login:'advance.owner',password,confirm_password:password,company_ids:['jakh']},'Isolated test');
  const session=auth.authenticate(owner.session.token), users={};
  for(const [login,role,project] of [['advance.writer','ar_clerk','harbour'],['advance.reviewer','financial_controller','harbour'],['advance.recorder','treasury_clerk','harbour'],['advance.other','ar_clerk','gardens']]) {
    const u=auth.provision(session,{name:login,login,job_title:role,reason,grants:[{company_id:'jakh',project_id:project,role_id:role,approval_limit:'0',advance_approval_limit:role==='financial_controller'?'10000':'0',ar_approval_limit:role==='financial_controller'?'10000':'0',receipt_approval_limit:role==='financial_controller'?'10000':'0'}]});
    await auth.activate({login,code:u.activation_code,password,confirm_password:password});users[login]=u;
  }
  const account=ledger(db,'example-client-finance-reviewer',today).account(null,{company_id:'jakh',code:'2393',name:'Fictional HTTP advance liability',type:'liability',purpose:'client_advance',active:true,reason});
  const contract=db.prepare("SELECT id FROM client_contracts WHERE company_id='jakh' AND project_id='harbour'").get();
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
  const result=(await writer('/client-advances/documents/'+a.id)).body;assert.equal(result.received.paid_principal,'100.01');assert.equal(result.received.open_receivable,'200.02');
  assert.equal((await other('/certificates/invoices/'+i.id)).status,404);
  assert.equal((await writer('/ledger/options?company=jakh')).status,404);
  assert.equal((await admin('/access/preview',{user_id:a.author_id})).status,200);
  assert.equal((await admin('/client-advances/documents',payload)).status,403);
});
