import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,transaction} from '../server/db.mjs';
import {createApi} from '../server/http.mjs';
import {procurement} from '../server/procurement.mjs';
import {installProcurementExamples} from '../server/procurement-examples.mjs';
async function client(t,db,actorId){
 const server=createApi(db,{authMode:'sample',actorId,today:()=> '2026-10-28'}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const headers={'X-Builder-Client':'local-app','Content-Type':'application/json'},base=`http://127.0.0.1:${server.address().port}/api`;
 const login=await fetch(base+'/local-session',{method:'POST',headers});headers.Cookie=login.headers.get('set-cookie').split(';')[0];
 return async(path,body,method='POST')=>{const res=await fetch(base+path,{headers,method:body===undefined?'GET':method,...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,body:await res.json()}};
}
test('typed procurement HTTP routes share session scope, price redaction and read-only access preview',async t=>{
 const db=openDatabase(':memory:',{examples:true});t.after(()=>db.close());const admin=await client(t,db,'ahmed'),site=await client(t,db,'mohammed');
 let res=await site('/procurement?company=jakh&project=harbour');assert.equal(res.status,200);assert.equal(res.body.requests.length,3);assert.equal(res.body.orders.length,2);assert.ok(res.body.requests.every(r=>!('quotes'in r)&&!('company_amount'in r)));
 const o=res.body.orders[0],r=res.body.requests.find(r=>r.state==='awaiting_approval');
 assert.equal((await site('/purchase-orders/'+o.id)).body.company_amount,undefined);
 assert.equal((await site('/procurement?company=build')).status,404);
 assert.equal((await site(`/material-requests/${r.id}/decision`,{version:r.version,action:'approve'})).status,403);
 assert.equal((await admin('/access/preview',{user_id:'mohammed'})).status,200);
 assert.equal((await admin(`/purchase-orders/${o.id}/receipts`,{version:o.version})).status,403);
 assert.equal((await admin('/access/preview',{user_id:null})).status,200);
 res=await admin(`/material-requests/${r.id}/decision`,{version:r.version,action:'approve'});assert.equal(res.status,200);
 const order=await admin(`/material-requests/${r.id}/orders`,{version:res.body.version});assert.equal(order.status,200);assert.equal(order.body.length,2);
 assert.equal((await admin(`/material-requests/${r.id}/orders`,{version:res.body.version})).body.length,2);
});
test('a request created over HTTP persists quantity without a vendor, currency or client-supplied identity',async t=>{
 const db=openDatabase();t.after(()=>db.close());const site=await client(t,db,'mohammed');
 const payload={company_id:'jakh',project_id:'harbour',title:'HTTP unpriced site demand',needed_by:'2026-11-05',requester_id:'ahmed',state:'approved',company_amount:'1',lines:[{product_id:'jakh-BLOCK',work_package_id:'WP-C-103',location_id:'harbour-unit',quantity:'25'}]};
 let res=await site('/material-requests',payload);assert.equal(res.status,201);assert.equal(res.body.requester_id,'mohammed');assert.equal(res.body.state,'draft');assert.equal(res.body.lines[0].quantity,'25');assert.equal(res.body.company_amount,undefined);
 const id=res.body.id;res=await site(`/material-requests/${id}/decision`,{version:res.body.version,action:'submit'});assert.equal(res.status,200);assert.equal(res.body.state,'submitted');
 assert.equal((await site('/search?company=jakh&q='+id)).body[0].id,id);
});
test('nested service operations roll back together and example upgrades are idempotent',t=>{
 const db=openDatabase(':memory:',{examples:true});t.after(()=>db.close());const count=table=>db.prepare(`SELECT count(*) n FROM ${table}`).get().n;
 const before=['material_requests','purchase_orders','material_receipts','stock_movements','construction_cost_facts'].map(count);
 installProcurementExamples(db);assert.deepEqual(['material_requests','purchase_orders','material_receipts','stock_movements','construction_cost_facts'].map(count),before);
 assert.throws(()=>transaction(db,()=>{procurement(db,'mohammed').createRequest({company_id:'jakh',project_id:'harbour',title:'Rollback demand',needed_by:'2026-11-05',lines:[{product_id:'jakh-BLOCK',work_package_id:'WP-C-103',location_id:'harbour-unit',quantity:'25'}]});throw new Error('Outer failure')}),/Outer failure/);
 assert.equal(count('material_requests'),before[0]);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});
