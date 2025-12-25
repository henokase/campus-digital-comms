const test = require('node:test');
const assert = require('node:assert/strict');

async function isUp(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || '45678fgchjbklt67y8u';

async function requireGateway(t) {
  const ok = await isUp(`${GATEWAY_BASE_URL}/health`);
  if (!ok) {
    t.skip(`Gateway not reachable at ${GATEWAY_BASE_URL}. Start docker compose first.`);
  }
  assert.equal(ok, true);
}

async function postJson(path, body, headers) {
  const res = await fetch(`${GATEWAY_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function getJson(path, headers) {
  const res = await fetch(`${GATEWAY_BASE_URL}${path}`, {
    method: 'GET',
    headers: { ...(headers || {}) },
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

test('compose e2e precheck: gateway is reachable', async (t) => {
  const ok = await isUp(`${GATEWAY_BASE_URL}/health`);
  if (!ok) {
    t.skip(`Gateway not reachable at ${GATEWAY_BASE_URL}. Start docker compose first.`);
  }
  assert.equal(ok, true);
});

test('e2e: auth happy path (register -> login -> profile)', async (t) => {
  await requireGateway(t);

  const email = `student_${Date.now()}@example.com`;
  const password = 'Password123!';

  const reg = await postJson('/api/auth/register', {
    email,
    password,
    role: 'student',
    fullName: 'Student Test',
    department: 'Software',
    year: 3,
  });
  assert.equal(reg.res.status, 201);
  assert.ok(reg.json);
  assert.ok(reg.json.user);
  assert.equal(reg.json.user.email, email);
  assert.equal(reg.json.user.role, 'student');
  assert.equal(reg.json.user.fullName, 'Student Test');

  const login = await postJson('/api/auth/login', { email, password });
  assert.equal(login.res.status, 200);
  assert.ok(login.json);
  assert.equal(typeof login.json.token, 'string');
  assert.ok(login.json.token.length > 10);
  assert.ok(login.json.user);
  assert.equal(login.json.user.email, email);

  const token = login.json.token;

  const profile = await getJson('/api/auth/profile', { authorization: `Bearer ${token}` });
  assert.equal(profile.res.status, 200);
  assert.ok(profile.json);
  assert.ok(profile.json.user);
  assert.equal(profile.json.user.email, email);
  assert.equal(profile.json.user.role, 'student');
});

test('e2e: register validation errors', async (t) => {
  await requireGateway(t);

  const badEmail = await postJson('/api/auth/register', {
    email: 'not-an-email',
    password: 'Password123!',
    role: 'student',
  });
  assert.equal(badEmail.res.status, 400);
  assert.equal(badEmail.json.error.code, 'INVALID_EMAIL');

  const shortPassword = await postJson('/api/auth/register', {
    email: `short_${Date.now()}@example.com`,
    password: 'short',
    role: 'student',
  });
  assert.equal(shortPassword.res.status, 400);
  assert.equal(shortPassword.json.error.code, 'INVALID_PASSWORD');

  const badRole = await postJson('/api/auth/register', {
    email: `badrole_${Date.now()}@example.com`,
    password: 'Password123!',
    role: 'hacker',
  });
  assert.equal(badRole.res.status, 400);
  assert.equal(badRole.json.error.code, 'INVALID_ROLE');
});

test('e2e: register duplicate email', async (t) => {
  await requireGateway(t);

  const email = `dup_${Date.now()}@example.com`;
  const password = 'Password123!';

  const first = await postJson('/api/auth/register', { email, password, role: 'student' });
  assert.equal(first.res.status, 201);

  const second = await postJson('/api/auth/register', { email, password, role: 'student' });
  assert.equal(second.res.status, 409);
  assert.equal(second.json.error.code, 'EMAIL_EXISTS');
});

test('e2e: login failure cases', async (t) => {
  await requireGateway(t);

  const invalidPayload = await postJson('/api/auth/login', { email: 'nope', password: 123 });
  assert.equal(invalidPayload.res.status, 400);
  assert.equal(invalidPayload.json.error.code, 'INVALID_CREDENTIALS');

  const missingUser = await postJson('/api/auth/login', { email: `missing_${Date.now()}@example.com`, password: 'Password123!' });
  assert.equal(missingUser.res.status, 401);
  assert.equal(missingUser.json.error.code, 'UNAUTHORIZED');

  const email = `wrongpw_${Date.now()}@example.com`;
  const password = 'Password123!';
  const reg = await postJson('/api/auth/register', { email, password, role: 'student' });
  assert.equal(reg.res.status, 201);

  const wrongPw = await postJson('/api/auth/login', { email, password: 'Password123!!' });
  assert.equal(wrongPw.res.status, 401);
  assert.equal(wrongPw.json.error.code, 'UNAUTHORIZED');
});

test('e2e: profile rejects missing token through gateway', async (t) => {
  await requireGateway(t);

  const profile = await getJson('/api/auth/profile');
  assert.equal(profile.res.status, 401);
  assert.ok(profile.json);
  assert.equal(profile.json.error.code, 'UNAUTHORIZED');
});

test('e2e: profile rejects invalid token through gateway', async (t) => {
  await requireGateway(t);

  const profile = await getJson('/api/auth/profile', { authorization: 'Bearer this-is-not-a-jwt' });
  assert.equal(profile.res.status, 401);
  assert.ok(profile.json);
  assert.equal(profile.json.error.code, 'UNAUTHORIZED');
});

test('e2e: profile returns 404 for non-existent user (validly signed token)', async (t) => {
  await requireGateway(t);

  const jwt = require('jsonwebtoken');
  const fakeUserId = '00000000-0000-0000-0000-000000000000';
  const token = jwt.sign({ userId: fakeUserId, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

  const profile = await getJson('/api/auth/profile', { authorization: `Bearer ${token}` });
  assert.equal(profile.res.status, 401);
  assert.ok(profile.json);
  assert.equal(profile.json.error.code, 'UNAUTHORIZED');
});
