CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS "auth";
CREATE SCHEMA IF NOT EXISTS "announcements";
CREATE SCHEMA IF NOT EXISTS "notifications";
CREATE SCHEMA IF NOT EXISTS "engagement";

-- auth.User
CREATE TABLE IF NOT EXISTS "auth"."User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "fullName" TEXT,
  "department" TEXT,
  "year" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "auth"."User"("email");

-- announcements.Announcement
CREATE TABLE IF NOT EXISTS "announcements"."Announcement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "category" TEXT,
  "priority" TEXT NOT NULL,
  "createdBy" UUID NOT NULL,
  "targetAudience" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- notifications.Notification
CREATE TABLE IF NOT EXISTS "notifications"."Notification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "announcementId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "channel" TEXT NOT NULL,
  "sourceEventId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_announcementId_userId_channel_sourceEventId_key"
ON "notifications"."Notification"("announcementId", "userId", "channel", "sourceEventId");

-- notifications.NotificationProcessedEvent
CREATE TABLE IF NOT EXISTS "notifications"."NotificationProcessedEvent" (
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationProcessedEvent_pkey" PRIMARY KEY ("eventId")
);

-- engagement.Feedback
CREATE TABLE IF NOT EXISTS "engagement"."Feedback" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "announcementId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "reactionType" TEXT NOT NULL,
  "comment" TEXT,
  "rating" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- engagement.AnnouncementMetrics
CREATE TABLE IF NOT EXISTS "engagement"."AnnouncementMetrics" (
  "announcementId" UUID NOT NULL,
  "notificationsSent" INTEGER NOT NULL DEFAULT 0,
  "notificationsRead" INTEGER NOT NULL DEFAULT 0,
  "feedbackCount" INTEGER NOT NULL DEFAULT 0,
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnnouncementMetrics_pkey" PRIMARY KEY ("announcementId")
);

-- engagement.ProcessedEvent
CREATE TABLE IF NOT EXISTS "engagement"."ProcessedEvent" (
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("eventId")
);
