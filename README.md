# campus-digital-comms
Campus Digital Communication Platform (CDCP) — A Distributed System for Announcements, Notifications, and Event Management

## Quick Start (Local)

### Prerequisites
- Docker Desktop
- Node.js 20+

### Configure environment
1. Copy `.env.example` to `.env`.
2. Update passwords/secrets in `.env` if desired.

### Run backend dependencies + services
```bash
docker compose up --build
```

## Architecture (high level)
- Frontend: `frontend/` (React + Vite)
- Backend: `backend/` (Node/Express microservices)
- Database: PostgreSQL
- Broker: RabbitMQ

## Services and Ports (dev)
- API Gateway: http://localhost:3000
- Auth Service: http://localhost:3001
- Announcement Service: http://localhost:3002
- Notification Service: http://localhost:3003
- Feedback/Analytics Service: http://localhost:3004
- Postgres: localhost:5432
- RabbitMQ: localhost:5672
- RabbitMQ UI: http://localhost:15672

## Docs
- `docs/requirements.md`
- `docs/architecture.md`
- `docs/events.md`
- `docs/demo.md`
