CREATE TYPE "CrawlOutcome" AS ENUM ('found', 'not_found', 'rate_limited', 'blocked', 'failed');

CREATE TABLE "CrawlEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT,
    "leadId" TEXT,
    "domain" TEXT NOT NULL,
    "requestedUrl" TEXT NOT NULL,
    "finalUrl" TEXT,
    "outcome" "CrawlOutcome" NOT NULL,
    "httpStatus" INTEGER,
    "contentType" TEXT,
    "snapshotSha256" TEXT,
    "snapshotBytes" INTEGER NOT NULL DEFAULT 0,
    "snapshotTruncated" BOOLEAN NOT NULL DEFAULT false,
    "robotsAllowed" BOOLEAN,
    "responseHeaders" JSONB,
    "rawSnapshot" TEXT,
    "extractedData" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrawlEvidence_organizationId_domain_createdAt_idx"
ON "CrawlEvidence"("organizationId", "domain", "createdAt");

CREATE INDEX "CrawlEvidence_organizationId_outcome_createdAt_idx"
ON "CrawlEvidence"("organizationId", "outcome", "createdAt");

CREATE INDEX "CrawlEvidence_accountId_idx" ON "CrawlEvidence"("accountId");
CREATE INDEX "CrawlEvidence_leadId_idx" ON "CrawlEvidence"("leadId");

ALTER TABLE "CrawlEvidence"
ADD CONSTRAINT "CrawlEvidence_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrawlEvidence"
ADD CONSTRAINT "CrawlEvidence_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrawlEvidence"
ADD CONSTRAINT "CrawlEvidence_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
