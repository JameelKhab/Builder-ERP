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
    req.foundations = foundations(db, session.previewId || session.actorId, today);
    req.procurement = procurement(db, session.previewId || session.actorId, today);
    next();
  });
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
