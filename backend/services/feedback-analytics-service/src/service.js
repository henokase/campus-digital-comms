function isValidUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function insertFeedback(pool, { announcementId, userId, reactionType, comment, rating, isAnonymous }) {
  const res = await pool.query(
    `INSERT INTO "engagement"."Feedback" (
      id, "announcementId", "userId", "reactionType", comment, rating, "isAnonymous", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW()
    )
    RETURNING
      id,
      "announcementId" AS "announcementId",
      "userId" AS "userId",
      "reactionType" AS "reactionType",
      comment,
      rating,
      "isAnonymous" AS "isAnonymous",
      "createdAt" AS "createdAt",
      "updatedAt" AS "updatedAt"`,
    [announcementId, userId, reactionType, comment ?? null, rating ?? null, Boolean(isAnonymous)]
  );
  return res.rows[0];
}

async function getFeedbackById(pool, { feedbackId }) {
  const res = await pool.query(
    `SELECT
      id,
      "announcementId" AS "announcementId",
      "userId" AS "userId",
      "reactionType" AS "reactionType",
      comment,
      rating,
      "isAnonymous" AS "isAnonymous",
      "createdAt" AS "createdAt",
      "updatedAt" AS "updatedAt"
     FROM "engagement"."Feedback"
     WHERE id = $1`,
    [feedbackId]
  );
  return res.rowCount > 0 ? res.rows[0] : null;
}

async function updateFeedback(pool, { feedbackId, userId, patch }) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (patch.reactionType !== undefined) {
    fields.push(`"reactionType" = $${idx}`);
    values.push(patch.reactionType);
    idx += 1;
  }
  if (patch.comment !== undefined) {
    fields.push(`comment = $${idx}`);
    values.push(patch.comment);
    idx += 1;
  }
  if (patch.rating !== undefined) {
    fields.push(`rating = $${idx}`);
    values.push(patch.rating);
    idx += 1;
  }
  if (patch.isAnonymous !== undefined) {
    fields.push(`"isAnonymous" = $${idx}`);
    values.push(Boolean(patch.isAnonymous));
    idx += 1;
  }

  if (fields.length === 0) return null;

  values.push(feedbackId);
  values.push(userId);

  const res = await pool.query(
    `UPDATE "engagement"."Feedback"
     SET ${fields.join(', ')}, "updatedAt" = NOW()
     WHERE id = $${idx} AND "userId" = $${idx + 1}
     RETURNING
      id,
      "announcementId" AS "announcementId",
      "userId" AS "userId",
      "reactionType" AS "reactionType",
      comment,
      rating,
      "isAnonymous" AS "isAnonymous",
      "createdAt" AS "createdAt",
      "updatedAt" AS "updatedAt"`,
    values
  );

  return res.rowCount > 0 ? res.rows[0] : null;
}

