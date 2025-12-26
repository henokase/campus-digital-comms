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
    producer: 'announcement-service',
    data,
  };
}

async function createPublisher() {
  const url = requireEnv('RABBITMQ_URL');
  const conn = await amqplib.connect(url);
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
    async publishAnnouncementCreated({ announcement }) {
      const envelope = buildEnvelope({
        eventType: 'announcement.created',
        data: {
          announcementId: announcement.id,
          title: announcement.title,
          content: announcement.content,
          type: announcement.type,
          category: announcement.category,
          priority: announcement.priority,
          createdBy: announcement.createdBy,
          targetAudience: announcement.targetAudience,
          publishedAt: announcement.publishedAt,
        },
      });

      await publish({ routingKey: envelope.eventType, message: envelope });
      return envelope;
    },

    async publishAnnouncementUpdated({ announcement }) {
      const envelope = buildEnvelope({
        eventType: 'announcement.updated',
        data: {
          announcementId: announcement.id,
          title: announcement.title,
          content: announcement.content,
          type: announcement.type,
          category: announcement.category,
          priority: announcement.priority,
          createdBy: announcement.createdBy,
          targetAudience: announcement.targetAudience,
          status: announcement.status,
          publishedAt: announcement.publishedAt,
        },
      });

      await publish({ routingKey: envelope.eventType, message: envelope });
      return envelope;
    },

    async publishAnnouncementDeleted({ announcement }) {
      const envelope = buildEnvelope({
        eventType: 'announcement.deleted',
        data: {
          announcementId: announcement.id,
          title: announcement.title,
          content: announcement.content,
          type: announcement.type,
          category: announcement.category,
          priority: announcement.priority,
          createdBy: announcement.createdBy,
          targetAudience: announcement.targetAudience,
          status: announcement.status,
          publishedAt: announcement.publishedAt,
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
