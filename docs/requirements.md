# CDCP Requirements (Simplified)

This file is the active requirements/spec document for the project.

Source: derived from the course requirements and the project’s simplified documentation.

## Project Summary
Campus Digital Communication Platform (CDCP) is a distributed system for campus announcements and events.

## Actors
- Admin
- Faculty/Staff
- Student

## Core Features
- Auth (register/login) + RBAC
- Announcements/events CRUD + publish
- Notifications (in-app) + delivery tracking
- Feedback/reactions + analytics summary

## Communication
- Sync: REST via API Gateway
- Async: RabbitMQ topic exchange with 8 topics

## RabbitMQ Topics (8 total)
- announcement.created
- announcement.updated
- announcement.deleted
- notification.sent
- notification.failed
- notification.read
- feedback.submitted
- feedback.updated

## Persistence
- PostgreSQL (single DB technology)
