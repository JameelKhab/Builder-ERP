import test from 'node:test';import assert from 'node:assert/strict';
import {openDatabase} from '../server/db.mjs';import {createApi} from '../server/http.mjs';
async function client(t,db,actorId){const server=createApi(db,{authMode:'sample',actorId,today:()=> '2026-10-29'}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;const s=await fetch(base+'/api/local-session',{method:'POST',headers:{'X-Builder-Client':'local-app'}});const Cookie=s.headers.get('set-cookie').split(';')[0];return async(path,body,method='POST')=>{const r=await fetch(base+'/api'+path,{method:body===undefined?'GET':method,headers:{Cookie,'X-Builder-Client':'local-app','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};};}
test('master HTTP endpoints enforce live scope, pricing redaction and read-only preview',async t=>{
 const db=openDatabase(':memory:',{examples:true});t.after(()=>db.close());const site=await client(t,db,'mohammed'),admin=await client(t,db,'ahmed');
 const own=await site('/masters?company=jakh');assert.equal(own.status,200);assert.equal(own.body.can_write,false);assert.ok(own.body.contacts.every(c=>!c.terms&&!c.proposals));assert.equal((await site('/masters?company=build')).status,404);
 const p=own.body.contacts[0];assert.equal((await site('/masters/parties/'+p.party_id,{...p,reason:'Forbidden'},'PUT')).status,403);assert.equal((await site('/masters/products/build-BLOCK')).status,404);
 assert.equal((await admin('/access/preview',{user_id:'sara'})).status,200);assert.equal((await admin('/masters/categories',{company_id:'jakh',name:'Not saved',reason:'Preview'})).status,403);
});
test('a newly maintained supplier and product flow through local HTTP purchase approval, exact pack issue and searchable history',async t=>{
 const db=openDatabase();t.after(()=>db.close());const buyer=await client(t,db,'sara'),manager=await client(t,db,'ahmed'),site=await client(t,db,'mohammed');
 let r=await buyer('/masters/parties',{company_id:'jakh',name:'HTTP supplier example',supplier:true,customer:false,subcontractor:false,address:'Frozen order address',reason:'Integration fixture'});assert.equal(r.status,201);let p=r.body;
 p=(await buyer('/masters/parties/'+p.party_id+'/terms',{company_id:'jakh',version:p.version,preferred_currency:'EUR',currencies:['EUR','AED'],payment_days:30,effective_from:'2026-10-29',reason:'Approved agreement evidence'})).body;
 const term=p.proposals[0];assert.equal((await manager('/workspace?company=jakh')).body.master_reviews[0].name,p.name);
 p=(await manager('/masters/terms/'+term.id+'/decision',{company_id:'jakh',version:p.version,decision:'approved',reason:'Independent agreement review'})).body;assert.equal(p.terms.id,term.id);
 const item=(await buyer('/masters/products',{company_id:'jakh',code:'HTTP-MAT',name:'HTTP material example',kind:'material',uom:'unit',precision:0,category_id:'jakh-materials',reason:'Product fixture'})).body;
 const packed=(await buyer('/masters/products/'+item.id+'/packs',{version:item.version,name:'Bundle of three',base_quantity:'3',reason:'Exact supplier packaging'})).body;
 let mr=(await site('/material-requests',{company_id:'jakh',project_id:'harbour',title:'HTTP maintained masters journey',needed_by:'2026-11-01',lines:[{product_id:item.id,work_package_id:'WP-C-103',location_id:'harbour-unit',quantity:'8'}]})).body;
 mr=(await site('/material-requests/'+mr.id+'/decision',{version:mr.version,action:'submit'})).body;
 mr=(await buyer('/material-requests/'+mr.id+'/quotes',{version:mr.version,line_id:mr.lines[0].id,vendor_id:p.vendor_id,pack_id:packed.packs[0].id,currency:'EUR',quantity:'3',unit_price:'10',rate:'4',rate_date:'2026-10-29',rate_source:'Fixture EUR/AED',reference:'HTTP-PACK',valid_until:'2026-11-01',lead_days:1})).body;
 mr=(await buyer('/material-requests/'+mr.id+'/sourcing',{version:mr.version,allocations:[{quote_id:mr.quotes[0].id,quantity:'8'}]})).body;
 mr=(await manager('/material-requests/'+mr.id+'/decision',{version:mr.version,action:'approve'})).body;const order=(await buyer('/material-requests/'+mr.id+'/orders',{version:mr.version})).body[0];assert.equal(order.company_amount,'106.68');assert.equal(order.address,'Frozen order address');
 const results=(await buyer('/search?company=jakh&q=HTTP')).body;assert.ok(results.some(r=>r.id==='MASTER-party:'+p.party_id));assert.ok(results.some(r=>r.id==='MASTER-product:'+item.id));
 assert.equal((await site('/purchase-orders/'+order.id)).body.lines[0].pack,undefined);
 const cost=(await manager('/reports/cost?company=jakh&project=harbour')).body.rows.find(r=>r.id==='C-103');assert.equal(cost.committed,'6000106.68');assert.equal(cost.cash,'3000000');
});
