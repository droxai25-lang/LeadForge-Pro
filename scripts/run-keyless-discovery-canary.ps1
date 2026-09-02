[CmdletBinding()]
param(
    [string]$ApiUrl = "http://127.0.0.1:3000",
    [string]$Market = "HVAC companies",
    [string]$Location = "Dallas, Texas, US",
    [int]$CompanyLimit = 5
)

$ErrorActionPreference = "Stop"
$appContainer = "leadforge-app"
$postgresContainer = "leadforge-postgres"
$runId = $null
$adminToken = $null
$jwtSecret = $null

if ($ApiUrl -ne "http://127.0.0.1:3000") { throw "The keyless discovery canary runs only against the loopback application." }
if ($CompanyLimit -lt 1 -or $CompanyLimit -gt 5) { throw "CompanyLimit must be between 1 and 5 for the bounded canary." }

$applicationEnvironment = docker inspect $appContainer --format '{{range .Config.Env}}{{println .}}{{end}}'
if ($LASTEXITCODE -ne 0) { throw "Could not inspect the local application container." }
$jwtEntry = $applicationEnvironment | Where-Object { $_ -like 'JWT_SECRET=*' } | Select-Object -First 1
if (-not $jwtEntry) { throw "JWT_SECRET is not available in the local application container." }
$jwtSecret = $jwtEntry.Substring('JWT_SECRET='.Length)

$adminRow = docker exec $postgresContainer psql -U leadforge_app -d leadforge_prod -At -F '|' -c 'SELECT id, email, role, "organizationId", "isDeveloper" FROM "User" WHERE role = ''developer_admin'' AND "organizationId" IS NOT NULL ORDER BY "createdAt" LIMIT 1;'
if ($LASTEXITCODE -ne 0 -or -not $adminRow) { throw "No developer-admin tenant is available for the canary." }
$adminFields = $adminRow.Trim().Split('|')
if ($adminFields.Count -ne 5) { throw "Unexpected developer-admin fixture shape." }

