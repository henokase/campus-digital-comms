# CDCP — Testing and Reliability Documentation

## 1. Document purpose
This document defines the **testing strategy**, **test execution procedures**, and **reliability guarantees** of the CDCP system as implemented.

Scope:
- unit test suites (service-level logic and middleware)
- integration tests (Docker Compose + gateway + database + RabbitMQ)
- E2E validation via Postman collection
- reliability mechanisms: retries, idempotency, uniqueness constraints
- operational failure modes and expected behavior

## 2. Testing taxonomy and ownership

| Test type | Primary goal | Location | Execution command |
|---|---|---|---|
| Unit tests | Verify isolated logic deterministically | `backend/tests/unit/**` | `npm run test:unit` (from `backend/`) |
| Integration tests | Verify cross-service behavior via gateway and real infra | `backend/tests/integration/**` | `npm run test:integration` (from `backend/`) |
| E2E (Postman) | Black-box regression across full system | `backend/tests/postman/` | Run in Postman UI (Newman optional) |

The backend uses Node’s built-in test runner:
- `node --test`

## 3. Unit testing (implementation-derived)

### 3.1 Unit test runner
- Entrypoint: `backend/package.json`
- Script: `test:unit`

```text
node --test tests/unit/**/*.test.js
```

### 3.2 Unit test suites

#### 3.2.1 Auth service helpers
- File: [backend/tests/unit/](../backend/tests/unit/)
- Targets: [backend/services/auth-service/src/auth.js](/backend/services/auth-service/src/auth.js)

Coverage:
- bearer token parsing (`getBearerToken`)
- password hashing and verification (`bcryptjs`)
- JWT signing and verification (`jsonwebtoken`)

Assertions:
- valid password verifies
- invalid password fails
- JWT is signed and verified using `process.env.JWT_SECRET`

#### 3.2.2 API Gateway middleware and forwarding
- File: [backend/tests/unit/gateway/gateway.unit.test.js](/backend/tests/unit/gateway/gateway.unit.test.js)
- Targets:
  - [/backend/services/api-gateway/src/middleware/auth.js](/backend/services/api-gateway/src/middleware/auth.js)
  - [/backend/services/api-gateway/src/middleware/rbac.js](/backend/services/api-gateway/src/middleware/rbac.js)
  - [/backend/services/api-gateway/src/forwarder.js](/backend/services/api-gateway/src/forwarder.js)

Coverage:
- public route classification
- 401 behavior for missing/invalid JWT on protected routes
- 403 behavior for RBAC failures on announcement write routes
- forwarder behavior:
  - preserves status code
  - forwards JSON responses
  - preserves upstream headers (except `transfer-encoding`)

#### 3.2.3 Announcement service validation and authorization helpers
- File: [backend/tests/unit/announcement/announcement.unit.test.js](/backend/tests/unit/announcement/announcement.unit.test.js)
- Targets: [/backend/services/announcement-service/src/app.js](/backend/services/announcement-service/src/app.js)

Coverage:
- validation primitives (`isNonEmptyString`, `isValidUuid`)
- targetAudience normalization (`normalizeTargetAudience`)
- authorization helper (`requireWriter`) enforcing `admin|faculty`

#### 3.2.4 Announcement event envelope construction
- File: [/backend/tests/unit/announcement/announcement.publisher.unit.test.js](/backend/tests/unit/announcement/announcement.publisher.unit.test.js)
- Targets: [/backend/services/announcement-service/src/publisher.js](/backend/services/announcement-service/src/publisher.js)

Coverage:
- envelope field presence and shape:
  - `eventId` (string)
  - `eventType`
  - `producer` (`announcement-service`)
  - `occurredAt` (string)
  - `data` pass-through

#### 3.2.5 Notification service event handling
- File: [/backend/tests/unit/notification/notification.unit.test.js](/backend/tests/unit/notification/notification.unit.test.js)
- Targets: [/backend/services/notification-service/src/service.js](/backend/services/notification-service/src/service.js)

Coverage:
- UUID validation
- announcement event processing:
  - recipient filtering by role/department/year
  - idempotency via processed-event check
  - notification row insertion behavior (test double)
  - publisher call behavior

Special focus:
- explicit test for rule: if `targetAudience.roles` exists and does not include `student`, notify nobody.

### 3.3 Unit testing invariants
The unit tests establish the following contract-level invariants:

| Invariant | Enforced by |
|---|---|
| Gateway rejects missing/invalid bearer tokens on protected routes | gateway unit test |
| Gateway RBAC blocks announcement writes for student | gateway unit test |
| Announcement service requires writer role for write operations | announcement unit test |
| Event envelopes have stable core fields | publisher unit test |
| Notification consumer is idempotent by `eventId` | notification unit test |

## 4. Integration testing (compose + real infra)

### 4.1 Integration test runner
- Script: `/backend/package.json:test:integration`

```text
node --test tests/integration/**/*.test.js
```

### 4.2 Preconditions
Integration tests are designed to run against a live compose stack.

Required:
- API Gateway reachable at `GATEWAY_BASE_URL` (default `http://localhost:3000`)
- RabbitMQ reachable at `RABBITMQ_URL` (default `amqp://cdcp_user:1234@localhost:5672`)

If gateway is not reachable, tests call `t.skip(...)`.

### 4.3 Integration suites

#### 4.3.1 Gateway/Auth integration
- File: [/backend/tests/integration/gateway/gateway-auth.compose.test.js](/backend/tests/integration/gateway/gateway-auth.compose.test.js)

Validates:
- register → login → profile happy path
- register validation failures
- duplicate email behavior (409)
- login invalid payload behavior (400)
- login failure behavior (401)
- profile missing token behavior through gateway (401)
- profile invalid token behavior through gateway (401)
- profile with validly signed token but missing user returns 401 (anti-enumeration)

