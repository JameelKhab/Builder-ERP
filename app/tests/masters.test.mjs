import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/db.mjs';
import {masters} from '../server/masters.mjs';
import {procurement} from '../server/procurement.mjs';
import {createService} from '../server/service.mjs';
import {usableSupplier} from '../server/master-rules.mjs';
import {installMasterExamples} from '../server/masters-examples.mjs';
const day=()=> '2026-10-29';
const contact={company_id:'jakh',name:'Fictional supplier',supplier:true,customer:true,subcontractor:false,email:'quotes@example.invalid',address:'Original fictional address',country:'United Arab Emirates',reason:'Test identity'};
const terms={company_id:'jakh',preferred_currency:'EUR',currencies:['EUR','AED'],payment_days:30,effective_from:'2026-10-29',reason:'Test agreement'};
function fixture(t){const db=openDatabase();t.after(()=>db.close());return {db,buyer:masters(db,'sara',day),manager:masters(db,'ahmed',day),site:masters(db,'mohammed',day),buy:procurement(db,'sara',day),approve:procurement(db,'ahmed',day),request:procurement(db,'mohammed',day)};}
function supplier(f,input=contact){let p=f.buyer.saveParty(null,input);p=f.buyer.proposeTerms(p.party_id,{...terms,company_id:input.company_id,version:p.version});return f.manager.decideTerms(p.proposals[0].id,{company_id:input.company_id,version:p.version,decision:'approved',reason:'Independent checked agreement'});}
function product(f){return f.buyer.saveProduct(null,{company_id:'jakh',code:'NEW-BLOCK',name:'New concrete block',kind:'material',uom:'unit',precision:0,category_id:'jakh-materials',reason:'Explicit whole-unit material'});}
function quotation(f,p,item,{quantity='3',unit_price='10',pack_id='',currency='EUR',needed='9'}={}){
 let r=f.request.createRequest({company_id:'jakh',project_id:'harbour',title:'Typed master chain',needed_by:'2026-11-01',lines:[{product_id:item.id,work_package_id:'WP-C-103',location_id:'harbour-unit',quantity:needed}]});
 r=f.request.decide(r.id,{version:r.version,action:'submit'});r=f.buy.addQuote(r.id,{version:r.version,line_id:r.lines[0].id,vendor_id:p.vendor_id,currency,pack_id,quantity,unit_price,rate:'4',rate_date:day(),rate_source:'Test exact rate',valid_until:'2026-11-01',reference:'TEST-QUOTE',lead_days:1});return r;
}
const source=(f,r)=>f.buy.sourcePlan(r.id,{version:r.version,allocations:[{quote_id:r.quotes[0].id,quantity:r.lines[0].quantity}]});
test('supplier has one party/customer identity, company-local terms and independent activation',t=>{
 const f=fixture(t);let p=f.buyer.saveParty(null,contact);assert.equal(p.supplier,1);assert.equal(p.customer,1);assert.equal(p.terms,null);
 assert.throws(()=>usableSupplier(f.db,'jakh',p.vendor_id,day()),/Approved active/);
 p=f.buyer.proposeTerms(p.party_id,{...terms,version:p.version});const proposal=p.proposals[0];
 assert.throws(()=>f.buyer.decideTerms(proposal.id,{company_id:'jakh',version:p.version,decision:'approved',reason:'Self'}),{status:403});
 assert.throws(()=>f.buyer.proposeTerms(p.party_id,{...terms,version:p.version}),{status:409});
 p=f.manager.decideTerms(proposal.id,{company_id:'jakh',version:p.version,decision:'approved',reason:'Reviewed evidence'});
 assert.equal(usableSupplier(f.db,'jakh',p.vendor_id,day()).currency,'EUR');assert.equal(p.terms.payment_days,30);
 assert.throws(()=>f.manager.decideTerms(proposal.id,{company_id:'jakh',version:p.version,decision:'approved',reason:'Replay'}),{status:409});
});
test('project-scoped grants cannot maintain company masters, and unpriced readers cannot see terms or proposals',t=>{
 const f=fixture(t),p=supplier(f);assert.throws(()=>f.site.saveParty(null,contact),{status:403});assert.throws(()=>f.site.workspace('build'),{status:404});
 const safe=f.site.partyDetail('jakh',p.party_id);assert.equal(safe.terms,undefined);assert.equal(safe.proposals,undefined);assert.equal(safe.history,undefined);
 f.db.prepare("UPDATE memberships SET project_id='harbour' WHERE user_id='sara'").run();assert.throws(()=>f.buyer.saveParty(null,contact),{status:403});
 const r=f.buyer.partyDetail('jakh',p.party_id);assert.equal(r.proposals,undefined);assert.equal(r.terms.preferred_currency,'EUR');
});
test('shared identity links existing authorised party while confidential company terms stay separate',t=>{
 const f=fixture(t),p=supplier(f);let linked=f.manager.saveParty(null,{...contact,company_id:'build',existing_party_id:p.party_id,address:'Second company contact',reason:'Link authorised shared identity'});
 assert.equal(linked.party_id,p.party_id);assert.equal(linked.terms,null);assert.equal(f.buyer.partyDetail('jakh',p.party_id).address,contact.address);
 assert.throws(()=>f.buyer.partyDetail('build',p.party_id),{status:404});
 assert.throws(()=>f.buyer.saveParty(p.party_id,{...p,name:'Unauthorised global rename',reason:'Must fail'}),{status:403});
 linked=f.manager.saveParty(linked.party_id,{...linked,name:'Shared renamed identity',reason:'Authorised in both companies'});assert.equal(f.buyer.partyDetail('jakh',p.party_id).name,linked.name);
 assert.throws(()=>f.buyer.saveParty(null,{...contact,existing_party_id:'hidden'}),{status:404});
 assert.equal(f.db.prepare('SELECT count(*) n FROM parties WHERE id=?').get(p.party_id).n,1);
});
test('stale terms require return and a fresh proposal; future/expired/currency inputs cannot activate',t=>{
 const f=fixture(t);let p=supplier(f);p=f.buyer.proposeTerms(p.party_id,{...terms,version:p.version,payment_days:60});const term=p.proposals.find(t=>!t.decision);
 p=f.buyer.saveParty(p.party_id,{...p,phone:'12345',reason:'Contact correction'});
 assert.throws(()=>f.manager.decideTerms(term.id,{company_id:'jakh',version:p.version,decision:'approved',reason:'Old proposal'}),{status:409});
 p=f.manager.decideTerms(term.id,{company_id:'jakh',version:p.version,decision:'returned',reason:'Refresh the changed contact'});assert.equal(p.terms.payment_days,30);
 for(const extra of [{currencies:['GBP']},{preferred_currency:'USD'},{payment_days:1.5},{effective_from:'2026-02-30'}])assert.throws(()=>f.buyer.proposeTerms(p.party_id,{...terms,version:p.version,...extra}));
 p=f.buyer.proposeTerms(p.party_id,{...terms,version:p.version,effective_from:'2026-11-10'});
 assert.throws(()=>f.manager.decideTerms(p.proposals.find(t=>!t.decision).id,{company_id:'jakh',version:p.version,decision:'approved',reason:'Too early'}),/not effective/);
});
test('pack quote uses approved currency and exact ratio arithmetic across partial awards and receipts',t=>{
 const f=fixture(t),p=supplier(f);let item=product(f);item=f.buyer.addPack(item.id,{version:item.version,name:'Three blocks',base_quantity:'3',supplier_code:'SUP-3',reason:'Pack evidence'});
 let r=quotation(f,p,item,{pack_id:item.packs[0].id,quantity:'3',unit_price:'10',needed:'8'});assert.equal(r.quotes[0].quantity,'9');assert.equal(r.quotes[0].currency,'EUR');assert.equal(r.quotes[0].pack.quoted_price,'10');assert.equal(r.quotes[0].pack.supplier_code,'');
 r=source(f,r);assert.equal(r.company_amount,'106.68');assert.equal(r.allocations[0].amount,'26.67');r=f.approve.decide(r.id,{version:r.version,action:'approve'});let o=f.buy.issueOrders(r.id,{version:r.version})[0];
 o=f.approve.receive(o.id,{version:o.version,line_id:o.lines[0].id,accepted:'2',rejected:'0',delivery_reference:'DN-TEST',reason:'',command_key:'test-partial'});assert.equal(o.receipts[0].company_value,'26.68');assert.equal(o.lines[0].outstanding,'6');
 assert.equal(f.request.orderDetail(o.id).lines[0].pack,undefined);assert.equal(f.request.orderDetail(o.id).payment_days,undefined);
 const row=createService(f.db,'ahmed',day).report('jakh','harbour').rows.find(x=>x.id==='C-103');assert.equal(row.committed,'6000106.68');assert.equal(row.cash,'3000000');
});
test('forbidden currency and mismatched/retired packs fail without adding a quotation',t=>{
 const f=fixture(t),p=supplier(f),item=product(f);let r=quotation(f,p,item,{quantity:'9',unit_price:'1',currency:'AED'});assert.equal(r.quotes[0].rate,'1');
 const q={version:r.version,line_id:r.lines[0].id,vendor_id:p.vendor_id,quantity:'9',unit_price:'1',rate:'1',rate_date:day(),rate_source:'Test',valid_until:'2026-11-01',reference:'BAD',lead_days:1};
 assert.throws(()=>f.buy.addQuote(r.id,{...q,currency:'USD'}),/permitted/);assert.throws(()=>f.buy.addQuote(r.id,{...q,pack_id:'unknown'}),/pack/);assert.equal(f.buy.requestDetail(r.id).quotes.length,1);
});
test('supplier block is checked at sourcing, approval, issue and legacy request gates but permits existing deliveries',t=>{
 const f=fixture(t),item=product(f);let p=supplier(f),r=quotation(f,p,item,{quantity:'9'});r=source(f,r);r=f.approve.decide(r.id,{version:r.version,action:'approve'});const o=f.buy.issueOrders(r.id,{version:r.version})[0];
 const waiting=quotation(f,p,item,{quantity:'9'}),review=source(f,quotation(f,p,item,{quantity:'9'}));let approved=source(f,quotation(f,p,item,{quantity:'9'}));approved=f.approve.decide(approved.id,{version:approved.version,action:'approve'});
 p=f.buyer.blockSupplier(p.party_id,{company_id:'jakh',version:p.version,reason:'Due diligence hold'});
 assert.throws(()=>source(f,waiting),/not available/);assert.throws(()=>f.approve.decide(review.id,{version:review.version,action:'approve'}),/not available/);assert.throws(()=>f.buy.issueOrders(approved.id,{version:approved.version}),/not available/);
 const received=f.approve.receive(o.id,{version:o.version,line_id:o.lines[0].id,accepted:'1',rejected:'0',delivery_reference:'Earlier order',reason:'',command_key:'still-deliver'});assert.equal(received.lines[0].received,'1');
 p=f.buyer.proposeTerms(p.party_id,{...terms,version:p.version});p=f.manager.decideTerms(p.proposals.find(t=>!t.decision).id,{company_id:'jakh',version:p.version,decision:'approved',reason:'Lift hold after review'});assert.equal(p.blocked,0);
 assert.throws(()=>source(f,waiting),/terms changed/);
 const old=f.buyer.partyDetail('jakh','PARTY-jakh-euro');f.buyer.blockSupplier(old.party_id,{company_id:'jakh',version:old.version,reason:'Hold legacy supplier too'});
 assert.throws(()=>createService(f.db,'sara',day).preview({company_id:'jakh',project_id:'harbour',item_id:'C-103',vendor_id:'euro',quantity:'1'}),/not available/);
});
test('historical supplier/address/product/unit/pack snapshots survive rename and archive',t=>{
 const f=fixture(t),p=supplier(f);let item=product(f);item=f.buyer.addPack(item.id,{version:item.version,name:'Three blocks',base_quantity:'3',reason:'Definition'});
 let r=source(f,quotation(f,p,item,{pack_id:item.packs[0].id}));r=f.approve.decide(r.id,{version:r.version,action:'approve'});const o=f.buy.issueOrders(r.id,{version:r.version})[0];
 f.buyer.saveParty(p.party_id,{...p,name:'Changed legal name',address:'Changed address',active:false,reason:'Archive'});item=f.buyer.saveProduct(item.id,{...item,name:'Changed material name',active:false,reason:'Archive product'});f.buyer.retirePack(item.packs[0].id,{version:1,active:false,reason:'Retire old packaging'});
 const after=f.buy.orderDetail(o.id);assert.equal(after.vendor,contact.name);assert.equal(after.address,contact.address);assert.equal(after.lines[0].product,'New concrete block');assert.equal(after.lines[0].pack.base_quantity,'3');assert.equal(after.lines[0].uom,'unit');assert.equal(f.buy.requestDetail(r.id).quotes[0].vendor,contact.name);
});
test('new products enforce unit precision, service separation and immutable definitions',t=>{
 const f=fixture(t),item=product(f);assert.throws(()=>f.buyer.saveProduct(item.id,{...item,uom:'tonne',reason:'Bad definition'}),/fixed/);
 const base={company_id:'jakh',project_id:'harbour',title:'Precision test',needed_by:'2026-11-01',lines:[{product_id:item.id,work_package_id:'WP-C-103',location_id:'harbour-unit',quantity:'1.5'}]};assert.throws(()=>f.request.createRequest(base),/decimal places/);
 const service=f.buyer.saveProduct(null,{company_id:'jakh',code:'SURVEY',name:'Survey service',kind:'service',uom:'hour',precision:2,category_id:'jakh-materials',reason:'Service test'});assert.throws(()=>f.request.createRequest({...base,lines:[{...base.lines[0],product_id:service.id,quantity:'1'}]}),/active product/);
 assert.throws(()=>f.buyer.addPack(item.id,{version:item.version,name:'Fractional blocks',base_quantity:'0.5',reason:'Invalid'}),/decimal places/);
 let r=source(f,quotation(f,supplier(f),item,{quantity:'9'}));r=f.approve.decide(r.id,{version:r.version,action:'approve'});let o=f.buy.issueOrders(r.id,{version:r.version})[0];const input={version:o.version,line_id:o.lines[0].id,accepted:'1.5',rejected:'0',delivery_reference:'DN',reason:'',command_key:'invalid'};assert.throws(()=>f.approve.receive(o.id,input),/decimal places/);o=f.approve.receive(o.id,{...input,accepted:'3',command_key:'valid'});assert.throws(()=>f.approve.moveStock(o.receipts[0].id,{version:o.version,kind:'issue',quantity:'0.5',location_id:'harbour-unit',reason:'Bad unit',command_key:'bad-move'}),/decimal places/);
});
test('category rename/archive preserves product references and history is immutable',t=>{
 const f=fixture(t),item=product(f);const category=f.buyer.saveCategory('jakh-materials',{company_id:'jakh',name:'Structural materials',active:false,version:1,reason:'Rename and retire'});assert.equal(f.buyer.productDetail(item.id).category_id,category.id);
 for(const table of ['supplier_terms','master_events','document_master_snapshots'])assert.throws(()=>f.db.exec(`DELETE FROM ${table}`),/append-only/);
 const p=f.buyer.addPack(item.id,{version:item.version,name:'Pallet',base_quantity:'100',reason:'Evidence'});assert.throws(()=>f.db.prepare("UPDATE product_packs SET base_quantity='50' WHERE id=?").run(p.packs[0].id),/new pack/);
});
test('example pack installs once, retains pending reviews and demonstrates one party in two companies',t=>{
 const db=openDatabase(':memory:',{examples:true});t.after(()=>db.close());const before=db.prepare('SELECT count(*) n FROM master_events').get().n;installMasterExamples(db);assert.equal(db.prepare('SELECT count(*) n FROM master_events').get().n,before);
 const a=masters(db,'ahmed',day).workspace('jakh'),b=masters(db,'ahmed',day).workspace('build'),p=a.contacts.find(p=>p.reference==='EX-MERIDIAN'),q=b.contacts.find(p=>p.reference==='EX-MERIDIAN');assert.equal(p.party_id,q.party_id);assert.equal(p.terms.payment_days,30);assert.equal(q.terms.payment_days,45);assert.equal(a.pending.length,1);assert.equal(b.pending.length,1);assert.ok(a.products.some(p=>p.kind==='service'));assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
});
test('pending purchasing rechecks current supplier identity/address, while retired pack history stays fixed',t=>{
 const f=fixture(t);let p=supplier(f),item=product(f);item=f.buyer.addPack(item.id,{version:item.version,name:'Bundle',base_quantity:'3',reason:'Pack proof'});
 const r=quotation(f,p,item,{pack_id:item.packs[0].id});f.buyer.retirePack(item.packs[0].id,{version:1,active:false,reason:'Future pack unavailable'});
 assert.throws(()=>quotation(f,p,item,{pack_id:item.packs[0].id}),/active pack/);
 assert.equal(source(f,r).company_amount,'120.00');
 p=f.buyer.saveParty(p.party_id,{...p,address:'New procurement address',reason:'Address changed'});
 const review=f.buy.requestDetail(r.id);assert.throws(()=>f.approve.decide(review.id,{version:review.version,action:'approve'}),/address changed/);
});
test('shared legal identity changes invalidate pending company terms and effective-date expiry stops new purchasing',t=>{
 const f=fixture(t);let p=supplier(f);let second=f.manager.saveParty(null,{...contact,company_id:'build',existing_party_id:p.party_id,reason:'Shared link'});
 p=f.buyer.proposeTerms(p.party_id,{...terms,version:p.version,effective_until:day()});const pending=p.proposals.find(t=>!t.decision);
 f.manager.saveParty(second.party_id,{...second,name:'Renamed shared supplier',reason:'Both company scopes permitted'});
 p=f.manager.partyDetail('jakh',p.party_id);assert.ok(p.proposals.find(t=>t.id===pending.id).stale);assert.throws(()=>f.manager.decideTerms(pending.id,{company_id:'jakh',version:p.version,decision:'approved',reason:'Stale identity'}),{status:409});
 p=f.manager.decideTerms(pending.id,{company_id:'jakh',version:p.version,decision:'returned',reason:'Refresh legal identity'});p=f.buyer.proposeTerms(p.party_id,{...terms,version:p.version,effective_until:day()});p=f.manager.decideTerms(p.proposals.find(t=>!t.decision).id,{company_id:'jakh',version:p.version,decision:'approved',reason:'Valid for today only'});
 assert.throws(()=>usableSupplier(f.db,'jakh',p.vendor_id,'2026-10-30'),/not effective/);
});
