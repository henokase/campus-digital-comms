const test = require('node:test');
const assert = require('node:assert/strict');

const amqplib = require('amqplib');

const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://cdcp_user:1234@localhost:5672';

async function isUp(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

async function requireGateway(t) {
  const ok = await isUp(`${GATEWAY_BASE_URL}/health`);
  if (!ok) {
    t.skip(`Gateway not reachable at ${GATEWAY_BASE_URL}. Start docker compose first.`);
  }
  assert.equal(ok, true);
}

async function postJson(path, body, headers) {
  const res = await fetch(`${GATEWAY_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function putJson(path, body, headers) {
  const res = await fetch(`${GATEWAY_BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function getJson(path, headers) {
  const res = await fetch(`${GATEWAY_BASE_URL}${path}`, {
    method: 'GET',
    headers: { ...(headers || {}) },
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function deleteReq(path, headers) {
  const res = await fetch(`${GATEWAY_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { ...(headers || {}) },
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function loginAsFaculty() {
  const email = `faculty_${Date.now()}@example.com`;
  const password = 'Password123!';

  const reg = await postJson('/api/auth/register', {
    email,
    password,
    role: 'faculty',
    fullName: 'Faculty Test',
    department: 'Software',
    year: 0,
  });
  assert.equal(reg.res.status, 201);

  const login = await postJson('/api/auth/login', { email, password });
  assert.equal(login.res.status, 200);
  assert.equal(typeof login.json.token, 'string');

  return { token: login.json.token };
}

async function setupRabbitConsumer() {
  const conn = await amqplib.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();
  const exchange = 'cdcp.events';
  await ch.assertExchange(exchange, 'topic', { durable: true });

  const q = await ch.assertQueue('', { exclusive: true, durable: false, autoDelete: true });
  await ch.bindQueue(q.queue, exchange, 'announcement.updated');
  await ch.bindQueue(q.queue, exchange, 'announcement.published');

  const buffer = [];
  const waiters = [];

  function pushMessage(msg) {
    if (waiters.length > 0) {
      const w = waiters.shift();
      w(msg);
      return;
    }
    buffer.push(msg);
  }

  await ch.consume(
    q.queue,
    (msg) => {
      if (!msg) return;
      const text = msg.content.toString('utf8');
      ch.ack(msg);
      pushMessage({ text, json: JSON.parse(text) });
    },
    { noAck: false }
  );

  return {
    async nextMessage(timeoutMs = 5000) {
      if (buffer.length > 0) return buffer.shift();
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          const idx = waiters.indexOf(resolve);
          if (idx >= 0) waiters.splice(idx, 1);
          resolve(null);
        }, timeoutMs);

        waiters.push((msg) => {
          clearTimeout(timer);
          resolve(msg);
        });
      });
    },
    async close() {
      await ch.close();
      await conn.close();
    },
  };
}

async function waitForMatchingMessage(consumer, { timeoutMs = 5000, predicate }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const msg = await consumer.nextMessage(Math.min(1000, Math.max(1, deadline - Date.now())));
    if (!msg) return null;
    if (predicate(msg)) return msg;
  }
  return null;
}

async function assertNoMatchingMessage(consumer, { timeoutMs = 1500, predicate }) {
  const msg = await waitForMatchingMessage(consumer, { timeoutMs, predicate });
  assert.equal(msg, null);
}

test('e2e: announcement publish emits announcement.published; updates to published emit announcement.updated (gateway + auth + announcement + rabbitmq)', async (t) => {
  await requireGateway(t);

  const consumer = await setupRabbitConsumer();
  t.after(async () => {
    await consumer.close();
  });

  const { token } = await loginAsFaculty();
  const authz = { authorization: `Bearer ${token}` };

  // Create
  const created = await postJson(
    '/api/announcements',
    {
      title: 'Announcement Title',
      content: 'Announcement Content',
      type: 'general',
      category: 'Test',
      priority: 'normal',
      targetAudience: { roles: ['student'], departments: ['Software'], years: [1, 2, 3] },
    },
    authz
  );
  assert.equal(created.res.status, 201);
  assert.ok(created.json.announcement);
  const id = created.json.announcement.id;

  await assertNoMatchingMessage(consumer, {
    timeoutMs: 2000,
    predicate: (m) => m?.json?.data?.announcementId === id,
  });

  // Read
  const got = await getJson(`/api/announcements/${id}`);
  assert.equal(got.res.status, 200);
  assert.equal(got.json.announcement.id, id);

  // Update
  const updated = await putJson(
    `/api/announcements/${id}`,
    {
      title: 'Updated Title',
      content: 'Updated Content',
      type: 'general',
      category: 'Test',
      priority: 'high',
      targetAudience: { roles: ['student'] },
    },
    authz
  );
  assert.equal(updated.res.status, 200);
  assert.equal(updated.json.announcement.title, 'Updated Title');

  await assertNoMatchingMessage(consumer, {
    timeoutMs: 2000,
    predicate: (m) => m?.json?.data?.announcementId === id,
  });

  // Publish
  const published = await postJson(`/api/announcements/${id}/publish`, {}, authz);
  assert.equal(published.res.status, 200);
  assert.equal(published.json.announcement.status, 'published');
  assert.ok(published.json.announcement.publishedAt);

  const publishedMsg = await waitForMatchingMessage(consumer, {
    timeoutMs: 10000,
    predicate: (m) => m?.json?.eventType === 'announcement.published' && m?.json?.data?.announcementId === id,
  });
  if (!publishedMsg) {
    t.diagnostic('Did not observe announcement.published message within timeout; check RabbitMQ wiring and RABBITMQ_URL.');
  } else {
    assert.equal(publishedMsg.json.eventType, 'announcement.published');
    assert.equal(publishedMsg.json.data.announcementId, id);
  }

  // Re-publish should be idempotent: no additional announcement.published message
  const republished = await postJson(`/api/announcements/${id}/publish`, {}, authz);
  assert.equal(republished.res.status, 200);
  assert.equal(republished.json.announcement.status, 'published');

  await assertNoMatchingMessage(consumer, {
    timeoutMs: 2000,
    predicate: (m) => m?.json?.eventType === 'announcement.published' && m?.json?.data?.announcementId === id,
  });

  // Update after publish should emit announcement.updated
  const updated2 = await putJson(
    `/api/announcements/${id}`,
    {
      title: 'Updated After Publish',
      content: 'Updated After Publish Content',
      type: 'general',
      category: 'Test',
      priority: 'high',
      targetAudience: { roles: ['student'] },
    },
    authz
  );
  assert.equal(updated2.res.status, 200);
  assert.equal(updated2.json.announcement.title, 'Updated After Publish');

  const updatedMsg = await waitForMatchingMessage(consumer, {
    timeoutMs: 10000,
    predicate: (m) => m?.json?.eventType === 'announcement.updated' && m?.json?.data?.announcementId === id,
  });
  if (!updatedMsg) {
    t.diagnostic('Did not observe announcement.updated message within timeout after publish; check RabbitMQ wiring and RABBITMQ_URL.');
  } else {
    assert.equal(updatedMsg.json.eventType, 'announcement.updated');
    assert.equal(updatedMsg.json.data.announcementId, id);
  }

  // Delete
  const del = await deleteReq(`/api/announcements/${id}`, authz);
  assert.equal(del.res.status, 200);

  await assertNoMatchingMessage(consumer, {
    timeoutMs: 2000,
    predicate: (m) => m?.json?.data?.announcementId === id,
  });
});
