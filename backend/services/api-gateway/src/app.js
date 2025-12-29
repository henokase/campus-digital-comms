const express = require('express');
const cors = require('cors');

const { authMiddleware } = require('./middleware/auth');
const { rbacMiddleware } = require('./middleware/rbac');
const { forwardRequest } = require('./forwarder');

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check
 *     responses:
 *       200:
 *         description: OK
 */

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/auth/profile:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get current user's profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/announcements:
 *   get:
 *     tags:
 *       - Announcements
 *     summary: List announcements
 *     responses:
 *       200:
 *         description: OK
 *   post:
 *     tags:
 *       - Announcements
 *     summary: Create announcement
 *     description: Requires role faculty/admin.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAnnouncementRequest'
 *     responses:
 *       201:
 *         description: Created
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Insufficient role
 */

/**
 * @openapi
 * /api/announcements/{id}:
 *   get:
 *     tags:
 *       - Announcements
 *     summary: Get announcement by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not found
 *   put:
 *     tags:
 *       - Announcements
 *     summary: Update announcement
 *     description: Requires role faculty/admin.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAnnouncementRequest'
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Insufficient role
 *   delete:
 *     tags:
 *       - Announcements
 *     summary: Delete announcement
 *     description: Requires role faculty/admin.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Insufficient role
 */

/**
 * @openapi
 * /api/announcements/{id}/publish:
 *   post:
 *     tags:
 *       - Announcements
 *     summary: Publish announcement
 *     description: Requires role faculty/admin.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Insufficient role
 *       404:
 *         description: Not found
 */

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: List notifications for current user
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 */

/**
 * @openapi
 * /api/notifications/unread-count:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get unread notification count
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 */

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   put:
 *     tags:
 *       - Notifications
 *     summary: Mark a notification as read
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 *       404:
 *         description: Not found
 */

/**
 * @openapi
 * /api/feedback:
 *   post:
 *     tags:
 *       - Feedback
 *     summary: Submit feedback for an announcement
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFeedbackRequest'
 *     responses:
 *       201:
 *         description: Created
 *       401:
 *         description: Missing or invalid token
 */

/**
 * @openapi
 * /api/feedback/{id}:
 *   patch:
 *     tags:
 *       - Feedback
 *     summary: Update feedback
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateFeedbackRequest'
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 */

/**
 * @openapi
 * /api/feedback/my:
 *   get:
 *     tags:
 *       - Feedback
 *     summary: List current user's feedback
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 */

/**
 * @openapi
 * /api/feedback/announcement/{announcementId}:
 *   get:
 *     tags:
 *       - Feedback
 *     summary: List feedback for an announcement
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: announcementId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 */

/**
 * @openapi
 * /api/analytics/dashboard:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Analytics dashboard
 *     description: Requires role faculty/admin.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalyticsDashboard'
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Insufficient role
 */

/**
 * @openapi
 * /api/analytics/announcement/{announcementId}:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Metrics for a specific announcement
 *     description: Requires role faculty/admin.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: announcementId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Insufficient role
 */

/**
 * @openapi
 * /api/analytics/top-announcements:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Top announcements by engagement
 *     description: Requires role faculty/admin.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Insufficient role
 */

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

  if (process.env.NODE_ENV !== 'production') {
    const swaggerUi = require('swagger-ui-express');
    const { buildSwaggerSpec } = require('./swagger');
    const swaggerSpec = buildSwaggerSpec();

    app.get('/api-docs.json', (_req, res) => {
      res.json(swaggerSpec);
    });

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
  }

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
