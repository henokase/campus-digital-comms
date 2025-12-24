# CDCP Architecture Overview

## Components
- Frontend (React + Vite)
- API Gateway (Node/Express)
- Auth Service (Node/Express)
- Announcement Service (Node/Express)
- Notification Service (Node/Express)
- Feedback + Analytics Service (Node/Express)
- PostgreSQL
- RabbitMQ

## Request Flow (Sync)
- Frontend → API Gateway → target service

## Event Flow (Async)
- Announcement publishes `announcement.*`
- Notification consumes `announcement.*` and publishes `notification.*`
- Feedback/Analytics consumes `notification.*` and `feedback.*`

## Ports (dev)
- Gateway: 3000
- Auth: 3001
- Announcement: 3002
- Notification: 3003
- Feedback/Analytics: 3004
- Postgres: 5432
- RabbitMQ: 5672
- RabbitMQ UI: 15672
