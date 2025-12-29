# CDCP Event Contracts — RabbitMQ Pub/Sub

## 1. Purpose and scope
This document defines the **authoritative Pub/Sub contract** for CDCP’s asynchronous messaging over RabbitMQ.

It is derived from the service implementations:
- Announcement publisher: [backend/services/announcement-service/src/publisher.js](../backend/services/announcement-service/src/publisher.js)
- Notification consumer/publisher: [backend/services/notification-service/src/consumer.js](../backend/services/notification-service/src/consumer.js), [backend/services/notification-service/src/publisher.js](../backend/services/notification-service/src/publisher.js)
- Feedback/analytics consumer/publisher: [backend/services/feedback-analytics-service/src/consumer.js](../backend/services/feedback-analytics-service/src/consumer.js), [backend/services/feedback-analytics-service/src/publisher.js](../backend/services/feedback-analytics-service/src/publisher.js)

### Scope
- Exchange name, type, durability
- Routing keys (event types)
- Canonical message envelope schema
- Per-event payload schemas and examples
- Producer and consumer responsibilities
- Delivery semantics, retry behavior, idempotency strategy

---

## 2. Broker topology

### 2.1 Exchange
| Property | Value | Source |
|---|---|---|
| Exchange name | `cdcp.events` | Default `EVENTS_EXCHANGE` fallback in all publishers/consumers |
| Exchange type | `topic` | `assertExchange(EXCHANGE_NAME, 'topic', { durable: true })` |
| Durable | `true` | asserted durable |

### 2.2 Routing model
- Routing key equals `eventType` string.
- Queues are bound to the exchange via routing keys.

### 2.3 Queue declarations
| Service | Default queue name | Durable | Bindings |
|---|---|---:|---|
| notification-service | `notification-service.q` | Yes | `announcement.published`, `announcement.updated` |
| feedback-analytics-service | `feedback-analytics-service.q` | Yes | `notification.sent`, `notification.read`, `feedback.submitted`, `feedback.updated` |

---

## 3. Canonical event envelope
All events MUST use the same envelope schema.

### 3.1 Envelope schema (normative)
Field names and types are **case-sensitive**.

| Field | Type | Required | Description |
|---|---|---:|---|
| `eventId` | UUID string | Yes | Unique id for this event message. Used for consumer idempotency/deduplication. |
| `eventType` | string | Yes | Routing key and semantic type identifier. |
| `occurredAt` | ISO-8601 datetime string | Yes | Timestamp at the producer when the event occurred. |
| `producer` | string | Yes | Producing service identifier (e.g., `announcement-service`). |
| `data` | object | Yes | Event-specific payload. |

### 3.2 Envelope example
```json
{
  "eventId": "e6f18bd1-13a8-4e08-9f9d-086a991b1d62",
  "eventType": "announcement.published",
  "occurredAt": "2025-12-28T08:55:31.104Z",
  "producer": "announcement-service",
  "data": {
    "announcementId": "2a6f1b8e-5b19-4ef4-8a78-6ab9e2d7b2b0",
    "title": "Exam schedule update",
    "content": "Final exam is moved to Friday",
    "type": "general",
    "category": "Academic",
    "priority": "high",
    "createdBy": "b27c83d7-1b95-4b9c-8e9e-bc1e2f6e7d3f",
    "targetAudience": {"roles": ["student"], "departments": ["Software"], "years": [2]},
    "status": "published",
    "publishedAt": "2025-12-28T08:55:31.000Z"
  }
}
```

---

## 4. Delivery semantics and reliability

### 4.1 Persistence
Publishers set:
- `persistent: true`
- `contentType: 'application/json'`

Implication:
- messages are persisted by RabbitMQ (durable exchange + durable queues) assuming the queue is durable.

### 4.2 Consumer acknowledgement
Consumers use manual acknowledgements:
- `ack` on success
- `nack(requeue=true)` on failure

