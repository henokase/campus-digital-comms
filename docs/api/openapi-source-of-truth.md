# CDCP API Gateway — OpenAPI / Swagger

## 1. Purpose and scope
This document is the reference for the public HTTP API of the Campus Digital Communication Platform (CDCP).

The public API contract is generated **code-first** from the API Gateway implementation:
- **Generator**: `swagger-jsdoc`
- **UI**: `swagger-ui-express`
- **Documentation blocks**: `@openapi` JSDoc blocks embedded in `backend/services/api-gateway/src/app.js`

The canonical machine-readable artifact is:
- [docs/api/api-gateway.openapi.json](./api-gateway.openapi.json)

> Any discrepancy between this Markdown document and the exported OpenAPI JSON must be treated as a documentation defect. The exported JSON is the canonical contract.

### Scope
- **Included**: Public, client-facing endpoints exposed by the **API Gateway**.
- **Excluded**: Service-internal endpoints that are not meant to be called directly by clients (e.g., direct calls to `auth-service:3001`).

### Server and base URL
Default (local development):
- Base URL: `http://localhost:3000`

The OpenAPI `servers[0].url` is generated from:
- `PUBLIC_BASE_URL` (if set) otherwise
- `http://localhost:${PORT}`

| Parameter | Source | Default | Notes |
|---|---:|---:|---|
| `PORT` | API Gateway container env | `3000` | Must match Docker port mapping for host access. |
| `PUBLIC_BASE_URL` | API Gateway env | unset | Recommended in deployed environments to publish correct server URL in Swagger. |

---

## 2. Swagger runtime exposure policy (non-production only)
Swagger is intentionally disabled in production.

### 2.1 Enablement rule
Swagger is mounted only when:
- `NODE_ENV !== 'production'`

### 2.2 Endpoints
| Endpoint | Method | Description | Availability |
|---|---|---|---|
| `/api-docs` | GET | Swagger UI | `NODE_ENV != production` |
| `/api-docs.json` | GET | OpenAPI JSON (runtime) | `NODE_ENV != production` |

### 2.3 Offline / artifact export
An export script writes the canonical spec artifact:

- Service: `backend/services/api-gateway`
- Script: `npm run openapi:export`
- Output: `docs/api/api-gateway.openapi.json`

This export does **not** require the gateway server to be running.

---

## 3. Security model
### 3.1 Authentication mechanism
- **Type**: JWT bearer token
- **Transport**: HTTP header

**Header**:
- `Authorization: Bearer <JWT>`

OpenAPI security scheme:
- `components.securitySchemes.BearerAuth` (`type=http`, `scheme=bearer`, `bearerFormat=JWT`)

### 3.2 Authorization model (RBAC)
The API Gateway enforces coarse-grained RBAC for:
- Announcement writes
- Analytics endpoints

| Capability | Gateway check | Allowed roles |
|---|---|---|
| Announcement write operations | `rbacMiddleware` | `admin`, `faculty` |
| Analytics endpoints | `rbacMiddleware` | `admin`, `faculty` |

### 3.3 Public vs protected routes
The gateway `authMiddleware` classifies routes:

| Route pattern | Method(s) | Public? | Notes |
|---|---|---:|---|
| `/health` | GET | Yes | Gateway health only. |
| `/api/auth/register` | POST | Yes | Registration is public. |
| `/api/auth/login` | POST | Yes | Login is public. |
| `/api/announcements` | GET | Yes | Announcements list is public. |
| `/api/announcements/*` | GET | Yes | Announcement read is public. |
| Everything else under `/api/*` | varies | No | Requires valid bearer token. |

### 3.4 Identity propagation to internal services
The gateway forwards requests to downstream services and injects identity headers when JWT is present:

| Header | Source | Purpose |
|---|---|---|
| `x-user-id` | JWT claim `userId` | Downstream user identity (UUID). |
| `x-user-role` | JWT claim `role` | Downstream role enforcement / analytics RBAC. |

> Downstream services (notification-service, feedback-analytics-service) explicitly rely on these headers and return `401` if missing.

---

## 4. Error model (cross-service)
Services generally return a structured error object.

