# CDCP — Architecture and Design

## 1. Document purpose
This document is the **system design description (SDD-style)** for the Campus Digital Communication Platform (CDCP). It is intended to be sufficiently explicit for a new engineer to:
- understand the decomposition into services and the boundaries between them
- understand the synchronous (HTTP) and asynchronous (RabbitMQ) communication paths
- understand the data model, schemas, and cross-service data dependencies
- run and operate the system in local development (Docker Compose)

## 2. System scope and problem statement
CDCP is a distributed, event-driven system for campus communication.

### 2.1 Primary capabilities (functional scope)
- Identity and role-based access control (RBAC)
- Announcement lifecycle management (create, update, publish)
- Delivery of in-app notifications to target audiences
- Feedback capture and engagement analytics (metrics)

### 2.2 Architectural principles (as implemented)
| Principle | Implementation evidence |
|---|---|
| Single public entry point | API Gateway (`backend/services/api-gateway`) is the only client-facing service. |
| Separation of concerns | Auth, announcement lifecycle, notification delivery, and analytics are isolated into distinct services and DB schemas. |
| Event-driven propagation | Announcement publication/update emits events; downstream services derive notifications/metrics asynchronously. |
| At-least-once message delivery | RabbitMQ consumers `ack` on success and `nack(requeue=true)` on failure. |
| Idempotent consumers | Consumers store processed `eventId` in service-owned idempotency tables. |

## 3. High-level architecture overview

### 3.1 Component diagram (textual)
**Client (Frontend / Postman / Browser)**
- communicates only with **API Gateway** over HTTP

**API Gateway**
- authenticates JWT bearer tokens
- enforces RBAC for privileged operations
- forwards traffic to internal services (reverse proxy)
- propagates user identity to internal services via headers

**Auth Service**
- user registration
- password hashing
- JWT issuance and verification (token minted here)

**Announcement Service**
- announcement CRUD
- publish operation
- emits announcement domain events

**Notification Service**
- consumes announcement events
- computes recipients via DB query against `auth.User`
- persists notification rows
- emits notification events

**Feedback/Analytics Service**
- feedback CRUD
- consumes notification + feedback events
- maintains per-announcement engagement metrics

**PostgreSQL**
- single physical DB instance
- multiple schemas (multi-tenant-by-schema)

**RabbitMQ**
- single topic exchange used as an event bus

### 3.2 Service inventory
| Service | Path | Default port | Responsibilities |
|---|---|---:|---|
| API Gateway | `backend/services/api-gateway` | 3000 | JWT auth, RBAC, reverse proxy, Swagger UI (non-prod) |
| Auth Service | `backend/services/auth-service` | 3001 | register/login/profile, JWT mint/verify, user persistence |
| Announcement Service | `backend/services/announcement-service` | 3002 | announcements CRUD + publish; emits `announcement.*` |
| Notification Service | `backend/services/notification-service` | 3003 | consume `announcement.*`, create notifications, emit `notification.*` |
| Feedback/Analytics Service | `backend/services/feedback-analytics-service` | 3004 | feedback endpoints + analytics endpoints; consume events and maintain metrics |

## 4. Deployment architecture (Docker Compose)

### 4.1 Runtime topology
The reference deployment is defined in `docker-compose.yml`.

| Container | Image/build | Exposed ports (host → container) | Depends on |
|---|---|---|---|
| postgres | `postgres:14` | `5432:5432` | — |
| rabbitmq | `rabbitmq:3.13-management` | `5672:5672`, `15672:15672` | — |
| api-gateway | build `./backend/services/api-gateway` | `3000:3000` | auth-service, announcement-service, notification-service, feedback-analytics-service |
| auth-service | build `./backend/services/auth-service` | `3001:3001` | postgres |
| announcement-service | build `./backend/services/announcement-service` | `3002:3002` | postgres, rabbitmq |
| notification-service | build `./backend/services/notification-service` | `3003:3003` | postgres, rabbitmq |
| feedback-analytics-service | build `./backend/services/feedback-analytics-service` | `3004:3004` | postgres, rabbitmq |
| frontend | build `./frontend` | `5000:5000` | api-gateway |

### 4.2 Health checks
Each service exposes `GET /health` and docker-compose defines health checks that:
- poll the internal service port from within the container
- gate `depends_on` readiness for the gateway

### 4.3 Environment configuration (dev)
The system primarily uses environment variables, injected via `docker-compose.yml` (and optionally `.env` substitution).

