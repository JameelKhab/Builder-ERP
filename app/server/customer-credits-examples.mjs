import {transaction} from './db.mjs';

// Discoverable fictional drafts only: they demonstrate the route without altering a credit balance.
export const CUSTOMER_CREDIT_EXAMPLES='customer-credits-v1';
export function installCustomerCreditExamples(db){
 if(db.prepare('SELECT id FROM sample_packs WHERE id=?').get(CUSTOMER_CREDIT_EXAMPLES))return;
 transaction(db,()=>{
  const author='example-correction-author';
  const now=new Date().toISOString();
  const sources=db.prepare("SELECT i.* FROM client_invoices i JOIN client_corrections c ON c.invoice_id=i.id WHERE c.state='applied' ORDER BY i.project_id,i.id").all();
  const projects=db.prepare('SELECT * FROM projects ORDER BY id').all();
  for(const p of projects){
   const source=sources.find(x=>x.project_id===p.id);
   if(!source)continue;
   for(const [n,kind] of [['A','allocation'],['B','refund']]){
    const id=`CCS-EX-${p.code}-${n}`;
    const payload={customer:{name:'Fictional client'},legs:[{invoice_id:source.id,project_id:p.id,reference:source.title,amount:'0.00',base_amount:'0.00',effect:1}],bank:null,accounts:null,beneficiary:null};
    const bank=kind==='refund'?db.prepare('SELECT id FROM payment_banks WHERE company_id=? AND active=1 ORDER BY id LIMIT 1').get(p.company_id)?.id:null;
    db.prepare(`INSERT INTO client_credit_settlements(id,company_id,project_id,customer_id,source_invoice_id,kind,bank_id,title,accounting_date,currency,total,authority_amount,company_total,basis,payload,author_id,state,version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,p.company_id,p.id,source.customer_id,source.id,kind,bank,`Example · ${p.name} · ${kind==='allocation'?'allocate retained credit':'review refund instructions'}`,source.accounting_date,source.currency,'0.00','0.00','0.00','FICTIONAL walkthrough draft. Inspect the source credit, evidence, independent approval and recording route.',JSON.stringify(payload),author,'draft',1,now);
    db.prepare('INSERT INTO client_credit_events(settlement_id,actor_id,action,reason,snapshot,at) VALUES(?,?,?,?,?,?)').run(id,author,'Example settlement prepared','FICTIONAL walkthrough. No financial movement.',JSON.stringify({id}),now);
   }
  }
  db.prepare('INSERT INTO sample_packs VALUES(?,?)').run(CUSTOMER_CREDIT_EXAMPLES,now);
 });
}
