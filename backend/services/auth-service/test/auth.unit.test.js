const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBearerToken,
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} = require('../src/auth');

test('hashPassword + verifyPassword happy path', async () => {
  const pw = 'MyStrongPassword123!';
  const hash = await hashPassword(pw);
  assert.equal(typeof hash, 'string');
  assert.equal(await verifyPassword(pw, hash), true);
});

test('verifyPassword returns false for wrong password', async () => {
  const pw = 'MyStrongPassword123!';
  const hash = await hashPassword(pw);
  assert.equal(await verifyPassword('wrong', hash), false);
});

test('signToken + verifyToken round-trip', async () => {
  process.env.JWT_SECRET = 'test_secret_1234567890';
  const token = signToken({ userId: 'u1', role: 'student' });
  assert.equal(typeof token, 'string');

  const claims = verifyToken(token);
  assert.equal(claims.userId, 'u1');
  assert.equal(claims.role, 'student');
});

test('verifyToken throws for invalid token', async () => {
  process.env.JWT_SECRET = 'test_secret_1234567890';

  assert.throws(() => {
    verifyToken('this-is-not-a-jwt');
  });
});

test('getBearerToken parses valid Authorization header', async () => {
  const req = { headers: { authorization: 'Bearer mytoken123' } };
  const token = getBearerToken(req);
  assert.equal(token, 'mytoken123');
});

test('getBearerToken returns null for missing or invalid header', async () => {
  const noHeaderReq = { headers: {} };
  const wrongSchemeReq = { headers: { authorization: 'Basic abc' } };
  const emptyValueReq = { headers: { authorization: 'Bearer ' } };

  assert.equal(getBearerToken(noHeaderReq), null);
  assert.equal(getBearerToken(wrongSchemeReq), null);
  assert.equal(getBearerToken(emptyValueReq), null);
});
