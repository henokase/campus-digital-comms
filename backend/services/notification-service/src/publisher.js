const amqplib = require('amqplib');
const crypto = require('node:crypto');

const EXCHANGE_NAME = process.env.EVENTS_EXCHANGE || 'cdcp.events';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function buildEnvelope({ eventType, data }) {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    producer: 'notification-service',
    data,
  };
}

async function connectRabbitWithRetry(url, { attempts = 30 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await amqplib.connect(url);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, Math.min(250 * attempt, 3000)));
    }
  }
  throw lastErr || new Error('Failed to connect to RabbitMQ');
}

async function createPublisher() {
  const url = requireEnv('RABBITMQ_URL');
  const conn = await connectRabbitWithRetry(url);
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

  async function publish({ routingKey, message }) {
    const ok = ch.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)), {
      contentType: 'application/json',
      persistent: true,
    });
    if (!ok) {
      await new Promise((r) => setImmediate(r));
    }
  }

  return {
    async publishNotificationSent({ notification }) {
      const envelope = buildEnvelope({
        eventType: 'notification.sent',
        data: {
          notificationId: notification.id,
          announcementId: notification.announcementId,
          userId: notification.userId,
          channel: notification.channel,
          status: notification.status,
          sentAt: notification.sentAt,
          sourceEventId: notification.sourceEventId,
        },
      });
      await publish({ routingKey: envelope.eventType, message: envelope });
      return envelope;
    },

    async publishNotificationFailed({ notification, errorMessage }) {
      const envelope = buildEnvelope({
        eventType: 'notification.failed',
        data: {
          notificationId: notification.id,
          announcementId: notification.announcementId,
          userId: notification.userId,
          channel: notification.channel,
          status: notification.status,
          errorMessage: errorMessage ?? notification.errorMessage ?? null,
          sourceEventId: notification.sourceEventId,
        },
      });
      await publish({ routingKey: envelope.eventType, message: envelope });
      return envelope;
    },

    async publishNotificationRead({ notification }) {
      const envelope = buildEnvelope({
        eventType: 'notification.read',
        data: {
          notificationId: notification.id,
          announcementId: notification.announcementId,
          userId: notification.userId,
          channel: notification.channel,
          readAt: notification.readAt,
          sourceEventId: notification.sourceEventId,
        },
      });
      await publish({ routingKey: envelope.eventType, message: envelope });
      return envelope;
    },

    async close() {
      await ch.close();
      await conn.close();
    },

    exchange: EXCHANGE_NAME,
  };
}

module.exports = { createPublisher, buildEnvelope, EXCHANGE_NAME };
