ALTER TYPE "LeadSourceType" ADD VALUE 'hunter';

CREATE TYPE "DiscoveryRunStatus" AS ENUM ('queued', 'running', 'completed', 'partial', 'failed', 'cancel_requested', 'cancelled');
CREATE TYPE "DiscoveryOutcome" AS ENUM ('found', 'not_found', 'rate_limited', 'blocked', 'failed');
CREATE TYPE "DiscoveryCompanyStatus" AS ENUM ('discovered', 'researching', 'completed', 'no_contacts', 'failed');
CREATE TYPE "DiscoveryContactStatus" AS ENUM ('discovered', 'promoted', 'duplicate', 'invalid');

ALTER TABLE "Account"
ADD COLUMN "websiteUrl" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "sourceProvider" TEXT,
ADD COLUMN "sourceReference" TEXT,
ADD COLUMN "sourceObservedAt" TIMESTAMP(3);

CREATE TABLE "DiscoveryRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT,
  "createdById" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'hunter',
  "query" TEXT NOT NULL,
  "criteria" JSONB NOT NULL,
  "companyLimit" INTEGER NOT NULL,
  "contactsPerCompany" INTEGER NOT NULL,
  "maxDomainSearches" INTEGER NOT NULL,
  "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'queued',
  "outcome" "DiscoveryOutcome",
  "providerResultCount" INTEGER NOT NULL DEFAULT 0,
  "companiesProcessed" INTEGER NOT NULL DEFAULT 0,
  "domainSearchesPerformed" INTEGER NOT NULL DEFAULT 0,
  "contactsFound" INTEGER NOT NULL DEFAULT 0,
  "leadsCreated" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoveryCompany" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "accountId" TEXT,
  "providerCompanyId" TEXT,
  "name" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "industry" TEXT,
  "description" TEXT,
  "employeeCount" INTEGER,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT,
  "websiteUrl" TEXT NOT NULL,
  "status" "DiscoveryCompanyStatus" NOT NULL DEFAULT 'discovered',
  "outcome" "DiscoveryOutcome",
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscoveryCompany_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoveryContact" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "leadId" TEXT,
  "email" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT,
  "position" TEXT NOT NULL,
  "seniority" TEXT,
  "department" TEXT,
  "decisionMaker" BOOLEAN NOT NULL DEFAULT false,
  "confidence" INTEGER,
  "verificationStatus" TEXT,
  "sourceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "DiscoveryContactStatus" NOT NULL DEFAULT 'discovered',
  "observedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscoveryContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscoveryRun_organizationId_createdAt_idx" ON "DiscoveryRun"("organizationId", "createdAt");
CREATE INDEX "DiscoveryRun_organizationId_status_idx" ON "DiscoveryRun"("organizationId", "status");
CREATE INDEX "DiscoveryRun_clientId_idx" ON "DiscoveryRun"("clientId");
CREATE UNIQUE INDEX "DiscoveryCompany_runId_domain_key" ON "DiscoveryCompany"("runId", "domain");
CREATE INDEX "DiscoveryCompany_organizationId_domain_idx" ON "DiscoveryCompany"("organizationId", "domain");
CREATE INDEX "DiscoveryCompany_accountId_idx" ON "DiscoveryCompany"("accountId");
CREATE UNIQUE INDEX "DiscoveryContact_runId_email_key" ON "DiscoveryContact"("runId", "email");
CREATE INDEX "DiscoveryContact_organizationId_email_idx" ON "DiscoveryContact"("organizationId", "email");
CREATE INDEX "DiscoveryContact_leadId_idx" ON "DiscoveryContact"("leadId");

ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ManagedClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscoveryCompany" ADD CONSTRAINT "DiscoveryCompany_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryCompany" ADD CONSTRAINT "DiscoveryCompany_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DiscoveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryCompany" ADD CONSTRAINT "DiscoveryCompany_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscoveryContact" ADD CONSTRAINT "DiscoveryContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryContact" ADD CONSTRAINT "DiscoveryContact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DiscoveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryContact" ADD CONSTRAINT "DiscoveryContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DiscoveryCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryContact" ADD CONSTRAINT "DiscoveryContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
