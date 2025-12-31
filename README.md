<p align="center">
  <img src="./frontend/src/assets/logo.png" alt="Project Logo" width="120"/>
</p>

<h1 align="center">Campus Digital Communication Platform (CDCP)</h1>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg"/>
  <img src="https://img.shields.io/badge/Made%20with-TypeScript%20%26%20JavaScript-3178C6?logo=typescript&logoColor=white&labelColor=F7DF1E&color=3178C6"/>
  <img src="https://img.shields.io/badge/Node.js-Enabled-green?logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/Powered%20by-Express-black?logo=express&logoColor=white"/>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen"/>
</p>

---

CDCP is a distributed, event-driven campus communication system that supports:
- announcements (create/update/publish)
- in-app notifications for targeted student audiences
- feedback capture and engagement analytics

The system uses a **microservices** architecture behind an **API Gateway**, with **PostgreSQL** for persistence and **RabbitMQ** for asynchronous event propagation.

## Contents
- [Quick start (Docker Compose)](#quick-start-docker-compose)
- [Services, ports, and URLs](#services-ports-and-urls)
- [Architecture summary](#architecture-summary)
- [API documentation (OpenAPI/Swagger)](#api-documentation-openapiswagger)
- [Event contracts (RabbitMQ)](#event-contracts-rabbitmq)
- [Environment variables](#environment-variables)
- [Running tests](#running-tests)
- [Operational notes](#operational-notes)
- [Troubleshooting](#troubleshooting)
- [Project documentation index](#project-documentation-index)

## Quick start (Docker Compose)

### Prerequisites
- Docker Desktop (or Docker Engine + Compose)
- Node.js (recommended: 22+, minimum: 20+)

### 1) Configure environment
1. Copy: [.env.example](./.env.example) → `.env`
2. Update values as needed (especially `JWT_SECRET` and DB/RabbitMQ credentials).

### 2) Start the full stack
From repository root:

```bash
docker compose up -d --build
```

This starts:
- PostgreSQL
- RabbitMQ (with management UI)
- API Gateway + all backend services
- Frontend

### 3) Run database migrations (required on first run)
Migrations are applied via a dedicated compose tool service:

```bash
docker compose --profile tools run --rm db-migrate
```

The migration workflow is implemented by:
- [docker-compose.yml](./docker-compose.yml) (`db-migrate` service)
- Prisma scripts in [backend/packages/db/package.json](./backend/packages/db/package.json)

### 4) Verify health
All services expose `GET /health`.

- Example:
Gateway health: `http://localhost:3000/health`

## Services, ports, and URLs

### Public entry points
| Component | URL | Notes |
|---|---|---|
| Frontend | `http://localhost:5000` | React + Vite |
| API Gateway (public API) | `http://localhost:3000` | All client traffic goes through the gateway |

### Backend services (internal, for debugging)
| Service | Default port | Health |
|---|---:|---|
| auth-service | 3001 | `http://localhost:3001/health` |
| announcement-service | 3002 | `http://localhost:3002/health` |
| notification-service | 3003 | `http://localhost:3003/health` |
| feedback-analytics-service | 3004 | `http://localhost:3004/health` |

### Infrastructure
| Component | Port(s) | URL |
|---|---:|---|
| PostgreSQL | 5432 | `localhost:5432` |
| RabbitMQ | 5672 | `amqp://localhost:5672` |
| RabbitMQ Management UI | 15672 | `http://localhost:15672` |
| Prisma Studio (tools profile) | 5555 | `http://localhost:5555` |

To start Prisma Studio:

```bash
docker compose --profile tools up -d prisma-studio
```

## Architecture summary

### Key design
- **Single public API surface**: the API Gateway forwards `/api/*` traffic to internal services.
- **JWT authentication + RBAC**: enforced at the gateway; identity is propagated via headers.
- **Asynchronous workflows**: RabbitMQ topic exchange `cdcp.events` carries domain events.
- **Idempotent consumers**: services record processed `eventId` to handle at-least-once delivery.

### Service responsibilities
| Service | Responsibilities |
|---|---|
| API Gateway | JWT auth, RBAC, reverse proxy routing, Swagger UI (non-prod) |
| Auth Service | user registration/login/profile, password hashing, JWT issuance |
| Announcement Service | announcement CRUD + publish; emits `announcement.*` events |
| Notification Service | consumes `announcement.*`; creates notifications; emits `notification.*` |
| Feedback/Analytics Service | feedback endpoints + analytics endpoints; consumes events; maintains metrics |

For full architecture documentation, see:
- [docs/architecture.md](./docs/architecture.md)

## API documentation (OpenAPI/Swagger)

### Runtime Swagger (development only)
Swagger is mounted only when `NODE_ENV != 'production'`:
- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON (runtime): `http://localhost:3000/api-docs.json`

### Canonical exported OpenAPI artifact
- OpenAPI JSON (source of truth): [docs/api/api-gateway.openapi.json](./docs/api/api-gateway.openapi.json)

To regenerate the exported OpenAPI file (no server required):

```bash
npm --prefix backend/services/api-gateway run openapi:export
```

Implementation reference:
- Export script: [backend/services/api-gateway/scripts/export-openapi.js](./backend/services/api-gateway/scripts/export-openapi.js)
- Gateway OpenAPI source blocks: [backend/services/api-gateway/src/app.js](./backend/services/api-gateway/src/app.js)
- OpenAPI documentation guide: [docs/api/openapi-source-of-truth.md](./docs/api/openapi-source-of-truth.md)

## Event contracts (RabbitMQ)

CDCP uses RabbitMQ as an event bus:
- Exchange: `cdcp.events` (topic)
- Routing key: equals `eventType` (e.g., `announcement.published`)
- Envelope: `{ eventId, eventType, occurredAt, producer, data }`

Authoritative contract:
- [docs/events.md](./docs/events.md)

## Environment variables

Baseline examples:
- [.env.example](./.env.example)

### Required / important variables
| Variable | Used by | Purpose |
|---|---|---|
| `JWT_SECRET` | gateway + auth + announcement | JWT signing/verification secret (keep private) |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | postgres + services | database credentials |
| `RABBITMQ_USER`, `RABBITMQ_PASSWORD` | rabbitmq | broker credentials |
| `RABBITMQ_URL` | announcement/notification/feedback-analytics | AMQP connection string |
| `API_GATEWAY_URL` | frontend | base URL for API calls |

Notes:
- In Docker Compose, services use `DB_HOST=postgres` and `rabbitmq` as the broker hostname (see [docker-compose.yml](./docker-compose.yml)).

## Running tests

### Unit tests
From [backend/](./backend/):

```bash
npm --prefix backend run test:unit
```

Unit tests are located in:
- [backend/tests/unit/](./backend/tests/unit/)

### Integration tests (requires running compose stack)
1. Start stack: `docker compose up -d --build`
2. Run:

```bash
npm --prefix backend run test:integration
```

Integration tests are located in:
- [backend/tests/integration/](./backend/tests/integration/)

### E2E (Postman)
Canonical collection:
- [backend/tests/postman/cdcp_complete_postman_collection.json](./backend/tests/postman/cdcp_complete_postman_collection.json)

Recommended:
- Set `gatewayBaseUrl = http://localhost:3000`
- Run the collection end-to-end in Postman Collection Runner

For detailed testing and reliability coverage, see:
- [docs/testing-reliability.md](./docs/testing-reliability.md)

## Operational notes

### Health endpoints
Every service exposes `GET /health` (used by Compose health checks).

### Reliability and idempotency
RabbitMQ consumers implement at-least-once processing with idempotency ledgers:
- `notifications.NotificationProcessedEvent`
- `engagement.ProcessedEvent`

Data model reference:
- [backend/packages/db/prisma/schema.prisma](./backend/packages/db/prisma/schema.prisma)

## Troubleshooting

### Containers are healthy but features don’t work
- Ensure migrations ran at least once:
  - `docker compose --profile tools run --rm db-migrate`

### RabbitMQ connection errors
- Check broker health:
  - `http://localhost:15672`
- Verify `RABBITMQ_URL` matches your credentials in `.env`.

### Swagger UI not available
- Confirm `NODE_ENV` is not `production` in:
  - [docker-compose.yml](./docker-compose.yml)

## Project documentation index

- Architecture (SDD-style): [docs/architecture.md](./docs/architecture.md)
- Testing & reliability: [docs/testing-reliability.md](./docs/testing-reliability.md)
- OpenAPI source-of-truth: [docs/api/openapi-source-of-truth.md](./docs/api/openapi-source-of-truth.md)
- Exported OpenAPI artifact: [docs/api/api-gateway.openapi.json](./docs/api/api-gateway.openapi.json)
- Event contracts: [docs/events.md](./docs/events.md)
