const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { createPool, waitForDb } = require('./db');
const { createPublisher } = require('./publisher');
const { createConsumer } = require('./consumer');
const { isValidUuid, listNotifications, unreadCount, markNotificationRead, handleAnnouncementEvent } = require('./service');

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

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const pool = createPool();
  await waitForDb(pool, { attempts: 60, delayMs: 500 });

  const publisher = await createPublisher();

  const consumer = await createConsumer({
    bindings: ['announcement.published', 'announcement.updated'],
    onMessage: async ({ envelope }) => {
      await handleAnnouncementEvent({ pool, publisher, envelope });
    },
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'notification-service', queue: consumer.queue });
  });

  app.get('/api/notifications', async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
      const offset = Math.max(Number(req.query.offset || 0), 0);

      const notifications = await listNotifications(pool, { userId, limit, offset });
      return res.status(200).json({ notifications, limit, offset });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.get('/api/notifications/unread-count', async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const count = await unreadCount(pool, { userId });
      return res.status(200).json({ count });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.put('/api/notifications/:id/read', async (req, res) => {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const { id } = req.params;
      if (!isValidUuid(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Invalid notification id.');
      }

      const notification = await markNotificationRead(pool, { notificationId: id, userId });
      if (!notification) {
        return sendError(res, 404, 'NOT_FOUND', 'Notification not found.');
      }

      await publisher.publishNotificationRead({ notification });
      return res.status(200).json({ notification });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  const port = Number(process.env.PORT || 3003);
  const server = app.listen(port, () => {
    console.log(`notification-service listening on ${port}`);
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
