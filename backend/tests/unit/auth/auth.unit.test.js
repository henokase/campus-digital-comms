const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBearerToken,
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} = require('../../../services/auth-service/src/auth');

test('auth-service unit: auth helpers (bearer parsing, password hashing, JWT sign/verify)', async () => {
  const pw = 'MyStrongPassword123!';
  const hash = await hashPassword(pw);
  assert.equal(typeof hash, 'string');
  assert.equal(await verifyPassword(pw, hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);

  process.env.JWT_SECRET = 'test_secret_1234567890';
  const token = signToken({ userId: 'u1', role: 'student' });
  assert.equal(typeof token, 'string');
  const claims = verifyToken(token);
  assert.equal(claims.userId, 'u1');
  assert.equal(claims.role, 'student');

  assert.throws(() => {
    verifyToken('this-is-not-a-jwt');
  });

  const goodReq = { headers: { authorization: 'Bearer mytoken123' } };
  const noHeaderReq = { headers: {} };
  const wrongSchemeReq = { headers: { authorization: 'Basic abc' } };
  const emptyValueReq = { headers: { authorization: 'Bearer ' } };

  assert.equal(getBearerToken(goodReq), 'mytoken123');
  assert.equal(getBearerToken(noHeaderReq), null);
  assert.equal(getBearerToken(wrongSchemeReq), null);
  assert.equal(getBearerToken(emptyValueReq), null);
});