async function listMyFeedback(pool, { userId, limit = 50, offset = 0 }) {
  const res = await pool.query(
    `SELECT
      id,
      "announcementId" AS "announcementId",
      "userId" AS "userId",
      "reactionType" AS "reactionType",
      comment,
      rating,
      "isAnonymous" AS "isAnonymous",
      "createdAt" AS "createdAt",
      "updatedAt" AS "updatedAt"
     FROM "engagement"."Feedback"
     WHERE "userId" = $1
     ORDER BY "createdAt" DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return res.rows;
}

async function listAnnouncementFeedback(pool, { announcementId, limit = 50, offset = 0 }) {
  const res = await pool.query(
    `SELECT
      f.id,
      f."announcementId" AS "announcementId",
      f."userId" AS "userId",
      f."reactionType" AS "reactionType",
      f.comment,
      f.rating,
      f."isAnonymous" AS "isAnonymous",
      f."createdAt" AS "createdAt",
      f."updatedAt" AS "updatedAt",
      u."fullName" AS "fullName",
      u.email AS email,
      u.role AS role,
      u.department AS department,
      u.year AS year
     FROM "engagement"."Feedback" f
     LEFT JOIN "auth"."User" u ON u.id = f."userId"
     WHERE f."announcementId" = $1
     ORDER BY f."createdAt" DESC
     LIMIT $2 OFFSET $3`,
    [announcementId, limit, offset]
  );

  return res.rows.map((r) => {
    if (r.isAnonymous) {
      return {
        id: r.id,
        announcementId: r.announcementId,
        reactionType: r.reactionType,
        comment: r.comment,
        rating: r.rating,
        isAnonymous: true,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        user: null,
      };
    }

    return {
      id: r.id,
      announcementId: r.announcementId,
      reactionType: r.reactionType,
      comment: r.comment,
      rating: r.rating,
      isAnonymous: false,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      user: r.userId
        ? {
            id: r.userId,
            fullName: r.fullName,
            email: r.email,
            role: r.role,
            department: r.department,
            year: r.year,
          }
        : null,
    };
  });
}

async function wasEventProcessed(pool, { eventId }) {
  const res = await pool.query(
    'SELECT "eventId" FROM "engagement"."ProcessedEvent" WHERE "eventId" = $1',
    [eventId]
  );
  return res.rowCount > 0;
}

async function markEventProcessed(pool, { eventId, eventType }) {
  await pool.query(
    'INSERT INTO "engagement"."ProcessedEvent" ("eventId", "eventType") VALUES ($1, $2) ON CONFLICT ("eventId") DO NOTHING',
    [eventId, eventType]
  );
}

async function bumpMetrics(pool, { announcementId, deltaSent = 0, deltaRead = 0, deltaFeedback = 0, bumpOnly = false }) {
  // bumpOnly=true means: do not change counts, only update lastUpdatedAt.
  const res = await pool.query(
    `INSERT INTO "engagement"."AnnouncementMetrics" (
      "announcementId", "notificationsSent", "notificationsRead", "feedbackCount", "lastUpdatedAt"
    ) VALUES (
      $1, $2, $3, $4, NOW()
    )
    ON CONFLICT ("announcementId") DO UPDATE
      SET
        "notificationsSent" = CASE WHEN $5 THEN "engagement"."AnnouncementMetrics"."notificationsSent" ELSE "engagement"."AnnouncementMetrics"."notificationsSent" + $2 END,
        "notificationsRead" = CASE WHEN $5 THEN "engagement"."AnnouncementMetrics"."notificationsRead" ELSE "engagement"."AnnouncementMetrics"."notificationsRead" + $3 END,
        "feedbackCount" = CASE WHEN $5 THEN "engagement"."AnnouncementMetrics"."feedbackCount" ELSE "engagement"."AnnouncementMetrics"."feedbackCount" + $4 END,
        "lastUpdatedAt" = NOW()
    RETURNING
      "announcementId" AS "announcementId",
      "notificationsSent" AS "notificationsSent",
      "notificationsRead" AS "notificationsRead",
      "feedbackCount" AS "feedbackCount",
      "lastUpdatedAt" AS "lastUpdatedAt"`,
    [announcementId, deltaSent, deltaRead, deltaFeedback, bumpOnly]
  );
  return res.rows[0];
}

async function handleAnalyticsEvent({ pool, envelope }) {
  const eventId = envelope?.eventId;
  const eventType = envelope?.eventType;
  if (!eventId || !eventType) return;

  // idempotent
  if (await wasEventProcessed(pool, { eventId })) return;

  const announcementId = envelope?.data?.announcementId;
  if (!isValidUuid(announcementId)) {
    await markEventProcessed(pool, { eventId, eventType });
    return;
  }

  if (eventType === 'notification.sent') {
    await bumpMetrics(pool, { announcementId, deltaSent: 1 });
  } else if (eventType === 'notification.read') {
    await bumpMetrics(pool, { announcementId, deltaRead: 1 });
  } else if (eventType === 'feedback.submitted') {
    await bumpMetrics(pool, { announcementId, deltaFeedback: 1 });
  } else if (eventType === 'feedback.updated') {
    await bumpMetrics(pool, { announcementId, bumpOnly: true });
  } else {
    // irrelevant
  }

  await markEventProcessed(pool, { eventId, eventType });
}

async function getAnnouncementMetrics(pool, { announcementId }) {
  const res = await pool.query(
    `SELECT
      "announcementId" AS "announcementId",
      "notificationsSent" AS "notificationsSent",
      "notificationsRead" AS "notificationsRead",
      "feedbackCount" AS "feedbackCount",
      "lastUpdatedAt" AS "lastUpdatedAt"
     FROM "engagement"."AnnouncementMetrics"
     WHERE "announcementId" = $1`,
    [announcementId]
  );

  if (res.rowCount === 0) {
    return {
      announcementId,
      notificationsSent: 0,
      notificationsRead: 0,
      feedbackCount: 0,
      lastUpdatedAt: null,
    };
  }

  return res.rows[0];
}

async function getDashboardMetrics(pool) {
  const totals = await pool.query(
    `SELECT
      COALESCE(SUM("notificationsSent"), 0)::int AS "totalNotificationsSent",
      COALESCE(SUM("notificationsRead"), 0)::int AS "totalNotificationsRead",
      COALESCE(SUM("feedbackCount"), 0)::int AS "totalFeedbackCount"
     FROM "engagement"."AnnouncementMetrics"`
  );

  const totalAnnouncements = await pool.query(
    'SELECT COUNT(*)::int AS "totalAnnouncements" FROM "announcements"."Announcement"'
  );

  return {
    totalAnnouncements: totalAnnouncements.rows[0]?.totalAnnouncements ?? 0,
    totalNotificationsSent: totals.rows[0]?.totalNotificationsSent ?? 0,
    totalNotificationsRead: totals.rows[0]?.totalNotificationsRead ?? 0,
    totalFeedbackCount: totals.rows[0]?.totalFeedbackCount ?? 0,
  };
}

async function getTopAnnouncementsByFeedback(pool, { limit = 5 }) {
  const res = await pool.query(
    `SELECT
      m."announcementId" AS "announcementId",
      m."feedbackCount" AS "feedbackCount"
     FROM "engagement"."AnnouncementMetrics" m
     ORDER BY m."feedbackCount" DESC, m."lastUpdatedAt" DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

module.exports = {
  isValidUuid,
  insertFeedback,
  getFeedbackById,
  updateFeedback,
  listMyFeedback,
  listAnnouncementFeedback,
  handleAnalyticsEvent,
  getAnnouncementMetrics,
  getDashboardMetrics,
  getTopAnnouncementsByFeedback,
};
