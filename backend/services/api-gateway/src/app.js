const express = require('express');
const cors = require('cors');

const { authMiddleware } = require('./middleware/auth');
const { rbacMiddleware } = require('./middleware/rbac');
const { forwardRequest } = require('./forwarder');

function getEnv(name, fallback) {
  const v = process.env[name];
  if (v) return v;
  if (fallback) return fallback;
  throw new Error(`${name} is required`);
}

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'api-gateway' });
  });

  app.use(authMiddleware);
  app.use(rbacMiddleware);

  app.use('/api/auth', (req, res, next) => {
    forwardRequest({ req, res, targetBaseUrl: getEnv('AUTH_SERVICE_URL', 'http://localhost:3001') }).catch(next);
  });

  app.use('/api/announcements', (req, res, next) => {
    forwardRequest({ req, res, targetBaseUrl: getEnv('ANNOUNCEMENT_SERVICE_URL', 'http://localhost:3002') }).catch(next);
  });

  app.use('/api/notifications', (req, res, next) => {
    forwardRequest({ req, res, targetBaseUrl: getEnv('NOTIFICATION_SERVICE_URL', 'http://localhost:3003') }).catch(next);
  });

  app.use('/api/feedback', (req, res, next) => {
    forwardRequest({ req, res, targetBaseUrl: getEnv('FEEDBACK_ANALYTICS_SERVICE_URL', 'http://localhost:3004') }).catch(next);
  });

  app.use('/api/analytics', (req, res, next) => {
    forwardRequest({ req, res, targetBaseUrl: getEnv('FEEDBACK_ANALYTICS_SERVICE_URL', 'http://localhost:3004') }).catch(next);
  });

  app.use((err, _req, res, _next) => {
    res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Upstream request failed.', details: { message: err.message } } });
  });

  return app;
}

module.exports = { createApp };
