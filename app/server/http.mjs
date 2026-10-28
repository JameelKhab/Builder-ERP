import express from 'express';
import { randomBytes } from 'node:crypto';
import { accessAdmin } from './access-admin.mjs';
import { policy } from './access.mjs';
import { createService } from './service.mjs';

// Local sample identity is deliberately injected by the server, never selected by an HTTP header.
// Replace this adapter with an identity provider before any multi-user or production release.
export function createApi(db, {
  actorId = 'ahmed',
  today,
  origin = 'http://127.0.0.1:4173'
} = {}) {
  const app = express(),
    sessions = new Map();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
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
  app.post('/api/local-session', (req, res) => {
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
    const session = sessions.get(token);
    if (!session || session.expires <= Date.now()) return res.status(401).json({
      error: 'Local session expired. Reload this page.'
    });
    const current = policy(db, session.actorId).actor();
    if (current.access_version !== session.version) {
      sessions.delete(token);
      return res.status(401).json({
        error: 'Your access has changed. Reload to start a fresh local session.'
      });
    }
    req.session = session;
    req.sessionToken = token;
    if (session.previewId && req.method !== 'GET' && !['/api/access/preview', '/api/logout'].includes(req.originalUrl)) return res.status(403).json({
      error: 'Access preview is read only. Return to your workspace to make changes.'
    });
    req.service = createService(db, session.previewId || session.actorId, today);
    next();
  });
  app.get('/api/bootstrap', (req, res) => res.json({
    ...req.service.bootstrap(),
    preview: req.session.previewId ? {
      name: policy(db, req.session.actorId).actor().name
    } : null
  }));
  app.get('/api/access', (req, res) => res.json(accessAdmin(db, req.session.previewId || req.session.actorId).list()));
  app.put('/api/access/users/:id', (req, res) => res.json(accessAdmin(db, req.session.actorId).save(req.params.id, req.body)));
  app.post('/api/access/preview', (req, res) => {
    accessAdmin(db, req.session.actorId).list();
    if (req.body.user_id) policy(db, req.body.user_id).actor();
    req.session.previewId = req.body.user_id || null;
    res.json({
      ok: true
    });
  });
  app.post('/api/logout', (req, res) => {
    sessions.delete(req.sessionToken);
    res.setHeader('Set-Cookie', 'builder_local=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');
    res.json({
      ok: true
    });
  });
  app.get('/api/workspace', (req, res) => res.json(req.service.workspace(req.query.company, req.query.project || null)));
  app.get('/api/reports/cost', (req, res) => res.json(req.service.report(req.query.company, req.query.project || null)));
  app.get('/api/search', (req, res) => res.json(req.service.search(req.query.company, req.query.q || '')));
  app.get('/api/records/:id', (req, res) => res.json(req.service.record(req.params.id)));
  app.get('/api/requests/:id', (req, res) => res.json(req.service.getRequest(req.params.id)));
  app.post('/api/requests/preview', (req, res) => res.json(req.service.preview(req.body)));
  app.post('/api/requests', (req, res) => res.status(201).json(req.service.create(req.body)));
  app.put('/api/requests/:id', (req, res) => res.json(req.service.update(req.params.id, req.body)));
  app.post('/api/requests/:id/decision', (req, res) => res.json(req.service.decide(req.params.id, req.body)));
  app.use((error, req, res, next) => {
    if (error.status) return res.status(error.status).json({
      error: error.message
    });
    console.error(error);
    res.status(500).json({
      error: 'The operation could not be completed. No success has been recorded.'
    });
  });
  return app;
}
