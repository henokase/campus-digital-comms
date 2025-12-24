# CDCP Event Contracts (RabbitMQ)

This document defines the Pub/Sub topics, message envelope, publishers, and subscribers.

## Exchange
- Name: `cdcp.topic`
- Type: topic

## Standard Event Envelope
All topics must use the same envelope:

```json
{
  "event_id": "uuid",
  "event_type": "announcement.created",
  "timestamp": "ISO-8601",
  "data": {}
}
```

## Topics (8 total)

### 1) `announcement.created`
- Publisher: announcement-service
- Subscribers: notification-service
- Data (minimum):
  - announcement_id
  - title
  - type
  - priority
  - target_audience
  - published_at

### 2) `announcement.updated`
- Publisher: announcement-service
- Subscribers: notification-service
- Data (minimum):
  - announcement_id
  - updated_fields
  - current_values

### 3) `announcement.deleted`
- Publisher: announcement-service
- Subscribers: notification-service
- Data (minimum):
  - announcement_id

### 4) `notification.sent`
- Publisher: notification-service
- Subscribers: feedback-analytics-service
- Data (minimum):
  - notification_id
  - announcement_id
  - user_id
  - channel
  - status

### 5) `notification.failed`
- Publisher: notification-service
- Subscribers: feedback-analytics-service
- Data (minimum):
  - notification_id
  - announcement_id
  - user_id
  - error_message

### 6) `notification.read`
- Publisher: notification-service
- Subscribers: feedback-analytics-service
- Data (minimum):
  - notification_id
  - announcement_id
  - user_id
  - read_at

### 7) `feedback.submitted`
- Publisher: feedback-analytics-service
- Subscribers: feedback-analytics-service (for metrics) and/or announcement-service (optional)
- Data (minimum):
  - feedback_id
  - announcement_id
  - user_id
  - reaction_type

### 8) `feedback.updated`
- Publisher: feedback-analytics-service
- Subscribers: feedback-analytics-service (for metrics)
- Data (minimum):
  - feedback_id
  - announcement_id
  - user_id
  - reaction_type
