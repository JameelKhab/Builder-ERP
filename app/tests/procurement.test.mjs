import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/db.mjs';
import {procurement} from '../server/procurement.mjs';
import {createService} from '../server/service.mjs';
import {sourcingAvailable} from '../server/cost-ledger.mjs';
const today=()=> '2026-10-29';
export const demand={company_id:'jakh',project_id:'harbour',title:'Level 12 blockwork',needed_by:'2026-11-06',lines:[{product_id:'jakh-BLOCK',work_package_id:'WP-C-103',location_id:'harbour-unit',quantity:'100',note:'Internal walls, approved drawing A-1204.'}]};
function fixture(t){const db=openDatabase();t.after(()=>db.close());return {db,site:procurement(db,'mohammed',today),buyer:procurement(db,'sara',today),manager:procurement(db,'ahmed',today)};}
function plan(f,{input=demand,unit_price='10',split=true}={}){
 let r=f.site.createRequest(input);r=f.site.decide(r.id,{version:r.version,action:'submit'});
 const q=(vendor,quantity,rate)=>{r=f.buyer.addQuote(r.id,{version:r.version,line_id:r.lines[0].id,vendor_id:vendor,reference:'Quote '+vendor,quantity,unit_price:vendor==='gulf'?'42':unit_price,currency:'FORGED',rate,rate_date:'2026-10-29',rate_source:'Test fixed snapshot',valid_until:'2026-11-10',lead_days:2});};
 q('euro',split?'60':'100','4');if(split)q('gulf','40','999');
 return f.buyer.sourcePlan(r.id,{version:r.version,allocations:r.quotes.map(q=>({quote_id:q.id,quantity:q.quantity}))});
}
function ordered(f,options){let r=plan(f,options);r=f.manager.decide(r.id,{version:r.version,action:'approve'});return f.buyer.issueOrders(r.id,{version:r.version});}
const receipt=(o,overrides={})=>({version:o.version,command_key:'delivery-1',line_id:o.lines[0].id,accepted:'30',rejected:'5',delivery_reference:'DN-1001',reason:'Five broken blocks rejected at gate',...overrides});
const movement=(o,overrides={})=>({version:o.version,command_key:'move-1',kind:'issue',quantity:'20',location_id:'harbour-unit',reason:'Installed against drawing A-1204',...overrides});
test('site demand supports several unpriced lines, scoped work and locations, and revisions before submission',t=>{
 const f=fixture(t);let r=f.site.createRequest({...demand,lines:[...demand.lines,{...demand.lines[0],product_id:'jakh-FORM',quantity:'3'}]});
 assert.equal(r.lines.length,2);assert.deepEqual(r.lines.map(l=>l.product_id),['jakh-BLOCK','jakh-FORM']);assert.equal(r.can_price,false);assert.ok(!('quotes' in r));assert.ok(!('company_amount'in r));
 r=f.site.updateRequest(r.id,{...demand,version:r.version,lines:[{...demand.lines[0],quantity:'120'}]});assert.equal(r.lines[0].quantity,'120');
 assert.throws(()=>f.site.updateRequest(r.id,{...demand,version:1}),{status:409});
 r=f.site.decide(r.id,{version:r.version,action:'submit'});assert.equal(r.state,'submitted');assert.equal(f.db.prepare('SELECT count(*) n FROM construction_cost_facts').get().n,0);
 assert.throws(()=>f.site.updateRequest(r.id,{...demand,version:r.version}),{status:403});
});
test('invalid quantity, dates, cross-company masters and cross-project work cannot create partial requests',t=>{
 const f=fixture(t),before=f.db.prepare('SELECT count(*) n FROM material_requests').get().n;
 for(const change of [{quantity:'-1'},{quantity:'0'},{quantity:'1e9'},{product_id:'build-BLOCK'},{work_package_id:'WP-C-201'},{location_id:'gardens-unit'}])assert.throws(()=>f.site.createRequest({...demand,lines:[{...demand.lines[0],...change}]}));
 assert.throws(()=>f.site.createRequest({...demand,needed_by:'2026-02-30'}));
 assert.throws(()=>f.site.createRequest({...demand,project_id:'creek'}),{status:404});
 assert.equal(f.db.prepare('SELECT count(*) n FROM material_requests').get().n,before);
});
test('quotes use vendor currency and same-currency rate 1; server computes a balanced split award',t=>{
 const f=fixture(t),r=plan(f);assert.equal(r.state,'awaiting_approval');assert.equal(r.company_amount,'4080.00');
 const euro=r.quotes.find(q=>q.vendor_id==='euro'),gulf=r.quotes.find(q=>q.vendor_id==='gulf');
 assert.equal(euro.currency,'EUR');assert.equal(gulf.rate,'1');assert.equal(gulf.currency,'AED');
 assert.equal(r.allocations.find(a=>a.vendor_id==='euro').company_amount,'2400.00');
 assert.equal(f.site.requestDetail(r.id).can_price,false);assert.equal(f.site.requestDetail(r.id).allocations,undefined);
 assert.equal(f.site.workspace('jakh').vendors.length,0);assert.deepEqual(f.site.workspace('jakh').creatable_projects.map(p=>p.id),['harbour']);
});
test('unbalanced allocations, duplicate quotes, foreign quotes and wrong state fail atomically',t=>{
 const f=fixture(t);let r=plan(f);r=f.manager.decide(r.id,{version:r.version,action:'return',note:'Revise supplier split'});
 const base={version:r.version,allocations:r.quotes.map(q=>({quote_id:q.id,quantity:q.quantity}))};
 for(const allocations of [[{...base.allocations[0],quantity:'59'},base.allocations[1]],[base.allocations[0],base.allocations[0]], [{quote_id:'unknown',quantity:'100'}]])assert.throws(()=>f.buyer.sourcePlan(r.id,{...base,allocations}));
 assert.equal(f.buyer.requestDetail(r.id).version,r.version);
 r=f.buyer.sourcePlan(r.id,base);assert.throws(()=>f.buyer.sourcePlan(r.id,{...base,version:r.version}));
});
test('requester and sourcing author cannot approve; authority is evaluated at the approval revision',t=>{
 const f=fixture(t),r=plan(f);assert.throws(()=>f.site.decide(r.id,{version:r.version,action:'approve'}),{status:403});
 assert.throws(()=>f.buyer.decide(r.id,{version:r.version,action:'approve'}),{status:403});
 f.db.prepare("UPDATE memberships SET approval_limit='4000' WHERE user_id='ahmed' AND company_id='jakh'").run();
 assert.throws(()=>f.manager.decide(r.id,{version:r.version,action:'approve'}),{status:403});
 f.db.prepare("UPDATE memberships SET approval_limit='5000' WHERE user_id='ahmed' AND company_id='jakh'").run();
 assert.equal(f.manager.decide(r.id,{version:r.version,action:'approve'}).state,'approved');
 assert.throws(()=>f.manager.decide(r.id,{version:r.version,action:'approve'}),{status:409});
});
test('expired quote and stale FX block approval without reserving funds',t=>{
 const f=fixture(t),r=plan(f),old=procurement(f.db,'ahmed',()=> '2026-11-11');
 assert.throws(()=>old.decide(r.id,{version:r.version,action:'approve'}),/expired/);
 const stale=procurement(f.db,'ahmed',()=> '2026-11-07');assert.throws(()=>stale.decide(r.id,{version:r.version,action:'approve'}),/stale/);
 assert.equal(sourcingAvailable(f.db,'C-103').toString(),'300000');
});
test('released budget, typed and legacy reservations share one capacity and cancellation releases it',t=>{
 const f=fixture(t);let r=plan(f);
 f.db.prepare("UPDATE work_packages SET release_state='draft' WHERE id='WP-C-103'").run();assert.throws(()=>f.manager.decide(r.id,{version:r.version,action:'approve'}),/released/);
 f.db.prepare("UPDATE work_packages SET release_state='released' WHERE id='WP-C-103'").run();
 f.db.prepare("UPDATE cost_items SET request_allowance='5000' WHERE id='C-103'").run();
 r=f.manager.decide(r.id,{version:r.version,action:'approve'});assert.equal(sourcingAvailable(f.db,'C-103').toString(),'920');
 const second=plan(f);assert.throws(()=>f.manager.decide(second.id,{version:second.version,action:'approve'}),/allowance/);
 const legacy=createService(f.db,'sara',today),manager=createService(f.db,'ahmed',today);
 let l=legacy.create({company_id:'jakh',project_id:'harbour',item_id:'C-103',title:'Legacy example',location:'Level 12',due:'2026-11-06',unit:'unit',quantity:'1',unit_price:'1000'});
 l=legacy.decide(l.id,{version:l.version,action:'submit'});assert.throws(()=>manager.decide(l.id,{version:l.version,action:'approve'}),/allowance/);
 f.manager.decide(r.id,{version:r.version,action:'cancel',note:'Demand withdrawn'});assert.equal(sourcingAvailable(f.db,'C-103').toString(),'5000');
 manager.decide(l.id,{version:l.version,action:'approve'});assert.equal(sourcingAvailable(f.db,'C-103').toString(),'4000');
 assert.throws(()=>f.manager.decide(second.id,{version:second.version,action:'approve'}),/allowance/);
});
test('order issue splits vendor/currency, converts reservation once and preserves frozen pricing',t=>{
 const f=fixture(t),orders=ordered(f),r=f.buyer.requestDetail(orders[0].request_id);
 assert.equal(orders.length,2);assert.equal(r.state,'ordered');assert.equal(sourcingAvailable(f.db,'C-103').toString(),'295920');
 assert.equal(f.db.prepare('SELECT count(*) n FROM construction_cost_facts').get().n,2);
 assert.deepEqual(f.buyer.issueOrders(r.id,{version:0}).map(o=>o.id).sort(),orders.map(o=>o.id).sort());
 f.db.prepare("UPDATE vendors SET rate='999',unit_price='999' WHERE id='euro'").run();
 assert.equal(f.buyer.orderDetail(orders.find(o=>o.currency==='EUR').id).lines[0].rate,'4');
 const report=createService(f.db,'ahmed',today).report('jakh','harbour'),line=report.rows.find(r=>r.id==='C-103');
 assert.equal(line.committed,'6004080.00');assert.equal(line.incurred,'4000000.00');assert.equal(line.cash,'3000000');assert.equal(line.transaction_sources.length,2);
 assert.throws(()=>f.manager.decide(r.id,{version:r.version,action:'cancel',note:'Cannot cancel issued supply'}));
});
test('partial receipt, rejection, return and issue keep quantities, value, cost and cash distinct',t=>{
 const f=fixture(t);let o=ordered(f).find(o=>o.currency==='EUR');o=f.site.receive(o.id,receipt(o));
 assert.equal(o.lines[0].received,'30');assert.equal(o.lines[0].outstanding,'30');assert.equal(o.receipts[0].available,'30');assert.equal(o.receipts[0].company_value,undefined);
 o=f.manager.orderDetail(o.id);assert.equal(o.receipts[0].stock_value,'1200.00');
 o=f.manager.moveStock(o.receipts[0].id,movement(o,{kind:'return',quantity:'5',reason:'Latent damage; replacement required'}));
 assert.equal(o.lines[0].outstanding,'35');assert.equal(o.receipts[0].available,'25');
 o=f.manager.moveStock(o.receipts[0].id,movement(o,{command_key:'issue-1'}));assert.equal(o.receipts[0].available,'5');assert.equal(o.receipts[0].stock_value,'200.00');
 const r=createService(f.db,'ahmed',today).report('jakh','harbour').rows.find(r=>r.id==='C-103');assert.equal(r.incurred,'4000800.00');assert.equal(r.committed,'6004080.00');assert.equal(r.cash,'3000000');
 assert.equal(o.movements.length,3);
});
test('receipt and stock commands retry safely and reject key reuse with changed payload',t=>{
 const f=fixture(t);let o=ordered(f)[0],input=receipt(o,{accepted:'20',rejected:'0'});o=f.manager.receive(o.id,input);const revision=o.version;
 assert.equal(f.manager.receive(o.id,input).version,revision);
 assert.throws(()=>f.manager.receive(o.id,{...input,accepted:'21'}),{status:409});
 const m=movement(o,{quantity:'4'});o=f.manager.moveStock(o.receipts[0].id,m);assert.equal(f.manager.moveStock(o.receipts[0].id,m).version,o.version);
 assert.throws(()=>f.manager.moveStock(o.receipts[0].id,{...m,quantity:'5'}),{status:409});
 assert.equal(f.db.prepare("SELECT count(*) n FROM construction_cost_facts WHERE kind='incurred'").get().n,1);
});
test('over-receipt, over-return, consumed-stock return and stale revisions cannot corrupt stock',t=>{
 const f=fixture(t);let o=ordered(f)[0];assert.throws(()=>f.manager.receive(o.id,receipt(o,{accepted:'101'})),/outstanding/);
 o=f.manager.receive(o.id,receipt(o,{accepted:'10',rejected:'0'}));
 assert.throws(()=>f.manager.receive(o.id,receipt(o,{version:1,command_key:'next'})),{status:409});
 assert.throws(()=>f.manager.moveStock(o.receipts[0].id,movement(o,{kind:'return',quantity:'11'})),/stock remains/);
 assert.throws(()=>f.manager.moveStock(o.receipts[0].id,movement(o,{quantity:'1',location_id:'gardens-site'})));
 o=f.manager.moveStock(o.receipts[0].id,movement(o,{quantity:'10'}));
 assert.equal(o.receipts[0].available,'0');assert.equal(o.receipts[0].stock_value,'0.00');
 assert.throws(()=>f.manager.moveStock(o.receipts[0].id,movement(o,{command_key:'later',kind:'return',quantity:'1'})),/stock remains/);
});
test('last lot consumption takes residual cents exactly and posted evidence cannot be rewritten',t=>{
 const f=fixture(t);let o=ordered(f,{split:false,unit_price:'0.003333'})[0];o=f.manager.receive(o.id,receipt(o,{accepted:'3',rejected:'0'}));
 assert.equal(o.receipts[0].stock_value,'0.04');
 for(let i=1;i<=3;i++)o=f.manager.moveStock(o.receipts[0].id,movement(o,{command_key:'cent-'+i,quantity:'1'}));
 assert.equal(o.receipts[0].stock_value,'0.00');const row=createService(f.db,'ahmed',today).report('jakh','harbour').rows.find(r=>r.id==='C-103');assert.equal(row.incurred,'4000000.04');
 for(const table of ['supplier_quotes','purchase_order_lines','material_receipts','stock_movements','construction_cost_facts','procurement_events'])assert.throws(()=>f.db.exec(`DELETE FROM ${table}`),/append-only/);
});
test('read-only auditor, unpriced site user and foreign scope have separate service permissions',t=>{
 const f=fixture(t),o=ordered(f)[0];f.db.prepare("INSERT INTO users(id,name,role) VALUES('audit','Auditor','Auditor')").run();
 f.db.prepare("INSERT INTO memberships(user_id,company_id,project_id,role_id) VALUES('audit','jakh','harbour','auditor')").run();
 const audit=procurement(f.db,'audit',today);assert.equal(audit.orderDetail(o.id).can_receive,false);assert.throws(()=>audit.receive(o.id,receipt(o)),{status:403});
 assert.throws(()=>f.site.addQuote(o.request_id,{version:1}),{status:403});
 assert.throws(()=>f.site.workspace('build'),{status:404});assert.throws(()=>f.site.workspace('jakh','gardens'),{status:404});
 const site=f.site.orderDetail(o.id);assert.equal(site.lines[0].unit_price,undefined);assert.equal(site.company_amount,undefined);assert.equal(site.can_move,false);
});
test('revoked grants apply to an already-created procurement service, search and direct orders',t=>{
 const f=fixture(t),o=ordered(f)[0];assert.equal(f.site.orderDetail(o.id).id,o.id);
 assert.ok(createService(f.db,'mohammed',today).search('jakh',o.id).every(r=>r.company_amount===undefined));
 f.db.prepare("DELETE FROM memberships WHERE user_id='mohammed'").run();
 assert.throws(()=>f.site.orderDetail(o.id),{status:404});assert.throws(()=>f.site.requestDetail(o.request_id),{status:404});
});
