const jwt = require('jsonwebtoken');

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

function isPublicRoute(req) {
  if (req.path === '/health') return true;
  if (req.method === 'POST' && req.path === '/api/auth/register') return true;
  if (req.method === 'POST' && req.path === '/api/auth/login') return true;
  return false;
}

function authMiddleware(req, res, next) {
  if (isPublicRoute(req)) return next();

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing Bearer token.' } });
  }

  try {
    const claims = jwt.verify(token, getJwtSecret());
    req.user = claims;
    return next();
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token.' } });
  }
}

module.exports = { authMiddleware, getBearerToken, isPublicRoute };