#### 4.3.2 Announcement + RabbitMQ integration
- File: [/backend/tests/integration/gateway/gateway-announcement.compose.test.js](/backend/tests/integration/gateway/gateway-announcement.compose.test.js)

Validates:
- announcement CRUD through gateway with faculty token
- publish behavior:
  - publishing emits `announcement.published`
  - re-publish is idempotent (no second `announcement.published`)
  - updating a published announcement emits `announcement.updated`

RabbitMQ verification mechanism:
- creates an **exclusive, auto-delete** queue and binds routing keys
- consumes and inspects the JSON envelope
- uses timeouts and diagnostics rather than hard-failing if message not observed (to avoid flaky pipelines when broker wiring is misconfigured)

#### 4.3.3 Notification end-to-end integration
- File: [/backend/tests/integration/gateway/gateway-notification.compose.test.js](/backend/tests/integration/gateway/gateway-notification.compose.test.js)

Validates:
- publish announcement → notification rows appear for matching students
- unread count endpoint
- mark-as-read updates `readAt`
- `notification.read` event emitted
- updating a published announcement creates additional notification rows due to `(announcementId, userId, channel, sourceEventId)` uniqueness

This suite intentionally includes polling loops with delays to accommodate asynchronous processing.

## 5. E2E testing (Postman)

### 5.1 Canonical Postman collection
- File: [/backend/tests/postman/cdcp_complete_postman_collection.json](/backend/tests/postman/cdcp_complete_postman_collection.json)

Collection properties:
- single consolidated collection spanning auth, announcements, notifications, feedback, analytics
- collection variables:
  - `gatewayBaseUrl`
  - `ts`, `studentEmail`, `facultyEmail` (generated per run)

### 5.2 Intended usage
Recommended procedure:
1. Start compose stack.
2. Import Postman collection.
3. Set `gatewayBaseUrl` to `http://localhost:3000`.
4. Run the collection with the Collection Runner.

Note:
- Newman automation is not currently wired in CI; this is a documented improvement opportunity.

## 6. Reliability model (as implemented)

## 6.1 Reliability goals
| Concern | Guarantee |
|---|---|
| Message delivery | At-least-once delivery semantics via manual ack/nack requeue |
| Duplicate message handling | Idempotent consumers via processed-event tables keyed by `eventId` |
| Duplicate row insertion | Uniqueness constraints for notifications |
| Service startup ordering | Compose health checks + retry loops for DB and RabbitMQ |

## 6.2 RabbitMQ consumer retry behavior
Consumers:
- [notification-service/src/consumer.js](notification-service/src/consumer.js)
- [feedback-analytics-service/src/consumer.js](feedback-analytics-service/src/consumer.js)

Behavior:
- JSON parse failure or handler exception triggers `nack(msg, false, true)` → requeue.

Operational implication:
- transient failures are retried automatically
- persistent poison messages can cause infinite redelivery (no DLQ configured)

## 6.3 Idempotency strategy
### 6.3.1 Notification service
- Table: `notifications.NotificationProcessedEvent`
- Key: `eventId`
- Logic: if already processed, drop event.

### 6.3.2 Feedback/analytics service
- Table: `engagement.ProcessedEvent`
- Key: `eventId`
- Logic: if already processed, drop event.

### 6.3.3 Notification uniqueness constraint
Notifications are protected against duplicates at the data layer:
- Unique key: `(announcementId, userId, channel, sourceEventId)`

Effect:
- same announcement event (`sourceEventId`) cannot create duplicate notifications for the same user/channel.
- updates to published announcements produce new `sourceEventId` and therefore intentionally create additional rows (observable in integration tests).

## 6.4 Database readiness
Services that use `waitForDb`:
- notification-service
- feedback-analytics-service

Behavior:
- retry loop attempting `SELECT 1`

Announcement-service and auth-service connect directly without an explicit readiness loop; their docker-compose health checks will fail until DB is ready.

## 6.5 RabbitMQ connection readiness
Publishers implement `connectRabbitWithRetry(url, { attempts })`:
- retry with incremental backoff up to a capped sleep

## 7. Failure mode analysis (developer-operational)

### 7.1 Broker unavailable
Expected behavior:
- publishers retry connection attempts during startup
- consumers retry connection attempts during startup

If RabbitMQ goes down after startup:
- current code does not implement channel reconnection logic; process may error depending on amqplib behavior.

### 7.2 Database unavailable
Expected behavior:
- services with `waitForDb` block startup until DB is reachable
- others may fail requests until DB connectivity restored

### 7.3 Event payload malformed
Expected behavior:
- consumer `JSON.parse` fails → message requeued indefinitely

Mitigation recommended (not implemented):
- DLQ + poison message quarantine
- schema validation and reject-to-DLQ on validation failures

## 8. Test execution procedures (deterministic)

### 8.1 Local unit tests
From `backend/`:
- `npm run test:unit`

### 8.2 Local integration tests
1. From repo root: `docker compose up -d --build`
2. From `backend/`: `npm run test:integration`

Environment overrides:
- `GATEWAY_BASE_URL`
- `RABBITMQ_URL`
- `JWT_SECRET` (for signing synthetic JWTs in tests)

---

## 9. References
- Unit tests root: [backend/tests/unit/](../backend/tests/unit/)
- Integration tests root: [backend/tests/integration/](../backend/tests/integration/)
- Postman collections: [/backend/tests/postman/cdcp_complete_postman_collection.json](/backend/tests/postman/cdcp_complete_postman_collection.json)
- DB schema: [backend/packages/db/prisma/schema.prisma](../backend/packages/db/prisma/schema.prisma)
- Events contract: [docs/events.md](./events.md)
