const test = require('node:test');
const assert = require('node:assert/strict');

const jwt = require('jsonwebtoken');

const {
  getBearerToken,
  isNonEmptyString,
  isValidUuid,
  normalizeTargetAudience,
  requireWriter,
} = require('../../../services/announcement-service/src/app');

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function makeReq({ authorization } = {}) {
  return {
    headers: {
      authorization,
    },
  };
}

test('announcement-service unit: validation + authz helpers', async () => {
  // basic validation helpers
  assert.equal(isNonEmptyString('x'), true);
  assert.equal(isNonEmptyString('  '), false);
  assert.equal(isNonEmptyString(null), false);

  assert.equal(isValidUuid('00000000-0000-0000-0000-000000000000'), true);
  assert.equal(isValidUuid('not-a-uuid'), false);

  assert.deepEqual(normalizeTargetAudience({ roles: ['student'] }), { roles: ['student'] });
  assert.equal(normalizeTargetAudience(null), null);
  assert.equal(normalizeTargetAudience('x'), null);

  // bearer token parsing
  assert.equal(getBearerToken(makeReq({ authorization: 'Bearer abc' })), 'abc');
  assert.equal(getBearerToken(makeReq({ authorization: 'Basic abc' })), null);
  assert.equal(getBearerToken(makeReq({})), null);

  // requireWriter authz
  process.env.JWT_SECRET = 'test_secret_1234567890';

  {
    const req = makeReq({});
    const res = makeRes();
    const claims = requireWriter(req, res);
    assert.equal(claims, null);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  }

  {
    const req = makeReq({ authorization: 'Bearer not-a-jwt' });
    const res = makeRes();
    const claims = requireWriter(req, res);
    assert.equal(claims, null);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  }

  {
    const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000000', role: 'student' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const claims = requireWriter(req, res);
    assert.equal(claims, null);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  }

  {
    const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000000', role: 'faculty' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const claims = requireWriter(req, res);
    assert.ok(claims);
    assert.equal(claims.role, 'faculty');
  }
});