This yields **at-least-once delivery**.

### 4.3 Retry behavior
If the consumer handler throws or parsing fails:
- message is `nack`’d and requeued
- RabbitMQ will redeliver until successfully processed

> There is no dead-letter exchange configured in `docker-compose.yml`. For production hardening, a DLQ policy is recommended.

### 4.4 Idempotency (mandatory under at-least-once)
Because redelivery can occur, consumers implement deduplication:

| Consumer | Idempotency store | Key |
|---|---|---|
| notification-service | `notifications.NotificationProcessedEvent` | `eventId` |
| feedback-analytics-service | `engagement.ProcessedEvent` | `eventId` |

---

## 5. Event catalog (routing keys)

### 5.1 Announcement domain events (produced by announcement-service)

#### 5.1.1 `announcement.published`
- **Producer**: `announcement-service`
- **Consumers**: `notification-service`

**Data payload (schema)**
| Field | Type | Required | Notes |
|---|---|---:|---|
| `announcementId` | UUID string | Yes | Announcement identifier. |
| `title` | string | Yes | Title at publish time. |
| `content` | string | Yes | Content at publish time. |
| `type` | string | Yes | Announcement type. |
| `category` | string \| null | No | Optional. |
| `priority` | string | Yes | Priority at publish time. |
| `createdBy` | UUID string | Yes | Creator user id. |
| `targetAudience` | object | Yes | Audience selector JSON. Required by notification-service. |
| `status` | string | Yes | Expected `published`. |
| `publishedAt` | ISO datetime \| null | Yes | Publish timestamp. |

**Producer guarantee**
- Published only when status changes to `published` (idempotent publish operation still returns 200 and does not re-emit a second event).

#### 5.1.2 `announcement.updated`
- **Producer**: `announcement-service`
- **Consumers**: `notification-service`

**Emission rule**
- Emitted only when an announcement is updated **and** its `status` is not `draft`.

**Data payload**
Same payload shape as `announcement.published`.

---

### 5.2 Notification domain events (produced by notification-service)

#### 5.2.1 `notification.sent`
- **Producer**: `notification-service`
- **Consumers**: `feedback-analytics-service`

**Data payload**
| Field | Type | Required | Notes |
|---|---|---:|---|
| `notificationId` | UUID string | Yes | Notification identifier. |
| `announcementId` | UUID string | Yes | Announcement that triggered notification. |
| `userId` | UUID string | Yes | Recipient user id. |
| `channel` | string | Yes | Currently `in_app`. |
| `status` | string | Yes | Currently `sent`. |
| `sentAt` | ISO datetime \| null | Yes | Timestamp set when status is sent. |
| `sourceEventId` | string | Yes | The upstream event id (e.g., `announcement.published.eventId`). |

#### 5.2.2 `notification.failed`
- **Producer**: `notification-service`
- **Consumers**: none configured by default

**Data payload**
| Field | Type | Required |
|---|---|---:|
| `notificationId` | UUID string | Yes |
| `announcementId` | UUID string | Yes |
| `userId` | UUID string | Yes |
| `channel` | string | Yes |
| `status` | string | Yes |
| `errorMessage` | string \| null | No |
| `sourceEventId` | string | Yes |

#### 5.2.3 `notification.read`
- **Producer**: `notification-service`
- **Consumers**: `feedback-analytics-service`

**Data payload**
| Field | Type | Required |
|---|---|---:|
| `notificationId` | UUID string | Yes |
| `announcementId` | UUID string | Yes |
| `userId` | UUID string | Yes |
| `channel` | string | Yes |
| `readAt` | ISO datetime \| null | Yes |
| `sourceEventId` | string | Yes |

---

### 5.3 Feedback domain events (produced by feedback-analytics-service)

#### 5.3.1 `feedback.submitted`
- **Producer**: `feedback-analytics-service`
- **Consumers**: `feedback-analytics-service` (analytics aggregation)

