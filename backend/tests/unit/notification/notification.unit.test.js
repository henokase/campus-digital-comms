const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isValidUuid,
  handleAnnouncementEvent,
} = require('../../../services/notification-service/src/service');

function makePool({ users = [], processed = new Set() } = {}) {
  const insertedProcessed = [];
  const insertedNotifications = [];

  async function query(sql, params) {
    // idempotency lookup
    if (sql.includes('FROM "notifications"."NotificationProcessedEvent"')) {
      const eventId = params[0];
      if (processed.has(eventId)) return { rowCount: 1, rows: [{ eventId }] };
      return { rowCount: 0, rows: [] };
    }

    // mark processed
    if (sql.startsWith('INSERT INTO "notifications"."NotificationProcessedEvent"')) {
      const [eventId, eventType] = params;
      processed.add(eventId);
      insertedProcessed.push({ eventId, eventType });
      return { rowCount: 1, rows: [] };
    }

    // user matching
    if (sql.includes('FROM "auth"."User"')) {
      // params: [roleFilter, departments, years]
      const departments = params[1];
      const years = params[2];
      const filtered = users.filter((u) => {
        if (u.role !== 'student') return false;
        if (departments && departments.length > 0 && !departments.includes(u.department)) return false;
        if (years && years.length > 0 && !years.includes(u.year)) return false;
        return true;
      });
      return { rowCount: filtered.length, rows: filtered.map((u) => ({ id: u.id })) };
    }

    // create notification
    if (sql.startsWith('INSERT INTO "notifications"."Notification"')) {
      const [announcementId, userId, channel, sourceEventId, status, errorMessage] = params;
      const row = {
        id: `notif_${insertedNotifications.length + 1}`,
        announcementId,
        userId,
        channel,
        sourceEventId,
        status,
        sentAt: status === 'sent' ? new Date().toISOString() : null,
        readAt: null,
        errorMessage: errorMessage ?? null,
      };
      insertedNotifications.push(row);
      return { rowCount: 1, rows: [row] };
    }

    throw new Error(`Unhandled SQL in test double: ${sql}`);
  }

  return { query, __insertedProcessed: insertedProcessed, __insertedNotifications: insertedNotifications };
}

function makePublisher() {
  const sent = [];
  return {
    sent,
    async publishNotificationSent({ notification }) {
      sent.push(notification);
    },
  };
}

test('notification-service unit: isValidUuid', async () => {
  assert.equal(isValidUuid('00000000-0000-0000-0000-000000000000'), true);
  assert.equal(isValidUuid('not-a-uuid'), false);
});

test('notification-service unit: announcement event creates notifications for matching students and marks event processed', async () => {
  const pool = makePool({
    users: [
      { id: '11111111-1111-1111-1111-111111111111', role: 'student', department: 'Software', year: 2 },
      { id: '22222222-2222-2222-2222-222222222222', role: 'student', department: 'Civil', year: 2 },
      { id: '33333333-3333-3333-3333-333333333333', role: 'faculty', department: 'Software', year: 0 },
    ],
  });
  const publisher = makePublisher();

  const envelope = {
    eventId: 'evt_1',
    eventType: 'announcement.published',
    data: {
      announcementId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      targetAudience: { roles: ['student'], departments: ['Software'], years: [2] },
    },
  };

  await handleAnnouncementEvent({ pool, publisher, envelope });

  assert.equal(pool.__insertedNotifications.length, 1);
  assert.equal(pool.__insertedNotifications[0].userId, '11111111-1111-1111-1111-111111111111');
  assert.equal(pool.__insertedNotifications[0].sourceEventId, 'evt_1');

  assert.equal(publisher.sent.length, 1);
  assert.equal(pool.__insertedProcessed.length, 1);
  assert.equal(pool.__insertedProcessed[0].eventId, 'evt_1');
});

test('notification-service unit: idempotency prevents duplicate processing for same eventId', async () => {
  const processed = new Set(['evt_dup']);
  const pool = makePool({ users: [{ id: '11111111-1111-1111-1111-111111111111', role: 'student', department: 'Software', year: 2 }], processed });
  const publisher = makePublisher();

  const envelope = {
    eventId: 'evt_dup',
    eventType: 'announcement.updated',
    data: {
      announcementId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      targetAudience: { roles: ['student'] },
    },
  };

  await handleAnnouncementEvent({ pool, publisher, envelope });

  assert.equal(pool.__insertedNotifications.length, 0);
  assert.equal(publisher.sent.length, 0);
  assert.equal(pool.__insertedProcessed.length, 0);
});

test("notification-service unit: if targetAudience.roles is present and does not include 'student', notify nobody", async () => {
  const pool = makePool({ users: [{ id: '11111111-1111-1111-1111-111111111111', role: 'student', department: 'Software', year: 2 }] });
  const publisher = makePublisher();

  const envelope = {
    eventId: 'evt_roles',
    eventType: 'announcement.published',
    data: {
      announcementId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      targetAudience: { roles: ['faculty'] },
    },
  };

  await handleAnnouncementEvent({ pool, publisher, envelope });

  assert.equal(pool.__insertedNotifications.length, 0);
  assert.equal(publisher.sent.length, 0);
  assert.equal(pool.__insertedProcessed.length, 1);
});
