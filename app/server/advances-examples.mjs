import { transaction } from './db.mjs';
import { estimates } from './estimates.mjs';
import { sampleEstimate } from './estimates-examples.mjs';
import { commercial } from './commercial.mjs';
import { sampleOffer } from './commercial-examples.mjs';
import { certificates } from './certificates.mjs';
import { advances } from './advances.mjs';
import { receipts } from './receipts.mjs';
import { ledger } from './ledger.mjs';
import { D } from './money.mjs';
export const ADVANCE_EXAMPLES = 'client-advances-v1';
export function installAdvanceExamples(db) {
  if (db.prepare('SELECT id FROM sample_packs WHERE id=?').get(ADVANCE_EXAMPLES)) return;
  transaction(db,()=>{
    const reason='FICTIONAL advance walkthrough only. No real client agreement, invoice, receipt or bank transaction.';
    const date=new Date().toISOString().slice(0,10),today=()=>date;
    const evidence={filename:'fictional-advance-basis.txt',base64:Buffer.from(reason).toString('base64')};
    // New synthetic identities only; existing users and financial limits stay intact.
    for(const [id,name,role] of [['example-advance-author','Sara · example advance preparer','ar_clerk'],['example-advance-reviewer','Omar · example advance reviewer','financial_controller']]){
      db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id,name,role);
      for(const company of ['jakh','build'])db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,advance_approval_limit) VALUES(?,?,'*',?,?)").run(id,company,role,role==='financial_controller'?'1000000':'0');
    }
    const advance=advances(db,'example-advance-author',today),review=advances(db,'example-advance-reviewer',today);
    const em=estimates(db,'ahmed',today),er=estimates(db,'example-estimate-reviewer',today),offers=commercial(db,'ahmed',today),or=commercial(db,'example-commercial-reviewer',today);
    const setup=certificates(db,'example-client-finance-author',today),finance=certificates(db,'example-client-finance-reviewer',today),ar=certificates(db,'example-client-accountant',today),measure=certificates(db,'example-measurer',today);
    const act=(s,r,action)=>s.decide(r.id,{version:r.version,action,reason});
    const inv=(source,title,post=true)=>{
      let r=ar.saveInvoice(null,{...source,title,invoice_date:date,accounting_date:date,due_date:date,rate:'1',rate_date:date,rate_source:reason,basis:reason,reason});
      if(post){r=ar.decideInvoice(r.id,{version:r.version,action:'submit',reason});r=finance.decideInvoice(r.id,{version:r.version,action:'post',reason});}return r;
    };
    const controls={};
    for(const company of ['jakh','build'])controls[company]=ledger(db,'example-client-finance-author',today).account(null,{company_id:company,code:'2390',name:'Example · Client mobilisation advance',type:'liability',purpose:'client_advance',active:true,reason}).id;
    for(const p of db.prepare("SELECT * FROM projects WHERE id IN ('harbour','gardens','creek') ORDER BY id").all()){
      const company=db.prepare('SELECT * FROM companies WHERE id=?').get(p.company_id),customer=db.prepare("SELECT party_id FROM party_companies WHERE company_id=? AND reference='DEMO-EST-CLIENT'").get(company.id).party_id;
      let e=em.save(null,{...sampleEstimate(company,customer,date,p.id),title:`Example · ${p.name} · mobilisation contract`,tender_reference:'DEMO-ADV-'+p.code});e=act(er,act(em,e,'submit'),'approve');
      let o=offers.save(null,sampleOffer(e,date));o=act(or,act(offers,o,'submit'),'approve');
      const w=db.prepare("SELECT id FROM work_packages WHERE project_id=? AND kind='item' AND cost_code_id=? ORDER BY id LIMIT 1").get(p.id,company.id+'-GENERAL');
      o=offers.recordAcceptance(o.id,{version:o.version,project_id:p.id,mapping:o.lines.map(l=>({line_key:l.line_key,work_package_id:w.id,location_id:null})),reference:'DEMO-ADV-'+p.code,accepted_on:date,signatory:'Fictional client representative',description:reason,...evidence,reason});
      or.decideAcceptance(o.acceptances[0].id,{version:1,action:'verify',confirmed:true,reason});
      const contract=db.prepare('SELECT id FROM client_contracts WHERE offer_id=?').get(o.id);
      const account=purpose=>db.prepare('SELECT id FROM ledger_accounts WHERE company_id=? AND code=?').get(company.id,purpose).id;
      let c=setup.savePolicy(null,{contract_id:contract.id,receivable_account:account('1300'),retention_account:account('1310'),revenue_account:account('4100'),tax_account:account('2310'),tax_percent:'5',tax_basis:'gross',recovery_tax_mode:'original_tax',recovery_fx_basis:'unconfigured',basis:reason,reason});
      c=setup.decidePolicy(c.policies[0].id,{version:c.policies[0].version,action:'submit',reason});c=finance.decidePolicy(c.policies[0].id,{version:c.policies[0].version,action:'approve',reason});
      const request=(label,principal)=>advance.save(null,{contract_id:c.id,title:`Example · ${p.name} · ${label}`,request_date:date,principal,tax_percent:'5',advance_account:controls[company.id],tax_account:account('2310'),rate:'1',rate_date:date,rate_source:reason,basis:reason,...evidence,reason});
      request('Draft for mobilisation planning','60');
      act(advance,request('Agreement awaiting independent review','80'),'submit');
      act(review,act(advance,request('Returned for clearer funding basis','90'),'submit'),'return');
      act(advance,request('Cancelled duplicate · history retained','50'),'cancel');
      act(review,act(advance,request('Approved · invoice not prepared','100'),'submit'),'approve');
      const unpaid=act(review,act(advance,request('Invoiced · awaiting client remittance','150'),'submit'),'approve');inv({advance_id:unpaid.id},unpaid.title);
      const funded=act(review,act(advance,request('Mobilisation release · partial receipt and recovery','300'),'submit'),'approve');const invoice=inv({advance_id:funded.id},funded.title);
      const rm=receipts(db,'example-receipt-author',today),rr=receipts(db,'example-receipt-reviewer',today),recorder=receipts(db,'example-receipt-recorder',today);
      const bank=db.prepare("SELECT * FROM payment_banks WHERE company_id=? AND name='Example · Receipt demonstration bank'").get(company.id);
      let cash=rm.save(null,{company_id:company.id,bank_id:bank.id,title:`Example · ${p.name} · advance remittance`,accounting_date:date,bank_amount:'210',bank_rate:'1',rate_date:date,rate_source:reason,explanation:reason,allocations:[{invoice_id:invoice.id,amount:'210'}]});cash=act(rr,act(rm,cash,'submit'),'approve');recorder.decide(cash.id,{version:cash.version,action:'record',reason,bank_reference:'DEMO-ADV-CASH-'+p.code,file:evidence});
      let cert=measure.save(null,{contract_id:c.id,title:`Example · ${p.name} · first work recovers mobilisation`,period_from:date,period_to:date,rate:'1',rate_date:date,rate_source:reason,basis:reason,lines:c.lines.map(l=>({line_key:l.line_key,cumulative_quantity:new D(l.quantity).times('0.02').toString()})),...evidence,reason});cert=act(measure,cert,'submit');
      for(const who of ['example-technical-reviewer','example-certificate-commercial','example-client-finance-reviewer'])cert=act(certificates(db,who,today),cert,'accept');
      inv({certificate_id:cert.id},cert.title);
    }
    db.prepare('INSERT INTO sample_packs VALUES(?,?)').run(ADVANCE_EXAMPLES,new Date().toISOString());
  });
}
