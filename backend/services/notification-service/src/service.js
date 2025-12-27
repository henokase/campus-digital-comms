function isValidUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function normalizeTargetAudience(v) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object') return null;
  return v;
}

function extractAudienceFromEnvelope(envelope) {
  const ta = normalizeTargetAudience(envelope?.data?.targetAudience);
  return ta;
}

async function wasEventProcessed(pool, { eventId }) {
  const res = await pool.query(
    'SELECT "eventId" FROM "notifications"."NotificationProcessedEvent" WHERE "eventId" = $1',
    [eventId]
  );
  return res.rowCount > 0;
}

async function markEventProcessed(pool, { eventId, eventType }) {
  await pool.query(
    'INSERT INTO "notifications"."NotificationProcessedEvent" ("eventId", "eventType") VALUES ($1, $2) ON CONFLICT ("eventId") DO NOTHING',
    [eventId, eventType]
  );
}

async function findMatchingStudents(pool, { targetAudience }) {
  // targetAudience is expected to be JSON object like: { roles:[], departments:[], years:[] }
  const roles = Array.isArray(targetAudience?.roles) ? targetAudience.roles : null;
  const departments = Array.isArray(targetAudience?.departments) ? targetAudience.departments : null;
  const years = Array.isArray(targetAudience?.years) ? targetAudience.years : null;

  // Spec: notify matching students only.
  // If roles are specified and they do not include 'student', nobody should be notified.
  if (roles && roles.length > 0 && !roles.includes('student')) {
    return [];
  }

  const roleFilter = ['student'];

  const query = `
    SELECT id
    FROM "auth"."User"
    WHERE role = ANY($1::text[])
      AND ($2::text[] IS NULL OR department = ANY($2::text[]))
      AND ($3::int[] IS NULL OR year = ANY($3::int[]))
  `;

  const res = await pool.query(query, [roleFilter, departments, years]);
  return res.rows.map((r) => r.id);
}

async function createNotification(pool, { announcementId, userId, channel, sourceEventId, status, errorMessage }) {
  const res = await pool.query(
    `INSERT INTO "notifications"."Notification" (
      id, "announcementId", "userId", channel, "sourceEventId", status,
      "sentAt", "readAt", "errorMessage", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5,
      CASE WHEN $5 = 'sent' THEN NOW() ELSE NULL END,
      NULL,
      $6,
      NOW(),
      NOW()
    )
    ON CONFLICT ("announcementId", "userId", channel, "sourceEventId") DO UPDATE
      SET "updatedAt" = NOW()
    RETURNING id, "announcementId" AS "announcementId", "userId" AS "userId", channel, "sourceEventId" AS "sourceEventId",
      status, "sentAt" AS "sentAt", "readAt" AS "readAt", "errorMessage" AS "errorMessage"`,
    [announcementId, userId, channel, sourceEventId, status, errorMessage ?? null]
  );

  return res.rows[0];
}

async function markNotificationRead(pool, { notificationId, userId }) {
  const res = await pool.query(
    `UPDATE "notifications"."Notification"
     SET "readAt" = COALESCE("readAt", NOW()),
         "updatedAt" = NOW()
     WHERE id = $1 AND "userId" = $2
     RETURNING id, "announcementId" AS "announcementId", "userId" AS "userId", channel,
       "sourceEventId" AS "sourceEventId", status, "sentAt" AS "sentAt", "readAt" AS "readAt", "errorMessage" AS "errorMessage"`,
    [notificationId, userId]
  );

  return res.rowCount > 0 ? res.rows[0] : null;
}

async function listNotifications(pool, { userId, limit = 50, offset = 0 }) {
  const res = await pool.query(
    `SELECT
      id,
      "announcementId" AS "announcementId",
      "userId" AS "userId",
      channel,
      "sourceEventId" AS "sourceEventId",
      status,
      "sentAt" AS "sentAt",
      "readAt" AS "readAt",
      "errorMessage" AS "errorMessage",
      "createdAt" AS "createdAt",
      "updatedAt" AS "updatedAt"
    FROM "notifications"."Notification"
    WHERE "userId" = $1
    ORDER BY "createdAt" DESC
    LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return res.rows;
}

async function unreadCount(pool, { userId }) {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM "notifications"."Notification"
     WHERE "userId" = $1 AND "readAt" IS NULL`,
    [userId]
  );
  return res.rows[0]?.count ?? 0;
}

async function handleAnnouncementEvent({ pool, publisher, envelope }) {
  const eventId = envelope?.eventId;
  const eventType = envelope?.eventType;

  if (!eventId || !eventType) return;

  const isRelevant = eventType === 'announcement.published' || eventType === 'announcement.updated';
  if (!isRelevant) return;

  if (await wasEventProcessed(pool, { eventId })) return;

  const announcementId = envelope?.data?.announcementId;
  if (!isValidUuid(announcementId)) {
    await markEventProcessed(pool, { eventId, eventType });
    return;
  }

  const targetAudience = extractAudienceFromEnvelope(envelope);
  if (!targetAudience) {
    await markEventProcessed(pool, { eventId, eventType });
    return;
  }

  const recipients = await findMatchingStudents(pool, { targetAudience });

  for (const userId of recipients) {
    // For now: in-app notification is treated as instantly sent.
    const notification = await createNotification(pool, {
      announcementId,
      userId,
      channel: 'in_app',
      sourceEventId: eventId,
      status: 'sent',
      errorMessage: null,
    });

    if (publisher) {
      await publisher.publishNotificationSent({ notification });
    }
  }

  await markEventProcessed(pool, { eventId, eventType });
}

module.exports = {
  isValidUuid,
  listNotifications,
  unreadCount,
  markNotificationRead,
  handleAnnouncementEvent,
};
