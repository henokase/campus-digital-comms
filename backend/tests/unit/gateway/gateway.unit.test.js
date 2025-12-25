const test = require('node:test');
const assert = require('node:assert/strict');

const { authMiddleware, getBearerToken, isPublicRoute } = require('../../../services/api-gateway/src/middleware/auth');
const { rbacMiddleware } = require('../../../services/api-gateway/src/middleware/rbac');
const { forwardRequest } = require('../../../services/api-gateway/src/forwarder');

function makeRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[String(k).toLowerCase()] = v;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function makeReq({ method = 'GET', path = '/x', originalUrl, headers = {}, body } = {}) {
  return {
    method,
    path,
    originalUrl: originalUrl ?? path,
    headers,
    body,
  };
}

test('api-gateway unit: auth middleware + RBAC + forwarder basics', async () => {
  // getBearerToken
  assert.equal(getBearerToken(makeReq({ headers: { authorization: 'Bearer abc' } })), 'abc');
  assert.equal(getBearerToken(makeReq({ headers: {} })), null);
  assert.equal(getBearerToken(makeReq({ headers: { authorization: 'Basic abc' } })), null);

  // isPublicRoute
  assert.equal(isPublicRoute(makeReq({ method: 'GET', path: '/health' })), true);
  assert.equal(isPublicRoute(makeReq({ method: 'POST', path: '/api/auth/register' })), true);
  assert.equal(isPublicRoute(makeReq({ method: 'POST', path: '/api/auth/login' })), true);
  assert.equal(isPublicRoute(makeReq({ method: 'GET', path: '/api/auth/profile' })), false);

  // authMiddleware
  process.env.JWT_SECRET = 'test_secret_1234567890';

  {
    const req = makeReq({ method: 'GET', path: '/api/auth/profile' });
    const res = makeRes();
    let calledNext = false;
    authMiddleware(req, res, () => {
      calledNext = true;
    });
    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  }

  {
    const req = makeReq({
      method: 'GET',
      path: '/api/auth/profile',
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    const res = makeRes();
    let calledNext = false;
    authMiddleware(req, res, () => {
      calledNext = true;
    });
    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  }

  {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: 'u1', role: 'student' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = makeReq({
      method: 'GET',
      path: '/api/auth/profile',
      headers: { authorization: `Bearer ${token}` },
    });
    const res = makeRes();
    let calledNext = false;
    authMiddleware(req, res, () => {
      calledNext = true;
    });
    assert.equal(calledNext, true);
    assert.equal(req.user.userId, 'u1');
    assert.equal(req.user.role, 'student');
  }

  // rbacMiddleware
  {
    const req = makeReq({ method: 'POST', path: '/api/announcements' });
    req.user = { role: 'student' };
    const res = makeRes();
    let calledNext = false;
    rbacMiddleware(req, res, () => {
      calledNext = true;
    });
    assert.equal(calledNext, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  }

  {
    const req = makeReq({ method: 'POST', path: '/api/announcements' });
    req.user = { role: 'faculty' };
    const res = makeRes();
    let calledNext = false;
    rbacMiddleware(req, res, () => {
      calledNext = true;
    });
    assert.equal(calledNext, true);
    assert.equal(res.statusCode, null);
  }

  // forwardRequest basics (stub fetch)
  {
    const oldFetch = global.fetch;
    try {
      global.fetch = async (url, init) => {
        assert.equal(String(url), 'http://example.com/api/auth/profile');
        assert.equal(init.method, 'GET');
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'x-test': '1' },
        });
      };

      const req = makeReq({ method: 'GET', path: '/api/auth/profile', originalUrl: '/api/auth/profile', headers: { authorization: 'Bearer abc' } });
      const res = makeRes();
      await forwardRequest({ req, res, targetBaseUrl: 'http://example.com' });

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['x-test'], '1');
      assert.deepEqual(res.body, { ok: true });
    } finally {
      global.fetch = oldFetch;
    }
  }
});