### 4.1 Canonical error envelope
Schema: `components.schemas.ErrorResponse`

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing Bearer token.",
    "details": {
      "message": "...optional..."
    }
  }
}
```

### 4.2 Common HTTP status codes
| HTTP | Meaning in CDCP | Typical `error.code` |
|---:|---|---|
| 400 | Validation / invalid input | `INVALID_*` |
| 401 | Missing/invalid auth, missing gateway identity headers | `UNAUTHORIZED` |
| 403 | Authenticated but not authorized | `FORBIDDEN` |
| 404 | Resource not found | `NOT_FOUND` |
| 409 | Conflict (e.g., email exists) | `EMAIL_EXISTS` |
| 500 | Internal error | `INTERNAL_ERROR` |
| 502 | Gateway upstream failure | `BAD_GATEWAY` |

---

## 5. Public API inventory (Gateway)
This section describes the public API surface. For the definitive request/response schemas and parameter definitions, consult:
- [docs/api/api-gateway.openapi.json](./api-gateway.openapi.json)

### 5.1 Health
| Operation | Method | Path | Auth | Notes |
|---|---|---|---:|---|
| Health check | GET | `/health` | No | Returns `{status:'ok', service:'api-gateway'}` |

### 5.2 Auth
| Operation | Method | Path | Auth | Notes |
|---|---|---|---:|---|
| Register user | POST | `/api/auth/register` | No | Creates user in auth service. |
| Login | POST | `/api/auth/login` | No | Returns JWT + user. |
| Profile | GET | `/api/auth/profile` | Yes | Requires bearer token. |

### 5.3 Announcements
| Operation | Method | Path | Auth | RBAC |
|---|---|---|---:|---|
| List announcements | GET | `/api/announcements` | No | Public read |
| Get announcement | GET | `/api/announcements/{id}` | No | Public read |
| Create announcement | POST | `/api/announcements` | Yes | faculty/admin |
| Update announcement | PUT | `/api/announcements/{id}` | Yes | faculty/admin |
| Delete announcement | DELETE | `/api/announcements/{id}` | Yes | faculty/admin |
| Publish announcement | POST | `/api/announcements/{id}/publish` | Yes | faculty/admin |

### 5.4 Notifications
| Operation | Method | Path | Auth | Notes |
|---|---|---|---:|---|
| List notifications | GET | `/api/notifications` | Yes | Pagination via `limit` and `offset`. |
| Unread count | GET | `/api/notifications/unread-count` | Yes | Returns `{ count }`. |
| Mark read | PUT | `/api/notifications/{id}/read` | Yes | Marks `readAt`. Emits `notification.read` event. |

### 5.5 Feedback
| Operation | Method | Path | Auth | Notes |
|---|---|---|---:|---|
| Submit feedback | POST | `/api/feedback` | Yes | Requires `announcementId` + `reactionType`. |
| Update feedback | PATCH | `/api/feedback/{id}` | Yes | Only owner can update. |
| List my feedback | GET | `/api/feedback/my` | Yes | Pagination via `limit` and `offset`. |
| List feedback for announcement | GET | `/api/feedback/announcement/{announcementId}` | Yes | Anonymity enforced in response. |

### 5.6 Analytics (admin/faculty)
| Operation | Method | Path | Auth | RBAC |
|---|---|---|---:|---|
| Dashboard | GET | `/api/analytics/dashboard` | Yes | faculty/admin |
| Metrics per announcement | GET | `/api/analytics/announcement/{announcementId}` | Yes | faculty/admin |
| Top announcements | GET | `/api/analytics/top-announcements` | Yes | faculty/admin |

---

## 6. Environment variables (Swagger + API correctness)
This section lists the environment variables that directly influence the public API behavior, documentation behavior, or authentication.

### 6.1 API Gateway variables
| Variable | Required | Example | Effect |
|---|---:|---:|---|
| `NODE_ENV` | Yes | `development` | Controls Swagger enablement (`!= production`). |
| `PORT` | Yes | `3000` | Gateway listen port. |
| `JWT_SECRET` | Yes | `min 10 chars` | JWT verification. Must match issuer (auth-service). |
| `PUBLIC_BASE_URL` | No | `http://localhost:3000` | Sets OpenAPI server URL. |
| `AUTH_SERVICE_URL` | Yes | `http://auth-service:3001` | Upstream routing. |
| `ANNOUNCEMENT_SERVICE_URL` | Yes | `http://localhost:3002` | Upstream routing. |
| `NOTIFICATION_SERVICE_URL` | Yes | `http://localhost:3003` | Upstream routing. |
| `FEEDBACK_ANALYTICS_SERVICE_URL` | Yes | `http://localhost:3004` | Upstream routing. |

---

## 7. Operational usage
### 7.1 Accessing Swagger from Docker
When running via Docker Compose with `api-gateway` exposing `3000:3000`:
- `http://localhost:3000/api-docs`
- `http://localhost:3000/api-docs.json`

### 7.2 Maintaining the contract
Required maintenance rule:
- Any route change under `/api/*` MUST be accompanied by updating the nearest `@openapi` block in `backend/services/api-gateway/src/app.js`.

---

## 8. References
- Runtime Swagger UI: `/api-docs`
- Runtime JSON: `/api-docs.json`
- Exported OpenAPI artifact: [docs/api/api-gateway.openapi.json](./api-gateway.openapi.json)
- Gateway implementation: [backend/services/api-gateway/src/app.js](../../backend/services/api-gateway/src/app.js)
- Auth middleware: [backend/services/api-gateway/src/middleware/auth.js](../../backend/services/api-gateway/src/middleware/auth.js)
- RBAC middleware: [backend/services/api-gateway/src/middleware/rbac.js](../../backend/services/api-gateway/src/middleware/rbac.js)
- Forwarder: [backend/services/api-gateway/src/forwarder.js](../../backend/services/api-gateway/src/forwarder.js)
