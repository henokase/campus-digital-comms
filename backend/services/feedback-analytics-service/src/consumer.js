const amqplib = require('amqplib');

const EXCHANGE_NAME = process.env.EVENTS_EXCHANGE || 'cdcp.events';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
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

async function createConsumer({ queueName = 'feedback-analytics-service.q', bindings, onMessage }) {
  if (!Array.isArray(bindings) || bindings.length === 0) throw new Error('bindings are required');
  if (!onMessage) throw new Error('onMessage is required');

  const url = requireEnv('RABBITMQ_URL');
  const conn = await connectRabbitWithRetry(url);
  const ch = await conn.createChannel();

  await ch.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
  const q = await ch.assertQueue(queueName, { durable: true });

  for (const rk of bindings) {
    await ch.bindQueue(q.queue, EXCHANGE_NAME, rk);
  }

  await ch.prefetch(25);

  const consumerTag = (await ch.consume(
    q.queue,
    async (msg) => {
      if (!msg) return;
      try {
        const text = msg.content.toString('utf8');
        const json = JSON.parse(text);
        await onMessage({ envelope: json, raw: msg });
        ch.ack(msg);
      } catch (_err) {
        ch.nack(msg, false, true);
      }
    },
    { noAck: false }
  )).consumerTag;

  return {
    queue: q.queue,
    async close() {
      await ch.cancel(consumerTag).catch(() => undefined);
      await ch.close();
      await conn.close();
    },
  };
}

module.exports = { createConsumer, EXCHANGE_NAME };
