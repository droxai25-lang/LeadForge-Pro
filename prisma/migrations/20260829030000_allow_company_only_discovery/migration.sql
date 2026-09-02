ALTER TABLE "DiscoveryRun"
  DROP CONSTRAINT IF EXISTS "DiscoveryRun_contactsPerCompany_check";

ALTER TABLE "DiscoveryRun"
  ADD CONSTRAINT "DiscoveryRun_contactsPerCompany_check"
  CHECK ("contactsPerCompany" BETWEEN 0 AND 10);
