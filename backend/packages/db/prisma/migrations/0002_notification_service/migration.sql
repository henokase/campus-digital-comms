-- Add sourceEventId to notifications.Notification and adjust uniqueness to allow multiple notifications per announcement

ALTER TABLE "notifications"."Notification" ADD COLUMN IF NOT EXISTS "sourceEventId" TEXT;

UPDATE "notifications"."Notification"
SET "sourceEventId" = COALESCE("sourceEventId", 'legacy')
WHERE "sourceEventId" IS NULL;

ALTER TABLE "notifications"."Notification" ALTER COLUMN "sourceEventId" SET NOT NULL;

DROP INDEX IF EXISTS "notifications"."Notification_announcementId_userId_channel_key";
DROP INDEX IF EXISTS "Notification_announcementId_userId_channel_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_announcementId_userId_channel_sourceEventId_key"
ON "notifications"."Notification"("announcementId", "userId", "channel", "sourceEventId");

-- Idempotency table for notification-service consuming RabbitMQ
CREATE TABLE IF NOT EXISTS "notifications"."NotificationProcessedEvent" (
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationProcessedEvent_pkey" PRIMARY KEY ("eventId")
);
