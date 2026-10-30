import { transaction } from './db.mjs';
import { createAdvanceExampleContract } from './advances-examples.mjs';
import { advances } from './advances.mjs';
import { certificates } from './certificates.mjs';
import { receipts } from './receipts.mjs';
import { clientCorrections } from './client-corrections.mjs';
import { D } from './money.mjs';

export const CORRECTION_EXAMPLES='client-corrections-v1';
export function installCorrectionExamples(db) {
  if(db.prepare('SELECT id FROM sample_packs WHERE id=?').get(CORRECTION_EXAMPLES))return;
  transaction(db,()=>{
    const date=new Date().toISOString().slice(0,10),today=()=>date;
    const reason='FICTIONAL correction walkthrough. No real agreement, invoice, receipt, refund or bank transaction.';
    const evidence={filename:'fictional-correction-evidence.txt',base64:Buffer.from(reason).toString('base64')};
    // These are new synthetic identities. Existing users, limits and documents are never changed.
    for(const [id,name,role] of [['example-correction-author','Lina · example correction preparer','ar_clerk'],['example-correction-finance','Nabil · example correction finance reviewer','financial_controller']]) {
      db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)').run(id,name,role);
      for(const company of ['jakh','build'])db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id,advance_approval_limit,certificate_approval_limit,ar_approval_limit) VALUES(?,?,'*',?,?,?,?)").run(id,company,role,...(role==='financial_controller'?['1000000','1000000','1000000']:['0','0','0']));
    }
    const maker=clientCorrections(db,'example-correction-author',today),finance=clientCorrections(db,'example-correction-finance',today);
    const act=(svc,r,action)=>svc.decide(r.id,{version:r.version,action,reason});
    const apply=r=>{
      r=act(maker,r,'submit');
      if(r.certificate_id)for(const who of ['example-technical-reviewer','example-certificate-commercial'])r=act(clientCorrections(db,who,today),r,'accept');
      return act(finance,r,'accept');
    };
    const ar=certificates(db,'example-client-accountant',today),posting=certificates(db,'example-client-finance-reviewer',today);
    const invoice=(source,title)=>{
      let r=ar.saveInvoice(null,{...source,title,invoice_date:date,accounting_date:date,due_date:date,rate:'1',rate_date:date,rate_source:reason,basis:reason,reason});
      r=ar.decideInvoice(r.id,{version:r.version,action:'submit',reason});return posting.decideInvoice(r.id,{version:r.version,action:'post',reason});
    };
    for(const p of db.prepare("SELECT * FROM projects WHERE id IN ('harbour','gardens','creek') ORDER BY id").all()) {
      const {company,contract,account}=createAdvanceExampleContract(db,p,date,reason,'correction');
      const am=advances(db,'example-advance-author',today),ap=advances(db,'example-advance-reviewer',today);
      const request=(label,principal)=>act(ap,act(am,am.save(null,{contract_id:contract.id,title:`Example · ${p.name} · ${label}`,request_date:date,principal,tax_percent:'5',advance_account:account('2390'),tax_account:account('2310'),rate:'1',rate_date:date,rate_source:reason,basis:reason,...evidence,reason}),'submit'),'approve');
      const correction=(source,label)=>maker.save(null,{...source,title:`Example · ${p.name} · ${label}`,effective_date:date,basis:reason,...evidence,reason});
      const unbilled=request('Unbilled source to withdraw','100');
      apply(correction({advance_id:unbilled.id},'Unbilled cancellation · no accounting'));
      const unpaid=request('Unpaid invoice source','120');invoice({advance_id:unpaid.id},unpaid.title);
      apply(correction({advance_id:unpaid.id},'Unpaid full credit · originals retained'));
      const pending=request('Funding awaiting correction review','80');invoice({advance_id:pending.id},pending.title);
      act(maker,correction({advance_id:pending.id},'Awaiting independent finance review'),'submit');
      const returned=request('Funding reason needs clarification','60');
      act(finance,act(maker,correction({advance_id:returned.id},'Returned · revise evidence and impact'),'submit'),'return');
      const cancelled=request('Source with cancelled correction request','50');
      act(maker,correction({advance_id:cancelled.id},'Cancelled request · source stays approved'),'cancel');
      const funded=request('Funded source with recovery','300'),funding=invoice({advance_id:funded.id},funded.title);
      const rm=receipts(db,'example-receipt-author',today),rr=receipts(db,'example-receipt-reviewer',today),recorder=receipts(db,'example-receipt-recorder',today);
      const bank=db.prepare("SELECT id FROM payment_banks WHERE company_id=? AND name='Example · Receipt demonstration bank'").get(company.id);
      let cash=rm.save(null,{company_id:company.id,bank_id:bank.id,title:`Example · ${p.name} · correction demonstration remittance`,accounting_date:date,bank_amount:'210',bank_rate:'1',rate_date:date,rate_source:reason,explanation:reason,allocations:[{invoice_id:funding.id,amount:'210'}]});
      cash=act(rr,act(rm,cash,'submit'),'approve');recorder.decide(cash.id,{version:cash.version,action:'record',reason,bank_reference:'DEMO-CCR-CASH-'+p.code,file:evidence});
      const measure=certificates(db,'example-measurer',today);
      const measured=(c,label)=>{
        let r=measure.save(null,{contract_id:c.id,title:`Example · ${p.name} · ${label}`,period_from:date,period_to:date,rate:'1',rate_date:date,rate_source:reason,basis:reason,lines:c.lines.map(l=>({line_key:l.line_key,cumulative_quantity:new D(l.quantity).times('0.02').toString()})),...evidence,reason});
        r=act(measure,r,'submit');for(const who of ['example-technical-reviewer','example-certificate-commercial','example-client-finance-reviewer'])r=act(certificates(db,who,today),r,'accept');return r;
      };
      const cert=measured(contract,'Measured source with recovered advance');invoice({certificate_id:cert.id},cert.title);
      apply(correction({certificate_id:cert.id},'Certified recovery withdrawn with exact credit'));
      apply(correction({advance_id:funded.id},'Paid invoice credited · cash retained'));
      // A replacement is a new record and fresh review cycle, never a reset.
      const replacement=measured(contract,'Replacement measurement · fresh approval');
      act(maker,correction({certificate_id:replacement.id},'Certified period awaiting technical review'),'submit');
      // Separate contract keeps a genuine recovery blocker available to inspect.
      const blocked=createAdvanceExampleContract(db,p,date,reason,'dependency').contract;
      let a=am.save(null,{contract_id:blocked.id,title:`Example · ${p.name} · dependency funding`,request_date:date,principal:'200',tax_percent:'0',advance_account:account('2390'),rate:'1',rate_date:date,rate_source:reason,basis:reason,...evidence,reason});
      a=act(ap,act(am,a,'submit'),'approve');const ai=invoice({advance_id:a.id},a.title);
      let pay=rm.save(null,{company_id:company.id,bank_id:bank.id,title:`Example · ${p.name} · dependency remittance`,accounting_date:date,bank_amount:'200',bank_rate:'1',rate_date:date,rate_source:reason,explanation:reason,allocations:[{invoice_id:ai.id,amount:'200'}]});
      pay=act(rr,act(rm,pay,'submit'),'approve');recorder.decide(pay.id,{version:pay.version,action:'record',reason,bank_reference:'DEMO-CCR-DEPENDENCY-'+p.code,file:evidence});
      measured(blocked,'Dependent recovery · not yet invoiced');
      correction({advance_id:a.id},'Blocked · correct certified recovery first');
    }
    db.prepare('INSERT INTO sample_packs VALUES(?,?)').run(CORRECTION_EXAMPLES,new Date().toISOString());
  });
}