try {
    $claims = @{
        id = $adminFields[0]
        email = $adminFields[1]
        role = $adminFields[2]
        organizationId = $adminFields[3]
        isDeveloper = $adminFields[4] -eq 't'
    } | ConvertTo-Json -Compress
    $env:LEADFORGE_CANARY_CLAIMS = $claims
    $env:LEADFORGE_CANARY_JWT_SECRET = $jwtSecret
    $adminToken = node --input-type=module -e "import jwt from 'jsonwebtoken'; import crypto from 'node:crypto'; const claims=JSON.parse(process.env.LEADFORGE_CANARY_CLAIMS); process.stdout.write(jwt.sign({sub:claims.id,email:claims.email,role:claims.role,organizationId:claims.organizationId,isDeveloper:claims.isDeveloper,jti:crypto.randomBytes(12).toString('hex')},process.env.LEADFORGE_CANARY_JWT_SECRET,{algorithm:'HS256',expiresIn:900,audience:'leadforge-api',issuer:'leadforge-session-server'}));"
    if ($LASTEXITCODE -ne 0 -or -not $adminToken) { throw "Could not create a short-lived canary session." }
    $headers = @{ Authorization = "Bearer $adminToken" }

    $readiness = Invoke-RestMethod -Method Get -Uri "$ApiUrl/api/discovery/status" -Headers $headers
    if (-not $readiness.ready -or -not $readiness.queueConnected -or $readiness.provider -ne 'overture_maps') {
        throw "Keyless discovery or its durable queue is not ready."
    }

    $qualificationContract = @{
        clientOffer = 'Website conversion improvements and AI-assisted after-hours lead intake'
        targetIndustries = @($Market)
        targetGeography = @($Location)
        targetCompanyCharacteristics = @{
            minEmployees = $null
            maxEmployees = $null
            allowUnknownEmployeeCount = $true
            minSourceConfidence = 0.65
            requirePublicEmail = $false
            requirePublicPhone = $false
            requiredTechnologies = @()
            excludedTechnologies = @()
        }
        desiredBuyerRoles = @('Owner', 'General Manager', 'Operations Manager')
        qualifyingSignals = @(
            @{ key = 'missing_online_scheduling'; weight = 20; required = $false }
            @{ key = 'missing_online_estimate'; weight = 20; required = $false }
            @{ key = 'missing_after_hours_intake'; weight = 15; required = $false }
            @{ key = 'missing_live_chat'; weight = 15; required = $false }
            @{ key = 'missing_marketing_automation'; weight = 15; required = $false }
            @{ key = 'missing_local_business_schema'; weight = 15; required = $false }
        )
        disqualifyingSignalKeys = @()
        minEvidenceCount = 2
        minEvidenceQuality = 0.7
        minOpportunityScore = 30
        notes = 'Bounded live acceptance contract; no paid discovery provider.'
    }
    $request = @{
        market = $Market
        location = $Location
        companyLimit = $CompanyLimit
        radiusKm = 35
        minConfidence = 0.65
        enrichNamedContacts = $false
        autoResearchWebsites = $true
        qualificationContract = $qualificationContract
    } | ConvertTo-Json -Depth 8
    $start = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/discovery/runs" -Headers $headers -ContentType 'application/json' -Body $request
    $runId = [string]$start.run.id
    if ($runId -notmatch '^[0-9a-fA-F-]{36}$') { throw "Discovery did not return a valid run ID." }

    $run = $null
    for ($attempt = 0; $attempt -lt 90; $attempt++) {
        Start-Sleep -Seconds 2
        $response = Invoke-RestMethod -Method Get -Uri "$ApiUrl/api/discovery/runs/$runId" -Headers $headers
        $run = $response.run
        if ($run.status -in @('completed', 'partial', 'failed', 'cancelled')) { break }
    }
    if (-not $run -or $run.status -notin @('completed', 'partial')) {
        throw "Discovery canary did not complete successfully: $($run.status) $($run.errorCode) $($run.errorMessage)"
    }
    if ($run.provider -ne 'overture_maps' -or $run.candidatesEvaluated -lt 1 -or $run.domainSearchesPerformed -ne 0) {
        throw "Opportunity canary did not evaluate public-source candidates with zero paid searches."
    }
    if (-not $run.companies -or $run.companies.Count -lt 1) { throw "Discovery canary returned no durable company records." }
    foreach ($company in $run.companies) {
        if (-not $company.domain -or -not $company.websiteUrl -or -not $company.providerCompanyId -or -not $company.datasetRelease -or $company.sourceUrls.Count -lt 2) {
            throw "A canary company is missing its real domain or source provenance."
        }
    }
    $qualified = @($run.companies | Where-Object { $_.qualificationStatus -eq 'qualified' })
    if ($qualified.Count -lt 1 -or $run.prospectsQualified -ne $qualified.Count) {
        throw "Opportunity canary did not produce a deterministic evidence-qualified prospect batch."
    }
    foreach ($prospect in $qualified) {
        if ($prospect.opportunityScore -lt $qualificationContract.minOpportunityScore -or $prospect.evidenceQuality -lt $qualificationContract.minEvidenceQuality) {
            throw "A qualified prospect did not clear the contract thresholds."
        }
        $matchedSignals = @($prospect.opportunitySignals | Where-Object { $_.matchedQualifyingRule })
        if ($matchedSignals.Count -lt $qualificationContract.minEvidenceCount -or -not $prospect.qualificationReasons -or -not $prospect.outreachAngle) {
            throw "A qualified prospect is missing qualification reasons, an evidence-only outreach angle, or the minimum observations."
        }
        foreach ($signal in $matchedSignals) {
            if (-not $signal.sourceUrl -or -not $signal.observedAt -or -not $signal.snapshotSha256 -or -not $signal.observation) {
                throw "A matched opportunity signal is missing factual evidence provenance."
            }
        }
    }

    $export = Invoke-WebRequest -Method Get -Uri "$ApiUrl/api/discovery/runs/$runId/prospects.csv" -Headers $headers
    $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes([string]$export.Content)
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try { $actualHash = [Convert]::ToHexString($hasher.ComputeHash($payloadBytes)).ToLowerInvariant() } finally { $hasher.Dispose() }
    $expectedHash = [string]($export.Headers['X-Content-SHA256'] | Select-Object -First 1)
    if ($actualHash -ne $expectedHash) { throw "Company export SHA-256 header did not match the exact payload bytes." }
    $recordCountHeader = [string]($export.Headers['X-Record-Count'] | Select-Object -First 1)
    if ([int]$recordCountHeader -ne $qualified.Count) { throw "Prospect export included candidates outside the qualified batch." }
    foreach ($rejectedCompany in @($run.companies | Where-Object { $_.qualificationStatus -ne 'qualified' })) {
        if ([string]$export.Content -match [regex]::Escape([string]$rejectedCompany.domain)) {
            throw "Prospect export leaked a rejected directory record."
        }
    }
    if ([string]$export.Content -notmatch 'Overture Places \(source-dependent CDLA Permissive 2\.0, Apache 2\.0, or CC0' -or [string]$export.Content -notmatch 'GeoNames \(CC BY 4\.0\)') {
        throw "Company export omitted required data attribution."
    }

    $evidenceSql = 'SELECT count(*) FROM "CrawlEvidence" e JOIN "DiscoveryCompany" c ON c."accountId" = e."accountId" WHERE c."runId" = ''{0}'';' -f $runId
    $evidenceCount = docker exec $postgresContainer psql -U leadforge_app -d leadforge_prod -tAc $evidenceSql
    $evidenceCountValue = [string](@($evidenceCount) | Select-Object -Last 1)
    if ($LASTEXITCODE -ne 0 -or [int]$evidenceCountValue.Trim() -lt 1) { throw "Automatic website research did not persist crawl evidence." }

    [pscustomobject]@{
        RunId = $runId
        Status = $run.status
        CandidatesEvaluated = $run.candidatesEvaluated
        QualifiedProspects = $run.prospectsQualified
        RejectedCandidates = $run.prospectsDisqualified
        PaidSearches = $run.domainSearchesPerformed
        NamedContacts = $run.contactsFound
        CrawlEvidence = [int]$evidenceCountValue.Trim()
        ExportSha256 = $actualHash
        Result = 'passed'
        VerifiedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
} finally {
    if ($runId -and $runId -match '^[0-9a-fA-F-]{36}$') {
        $cleanupSql = @"
CREATE TEMP TABLE canary_accounts AS
SELECT DISTINCT c."accountId" AS id
FROM "DiscoveryCompany" c
JOIN "DiscoveryRun" r ON r.id = c."runId"
JOIN "Account" a ON a.id = c."accountId"
WHERE c."runId" = '$runId' AND a."createdAt" >= r."createdAt";
CREATE TEMP TABLE canary_leads AS
SELECT DISTINCT dc."leadId" AS id FROM "DiscoveryContact" dc WHERE dc."runId" = '$runId' AND dc."leadId" IS NOT NULL;
DELETE FROM "CrawlEvidence" WHERE "accountId" IN (SELECT id FROM canary_accounts);
DELETE FROM "Lead" WHERE id IN (SELECT id FROM canary_leads) AND "sourceType" = 'crawl';
DELETE FROM "ActivityLog" WHERE metadata->>'runId' = '$runId';
DELETE FROM "DiscoveryRun" WHERE id = '$runId';
DELETE FROM "Account" WHERE id IN (SELECT id FROM canary_accounts) AND NOT EXISTS (SELECT 1 FROM "Lead" l WHERE l."accountId" = "Account".id);
"@
        docker exec $postgresContainer psql -v ON_ERROR_STOP=1 -U leadforge_app -d leadforge_prod -c $cleanupSql 2>$null | Out-Null
    }
    $jwtSecret = $null
    $adminToken = $null
    Remove-Item Env:LEADFORGE_CANARY_CLAIMS -ErrorAction SilentlyContinue
    Remove-Item Env:LEADFORGE_CANARY_JWT_SECRET -ErrorAction SilentlyContinue
}