#### 4.3.1 Global variables (commonly used)
| Variable | Used by | Example |
|---|---|---|
| `NODE_ENV` | all services | `development` |
| `JWT_SECRET` | gateway + auth + announcement | `...` |
| `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` | services using PG via `pg` | `postgres` / `5432` / ... |
| `DATABASE_URL` | services (auth uses direct pool, others may use both) | `postgresql://...` |
| `RABBITMQ_URL` | announcement/notification/feedback-analytics | `amqp://...@rabbitmq:5672` |
| `EVENTS_EXCHANGE` | all event publishers/consumers | optional; default `cdcp.events` |

#### 4.3.2 API Gateway upstream routing
The API Gateway routes by prefix and forwards the **original URL path** to the target service.

| Env var | Default in compose | Meaning |
|---|---|---|
| `AUTH_SERVICE_URL` | `http://auth-service:3001` | upstream base URL for `/api/auth/*` |
| `ANNOUNCEMENT_SERVICE_URL` | `http://announcement-service:3002` | upstream base URL for `/api/announcements/*` |
| `NOTIFICATION_SERVICE_URL` | `http://notification-service:3003` | upstream base URL for `/api/notifications/*` |
| `FEEDBACK_ANALYTICS_SERVICE_URL` | `http://feedback-analytics-service:3004` | upstream base URL for `/api/feedback/*` and `/api/analytics/*` |

## 5. Synchronous communication (HTTP)

### 5.1 API Gateway routing model
The gateway is a reverse proxy with three key responsibilities:

1) **Authentication** (`authMiddleware`)
- validates `Authorization: Bearer <JWT>` for non-public routes
- attaches `req.user` claims when valid

2) **Authorization** (`rbacMiddleware`)
- blocks announcement write operations and analytics reads for non-`admin|faculty`

3) **Forwarding** (`forwardRequest`)
- forwards request method, headers, and JSON body to upstream service
- injects identity headers when `req.user` exists:
  - `x-user-id`
  - `x-user-role`

### 5.2 Public vs protected endpoints (gateway-level)
| Endpoint family | Public read | Protected write | Notes |
|---|---:|---:|---|
| `/api/auth/*` | register/login public | profile protected | Auth service also validates token for profile. |
| `/api/announcements/*` | GET public | POST/PUT/DELETE/PUBLISH protected | Announcement service also checks writer role itself. |
| `/api/notifications/*` | No | Yes | Notification service requires `x-user-id` header from gateway. |
| `/api/feedback/*` | No | Yes | Feedback service requires `x-user-id` header from gateway. |
| `/api/analytics/*` | No | Yes | Gateway RBAC + feedback/analytics service role check (`x-user-role`). |

## 6. Asynchronous communication (RabbitMQ)
See `docs/events.md` for the canonical contract. The following section describes the architectural intent and flow.

### 6.1 Event bus
- Exchange: `cdcp.events` (topic)
- Routing key: equals `eventType`
- Envelope: `{ eventId, eventType, occurredAt, producer, data }`

### 6.2 Event-driven workflow (end-to-end)
#### 6.2.1 Publish announcement → notifications
1) Faculty/Admin publishes an announcement via gateway
2) Announcement service updates status to `published`
3) Announcement service publishes `announcement.published`
4) Notification service consumes the event and selects target students
5) Notification service inserts notifications and emits `notification.sent`

#### 6.2.2 Notification read → analytics
1) Student marks a notification as read via gateway
2) Notification service updates `readAt` and emits `notification.read`
3) Feedback/analytics service consumes `notification.read` and increments read metrics

#### 6.2.3 Feedback submit/update → analytics
1) Student submits feedback via gateway
2) Feedback/analytics service persists feedback and emits `feedback.submitted`
3) Feedback/analytics service also consumes feedback events and updates metrics

## 7. Data architecture (PostgreSQL)

### 7.1 Database organization
A single PostgreSQL database is used with **multiple schemas** (Prisma `multiSchema`).

| Schema | Ownership | Purpose |
|---|---|---|
| `auth` | auth-service | user identity and attributes |
| `announcements` | announcement-service | announcement records |
| `notifications` | notification-service | notification records + idempotency |
| `engagement` | feedback-analytics-service | feedback records + metrics + idempotency |

### 7.2 Canonical data model (Prisma)
Canonical schema is defined in:
- `backend/packages/db/prisma/schema.prisma`

