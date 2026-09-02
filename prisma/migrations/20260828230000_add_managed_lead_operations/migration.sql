CREATE TYPE "ManagedClientStatus" AS ENUM ('active', 'paused', 'archived');
CREATE TYPE "ClientExclusionType" AS ENUM ('email', 'domain', 'company');
CREATE TYPE "LeadReviewStatus" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "DeliveryBatchFormat" AS ENUM ('csv', 'json');
CREATE TYPE "DeliveryBatchStatus" AS ENUM ('prepared', 'exported', 'delivered', 'purged');

CREATE TABLE "ManagedClient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "targetProfile" JSONB NOT NULL,
    "defaultRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "status" "ManagedClientStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManagedClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientExclusion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "ClientExclusionType" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientExclusion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "LeadReviewStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "preparedById" TEXT,
    "format" "DeliveryBatchFormat" NOT NULL,
    "status" "DeliveryBatchStatus" NOT NULL DEFAULT 'prepared',
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "payloadText" TEXT,
    "payloadSha256" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "leadIds" TEXT[] NOT NULL,
    "fields" TEXT[] NOT NULL,
    "deliveredTo" TEXT,
    "exportedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedClient_organizationId_name_key" ON "ManagedClient"("organizationId", "name");
CREATE INDEX "ManagedClient_organizationId_status_idx" ON "ManagedClient"("organizationId", "status");
CREATE UNIQUE INDEX "ClientExclusion_clientId_type_value_key" ON "ClientExclusion"("clientId", "type", "value");
CREATE INDEX "ClientExclusion_organizationId_clientId_idx" ON "ClientExclusion"("organizationId", "clientId");
CREATE UNIQUE INDEX "LeadReview_clientId_leadId_key" ON "LeadReview"("clientId", "leadId");
CREATE INDEX "LeadReview_organizationId_clientId_status_idx" ON "LeadReview"("organizationId", "clientId", "status");
CREATE INDEX "LeadReview_leadId_idx" ON "LeadReview"("leadId");
CREATE INDEX "DeliveryBatch_organizationId_clientId_createdAt_idx" ON "DeliveryBatch"("organizationId", "clientId", "createdAt");
CREATE INDEX "DeliveryBatch_organizationId_retentionUntil_status_idx" ON "DeliveryBatch"("organizationId", "retentionUntil", "status");

ALTER TABLE "ManagedClient" ADD CONSTRAINT "ManagedClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientExclusion" ADD CONSTRAINT "ClientExclusion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientExclusion" ADD CONSTRAINT "ClientExclusion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ManagedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadReview" ADD CONSTRAINT "LeadReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadReview" ADD CONSTRAINT "LeadReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ManagedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadReview" ADD CONSTRAINT "LeadReview_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadReview" ADD CONSTRAINT "LeadReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ManagedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ManagedClient" ADD CONSTRAINT "ManagedClient_defaultRetentionDays_check" CHECK ("defaultRetentionDays" BETWEEN 1 AND 3650);
ALTER TABLE "DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_recordCount_check" CHECK ("recordCount" > 0);
ALTER TABLE "DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_leadCount_check" CHECK (cardinality("leadIds") = "recordCount");