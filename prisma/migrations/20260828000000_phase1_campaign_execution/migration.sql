CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
CREATE TYPE "CampaignEnrollmentStatus" AS ENUM ('active', 'paused', 'completed', 'unsubscribed', 'bounced', 'complained', 'failed', 'cancelled');
CREATE TYPE "SuppressionReason" AS ENUM ('unsubscribe', 'hard_bounce', 'complaint', 'manual', 'invalid_address');
CREATE TYPE "DeliveryEventType" AS ENUM ('delivered', 'hard_bounce', 'soft_bounce', 'complaint', 'unsubscribe');

CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "dailySendingLimit" INTEGER NOT NULL DEFAULT 50,
    "trackOpens" BOOLEAN NOT NULL DEFAULT true,
    "trackClicks" BOOLEAN NOT NULL DEFAULT true,
    "launchedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignStep" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tone" TEXT,
    "framework" TEXT,
    "targetPainPoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampaignStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignEnrollment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "status" "CampaignEnrollmentStatus" NOT NULL DEFAULT 'active',
    "currentStepNumber" INTEGER NOT NULL DEFAULT 0,
    "nextSendAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "stopReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampaignEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Suppression" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "source" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Suppression_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryProviderEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" "DeliveryEventType" NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "dispatchId" TEXT,
    "payload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "DeliveryProviderEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OutboundDispatch"
ADD COLUMN "campaignId" TEXT,
ADD COLUMN "campaignStepId" TEXT,
ADD COLUMN "enrollmentId" TEXT,
ADD COLUMN "inboundReplyId" TEXT,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "bodyText" TEXT,
ADD COLUMN "trackOpens" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trackClicks" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "scheduledFor" TIMESTAMP(3),
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "attemptsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "providerMessageId" TEXT,
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "bouncedAt" TIMESTAMP(3),
ADD COLUMN "complainedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "CampaignStep_campaignId_stepNumber_key" ON "CampaignStep"("campaignId", "stepNumber");
CREATE INDEX "CampaignStep_campaignId_idx" ON "CampaignStep"("campaignId");
CREATE INDEX "Campaign_organizationId_status_idx" ON "Campaign"("organizationId", "status");
CREATE INDEX "Campaign_mailboxId_idx" ON "Campaign"("mailboxId");
CREATE UNIQUE INDEX "CampaignEnrollment_campaignId_leadId_key" ON "CampaignEnrollment"("campaignId", "leadId");
CREATE INDEX "CampaignEnrollment_organizationId_status_idx" ON "CampaignEnrollment"("organizationId", "status");
CREATE INDEX "CampaignEnrollment_campaignId_status_nextSendAt_idx" ON "CampaignEnrollment"("campaignId", "status", "nextSendAt");
CREATE INDEX "CampaignEnrollment_leadId_idx" ON "CampaignEnrollment"("leadId");
CREATE UNIQUE INDEX "Suppression_organizationId_email_key" ON "Suppression"("organizationId", "email");
CREATE INDEX "Suppression_organizationId_reason_idx" ON "Suppression"("organizationId", "reason");
CREATE UNIQUE INDEX "DeliveryProviderEvent_provider_eventId_key" ON "DeliveryProviderEvent"("provider", "eventId");
CREATE INDEX "DeliveryProviderEvent_organizationId_eventType_idx" ON "DeliveryProviderEvent"("organizationId", "eventType");
CREATE INDEX "DeliveryProviderEvent_dispatchId_idx" ON "DeliveryProviderEvent"("dispatchId");
CREATE UNIQUE INDEX "OutboundDispatch_idempotencyKey_key" ON "OutboundDispatch"("idempotencyKey");
CREATE INDEX "OutboundDispatch_campaignId_status_scheduledFor_idx" ON "OutboundDispatch"("campaignId", "status", "scheduledFor");
CREATE INDEX "OutboundDispatch_enrollmentId_status_idx" ON "OutboundDispatch"("enrollmentId", "status");
CREATE INDEX "OutboundDispatch_providerMessageId_idx" ON "OutboundDispatch"("providerMessageId");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Suppression" ADD CONSTRAINT "Suppression_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryProviderEvent" ADD CONSTRAINT "DeliveryProviderEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryProviderEvent" ADD CONSTRAINT "DeliveryProviderEvent_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "OutboundDispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboundDispatch" ADD CONSTRAINT "OutboundDispatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundDispatch" ADD CONSTRAINT "OutboundDispatch_campaignStepId_fkey" FOREIGN KEY ("campaignStepId") REFERENCES "CampaignStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboundDispatch" ADD CONSTRAINT "OutboundDispatch_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CampaignEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
