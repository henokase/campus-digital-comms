const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool } = require('./db');
const {
  getBearerToken,
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

function sendError(res, status, code, message, details) {
  res.status(status).json({
    error: {
      code,
      message,
      details: details ?? undefined,
    },
  });
}

function isValidEmail(email) {
  return typeof email === 'string' && email.includes('@') && email.length <= 255;
}

function normalizeRole(role) {
  if (typeof role !== 'string') return null;
  const r = role.trim().toLowerCase();
  if (r === 'admin' || r === 'faculty' || r === 'student') return r;
  return null;
}

function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    fullName: row.fullname ?? null,
    department: row.department ?? null,
    year: row.year ?? null,
    createdAt: row.createdat,
    updatedAt: row.updatedat,
  };
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, role, fullName, department, year } = req.body ?? {};
    const normalizedRole = normalizeRole(role);

    if (!isValidEmail(email)) {
      return sendError(res, 400, 'INVALID_EMAIL', 'Email is invalid.');
    }
    if (typeof password !== 'string' || password.length < 8) {
      return sendError(res, 400, 'INVALID_PASSWORD', 'Password must be at least 8 characters.');
    }
    if (!normalizedRole) {
      return sendError(res, 400, 'INVALID_ROLE', 'Role must be one of: admin, faculty, student.');
    }

    const exists = await pool.query('SELECT 1 FROM "auth"."User" WHERE email = $1', [email]);
    if (exists.rowCount > 0) {
      return sendError(res, 409, 'EMAIL_EXISTS', 'A user with this email already exists.');
    }

    const passwordHash = await hashPassword(password);

    const created = await pool.query(
      `INSERT INTO "auth"."User" (
        id, email, "passwordHash", role, "fullName", department, year, "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, email, role, "fullName" AS fullname, department, year, "createdAt" AS createdat, "updatedAt" AS updatedat`,
      [email, passwordHash, normalizedRole, fullName ?? null, department ?? null, year ?? null]
    );

    const user = toPublicUser(created.rows[0]);
    return res.status(201).json({ user });
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!isValidEmail(email) || typeof password !== 'string') {
      return sendError(res, 400, 'INVALID_CREDENTIALS', 'Email/password are invalid.');
    }

    const result = await pool.query(
      'SELECT id, email, role, "passwordHash", "fullName" AS fullname, department, year, "createdAt" AS createdat, "updatedAt" AS updatedat FROM "auth"."User" WHERE email = $1',
      [email]
    );
    if (result.rowCount === 0) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Invalid email or password.');
    }

    const row = result.rows[0];
    const ok = await verifyPassword(password, row.passwordHash);
    if (!ok) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Invalid email or password.');
    }

    const token = signToken({ userId: row.id, role: row.role });
    const user = toPublicUser(row);
    return res.status(200).json({ token, user });
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
  }
});

app.get('/api/auth/profile', async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Missing Bearer token.');
    }

    let claims;
    try {
      claims = verifyToken(token);
    } catch {
      return sendError(res, 401, 'UNAUTHORIZED', 'Invalid token.');
    }

    const result = await pool.query(
      'SELECT id, email, role, "fullName" AS fullname, department, year, "createdAt" AS createdat, "updatedAt" AS updatedat FROM "auth"."User" WHERE id = $1',
      [claims.userId]
    );

    if (result.rowCount === 0) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Invalid token.');
    }

    return res.status(200).json({ user: toPublicUser(result.rows[0]) });
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected error.', { message: err.message });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`auth-service listening on ${port}`);
});
