const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

function sendError(res, status, code, message, details) {
  res.status(status).json({
    error: {
      code,
      message,
      details: details ?? undefined,
    },
  });
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 10) {
    throw new Error('JWT_SECRET is missing or too short');
  }
  return secret;
}

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, value] = header.split(' ');
  if (type !== 'Bearer' || !value) return null;
  return value;
}

function requireWriter(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    sendError(res, 401, 'UNAUTHORIZED', 'Missing Bearer token.');
    return null;
  }

  try {
    const claims = jwt.verify(token, getJwtSecret());
    const role = claims?.role;
    if (role !== 'admin' && role !== 'faculty') {
      sendError(res, 403, 'FORBIDDEN', 'Insufficient role for this action.');
      return null;
    }
    return claims;
  } catch {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid token.');
    return null;
  }
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function normalizeTargetAudience(v) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object') return null;
  return v;
}

function toAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type,
    category: row.category ?? null,
    priority: row.priority,
    createdBy: row.createdby,
    targetAudience: row.targetaudience,
    status: row.status,
    publishedAt: row.publishedat ?? null,
    createdAt: row.createdat,
    updatedAt: row.updatedat,
  };
}

function createApp({ pool, publisher }) {
  if (!pool) throw new Error('pool is required');

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'announcement-service' });
  });

  app.post('/api/announcements', async (req, res) => {
    try {
      const claims = requireWriter(req, res);
      if (!claims) return;

      const { title, content, type, category, priority, targetAudience } = req.body ?? {};

      if (!isNonEmptyString(title)) {
        return sendError(res, 400, 'INVALID_TITLE', 'Title is required.');
      }
      if (!isNonEmptyString(content)) {
        return sendError(res, 400, 'INVALID_CONTENT', 'Content is required.');
      }
      if (!isNonEmptyString(type)) {
        return sendError(res, 400, 'INVALID_TYPE', 'Type is required.');
      }
      if (!isNonEmptyString(priority)) {
        return sendError(res, 400, 'INVALID_PRIORITY', 'Priority is required.');
      }

      const ta = normalizeTargetAudience(targetAudience);
      if (!ta) {
        return sendError(res, 400, 'INVALID_TARGET_AUDIENCE', 'targetAudience must be a JSON object.');
      }

      const createdBy = claims.userId;
      if (!isValidUuid(createdBy)) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Invalid token claims.');
      }

      const created = await pool.query(
        `INSERT INTO "announcements"."Announcement" (
          id, title, content, type, category, priority, "createdBy", "targetAudience", status, "publishedAt", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::jsonb, 'draft', NULL, NOW(), NOW()
        )
        RETURNING
          id, title, content, type, category, priority,
          "createdBy" AS createdby,
          "targetAudience" AS targetaudience,
          status,
          "publishedAt" AS publishedat,
          "createdAt" AS createdat,
          "updatedAt" AS updatedat`,
        [title, content, type, category ?? null, priority, createdBy, JSON.stringify(ta)]
      );

      const announcement = toAnnouncement(created.rows[0]);

      if (publisher) {
        await publisher.publishAnnouncementCreated({ announcement });
      }

      return res.status(201).json({ announcement });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.get('/api/announcements', async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT
          id, title, content, type, category, priority,
          "createdBy" AS createdby,
          "targetAudience" AS targetaudience,
          status,
          "publishedAt" AS publishedat,
          "createdAt" AS createdat,
          "updatedAt" AS updatedat
        FROM "announcements"."Announcement"
        ORDER BY "createdAt" DESC`
      );

      return res.status(200).json({ announcements: result.rows.map(toAnnouncement) });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.get('/api/announcements/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Invalid announcement id.');
      }

      const result = await pool.query(
        `SELECT
          id, title, content, type, category, priority,
          "createdBy" AS createdby,
          "targetAudience" AS targetaudience,
          status,
          "publishedAt" AS publishedat,
          "createdAt" AS createdat,
          "updatedAt" AS updatedat
        FROM "announcements"."Announcement"
        WHERE id = $1`,
        [id]
      );

      if (result.rowCount === 0) {
        return sendError(res, 404, 'NOT_FOUND', 'Announcement not found.');
      }

      return res.status(200).json({ announcement: toAnnouncement(result.rows[0]) });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.put('/api/announcements/:id', async (req, res) => {
    try {
      const claims = requireWriter(req, res);
      if (!claims) return;

      const { id } = req.params;
      if (!isValidUuid(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Invalid announcement id.');
      }

      const { title, content, type, category, priority, targetAudience } = req.body ?? {};
      if (!isNonEmptyString(title) || !isNonEmptyString(content) || !isNonEmptyString(type) || !isNonEmptyString(priority)) {
        return sendError(res, 400, 'INVALID_PAYLOAD', 'title, content, type, and priority are required.');
      }
      const ta = normalizeTargetAudience(targetAudience);
      if (!ta) {
        return sendError(res, 400, 'INVALID_TARGET_AUDIENCE', 'targetAudience must be a JSON object.');
      }

      const updated = await pool.query(
        `UPDATE "announcements"."Announcement"
        SET title = $2,
            content = $3,
            type = $4,
            category = $5,
            priority = $6,
            "targetAudience" = $7::jsonb,
            "updatedAt" = NOW()
        WHERE id = $1
        RETURNING
          id, title, content, type, category, priority,
          "createdBy" AS createdby,
          "targetAudience" AS targetaudience,
          status,
          "publishedAt" AS publishedat,
          "createdAt" AS createdat,
          "updatedAt" AS updatedat`,
        [id, title, content, type, category ?? null, priority, JSON.stringify(ta)]
      );

      if (updated.rowCount === 0) {
        return sendError(res, 404, 'NOT_FOUND', 'Announcement not found.');
      }

      const announcement = toAnnouncement(updated.rows[0]);

      if (publisher) {
        await publisher.publishAnnouncementUpdated({ announcement });
      }

      return res.status(200).json({ announcement });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.delete('/api/announcements/:id', async (req, res) => {
    try {
      const claims = requireWriter(req, res);
      if (!claims) return;

      const { id } = req.params;
      if (!isValidUuid(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Invalid announcement id.');
      }

      const deleted = await pool.query(
        `DELETE FROM "announcements"."Announcement"
        WHERE id = $1
        RETURNING
          id, title, content, type, category, priority,
          "createdBy" AS createdby,
          "targetAudience" AS targetaudience,
          status,
          "publishedAt" AS publishedat,
          "createdAt" AS createdat,
          "updatedAt" AS updatedat`,
        [id]
      );

      if (deleted.rowCount === 0) {
        return sendError(res, 404, 'NOT_FOUND', 'Announcement not found.');
      }

      const announcement = toAnnouncement(deleted.rows[0]);

      if (publisher) {
        await publisher.publishAnnouncementDeleted({ announcement });
      }

      return res.status(200).json({ announcement });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  app.post('/api/announcements/:id/publish', async (req, res) => {
    try {
      const claims = requireWriter(req, res);
      if (!claims) return;

      const { id } = req.params;
      if (!isValidUuid(id)) {
        return sendError(res, 400, 'INVALID_ID', 'Invalid announcement id.');
      }

      const updated = await pool.query(
        `UPDATE "announcements"."Announcement"
        SET status = 'published',
            "publishedAt" = COALESCE("publishedAt", NOW()),
            "updatedAt" = NOW()
        WHERE id = $1 AND status <> 'published'
        RETURNING
          id, title, content, type, category, priority,
          "createdBy" AS createdby,
          "targetAudience" AS targetaudience,
          status,
          "publishedAt" AS publishedat,
          "createdAt" AS createdat,
          "updatedAt" AS updatedat`,
        [id]
      );

      if (updated.rowCount === 0) {
        const existing = await pool.query(
          `SELECT
            id, title, content, type, category, priority,
            "createdBy" AS createdby,
            "targetAudience" AS targetaudience,
            status,
            "publishedAt" AS publishedat,
            "createdAt" AS createdat,
            "updatedAt" AS updatedat
          FROM "announcements"."Announcement"
          WHERE id = $1`,
          [id]
        );

        if (existing.rowCount === 0) {
          return sendError(res, 404, 'NOT_FOUND', 'Announcement not found.');
        }

        return res.status(200).json({ announcement: toAnnouncement(existing.rows[0]) });
      }

      const announcement = toAnnouncement(updated.rows[0]);

      return res.status(200).json({ announcement });
    } catch (err) {
      return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
    }
  });

  return app;
}

module.exports = { createApp, toAnnouncement, normalizeTargetAudience, isValidUuid, isNonEmptyString, requireWriter, getBearerToken };