#### 7.2.1 `auth.User`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `email` | string | unique |
| `passwordHash` | string | required |
| `role` | string | required (`admin|faculty|student` enforced at app-level) |
| `fullName` | string | nullable |
| `department` | string | nullable |
| `year` | int | nullable |
| `createdAt` | timestamp | default now |
| `updatedAt` | timestamp | updatedAt |

#### 7.2.2 `announcements.Announcement`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `title` | string | required |
| `content` | string | required |
| `type` | string | required |
| `category` | string | nullable |
| `priority` | string | required |
| `createdBy` | UUID | required (user id) |
| `targetAudience` | JSON | required |
| `status` | string | default `draft` |
| `publishedAt` | timestamp | nullable |
| `createdAt` | timestamp | default now |
| `updatedAt` | timestamp | updatedAt |

#### 7.2.3 `notifications.Notification`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `announcementId` | UUID | required |
| `userId` | UUID | required |
| `channel` | string | required |
| `sourceEventId` | string | required |
| `status` | string | required |
| `sentAt` | timestamp | nullable |
| `readAt` | timestamp | nullable |
| `errorMessage` | string | nullable |
| `createdAt` | timestamp | default now |
| `updatedAt` | timestamp | updatedAt |

Unique constraint:
- `(announcementId, userId, channel, sourceEventId)`

#### 7.2.4 `notifications.NotificationProcessedEvent`
Idempotency ledger for announcement events.

| Column | Type | Constraints |
|---|---|---|
| `eventId` | string | PK |
| `eventType` | string | required |
| `processedAt` | timestamp | default now |

#### 7.2.5 `engagement.Feedback`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `announcementId` | UUID | required |
| `userId` | UUID | required |
| `reactionType` | string | required |
| `comment` | string | nullable |
| `rating` | int | nullable (1–5 enforced at app-level) |
| `isAnonymous` | boolean | default false |
| `createdAt` | timestamp | default now |
| `updatedAt` | timestamp | updatedAt |

#### 7.2.6 `engagement.AnnouncementMetrics`
| Column | Type | Constraints |
|---|---|---|
| `announcementId` | UUID | PK |
| `notificationsSent` | int | default 0 |
| `notificationsRead` | int | default 0 |
| `feedbackCount` | int | default 0 |
| `lastUpdatedAt` | timestamp | default now |

#### 7.2.7 `engagement.ProcessedEvent`
Idempotency ledger for analytics consumer.

| Column | Type | Constraints |
|---|---|---|
| `eventId` | string | PK |
| `eventType` | string | required |
| `processedAt` | timestamp | default now |

### 7.3 Cross-schema coupling (explicit)
While each service owns a schema, the implementation performs cross-schema reads:

| Consumer | Cross-schema dependency | Purpose |
|---|---|---|
| notification-service | reads `auth.User` | compute recipients by role/department/year |
| feedback-analytics-service | joins `engagement.Feedback` with `auth.User` | enrich non-anonymous feedback listings |

This coupling is acceptable for the project scope but should be documented as a deliberate design tradeoff.

## 8. Key design decisions and tradeoffs

### 8.1 Gateway-only public API
- Pros: single client integration surface; centralized auth/RBAC; consistent error model
- Cons: gateway becomes a critical dependency; requires careful routing and header propagation

### 8.2 Shared database with per-service schemas
- Pros: operational simplicity; single DB container; clear schema separation
- Cons: cross-schema queries reduce strict service autonomy

### 8.3 RabbitMQ topic exchange
- Pros: easy routing by event type; decoupled producers/consumers
- Cons: requires idempotency and operational policies (DLQ) for production-hardening

## 9. Operational runbook (minimal)

### 9.1 Local startup (reference)
From repository root:
- `docker compose up -d --build`

### 9.2 Primary URLs
| Component | URL |
|---|---|
| Gateway | `http://localhost:3000` |
| Swagger UI (non-prod) | `http://localhost:3000/api-docs` |
| RabbitMQ UI | `http://localhost:15672` |

### 9.3 Shutdown
- `docker compose down`

## 10. References
- Compose definition: [docker-compose.yml](../docker-compose.yml)
- OpenAPI contract: [docs/api/api-gateway.openapi.json](./api/api-gateway.openapi.json)
- Swagger runtime endpoints: `/api-docs`, `/api-docs.json` (non-prod)
- Event contracts: [docs/events.md](./events.md)
- Database schema: [backend/packages/db/prisma/schema.prisma](../backend/packages/db/prisma/schema.prisma)
