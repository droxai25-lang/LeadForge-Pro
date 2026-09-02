CREATE TYPE "ProspectQualificationStatus" AS ENUM ('pending', 'qualified', 'disqualified', 'insufficient_evidence', 'failed');

ALTER TABLE "DiscoveryRun"
  ADD COLUMN "qualificationContract" JSONB,
  ADD COLUMN "candidatesEvaluated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "prospectsQualified" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "prospectsDisqualified" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "qualificationFailures" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "DiscoveryCompany"
  ADD COLUMN "qualificationStatus" "ProspectQualificationStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "opportunityScore" DOUBLE PRECISION,
  ADD COLUMN "evidenceQuality" DOUBLE PRECISION,
  ADD COLUMN "qualificationReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "disqualificationReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bestContact" JSONB,
  ADD COLUMN "outreachAngle" TEXT,
  ADD COLUMN "qualifiedAt" TIMESTAMP(3);

ALTER TABLE "DeliveryBatch"
  ADD COLUMN "prospectIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "DeliveryBatch" DROP CONSTRAINT "DeliveryBatch_leadCount_check";
ALTER TABLE "DeliveryBatch" ADD CONSTRAINT "DeliveryBatch_leadCount_check" CHECK (
  (cardinality("leadIds") = "recordCount" AND cardinality("prospectIds") = 0)
  OR (cardinality("prospectIds") = "recordCount" AND cardinality("leadIds") = 0)
);

CREATE TABLE "OpportunitySignal" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "evidenceId" TEXT,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "observation" TEXT NOT NULL,
  "opportunity" TEXT NOT NULL,
  "evidenceQuality" DOUBLE PRECISION NOT NULL,
  "scoreContribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "matchedQualifyingRule" BOOLEAN NOT NULL DEFAULT false,
  "matchedDisqualifyingRule" BOOLEAN NOT NULL DEFAULT false,
  "sourceUrl" TEXT NOT NULL,
  "snapshotSha256" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunitySignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpportunitySignal_companyId_key_key" ON "OpportunitySignal"("companyId", "key");
CREATE INDEX "OpportunitySignal_organizationId_runId_idx" ON "OpportunitySignal"("organizationId", "runId");
CREATE INDEX "OpportunitySignal_companyId_matchedQualifyingRule_idx" ON "OpportunitySignal"("companyId", "matchedQualifyingRule");
CREATE INDEX "OpportunitySignal_evidenceId_idx" ON "OpportunitySignal"("evidenceId");

ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DiscoveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DiscoveryCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "CrawlEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_candidatesEvaluated_check" CHECK ("candidatesEvaluated" >= 0 AND "candidatesEvaluated" <= "companyLimit");
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_prospectsQualified_check" CHECK ("prospectsQualified" >= 0 AND "prospectsQualified" <= "candidatesEvaluated");
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_prospectsDisqualified_check" CHECK ("prospectsDisqualified" >= 0 AND "prospectsDisqualified" <= "candidatesEvaluated");
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_evaluationTotals_check" CHECK (("prospectsQualified" + "prospectsDisqualified") <= "candidatesEvaluated");
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_qualificationFailures_check" CHECK ("qualificationFailures" >= 0 AND "qualificationFailures" <= "companiesProcessed");
ALTER TABLE "DiscoveryCompany" ADD CONSTRAINT "DiscoveryCompany_opportunityScore_check" CHECK ("opportunityScore" IS NULL OR ("opportunityScore" >= 0 AND "opportunityScore" <= 100));
ALTER TABLE "DiscoveryCompany" ADD CONSTRAINT "DiscoveryCompany_evidenceQuality_check" CHECK ("evidenceQuality" IS NULL OR ("evidenceQuality" >= 0 AND "evidenceQuality" <= 1));
ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_evidenceQuality_check" CHECK ("evidenceQuality" >= 0 AND "evidenceQuality" <= 1);
ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_scoreContribution_check" CHECK ("scoreContribution" >= 0 AND "scoreContribution" <= 100);
