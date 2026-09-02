ALTER TABLE "DiscoveryRun"
ADD CONSTRAINT "DiscoveryRun_companyLimit_check" CHECK ("companyLimit" BETWEEN 1 AND 100),
ADD CONSTRAINT "DiscoveryRun_contactsPerCompany_check" CHECK ("contactsPerCompany" BETWEEN 1 AND 10),
ADD CONSTRAINT "DiscoveryRun_maxDomainSearches_check" CHECK ("maxDomainSearches" BETWEEN 0 AND 100),
ADD CONSTRAINT "DiscoveryRun_providerResultCount_check" CHECK ("providerResultCount" >= 0),
ADD CONSTRAINT "DiscoveryRun_companiesProcessed_check" CHECK ("companiesProcessed" >= 0),
ADD CONSTRAINT "DiscoveryRun_domainSearchesPerformed_check" CHECK ("domainSearchesPerformed" >= 0 AND "domainSearchesPerformed" <= "maxDomainSearches"),
ADD CONSTRAINT "DiscoveryRun_contactsFound_check" CHECK ("contactsFound" >= 0),
ADD CONSTRAINT "DiscoveryRun_leadsCreated_check" CHECK ("leadsCreated" >= 0);

ALTER TABLE "DiscoveryContact"
ADD CONSTRAINT "DiscoveryContact_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 100);
