[CmdletBinding()]
param(
    [string]$ApiUrl = "http://127.0.0.1:3000",
    [int]$CompanyLimit = 3
)

$ErrorActionPreference = "Stop"
$appContainer = "leadforge-app"
$postgresContainer = "leadforge-postgres"
$runId = $null
$autopilotId = $null
$adminToken = $null
$jwtSecret = $null
$organizationId = $null

if ($ApiUrl -ne "http://127.0.0.1:3000") { throw "The autonomous discovery canary runs only against the loopback application." }
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
$organizationId = $adminFields[3]
if ($organizationId -notmatch '^[0-9a-fA-F-]{36}$') { throw "The canary tenant ID is not a UUID." }

try {
    $existingAutopilot = docker exec $postgresContainer psql -U leadforge_app -d leadforge_prod -tAc "SELECT id FROM `"DiscoveryAutopilot`" WHERE `"organizationId`" = '$organizationId';"
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect autonomous discovery state." }
    if ($existingAutopilot -and $existingAutopilot.Trim()) {
        throw "The selected tenant already has autonomous discovery state. The canary refuses to overwrite it."
    }

    $autopilotId = [guid]::NewGuid().ToString()
    $insertAutopilotSql = "INSERT INTO `"DiscoveryAutopilot`" (id, `"organizationId`", enabled, `"intervalMinutes`", `"companyLimit`", cursor, `"createdAt`", `"updatedAt`") VALUES ('$autopilotId', '$organizationId', false, 60, $CompanyLimit, 0, now(), now());"
    docker exec $postgresContainer psql -v ON_ERROR_STOP=1 -U leadforge_app -d leadforge_prod -c $insertAutopilotSql | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not create isolated canary frontier state." }

    $claims = @{
        id = $adminFields[0]
        email = $adminFields[1]
        role = $adminFields[2]
        organizationId = $organizationId
        isDeveloper = $adminFields[4] -eq 't'
    } | ConvertTo-Json -Compress
    $env:LEADFORGE_CANARY_CLAIMS = $claims
    $env:LEADFORGE_CANARY_JWT_SECRET = $jwtSecret
    $adminToken = node --input-type=module -e "import jwt from 'jsonwebtoken'; import crypto from 'node:crypto'; const claims=JSON.parse(process.env.LEADFORGE_CANARY_CLAIMS); process.stdout.write(jwt.sign({sub:claims.id,email:claims.email,role:claims.role,organizationId:claims.organizationId,isDeveloper:claims.isDeveloper,jti:crypto.randomBytes(12).toString('hex')},process.env.LEADFORGE_CANARY_JWT_SECRET,{algorithm:'HS256',expiresIn:900,audience:'leadforge-api',issuer:'leadforge-session-server'}));"
    if ($LASTEXITCODE -ne 0 -or -not $adminToken) { throw "Could not create a short-lived canary session." }
    $headers = @{ Authorization = "Bearer $adminToken" }

    $status = Invoke-RestMethod -Method Get -Uri "$ApiUrl/api/discovery/autopilot" -Headers $headers
    if ($status.coverage.userLocationRequired -or $status.coverage.userNicheRequired -or $status.coverage.slots -lt 10000) {
        throw "Autonomous status did not expose a system-owned worldwide frontier."
    }
    if (-not $status.sellerProfile.offer -or -not $status.qualificationContract.qualifyingSignals) {
        throw "Autonomous status did not expose the built-in DroxAI seller and qualification contract."
    }

    # Intentionally send no body: niche, location, offer, and criteria are not operator inputs.
    $start = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/discovery/autopilot/start" -Headers $headers
    $runId = [string]$start.autopilot.currentRunId
    if ($runId -notmatch '^[0-9a-fA-F-]{36}$') { throw "Zero-input autonomous discovery did not return a valid current run ID." }

    $run = $null
    for ($attempt = 0; $attempt -lt 180; $attempt++) {
        Start-Sleep -Seconds 2
        $response = Invoke-RestMethod -Method Get -Uri "$ApiUrl/api/discovery/runs/$runId" -Headers $headers
        $run = $response.run
        if ($run.status -in @('completed', 'partial', 'failed', 'cancelled')) { break }
    }
    if (-not $run -or $run.status -notin @('completed', 'partial')) {
        throw "Autonomous canary did not complete successfully: $($run.status) $($run.errorCode) $($run.errorMessage)"
    }
    if ($run.provider -ne 'overture_autopilot' -or $run.criteria.mode -ne 'autopilot' -or $run.candidatesEvaluated -lt 1 -or $run.domainSearchesPerformed -ne 0) {
        throw "Autonomous canary did not research public candidates with its internal contract and zero paid searches."
    }

    $qualified = @($run.companies | Where-Object { $_.qualificationStatus -eq 'qualified' })
    if ($qualified.Count -lt 1 -or $run.prospectsQualified -ne $qualified.Count) {
        throw "Autonomous canary did not produce an evidence-qualified prospect batch."
    }
    foreach ($prospect in $qualified) {
        $matchedSignals = @($prospect.opportunitySignals | Where-Object { $_.matchedQualifyingRule })
        if ($matchedSignals.Count -lt $status.qualificationContract.minEvidenceCount -or -not $prospect.qualificationReasons -or -not $prospect.outreachAngle) {
            throw "A qualified autonomous prospect is missing its qualification explanation or outreach angle."
        }
        foreach ($signal in $matchedSignals) {
            if (-not $signal.sourceUrl -or -not $signal.observedAt -or -not $signal.snapshotSha256 -or -not $signal.observation) {
                throw "A matched autonomous opportunity signal is missing factual evidence provenance."
            }
        }
    }

    $export = Invoke-WebRequest -Method Get -Uri "$ApiUrl/api/discovery/runs/$runId/prospects.csv" -Headers $headers
    $recordCountHeader = [string]($export.Headers['X-Record-Count'] | Select-Object -First 1)
    if ([int]$recordCountHeader -ne $qualified.Count) { throw "Autonomous export included records outside the qualified batch." }
    foreach ($rejectedCompany in @($run.companies | Where-Object { $_.qualificationStatus -ne 'qualified' })) {
        if ([string]$export.Content -match [regex]::Escape([string]$rejectedCompany.domain)) {
            throw "Autonomous export leaked a rejected directory record."
        }
    }

    $stop = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/discovery/autopilot/stop" -Headers $headers
    if ($stop.autopilot.enabled -or $stop.autopilot.nextRunAt) { throw "Autonomous Stop did not disable future batches." }

    [pscustomobject]@{
        RunId = $runId
        Status = $run.status
        InternalMarket = $run.criteria.location
        CandidatesEvaluated = $run.candidatesEvaluated
        QualifiedProspects = $run.prospectsQualified
        RejectedCandidates = $run.prospectsDisqualified
        PaidSearches = $run.domainSearchesPerformed
        InputNiche = $null
        InputLocation = $null
        Result = 'passed'
        VerifiedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
} finally {
    if ($autopilotId -and $autopilotId -match '^[0-9a-fA-F-]{36}$') {
        $cleanupSql = @"
CREATE TEMP TABLE canary_runs AS SELECT id FROM "DiscoveryRun" WHERE id = '$runId' AND "organizationId" = '$organizationId';
CREATE TEMP TABLE canary_accounts AS
SELECT DISTINCT c."accountId" AS id
FROM "DiscoveryCompany" c
JOIN canary_runs r ON r.id = c."runId"
JOIN "Account" a ON a.id = c."accountId"
JOIN "DiscoveryRun" dr ON dr.id = c."runId"
WHERE a."createdAt" >= dr."createdAt";
CREATE TEMP TABLE canary_leads AS
SELECT DISTINCT dc."leadId" AS id FROM "DiscoveryContact" dc JOIN canary_runs r ON r.id = dc."runId" WHERE dc."leadId" IS NOT NULL;
DELETE FROM "CrawlEvidence" WHERE "accountId" IN (SELECT id FROM canary_accounts);
DELETE FROM "Lead" WHERE id IN (SELECT id FROM canary_leads) AND "sourceType" = 'crawl';
DELETE FROM "ActivityLog" WHERE metadata->>'runId' IN (SELECT id FROM canary_runs) OR metadata->>'autopilotId' = '$autopilotId';
DELETE FROM "DiscoveryRun" WHERE id IN (SELECT id FROM canary_runs);
DELETE FROM "DiscoveryAutopilot" WHERE id = '$autopilotId' AND "organizationId" = '$organizationId';
DELETE FROM "Account" WHERE id IN (SELECT id FROM canary_accounts) AND NOT EXISTS (SELECT 1 FROM "Lead" l WHERE l."accountId" = "Account".id);
"@
        docker exec $postgresContainer psql -v ON_ERROR_STOP=1 -U leadforge_app -d leadforge_prod -c $cleanupSql 2>$null | Out-Null
    }
    $jwtSecret = $null
    $adminToken = $null
    Remove-Item Env:LEADFORGE_CANARY_CLAIMS -ErrorAction SilentlyContinue
    Remove-Item Env:LEADFORGE_CANARY_JWT_SECRET -ErrorAction SilentlyContinue
}
