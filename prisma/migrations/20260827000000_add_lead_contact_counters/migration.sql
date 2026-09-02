ALTER TABLE "Lead"
ADD COLUMN "lastContactedAt" TIMESTAMP(3),
ADD COLUMN "sentCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Lead"
ALTER COLUMN "engagementScore" SET DEFAULT 0;

ALTER TABLE "Mailbox"
ALTER COLUMN "warmupEnabled" SET DEFAULT false,
ALTER COLUMN "reputationScore" SET DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'inactive',
ALTER COLUMN "spfStatus" SET DEFAULT 'unverified',
ALTER COLUMN "dkimStatus" SET DEFAULT 'unverified',
ALTER COLUMN "dmarcStatus" SET DEFAULT 'unverified';