import { commercial } from './commercial.mjs';
import { boqIntake } from './boq-intake.mjs';
import { estimates } from './estimates.mjs';
import { payments } from './payments.mjs';
import { payables } from './payables.mjs';
import { ledger } from './ledger.mjs';
import { quality } from './quality.mjs';
import { masters } from './masters.mjs';
import { identity } from './identity.mjs';
import { foundations } from './foundations.mjs';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { accessAdmin } from './access-admin.mjs';
import { policy } from './access.mjs';
import { procurement } from './procurement.mjs';
import { createService } from './service.mjs';
const browserLabel = req => {
  const ua = req.headers['user-agent'] || '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const device = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'local device';
  return `${browser} on ${device}`;
};

// Sample mode is explicit and permanently unavailable after the first owner is configured.
// Local individual accounts use server-validated opaque sessions; network release needs separate hardening.
export function createApi(db, {
  actorId = 'ahmed',
  authMode = 'auto',
  clock,
  today,
  origin = 'http://127.0.0.1:4173'
} = {}) {
  const app = express(),
    sessions = new Map(),
    auth = identity(db, {
      clock,
      sampleMode: authMode === 'sample'
    });
  const asyncRoute = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
  const tokenFrom = req => req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('builder_identity='))?.slice('builder_identity='.length);
  const setSession = (res, s) => res.setHeader('Set-Cookie', `builder_identity=${s.token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`);
  const clearSession = res => res.setHeader('Set-Cookie', ['builder_identity=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0', 'builder_local=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0']);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const host = req.headers.host?.split(':')[0];
    if (!['127.0.0.1', 'localhost'].includes(host)) return res.status(403).json({
      error: 'Only the local application host is allowed.'
    });
    if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({
      error: 'Cross-site requests are not allowed.'
    });
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY'
    });
    if (req.headers.origin && req.headers.origin !== origin) return res.status(403).json({
      error: 'Origin is not allowed.'
    });
    if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-builder-client'] !== 'local-app') return res.status(403).json({
      error: 'Same-origin client header required.'
    });
    next();
  });
  app.use('/api/quality/cases/:id/evidence', express.json({
    limit: '3mb'
  }));
  app.use('/api/commercial/acceptances', express.json({ limit: '3mb' }));
  app.use('/api/estimates/documents', express.json({ limit: '2mb' }));
  app.use('/api/boq-intakes/upload', express.json({ limit: '9mb' }));
  app.use(express.json({
    limit: '24kb'
  }));
  app.get('/api/auth/status', (req, res) => res.json(auth.status()));
  app.get('/api/auth/setup-options', (req, res) => res.json(auth.setupOptions()));
  app.post('/api/auth/setup', asyncRoute(async (req, res) => {
    const result = await auth.setup(req.body, browserLabel(req));
    setSession(res, result.session);
    sessions.clear();
    res.status(201).json({
      recovery_codes: result.recovery_codes
    });
  }));
  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const result = await auth.signIn(req.body, browserLabel(req));
    setSession(res, result);
    res.json({
      ok: true
    });
  }));
  app.post('/api/auth/activate', asyncRoute(async (req, res) => {
    const result = await auth.activate(req.body);
    clearSession(res);
    res.json(result);
  }));
  app.post('/api/local-session', (req, res) => {
    if (auth.mode() !== 'sample') return res.status(403).json({
      error: 'Sample sign-in is disabled. Use your own account.'
    });
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    for (const [key, session] of sessions) if (session.expires <= now) sessions.delete(key);
    if (sessions.size >= 100) return res.status(429).json({
      error: 'Too many local sessions. Restart the local server.'
    });
    const user = policy(db, actorId).actor();
    sessions.set(token, {
      expires: now + 8 * 60 * 60 * 1000,
      actorId,
      version: user.access_version,
      previewId: null
    });
    res.setHeader('Set-Cookie', `builder_local=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`);
    res.json({
      mode: 'local-sample'
    });
  });
  app.use('/api', (req, res, next) => {
    const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('builder_local='))?.slice(14);
    let session;
    if (auth.mode() === 'local') {
      try {
        session = auth.authenticate(tokenFrom(req));
      } catch (error) {
        error.code = 'session_expired';
        throw error;
      }
      req.realIdentity = true;
    } else if (auth.mode() === 'sample') session = sessions.get(token);
    if (!session || !req.realIdentity && session.expires <= Date.now()) return res.status(401).json({
      error: 'Local session expired. Reload this page.'
    });
    const current = policy(db, session.actorId).actor();
    if (current.access_version !== session.version) {
      if (!req.realIdentity) sessions.delete(token);
      return res.status(401).json({
        error: 'Your access has changed. Reload to start a fresh local session.'
      });
    }
    req.auth = auth;
    req.session = session;
    req.sessionToken = token;
    if (session.previewId && req.method !== 'GET' && !['/api/access/preview', '/api/logout'].includes(req.originalUrl)) return res.status(403).json({
      error: 'Access preview is read only. Return to your workspace to make changes.'
    });
    req.service = createService(db, session.previewId || session.actorId, today);
    req.commercial = commercial(db, session.previewId || session.actorId, today);
    req.estimates = estimates(db, session.previewId || session.actorId, today);
    req.boqIntake = boqIntake(db, session.previewId || session.actorId, today);
    req.payments = payments(db, session.previewId || session.actorId, today);
    req.payables = payables(db, session.previewId || session.actorId, today);
    req.ledger = ledger(db, session.previewId || session.actorId, today);
    req.quality = quality(db, session.previewId || session.actorId, today);
    req.masters = masters(db, session.previewId || session.actorId, today);
    req.foundations = foundations(db, session.previewId || session.actorId, today);
    req.procurement = procurement(db, session.previewId || session.actorId, today);
    next();
  });
  app.get('/api/commercial/options',(req,res)=>res.json(req.commercial.options(req.query.company,req.query.project||null)));
  app.get('/api/commercial/report',(req,res)=>res.json(req.commercial.report(req.query.company,{project:req.query.project||null,state:req.query.state||'all',from:req.query.from||null,to:req.query.to||null})));
  app.get('/api/commercial/offers/:id',(req,res)=>res.json(req.commercial.detail(req.params.id)));
  app.get('/api/commercial/offers/:id/allocations',(req,res)=>res.json(req.commercial.allocationOptions(req.params.id,req.query.project)));
  app.post('/api/commercial/offers',(req,res)=>res.status(201).json(req.commercial.save(null,req.body)));
  app.put('/api/commercial/offers/:id',(req,res)=>res.json(req.commercial.save(req.params.id,req.body)));
  app.post('/api/commercial/offers/:id/decision',(req,res)=>res.json(req.commercial.decide(req.params.id,req.body)));
  app.post('/api/commercial/offers/:id/revision',(req,res)=>res.status(201).json(req.commercial.revise(req.params.id,req.body)));
  app.post('/api/commercial/acceptances',(req,res)=>res.status(201).json(req.commercial.recordAcceptance(req.body.offer_id,req.body)));
  app.post('/api/commercial/acceptances/:id/decision',(req,res)=>res.json(req.commercial.decideAcceptance(req.params.id,req.body)));
  app.get('/api/commercial/evidence/:id',(req,res)=>{const f=req.commercial.download(req.params.id);res.set({'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="acceptance-evidence"; filename*=UTF-8''${encodeURIComponent(f.filename)}`,'X-Content-SHA256':f.sha256});res.send(Buffer.from(f.bytes));});
  app.get('/api/commercial/contracts/:id',(req,res)=>res.json(req.commercial.contract(req.params.id)));
  app.get('/api/boq-intakes',(req,res)=>res.json(req.boqIntake.list(req.query.company,req.query.project||null)));
  app.get('/api/boq-intakes/options/:estimate',(req,res)=>res.json(req.boqIntake.options(req.params.estimate)));
  app.post('/api/boq-intakes/upload',(req,res)=>res.status(201).json(req.boqIntake.upload(req.body.estimate_id,req.body)));
  app.get('/api/boq-intakes/:id',(req,res)=>res.json(req.boqIntake.detail(req.params.id)));
  app.post('/api/boq-intakes/:id/check',(req,res)=>res.json(req.boqIntake.check(req.params.id,req.body)));
  app.post('/api/boq-intakes/:id/decision',(req,res)=>res.json(req.boqIntake.decide(req.params.id,req.body)));
  app.post('/api/boq-intakes/:id/commit',(req,res)=>res.json(req.boqIntake.commit(req.params.id,req.body)));
  app.get('/api/boq-intakes/:id/checks/:check',(req,res)=>res.json(req.boqIntake.previousCheck(req.params.id,req.params.check)));
  app.get('/api/boq-files/:id',(req,res)=>{const f=req.boqIntake.download(req.params.id);res.set({'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="BOQ-source.${/\.xlsx$/i.test(f.filename)?'xlsx':'csv'}"; filename*=UTF-8''${encodeURIComponent(f.filename)}`,'X-Content-SHA256':f.sha256});res.send(Buffer.from(f.bytes));});
  app.get('/api/estimates/options',(req,res)=>res.json(req.estimates.options(req.query.company,req.query.project||null)));
  app.get('/api/estimates/report',(req,res)=>res.json(req.estimates.report(req.query.company,{project:req.query.project||null,state:req.query.state||'all'})));
  app.get('/api/estimates/documents',(req,res)=>res.json(req.estimates.list(req.query.company,req.query.project||null)));
  app.get('/api/estimates/documents/:id',(req,res)=>res.json(req.estimates.detail(req.params.id)));
  app.get('/api/estimates/documents/:id/compare',(req,res)=>res.json(req.estimates.compare(req.params.id,req.query.from)));
  app.post('/api/estimates/documents',(req,res)=>res.status(201).json(req.estimates.save(null,req.body)));
  app.put('/api/estimates/documents/:id',(req,res)=>res.json(req.estimates.save(req.params.id,req.body)));
  app.post('/api/estimates/documents/:id/decision',(req,res)=>res.json(req.estimates.decide(req.params.id,req.body)));
  app.post('/api/estimates/documents/:id/revision',(req,res)=>res.status(201).json(req.estimates.revise(req.params.id,req.body)));
  app.post('/api/estimates/documents/:id/handover',(req,res)=>res.json(req.estimates.handover(req.params.id,req.body)));
  app.get('/api/payments/options',(req,res)=>res.json(req.payments.options(req.query.company,req.query.project||null)));
  app.get('/api/payments/report',(req,res)=>res.json(req.payments.report(req.query.company,{project:req.query.project||null,to:req.query.to||undefined})));
  app.get('/api/payments/documents',(req,res)=>res.json(req.payments.list(req.query.company,req.query.project||null)));
  app.get('/api/payments/documents/:id',(req,res)=>res.json(req.payments.detail(req.params.id)));
  app.post('/api/payments/documents',(req,res)=>res.status(201).json(req.payments.save(null,req.body)));
  app.put('/api/payments/documents/:id',(req,res)=>res.json(req.payments.save(req.params.id,req.body)));
  app.post('/api/payments/documents/:id/decision',(req,res)=>res.json(req.payments.decide(req.params.id,req.body)));
  app.post('/api/payments/documents/:id/reversal',(req,res)=>res.status(201).json(req.payments.reverse(req.params.id,req.body)));
  app.post('/api/payments/banks',(req,res)=>res.status(201).json(req.payments.bank(null,req.body)));
  app.put('/api/payments/banks/:id',(req,res)=>res.json(req.payments.bank(req.params.id,req.body)));
  app.get('/api/payments/statements',(req,res)=>res.json(req.payments.statements(req.query.company)));
  app.post('/api/payments/statements/:id/void',(req,res)=>res.json(req.payments.voidStatement(req.params.id,req.body)));
  app.post('/api/payments/statements',(req,res)=>res.status(201).json(req.payments.statement(req.body)));
  app.post('/api/payments/statement-rows/:id/decision',(req,res)=>res.json(req.payments.match(req.params.id,req.body)));
  app.get('/api/payables/options', (req,res)=>res.json(req.payables.options(req.query.company,req.query.project||null)));
  app.get('/api/payables/sources', (req,res)=>res.json(req.payables.sources(req.query.company,req.query.project||null)));
  app.get('/api/payables/report', (req,res)=>res.json(req.payables.report(req.query.company,{project:req.query.project||null,to:req.query.to||undefined})));
  app.get('/api/payables/documents', (req,res)=>res.json(req.payables.list(req.query.company,req.query.project||null)));
  app.get('/api/payables/documents/:id', (req,res)=>res.json(req.payables.detail(req.params.id)));
  app.post('/api/payables/documents', (req,res)=>res.status(201).json(req.payables.save(null,req.body)));
  app.put('/api/payables/documents/:id', (req,res)=>res.json(req.payables.save(req.params.id,req.body)));
  app.post('/api/payables/documents/:id/decision', (req,res)=>res.json(req.payables.decide(req.params.id,req.body)));
  app.put('/api/payables/settings/:company', (req,res)=>res.json(req.payables.settings(req.params.company,req.body)));
  app.post('/api/payables/taxes', (req,res)=>res.status(201).json(req.payables.tax(null,req.body)));
  app.put('/api/payables/taxes/:id', (req,res)=>res.json(req.payables.tax(req.params.id,req.body)));
  app.get('/api/ledger/options', (req, res) => res.json(req.ledger.options(req.query.company, req.query.project || null)));
  app.get('/api/ledger/report', (req, res) => res.json(req.ledger.report(req.query.company, {
    project: req.query.project || null,
    from: req.query.from || undefined,
    to: req.query.to || undefined,
    account: req.query.account || null
  })));
  app.get('/api/ledger/entries', (req, res) => res.json(req.ledger.list(req.query.company, req.query.project || null)));
  app.get('/api/ledger/entries/:id', (req, res) => res.json(req.ledger.detail(req.params.id)));
  app.post('/api/ledger/entries', (req, res) => res.status(201).json(req.ledger.save(null, req.body)));
  app.put('/api/ledger/entries/:id', (req, res) => res.json(req.ledger.save(req.params.id, req.body)));
  app.post('/api/ledger/entries/:id/decision', (req, res) => res.json(req.ledger.decide(req.params.id, req.body)));
  app.post('/api/ledger/entries/:id/reversal', (req, res) => res.status(201).json(req.ledger.reverse(req.params.id, req.body)));
  app.post('/api/ledger/accounts', (req, res) => res.status(201).json(req.ledger.account(null, req.body)));
  app.put('/api/ledger/accounts/:id', (req, res) => res.json(req.ledger.account(req.params.id, req.body)));
  app.post('/api/ledger/periods', (req, res) => res.status(201).json(req.ledger.period(req.body)));
  app.post('/api/ledger/periods/:id/decision', (req, res) => res.json(req.ledger.periodDecision(req.params.id, req.body)));
  app.get('/api/bootstrap', (req, res) => res.json({
    ...req.service.bootstrap(),
    mode: req.realIdentity ? 'local' : 'local-sample',
    preview: req.session.previewId ? {
      name: policy(db, req.session.actorId).actor().name
    } : null
  }));
  app.get('/api/access', (req, res) => {
    const data = accessAdmin(db, req.session.previewId || req.session.actorId).list();
    res.json({
      ...data,
      identity_mode: auth.mode(),
      users: data.users.map(e => ({
        ...e,
        identity: auth.userSummary(e.user.id)
      }))
    });
  });
  app.put('/api/access/users/:id', (req, res) => {
    if (req.realIdentity) auth.requireRecent(req.session);
    res.json(accessAdmin(db, req.session.actorId).save(req.params.id, req.body));
  });
  app.post('/api/access/preview', (req, res) => {
    accessAdmin(db, req.session.actorId).list();
    if (req.body.user_id) policy(db, req.body.user_id).actor();
    if (req.realIdentity) auth.setPreview(req.session, req.body.user_id);else req.session.previewId = req.body.user_id || null;
    res.json({
      ok: true
    });
  });
  app.post('/api/logout', (req, res) => {
    if (req.realIdentity) auth.logout(req.session);else sessions.delete(req.sessionToken);
    clearSession(res);
    res.json({
      ok: true
    });
  });
  const realOnly = (req, res, next) => {
    if (!req.realIdentity) return res.status(403).json({
      error: 'Set up individual sign-in before managing credentials.'
    });
    next();
  };
  app.get('/api/auth/profile', realOnly, (req, res) => res.json(auth.profile(req.session)));
  app.post('/api/auth/reauthenticate', realOnly, asyncRoute(async (req, res) => res.json(await auth.reauthenticate(req.session, req.body))));
  app.post('/api/auth/password', realOnly, asyncRoute(async (req, res) => {
    const result = await auth.changePassword(req.session, req.body);
    clearSession(res);
    res.json(result);
  }));
  app.post('/api/auth/recovery-codes', realOnly, (req, res) => res.json(auth.replaceRecovery(req.session)));
  app.post('/api/auth/sessions/:id/revoke', realOnly, (req, res) => {
    const result = auth.revokeSession(req.session, req.params.id);
    if (result.current) clearSession(res);
    res.json(result);
  });
  app.post('/api/access/accounts', realOnly, (req, res) => res.status(201).json(auth.provision(req.session, req.body)));
  app.post('/api/access/accounts/:id/activation', realOnly, (req, res) => res.json(auth.issueActivation(req.session, req.params.id, req.body)));
  app.post('/api/access/accounts/:id/administration', realOnly, (req, res) => res.json(auth.administrativeAuthority(req.session, req.params.id, req.body)));
  app.get('/api/access/security-events', realOnly, (req, res) => res.json(auth.securityEvents(req.session)));
  app.get('/api/workspace', (req, res) => res.json(req.service.workspace(req.query.company, req.query.project || null)));
  app.get('/api/reports/cost', (req, res) => res.json(req.service.report(req.query.company, req.query.project || null)));
  app.get('/api/search', (req, res) => res.json(req.service.search(req.query.company, req.query.q || '')));
  app.get('/api/records/:id', (req, res) => res.json(req.service.record(req.params.id)));
  app.get('/api/requests/:id', (req, res) => res.json(req.service.getRequest(req.params.id)));
  app.post('/api/requests/preview', (req, res) => res.json(req.service.preview(req.body)));
  app.post('/api/requests', (req, res) => res.status(201).json(req.service.create(req.body)));
  app.put('/api/requests/:id', (req, res) => res.json(req.service.update(req.params.id, req.body)));
  app.post('/api/requests/:id/decision', (req, res) => res.json(req.service.decide(req.params.id, req.body)));
  app.get('/api/quality', (req, res) => res.json(req.quality.list(req.query.company, req.query.project || null)));
  app.get('/api/quality/options', (req, res) => res.json(req.quality.options(req.query.company, req.query.project)));
  app.get('/api/quality/report', (req, res) => res.json(req.quality.report(req.query.company, req.query.project || null, {
    state: req.query.state || '',
    severity: req.query.severity || ''
  })));
  app.get('/api/quality/cases/:id', (req, res) => res.json(req.quality.detail(req.params.id)));
  app.post('/api/quality/cases', (req, res) => res.status(201).json(req.quality.save(null, req.body)));
  app.put('/api/quality/cases/:id', (req, res) => res.json(req.quality.save(req.params.id, req.body)));
  app.post('/api/quality/cases/:id/containment', (req, res) => res.json(req.quality.contain(req.params.id, req.body)));
  app.post('/api/quality/cases/:id/plan', (req, res) => res.json(req.quality.plan(req.params.id, req.body)));
  app.post('/api/quality/cases/:id/evidence', (req, res) => res.json(req.quality.attach(req.params.id, req.body)));
  app.post('/api/quality/cases/:id/decision', (req, res) => res.json(req.quality.decide(req.params.id, req.body)));
  app.post('/api/quality/cases/:id/assignment', (req, res) => res.json(req.quality.reassign(req.params.id, req.body)));
  app.post('/api/quality/cases/:id/actions/:action/complete', (req, res) => res.json(req.quality.completeAction(req.params.id, req.params.action, req.body)));
  app.post('/api/quality/cases/:id/actions/:action/assignment', (req, res) => res.json(req.quality.reassignAction(req.params.id, req.params.action, req.body)));
  app.get('/api/quality/evidence/:id', (req, res) => {
    const e = req.quality.download(req.params.id);
    res.set({
      'Content-Type': e.mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(e.filename)}`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Length': String(e.size)
    });
    res.send(Buffer.from(e.content));
  });
  app.get('/api/masters', (req, res) => res.json(req.masters.workspace(req.query.company)));
  app.get('/api/masters/parties/:id', (req, res) => res.json(req.masters.partyDetail(req.query.company, req.params.id)));
  app.post('/api/masters/parties', (req, res) => res.status(201).json(req.masters.saveParty(null, req.body)));
  app.put('/api/masters/parties/:id', (req, res) => res.json(req.masters.saveParty(req.params.id, req.body)));
  app.post('/api/masters/parties/:id/terms', (req, res) => res.json(req.masters.proposeTerms(req.params.id, req.body)));
  app.post('/api/masters/parties/:id/block', (req, res) => res.json(req.masters.blockSupplier(req.params.id, req.body)));
  app.post('/api/masters/terms/:id/decision', (req, res) => res.json(req.masters.decideTerms(req.params.id, req.body)));
  app.get('/api/masters/products/:id', (req, res) => res.json(req.masters.productDetail(req.params.id)));
  app.post('/api/masters/products', (req, res) => res.status(201).json(req.masters.saveProduct(null, req.body)));
  app.put('/api/masters/products/:id', (req, res) => res.json(req.masters.saveProduct(req.params.id, req.body)));
  app.post('/api/masters/products/:id/packs', (req, res) => res.json(req.masters.addPack(req.params.id, req.body)));
  app.put('/api/masters/packs/:id', (req, res) => res.json(req.masters.retirePack(req.params.id, req.body)));
  app.post('/api/masters/categories', (req, res) => res.status(201).json(req.masters.saveCategory(null, req.body)));
  app.put('/api/masters/categories/:id', (req, res) => res.json(req.masters.saveCategory(req.params.id, req.body)));
  app.get('/api/organisation', (req, res) => res.json(req.foundations.organisation()));
  app.post('/api/organisation/companies', (req, res) => res.status(201).json(req.foundations.saveCompany(null, req.body)));
  app.put('/api/organisation/companies/:id', (req, res) => res.json(req.foundations.saveCompany(req.params.id, req.body)));
  app.get('/api/foundations', (req, res) => res.json(req.foundations.workspace(req.query.company, req.query.project || null)));
  app.post('/api/projects', (req, res) => res.status(201).json(req.foundations.saveProject(null, req.body)));
  app.put('/api/projects/:id', (req, res) => res.json(req.foundations.saveProject(req.params.id, req.body)));
  app.get('/api/projects/:id/history', (req, res) => res.json(req.foundations.projectHistory(req.params.id)));
  app.post('/api/locations', (req, res) => res.status(201).json(req.foundations.saveLocation(null, req.body)));
  app.put('/api/locations/:id', (req, res) => res.json(req.foundations.saveLocation(req.params.id, req.body)));
  app.post('/api/work-packages', (req, res) => res.status(201).json(req.foundations.savePackage(null, req.body)));
  app.put('/api/work-packages/:id', (req, res) => res.json(req.foundations.savePackage(req.params.id, req.body)));
  app.post('/api/cost-codes', (req, res) => res.status(201).json(req.foundations.addCostCode(req.body)));
  app.get('/api/budgets/:id', (req, res) => res.json(req.foundations.budgetDetail(req.params.id)));
  app.post('/api/budgets', (req, res) => res.status(201).json(req.foundations.saveBudget(null, req.body)));
  app.put('/api/budgets/:id', (req, res) => res.json(req.foundations.saveBudget(req.params.id, req.body)));
  app.post('/api/budgets/:id/decision', (req, res) => res.json(req.foundations.decideBudget(req.params.id, req.body)));
  app.get('/api/procurement', (req, res) => res.json(req.procurement.workspace(req.query.company, req.query.project || null)));
  app.get('/api/material-requests/:id', (req, res) => res.json(req.procurement.requestDetail(req.params.id)));
  app.post('/api/material-requests', (req, res) => res.status(201).json(req.procurement.createRequest(req.body)));
  app.put('/api/material-requests/:id', (req, res) => res.json(req.procurement.updateRequest(req.params.id, req.body)));
  app.post('/api/material-requests/:id/quotes', (req, res) => res.json(req.procurement.addQuote(req.params.id, req.body)));
  app.post('/api/material-requests/:id/sourcing', (req, res) => res.json(req.procurement.sourcePlan(req.params.id, req.body)));
  app.post('/api/material-requests/:id/decision', (req, res) => res.json(req.procurement.decide(req.params.id, req.body)));
  app.post('/api/material-requests/:id/orders', (req, res) => res.json(req.procurement.issueOrders(req.params.id, req.body)));
  app.get('/api/purchase-orders/:id', (req, res) => res.json(req.procurement.orderDetail(req.params.id)));
  app.post('/api/purchase-orders/:id/receipts', (req, res) => res.json(req.procurement.receive(req.params.id, req.body)));
  app.post('/api/material-receipts/:id/movements', (req, res) => res.json(req.procurement.moveStock(req.params.id, req.body)));
  app.use((error, req, res, next) => {
    if (error.status) return res.status(error.status).json({
      error: error.message,
      ...(error.code === 'session_expired' ? {
        code: 'session_expired'
      } : {}),
      ...(error.status === 428 ? {
        code: 'reauthentication_required'
      } : {})
    });
    console.error('Builder API operation failed:', error.name || 'Error');
    res.status(500).json({
      error: 'The operation could not be completed. No success has been recorded.'
    });
  });
  return app;
}
