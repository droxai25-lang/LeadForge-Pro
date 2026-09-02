[CmdletBinding()]
param(
    [string]$ImageName = "leadforge-pro:autonomous-discovery-v6"
)

$ErrorActionPreference = "Stop"
$postgresContainer = "leadforge-postgres"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$databaseName = "leadforge_verify_$timestamp"
$created = $false

if ($databaseName -notmatch '^leadforge_verify_[0-9]{14}$') {
    throw "Refusing unsafe disposable database name: $databaseName"
}

$networkJson = docker inspect $postgresContainer --format '{{json .NetworkSettings.Networks}}'
if ($LASTEXITCODE -ne 0) { throw "Could not inspect the PostgreSQL container network." }
$networkName = (($networkJson | ConvertFrom-Json).PSObject.Properties.Name | Select-Object -First 1)
if (-not $networkName -or $networkName -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_.-]+$') {
    throw "Could not resolve a safe Docker network name."
}

$postgresEnvironment = docker inspect $postgresContainer --format '{{range .Config.Env}}{{println .}}{{end}}'
if ($LASTEXITCODE -ne 0) { throw "Could not inspect the PostgreSQL container configuration." }
$passwordEntry = $postgresEnvironment | Where-Object { $_ -like 'POSTGRES_PASSWORD=*' } | Select-Object -First 1
if (-not $passwordEntry) { throw "POSTGRES_PASSWORD is not available in the PostgreSQL container." }
$postgresPassword = $passwordEntry.Substring('POSTGRES_PASSWORD='.Length)
$encodedPassword = [System.Uri]::EscapeDataString($postgresPassword)
$databaseUrl = "postgresql://leadforge_app:${encodedPassword}@postgres:5432/$databaseName`?schema=public"

$existing = docker exec $postgresContainer psql -U leadforge_app -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$databaseName';"
if ($LASTEXITCODE -ne 0) { throw "Could not inspect PostgreSQL databases." }
if ($existing -and $existing.Trim()) { throw "Disposable database already exists: $databaseName" }

try {
    docker exec $postgresContainer createdb -U leadforge_app $databaseName
    if ($LASTEXITCODE -ne 0) { throw "Could not create disposable migration database." }
    $created = $true

    docker run --rm --network $networkName --entrypoint npx -e "DATABASE_URL=$databaseUrl" $ImageName prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw "The repository migration chain failed." }

    $validationSql = @'
SELECT json_build_object(
  'migrations', (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  'managedTables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('ManagedClient', 'ClientExclusion', 'LeadReview', 'DeliveryBatch')),
  'discoveryTables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('DiscoveryRun', 'DiscoveryCompany', 'DiscoveryContact', 'OpportunitySignal', 'DiscoveryAutopilot')),
  'hunterLeadSource', EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'LeadSourceType' AND e.enumlabel = 'hunter'),
  'discoveryChecks', (SELECT count(*) FROM pg_constraint WHERE conname IN ('DiscoveryRun_companyLimit_check', 'DiscoveryRun_contactsPerCompany_check', 'DiscoveryRun_maxDomainSearches_check', 'DiscoveryRun_providerResultCount_check', 'DiscoveryRun_companiesProcessed_check', 'DiscoveryRun_domainSearchesPerformed_check', 'DiscoveryRun_contactsFound_check', 'DiscoveryRun_leadsCreated_check', 'DiscoveryContact_confidence_check')),
  'leadSourceColumn', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Lead' AND column_name = 'sourceType'),
  'deliveryChecks', (SELECT count(*) FROM pg_constraint WHERE conname IN ('ManagedClient_defaultRetentionDays_check', 'DeliveryBatch_recordCount_check', 'DeliveryBatch_leadCount_check'))
  , 'qualificationChecks', (SELECT count(*) FROM pg_constraint WHERE conname IN ('DiscoveryRun_candidatesEvaluated_check', 'DiscoveryRun_prospectsQualified_check', 'DiscoveryRun_prospectsDisqualified_check', 'DiscoveryRun_evaluationTotals_check', 'DiscoveryRun_qualificationFailures_check', 'DiscoveryCompany_opportunityScore_check', 'DiscoveryCompany_evidenceQuality_check', 'OpportunitySignal_evidenceQuality_check', 'OpportunitySignal_scoreContribution_check'))
  , 'companyDiscoveryColumns', (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DiscoveryCompany' AND column_name IN ('publicEmail', 'phone', 'streetAddress', 'confidence', 'datasetRelease', 'sourceUrls', 'qualificationStatus', 'opportunityScore', 'evidenceQuality', 'qualificationReasons', 'disqualificationReasons', 'bestContact', 'outreachAngle', 'qualifiedAt'))
  , 'autopilotChecks', (SELECT count(*) FROM pg_constraint WHERE conname IN ('DiscoveryAutopilot_intervalMinutes_check', 'DiscoveryAutopilot_companyLimit_check', 'DiscoveryAutopilot_cursor_check'))
);
'@
    $validation = docker exec $postgresContainer psql -U leadforge_app -d $databaseName -tAc $validationSql
    if ($LASTEXITCODE -ne 0) { throw "The migrated disposable schema could not be validated." }
    $validationObject = $validation.Trim() | ConvertFrom-Json
    if ($validationObject.migrations -lt 13 -or $validationObject.managedTables -ne 4 -or $validationObject.discoveryTables -ne 5 -or $validationObject.discoveryChecks -ne 9 -or $validationObject.qualificationChecks -ne 9 -or $validationObject.companyDiscoveryColumns -ne 14 -or $validationObject.autopilotChecks -ne 3 -or -not $validationObject.leadSourceColumn -or -not $validationObject.hunterLeadSource) {
        throw "The migrated disposable schema is missing required managed-delivery, opportunity-qualification, or autonomous-frontier structures."
    }

    [pscustomobject]@{
        Database = $databaseName
        Image = $ImageName
        Validation = $validation.Trim()
        VerifiedAt = (Get-Date).ToUniversalTime().ToString("o")
    }
} finally {
    $postgresPassword = $null
    $encodedPassword = $null
    $databaseUrl = $null
    if ($created) {
        docker exec $postgresContainer psql -U leadforge_app -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$databaseName' AND pid <> pg_backend_pid();" 2>$null | Out-Null
        docker exec $postgresContainer dropdb -U leadforge_app $databaseName 2>$null | Out-Null
    }
}
