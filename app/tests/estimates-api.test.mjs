import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { identity } from '../server/identity.mjs';
import { createApi } from '../server/http.mjs';
import { masters } from '../server/masters.mjs';
import { sampleEstimate } from '../server/estimates-examples.mjs';
import { estimateRegisterCsv } from '../src/estimates-export.js';
const today = () => '2026-10-29';
test('individual HTTP users prepare, independently approve and hand over a scoped estimate; API reports and previews stay controlled', async t => {
  const db = openDatabase();
  t.after(() => db.close());
  const customer = masters(db, 'ahmed', today).saveParty(null, {
    company_id: 'jakh',
    name: 'HTTP fictional client',
    customer: true,
    supplier: false,
    subcontractor: false,
    reason: 'Test customer for estimate chain'
  });
  const auth = identity(db, {
      sampleMode: true
    }),
    password = 'Disposable estimate test passphrase 94!';
  const owner = await auth.setup({
    name: 'Estimate test owner',
    login: 'est.owner',
    password,
    confirm_password: password,
    company_ids: ['jakh']
  }, 'Disposable test');
  const session = auth.authenticate(owner.session.token),
    users = {};
  for (const [login, role, limit, project] of [['est.writer', 'estimator', '0', '*'], ['est.reviewer', 'tendering_manager', '1000000', '*'], ['est.manager', 'project_manager', '0', '*'], ['est.restricted', 'estimator', '0', 'gardens']]) {
    const u = auth.provision(session, {
      name: login,
      login,
      job_title: role,
      reason: 'Disposable independent estimate roles',
      grants: [{
        company_id: 'jakh',
        project_id: project,
        role_id: role,
        approval_limit: '0',
        estimate_approval_limit: limit, commercial_approval_limit: limit
      }]
    });
    await auth.activate({
      login,
      code: u.activation_code,
      password,
      confirm_password: password
    });
    users[login] = u;
  }
  const server = createApi(db, {
    today
  }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function client(login) {
    let cookie = '';
    const call = async (path, body, method = 'POST') => {
      const res = await fetch(base + path, {
        method: body === undefined ? 'GET' : method,
        headers: {
          'Content-Type': 'application/json',
          'X-Builder-Client': 'local-app',
          Cookie: cookie
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
      return {
        status: res.status,
        body: res.headers.get('content-type')?.includes('application/json') ? await res.json() : Buffer.from(await res.arrayBuffer()), headers: res.headers
      };
    };
    assert.equal((await call('/auth/login', {
      login,
      password
    })).status, 200);
    return call;
  }
  const writer = await client('est.writer'),
    reviewer = await client('est.reviewer'),
    manager = await client('est.manager'),
    restricted = await client('est.restricted'),
    admin = await client('est.owner');
  const input = sampleEstimate({
    id: 'jakh',
    currency: 'AED'
  }, customer.party_id, today());
  let res = await writer('/estimates/documents', {
    ...input,
    author_id: 'someone',
    state: 'approved',
    calculation: '{}'
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  let r = res.body;
  assert.equal(r.state, 'draft');
  assert.equal(r.calculation.totals.selling, '34151.04');
  assert.notEqual(r.author_id, 'someone');
  const decide = (call, r, action) => call(`/estimates/documents/${r.id}/decision`, {
    action,
    version: r.version,
    reason: 'Independently reviewed exact estimate'
  });
  r = (await decide(writer, r, 'submit')).body;
  assert.equal((await decide(writer, r, 'approve')).status, 403);
  assert.equal((await restricted('/estimates/documents/' + r.id)).status, 404);
  assert.equal((await restricted('/search?company=jakh&q=' + r.id)).body.length, 0);
  assert.equal((await restricted('/estimates/report?company=jakh')).body.rows.length, 0);
  assert.ok((await reviewer('/workspace?company=jakh')).body.estimate_documents.some(x => x.id === r.id && x.can_review));
  res = await decide(reviewer, r, 'approve');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  r = res.body;
  assert.equal((await writer('/estimates/documents/' + r.id, {
    ...r,
    reason: 'Forbidden update'
  }, 'PUT')).status, 403);
  const report = (await reviewer('/estimates/report?company=jakh')).body;
  assert.equal(report.rows.length, 1);
  assert.match(estimateRegisterCsv(report), /34151.04/);
  assert.equal((await writer(`/estimates/documents/${r.id}/handover`, {
    version: r.version,
    reason: 'Insufficient project rights'
  })).status, 403);
  const managerId = db.prepare("SELECT user_id FROM identities WHERE login='est.manager'").get().user_id;
  res = await manager(`/estimates/documents/${r.id}/handover`, {
    version: r.version,
    reason: 'Controlled project setup from locked estimate',
    project: {
      code: 'HTTP-EST',
      name: 'HTTP estimate project',
      location: 'Fictional site',
      manager_id: managerId,
      planned_start: '2026-11-01',
      planned_end: '2027-11-01'
    }
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const h = res.body.handover;
  assert.equal(db.prepare('SELECT state FROM budget_documents WHERE id=?').get(h.budget_id).state, 'draft');
  assert.equal(db.prepare('SELECT count(*) n FROM budget_facts WHERE document_id=?').get(h.budget_id).n, 0);
  const target=(await writer('/estimates/documents',{...input,title:'HTTP workbook intake'})).body;
  const product=db.prepare("SELECT * FROM products WHERE company_id='jakh' AND active=1 LIMIT 1").get(),cost=db.prepare("SELECT * FROM cost_codes WHERE company_id='jakh' LIMIT 1").get();
  const contents=`Code,Description,Quantity,Unit cost,Unit,Cost code,Product\nHTTP-BOQ,Fictional imported item,2,12.50,${product.uom},${cost.code},${product.code}\n`;
  const uploadBody={estimate_id:target.id,estimate_version:target.version,reason:'HTTP workbook intake',files:[{filename:'HTTP-example.csv',base64:Buffer.from(contents).toString('base64')}]};
  res=await writer('/boq-intakes/upload',uploadBody);assert.equal(res.status,201,JSON.stringify(res.body));let batch=res.body;
  assert.equal((await restricted('/boq-intakes/'+batch.id)).status,404);
  assert.equal((await restricted('/boq-files/'+batch.files[0].id)).status,404);
  res=await writer(`/boq-intakes/${batch.id}/check`,{version:batch.version,reason:'HTTP exact row checks',configs:batch.configs.map(c=>({...c,expected_total:'275.00'}))});assert.equal(res.status,200,JSON.stringify(res.body));batch=res.body;
  assert.equal(batch.result.issues.length,0);
  assert.equal((await writer(`/boq-intakes/${batch.id}/decision`,{version:batch.version,action:'review',confirmed:true,reason:'Self review attempt'})).status,403);
  assert.ok((await reviewer('/workspace?company=jakh')).body.boq_intakes.some(b=>b.id===batch.id&&b.can_review));
  res=await reviewer(`/boq-intakes/${batch.id}/decision`,{version:batch.version,action:'review',confirmed:true,reason:'Independent HTTP file reconciliation'});assert.equal(res.status,200,JSON.stringify(res.body));batch=res.body;
  const commitVersion=batch.version;res=await writer(`/boq-intakes/${batch.id}/commit`,{version:commitVersion,reason:'Add independently checked rows'});assert.equal(res.status,200,JSON.stringify(res.body));assert.equal(res.body.state,'committed');
  assert.equal((await writer(`/boq-intakes/${batch.id}/commit`,{version:commitVersion,reason:'Retry safely'})).body.committed_version,res.body.committed_version);
  const changed=(await writer('/estimates/documents/'+target.id)).body;assert.equal(changed.lines.length,target.lines.length+1);assert.equal(changed.intake_sources.length,1);
  const offerInput={estimate_id:r.id,title:'HTTP offer from approved study',offered_on:today(),valid_until:'2026-12-31',payment_days:30,retention_percent:'5',retention_cap:'2000',advance_ceiling:'1000',recovery_percent:'20',terms:'Fictional measured-work terms for HTTP verification',basis:r.basis,exclusions:r.exclusions,reason:'Prepare an original local offer'};
  res=await writer('/commercial/offers',offerInput);assert.equal(res.status,201,JSON.stringify(res.body));let offer=res.body;
  res=await writer(`/commercial/offers/${offer.id}/decision`,{version:offer.version,action:'submit',reason:'Commercial terms ready for review'});assert.equal(res.status,200);offer=res.body;
  assert.equal((await writer(`/commercial/offers/${offer.id}/decision`,{version:offer.version,action:'approve',reason:'Self approval'})).status,403);
  assert.ok((await reviewer('/workspace?company=jakh')).body.commercial_offers.some(o=>o.id===offer.id&&o.can_review));
  res=await reviewer(`/commercial/offers/${offer.id}/decision`,{version:offer.version,action:'approve',reason:'Independent commercial authority'});assert.equal(res.status,200,JSON.stringify(res.body));offer=res.body;
  const evidenceText='FICTIONAL ACCEPTANCE for '+offer.id;
  res=await writer('/commercial/acceptances',{offer_id:offer.id,version:offer.version,project_id:h.project_id,accepted_on:today(),reference:'HTTP-ACCEPT-001',signatory:'Fictional client',description:'Agrees to this exact offer revision',filename:'http-acceptance.txt',base64:Buffer.from(evidenceText).toString('base64'),mapping:offer.lines.map(l=>({line_key:l.line_key,work_package_id:h.lines.find(m=>m.line_key===l.line_key).work_package_id,location_id:null})),reason:'Record fictional client evidence'});
  assert.equal(res.status,201,JSON.stringify(res.body));offer=res.body;const acc=offer.acceptances[0];
  assert.equal((await restricted('/commercial/offers/'+offer.id)).status,404);assert.equal((await restricted('/commercial/evidence/'+acc.id)).status,404);
  const file=await reviewer('/commercial/evidence/'+acc.id);assert.equal(file.status,200);assert.equal(file.body.toString(),evidenceText);assert.equal(file.headers.get('x-content-sha256'),acc.sha256);assert.match(file.headers.get('content-disposition'),/attachment/);
  res=await reviewer(`/commercial/acceptances/${acc.id}/decision`,{version:acc.version,action:'verify',confirmed:true,reason:'Verified date, scope and exact terms'});assert.equal(res.status,200,JSON.stringify(res.body));offer=res.body;assert.equal(offer.state,'awarded');assert.equal(offer.contract.original_value,r.calculation.totals.selling);
  assert.equal((await reviewer(`/commercial/acceptances/${acc.id}/decision`,{version:acc.version,action:'verify',confirmed:true,reason:'Safe retry'})).body.contract.id,offer.contract.id);
  assert.equal((await restricted('/commercial/contracts/'+offer.contract.id)).status,404);assert.equal((await writer('/commercial/report?company=jakh&project='+h.project_id)).body.totals.awarded,offer.company_amount);
  assert.equal(db.prepare('SELECT count(*) n FROM budget_facts WHERE document_id=?').get(h.budget_id).n,0);
  const preview = await admin('/access/preview', {
    user_id: r.author_id
  });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal((await admin('/estimates/documents', input)).status, 403);
  assert.equal((await admin('/commercial/offers',offerInput)).status,403);
  assert.equal((await admin('/estimates/documents/' + r.id)).status, 200);
  assert.equal((await admin('/boq-intakes/upload',uploadBody)).status,403);
  assert.equal((await admin(`/boq-intakes/${batch.id}/check`,{version:batch.version,reason:'Read only preview',configs:batch.configs})).status,403);
});
