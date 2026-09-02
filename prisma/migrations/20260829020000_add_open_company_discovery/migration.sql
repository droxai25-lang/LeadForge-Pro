ALTER TABLE "Account"
  ADD COLUMN "publicEmail" TEXT,
  ADD COLUMN "streetAddress" TEXT,
  ADD COLUMN "sourceUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "DiscoveryCompany"
  ADD COLUMN "publicEmail" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "streetAddress" TEXT,
  ADD COLUMN "confidence" DOUBLE PRECISION,
  ADD COLUMN "datasetRelease" TEXT,
  ADD COLUMN "sourceUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
