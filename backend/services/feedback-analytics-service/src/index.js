const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { createPool, waitForDb } = require('./db');
const { createPublisher } = require('./publisher');
const { createConsumer } = require('./consumer');
const {
  isValidUuid,
  insertFeedback,
  updateFeedback,
  listMyFeedback,
  listAnnouncementFeedback,
  handleAnalyticsEvent,
  getAnnouncementMetrics,
  getDashboardMetrics,
  getTopAnnouncementsByFeedback,
} = require('./service');

function sendError(res, status, code, message, details) {
  res.status(status).json({
    error: {
      code,
      message,
      details: details ?? undefined,
    },
  });
}

function requireUserId(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId || typeof userId !== 'string') {
    sendError(res, 401, 'UNAUTHORIZED', 'Missing x-user-id header (expected from API Gateway).');
    return null;
  }
  if (!isValidUuid(userId)) {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid x-user-id header.');
    return null;
  }
  return userId;
}

function requireAdminOrFaculty(req, res) {
  const role = req.headers['x-user-role'];
  if (role !== 'admin' && role !== 'faculty') {
    sendError(res, 403, 'FORBIDDEN', 'Admin or faculty role required.');
    return null;
  }
  return role;
}

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const pool = createPool();
  await waitForDb(pool, { attempts: 60, delayMs: 500 });

  const publisher = await createPublisher();

  const consumer = await createConsumer({
    bindings: ['notification.sent', 'notification.read', 'feedback.submitted', 'feedback.updated'],
    onMessage: async ({ envelope }) => {
      await handleAnalyticsEvent({ pool, envelope });
    },
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'feedback-analytics-service', queue: consumer.queue });
  });

  // Feedback (any authenticated user)
  app.post('/api/feedback', async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const { announcementId, reactionType, comment, rating, isAnonymous } = req.body || {};
      if (!isValidUuid(announcementId)) {
        return sendError(res, 400, 'INVALID_ID', 'Invalid announcementId.');
      }
      if (!reactionType || typeof reactionType !== 'string') {
        return sendError(res, 400, 'INVALID_BODY', 'reactionType is required.');
      }
      if (rating !== undefined && rating !== null) {
        const n = Number(rating);
        if (!Number.isInteger(n) || n < 1 || n > 5) {
          return sendError(res, 400, 'INVALID_BODY', 'rating must be an integer between 1 and 5.');
        }
      }
      if (comment !== undefined && comment !== null && typeof comment !== 'string') {
        return sendError(res, 400, 'INVALID_BODY', 'comment must be a string.');
      }

      const feedback = await insertFeedback(pool, {
        announcementId,
        userId,
        reactionType,
        comment,
        rating,
        isAnonymous,
      });

      await publisher.publishFeedbackSubmitted({ feedback });
      return res.status(201).json({ feedback });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.patch('/api/feedback/:id', async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const { id } = req.params;
      if (!isValidUuid(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Invalid feedback id.');
      }

      const patch = req.body || {};
      if (patch.reactionType !== undefined && typeof patch.reactionType !== 'string') {
        return sendError(res, 400, 'INVALID_BODY', 'reactionType must be a string.');
      }
      if (patch.comment !== undefined && patch.comment !== null && typeof patch.comment !== 'string') {
        return sendError(res, 400, 'INVALID_BODY', 'comment must be a string.');
      }
      if (patch.rating !== undefined && patch.rating !== null) {
        const n = Number(patch.rating);
        if (!Number.isInteger(n) || n < 1 || n > 5) {
          return sendError(res, 400, 'INVALID_BODY', 'rating must be an integer between 1 and 5.');
        }
      }

      const feedback = await updateFeedback(pool, { feedbackId: id, userId, patch });
      if (!feedback) {
        return sendError(res, 404, 'NOT_FOUND', 'Feedback not found (or not owned by user).');
      }

      await publisher.publishFeedbackUpdated({ feedback });
      return res.status(200).json({ feedback });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.get('/api/feedback/announcement/:id', async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const { id } = req.params;
      if (!isValidUuid(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Invalid announcement id.');
      }

      const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
      const offset = Math.max(Number(req.query.offset || 0), 0);

      const feedback = await listAnnouncementFeedback(pool, { announcementId: id, limit, offset });
      return res.status(200).json({ feedback, limit, offset });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.get('/api/feedback/my', async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
      const offset = Math.max(Number(req.query.offset || 0), 0);

      const feedback = await listMyFeedback(pool, { userId, limit, offset });
      return res.status(200).json({ feedback, limit, offset });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  // Analytics (admin/faculty only)
  app.get('/api/analytics/dashboard', async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const role = requireAdminOrFaculty(req, res);
      if (!role) return;

      const dashboard = await getDashboardMetrics(pool);
      return res.status(200).json(dashboard);
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.get('/api/analytics/announcement/:id', async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const role = requireAdminOrFaculty(req, res);
      if (!role) return;

      const { id } = req.params;
      if (!isValidUuid(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Invalid announcement id.');
      }

      const metrics = await getAnnouncementMetrics(pool, { announcementId: id });
      return res.status(200).json({ metrics });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.get('/api/analytics/top-announcements', async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const role = requireAdminOrFaculty(req, res);
      if (!role) return;

      const limit = Math.min(Math.max(Number(req.query.limit || 5), 1), 50);
      const items = await getTopAnnouncementsByFeedback(pool, { limit });
      return res.status(200).json({ announcements: items, limit });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  const port = Number(process.env.PORT || 3004);
  const server = app.listen(port, () => {
    console.log(`feedback-analytics-service listening on ${port}`);
  });

  async function shutdown() {
    server.close(() => undefined);
    await consumer.close().catch(() => undefined);
    await publisher.close().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }

  process.on('SIGINT', () => {
    shutdown().finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    shutdown().finally(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
