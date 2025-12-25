const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 10) {
    throw new Error('JWT_SECRET is missing or too short');
  }
  return secret;
}

function signToken({ userId, role }) {
  return jwt.sign({ userId, role }, getJwtSecret(), { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, value] = header.split(' ');
  if (type !== 'Bearer' || !value) return null;
  return value;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  getBearerToken,
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
};
