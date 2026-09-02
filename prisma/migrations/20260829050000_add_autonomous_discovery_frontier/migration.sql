CREATE TABLE "DiscoveryAutopilot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "intervalMinutes" INTEGER NOT NULL DEFAULT 1,
  "companyLimit" INTEGER NOT NULL DEFAULT 25,
  "cursor" INTEGER NOT NULL DEFAULT 0,
  "currentRunId" TEXT,
  "lastRunId" TEXT,
  "lastStartedAt" TIMESTAMP(3),
  "lastCompletedAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscoveryAutopilot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscoveryAutopilot_organizationId_key" ON "DiscoveryAutopilot"("organizationId");
CREATE INDEX "DiscoveryAutopilot_enabled_nextRunAt_idx" ON "DiscoveryAutopilot"("enabled", "nextRunAt");

ALTER TABLE "DiscoveryAutopilot" ADD CONSTRAINT "DiscoveryAutopilot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryAutopilot" ADD CONSTRAINT "DiscoveryAutopilot_intervalMinutes_check" CHECK ("intervalMinutes" >= 1 AND "intervalMinutes" <= 10080);
ALTER TABLE "DiscoveryAutopilot" ADD CONSTRAINT "DiscoveryAutopilot_companyLimit_check" CHECK ("companyLimit" >= 1 AND "companyLimit" <= 100);
ALTER TABLE "DiscoveryAutopilot" ADD CONSTRAINT "DiscoveryAutopilot_cursor_check" CHECK ("cursor" >= 0);
