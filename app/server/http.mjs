import express from 'express';
import { randomBytes } from 'node:crypto';
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
    if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-jakh-client'] !== 'local-app') return res.status(403).json({
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
    for (const [key, expiry] of sessions) if (expiry <= now) sessions.delete(key);
    if (sessions.size >= 100) return res.status(429).json({
      error: 'Too many local sessions. Restart the local server.'
    });
    sessions.set(token, now + 8 * 60 * 60 * 1000);
    res.setHeader('Set-Cookie', `jakh_local=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`);
    res.json({
      mode: 'local-sample'
    });
  });
  app.use('/api', (req, res, next) => {
    const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('jakh_local='))?.slice(11);
    if (!token || (sessions.get(token) || 0) <= Date.now()) return res.status(401).json({
      error: 'Local session expired. Reload this page.'
    });
    req.service = createService(db, actorId, today);
    next();
  });
  app.get('/api/bootstrap', (req, res) => res.json(req.service.bootstrap()));
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
