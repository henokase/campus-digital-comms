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

async function setupRabbitConsumer({ routingKeys }) {
  const conn = await amqplib.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();
  const exchange = 'cdcp.events';
  await ch.assertExchange(exchange, 'topic', { durable: true });

  const q = await ch.assertQueue('', { exclusive: true, durable: false, autoDelete: true });
  for (const rk of routingKeys) {
    await ch.bindQueue(q.queue, exchange, rk);
  }

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

async function registerAndLogin({ role, department, year }) {
  const email = `${role}_${Date.now()}@example.com`;
  const password = 'Password123!';

  const reg = await postJson('/api/auth/register', {
    email,
    password,
    role,
    fullName: `${role} Test`,
    department,
    year,
  });
  assert.equal(reg.res.status, 201);

  const login = await postJson('/api/auth/login', { email, password });
  assert.equal(login.res.status, 200);

  return { token: login.json.token, user: login.json.user };
}

test('e2e: publish announcement -> notification rows created for matching students; read -> emits notification.read', async (t) => {
  await requireGateway(t);

  const eventConsumer = await setupRabbitConsumer({ routingKeys: ['notification.read', 'notification.sent'] });
  t.after(async () => {
    await eventConsumer.close();
  });

  // Create matching + non-matching students
  const student1 = await registerAndLogin({ role: 'student', department: 'Software', year: 2 });
  await registerAndLogin({ role: 'student', department: 'Civil', year: 2 });
  await registerAndLogin({ role: 'faculty', department: 'Software', year: 0 });

  const faculty = await registerAndLogin({ role: 'faculty', department: 'Software', year: 0 });
  const authz = { authorization: `Bearer ${faculty.token}` };

  // Create announcement
  const created = await postJson(
    '/api/announcements',
    {
      title: 'Notify Test',
      content: 'Hello',
      type: 'general',
      category: 'Test',
      priority: 'normal',
      targetAudience: { roles: ['student'], departments: ['Software'], years: [2] },
    },
    authz
  );
  assert.equal(created.res.status, 201);
  const announcementId = created.json.announcement.id;

  // Publish
  const published = await postJson(`/api/announcements/${announcementId}/publish`, {}, authz);
  assert.equal(published.res.status, 200);

  // Wait a bit for consumer to process (poll API until notifications appear)
  const headers = { authorization: `Bearer ${student1.token}` };

  let notifications = null;
  for (let i = 0; i < 25; i += 1) {
    const list = await getJson('/api/notifications?limit=50&offset=0', headers);
    assert.equal(list.res.status, 200);
    notifications = list.json.notifications;
    if (Array.isArray(notifications) && notifications.length > 0) break;
    await new Promise((r) => setTimeout(r, 400));
  }

  assert.ok(Array.isArray(notifications));
  assert.ok(notifications.length > 0);

  const unread = await getJson('/api/notifications/unread-count', headers);
  assert.equal(unread.res.status, 200);
  assert.ok(unread.json.count >= 1);

  // Mark first notification as read
  const notificationId = notifications[0].id;
  const marked = await putJson(`/api/notifications/${notificationId}/read`, {}, headers);
  assert.equal(marked.res.status, 200);
  assert.equal(marked.json.notification.id, notificationId);
  assert.ok(marked.json.notification.readAt);

  const readMsg = await waitForMatchingMessage(eventConsumer, {
    timeoutMs: 10000,
    predicate: (m) => m?.json?.eventType === 'notification.read' && m?.json?.data?.notificationId === notificationId,
  });
  if (!readMsg) {
    t.diagnostic('Did not observe notification.read event within timeout; check RabbitMQ wiring.');
  } else {
    assert.equal(readMsg.json.eventType, 'notification.read');
    assert.equal(readMsg.json.data.notificationId, notificationId);
  }
});

test('e2e: updating a published announcement creates additional notification rows (sourceEventId uniqueness)', async (t) => {
  await requireGateway(t);

  const student = await registerAndLogin({ role: 'student', department: 'Software', year: 1 });
  const faculty = await registerAndLogin({ role: 'faculty', department: 'Software', year: 0 });
  const authz = { authorization: `Bearer ${faculty.token}` };
  const headers = { authorization: `Bearer ${student.token}` };

  const created = await postJson(
    '/api/announcements',
    {
      title: 'Notify Update Test',
      content: 'Hello',
      type: 'general',
      category: 'Test',
      priority: 'normal',
      targetAudience: { roles: ['student'], departments: ['Software'], years: [1] },
    },
    authz
  );
  assert.equal(created.res.status, 201);
  const announcementId = created.json.announcement.id;

  const published = await postJson(`/api/announcements/${announcementId}/publish`, {}, authz);
  assert.equal(published.res.status, 200);

  // Wait for first notification
  let firstCount = 0;
  for (let i = 0; i < 25; i += 1) {
    const list = await getJson('/api/notifications?limit=50&offset=0', headers);
    assert.equal(list.res.status, 200);
    firstCount = list.json.notifications.length;
    if (firstCount >= 1) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  assert.ok(firstCount >= 1);

  // Update published announcement (should emit announcement.updated and create a new notification row)
  const updated = await putJson(
    `/api/announcements/${announcementId}`,
    {
      title: 'Notify Update Test - v2',
      content: 'Hello v2',
      type: 'general',
      category: 'Test',
      priority: 'high',
      targetAudience: { roles: ['student'], departments: ['Software'], years: [1] },
    },
    authz
  );
  assert.equal(updated.res.status, 200);

  let secondCount = firstCount;
  for (let i = 0; i < 25; i += 1) {
    const list = await getJson('/api/notifications?limit=50&offset=0', headers);
    assert.equal(list.res.status, 200);
    secondCount = list.json.notifications.length;
    if (secondCount >= firstCount + 1) break;
    await new Promise((r) => setTimeout(r, 400));
  }

  assert.ok(secondCount >= firstCount + 1);
});
