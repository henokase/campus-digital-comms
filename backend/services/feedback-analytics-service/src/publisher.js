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
    producer: 'feedback-analytics-service',
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
    async publishFeedbackSubmitted({ feedback }) {
      const envelope = buildEnvelope({
        eventType: 'feedback.submitted',
        data: {
          feedbackId: feedback.id,
          announcementId: feedback.announcementId,
          userId: feedback.userId,
          reactionType: feedback.reactionType,
          comment: feedback.comment ?? null,
          rating: feedback.rating ?? null,
          isAnonymous: Boolean(feedback.isAnonymous),
          createdAt: feedback.createdAt,
          updatedAt: feedback.updatedAt,
        },
      });
      await publish({ routingKey: envelope.eventType, message: envelope });
      return envelope;
    },

    async publishFeedbackUpdated({ feedback }) {
      const envelope = buildEnvelope({
        eventType: 'feedback.updated',
        data: {
          feedbackId: feedback.id,
          announcementId: feedback.announcementId,
          userId: feedback.userId,
          reactionType: feedback.reactionType,
          comment: feedback.comment ?? null,
          rating: feedback.rating ?? null,
          isAnonymous: Boolean(feedback.isAnonymous),
          createdAt: feedback.createdAt,
          updatedAt: feedback.updatedAt,
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
