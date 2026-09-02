CREATE TYPE "LeadSourceType" AS ENUM ('unknown', 'manual', 'batch', 'csv', 'crawl', 'waterfall', 'api');

ALTER TABLE "Lead"
ADD COLUMN "sourceType" "LeadSourceType" NOT NULL DEFAULT 'unknown',
ADD COLUMN "sourceReference" TEXT,
ADD COLUMN "sourceObservedAt" TIMESTAMP(3);

CREATE INDEX "Lead_organizationId_sourceType_idx" ON "Lead"("organizationId", "sourceType");