**Data payload**
| Field | Type | Required |
|---|---|---:|
| `feedbackId` | UUID string | Yes |
| `announcementId` | UUID string | Yes |
| `userId` | UUID string | Yes |
| `reactionType` | string | Yes |
| `comment` | string \| null | No |
| `rating` | integer \| null | No |
| `isAnonymous` | boolean | Yes |
| `createdAt` | ISO datetime | Yes |
| `updatedAt` | ISO datetime | Yes |

#### 5.3.2 `feedback.updated`
- **Producer**: `feedback-analytics-service`
- **Consumers**: `feedback-analytics-service` (analytics aggregation)

**Data payload**
Same shape as `feedback.submitted`.

---

## 6. Consumer processing rules (normative)

### 6.1 notification-service consumption rules
Bindings:
- `announcement.published`
- `announcement.updated`

Processing logic (normative):
- Validate envelope has `eventId` and `eventType`
- Enforce idempotency by `eventId`
- Validate `data.announcementId` is UUID
- Require `data.targetAudience` object
- Compute recipients by querying `auth.User`:
  - Only role `student`
  - Optional department/year filtering when provided
  - If `targetAudience.roles` exists and does not include `student`, notify nobody
- For each matching student:
  - insert notification with `(announcementId, userId, channel, sourceEventId)` uniqueness
  - publish `notification.sent`

### 6.2 feedback-analytics-service consumption rules
Bindings:
- `notification.sent`
- `notification.read`
- `feedback.submitted`
- `feedback.updated`

Processing logic:
- Validate `eventId` and `eventType`
- Enforce idempotency by `eventId`
- Validate `data.announcementId` UUID
- Update `engagement.AnnouncementMetrics`:
  - `notification.sent` => `notificationsSent + 1`
  - `notification.read` => `notificationsRead + 1`
  - `feedback.submitted` => `feedbackCount + 1`
  - `feedback.updated` => only bump `lastUpdatedAt`

---

## 7. Environment variables (RabbitMQ)

| Variable | Used by | Required | Default | Description |
|---|---|---:|---:|---|
| `RABBITMQ_URL` | announcement/notification/feedback-analytics | Yes | none | Full AMQP URL (includes credentials). |
| `EVENTS_EXCHANGE` | announcement/notification/feedback-analytics | No | `cdcp.events` | Override exchange name (must match across services). |

Docker Compose default wiring:
- RabbitMQ container exposes `5672` and `15672`.
- Services use `${RABBITMQ_URL:-amqp://cdcp_user:1234@rabbitmq:5672}`.

---

## 8. Conformance requirements

### 8.1 Field naming
All envelope fields must use **camelCase** as implemented:
- `eventId`, `eventType`, `occurredAt`, `producer`, `data`

Any producer emitting snake_case or alternative fields is non-conformant.

### 8.2 Backward/forward compatibility
The contract is currently unversioned. For industrial hardening, the recommended approach is:
- version in routing keys (e.g., `announcement.published.v1`)
- include `schemaVersion` field in envelope

---

## 9. Implementation references
- Exchange constant: `EXCHANGE_NAME = process.env.EVENTS_EXCHANGE || 'cdcp.events'`
- Announcement publisher: [backend/services/announcement-service/src/publisher.js](../backend/services/announcement-service/src/publisher.js)
- Notification consumer: [backend/services/notification-service/src/consumer.js](../backend/services/notification-service/src/consumer.js)
- Notification publisher: [backend/services/notification-service/src/publisher.js](../backend/services/notification-service/src/publisher.js)
- Feedback publisher: [backend/services/feedback-analytics-service/src/publisher.js](../backend/services/feedback-analytics-service/src/publisher.js)
- Feedback consumer: [backend/services/feedback-analytics-service/src/consumer.js](../backend/services/feedback-analytics-service/src/consumer.js)
