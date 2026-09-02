[CmdletBinding()]
param(
    [string]$ApiUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"
$appContainer = "leadforge-app"
$postgresContainer = "leadforge-postgres"

if ($ApiUrl -ne "http://127.0.0.1:3000") {
    throw "The private-operation canary runs only against http://127.0.0.1:3000."
}

$applicationEnvironment = docker inspect $appContainer --format '{{range .Config.Env}}{{println .}}{{end}}'
if ($LASTEXITCODE -ne 0) { throw "Could not inspect the local application container." }
$jwtEntry = $applicationEnvironment | Where-Object { $_ -like 'JWT_SECRET=*' } | Select-Object -First 1
if (-not $jwtEntry) { throw "JWT_SECRET is not available in the local application container." }
$jwtSecret = $jwtEntry.Substring('JWT_SECRET='.Length)

$adminRow = docker exec $postgresContainer psql -U leadforge_app -d leadforge_prod -At -F '|' -c 'SELECT u.id, u.email, u.role, u."organizationId", u."isDeveloper", l.id, l.email FROM "User" u JOIN LATERAL (SELECT id, email FROM "Lead" WHERE "organizationId" = u."organizationId" ORDER BY "createdAt" LIMIT 1) l ON true WHERE u.role = ''developer_admin'' AND u."organizationId" IS NOT NULL ORDER BY u."createdAt" LIMIT 1;'
if ($LASTEXITCODE -ne 0 -or -not $adminRow) { throw "No developer-admin tenant with a live lead is available for the canary." }
$adminFields = $adminRow.Trim().Split('|')
if ($adminFields.Count -ne 7) { throw "Unexpected developer-admin fixture shape." }

$secondSql = 'SELECT id, email, role, "organizationId", "isDeveloper" FROM "User" WHERE "organizationId" IS NOT NULL AND "organizationId" <> ''{0}'' ORDER BY "createdAt" LIMIT 1;' -f $adminFields[3]
$secondRow = docker exec $postgresContainer psql -U leadforge_app -d leadforge_prod -At -F '|' -c $secondSql
if ($LASTEXITCODE -ne 0 -or -not $secondRow) { throw "No second tenant is available for the isolation canary." }
$secondFields = $secondRow.Trim().Split('|')
if ($secondFields.Count -ne 5) { throw "Unexpected second-tenant fixture shape." }

function New-CanaryToken {
    param([string[]]$Fields)

    $claims = @{
        id = $Fields[0]
        email = $Fields[1]
        role = $Fields[2]
        organizationId = $Fields[3]
        isDeveloper = $Fields[4] -eq 't'
    } | ConvertTo-Json -Compress
    $env:LEADFORGE_CANARY_CLAIMS = $claims
    $token = node --input-type=module -e "import jwt from 'jsonwebtoken'; import crypto from 'node:crypto'; const claims=JSON.parse(process.env.LEADFORGE_CANARY_CLAIMS); process.stdout.write(jwt.sign({sub:claims.id,email:claims.email,role:claims.role,organizationId:claims.organizationId,isDeveloper:claims.isDeveloper,jti:crypto.randomBytes(12).toString('hex')},process.env.LEADFORGE_CANARY_JWT_SECRET,{algorithm:'HS256',expiresIn:900,audience:'leadforge-api',issuer:'leadforge-session-server'}));"
    if ($LASTEXITCODE -ne 0 -or -not $token) { throw "Could not create a short-lived canary session." }
    return $token
}

try {
    $env:LEADFORGE_CANARY_JWT_SECRET = $jwtSecret
    $adminToken = New-CanaryToken -Fields $adminFields[0..4]
    $secondToken = New-CanaryToken -Fields $secondFields

    $env:TEST_API_URL = $ApiUrl
    $env:TEST_ADMIN_TOKEN = $adminToken
    $env:TEST_SECOND_TENANT_TOKEN = $secondToken
    $env:TEST_LIVE_LEAD_ID = $adminFields[5]
    $env:TEST_LIVE_LEAD_EMAIL = $adminFields[6]

    npx vitest run tests/managedDelivery.integration.test.ts
    if ($LASTEXITCODE -ne 0) { throw "Managed-delivery service canary failed." }

    $operations = Invoke-RestMethod -Method Get -Uri "$ApiUrl/api/admin/operations" -Headers @{ Authorization = "Bearer $adminToken" }
    if (-not $operations.success) { throw "Operations telemetry did not return success." }

    $residue = docker exec $postgresContainer psql -U leadforge_app -d leadforge_prod -tAc 'SELECT json_build_object(''managedClients'', (SELECT count(*) FROM "ManagedClient"), ''deliveryBatches'', (SELECT count(*) FROM "DeliveryBatch"), ''clientExclusions'', (SELECT count(*) FROM "ClientExclusion"), ''leadReviews'', (SELECT count(*) FROM "LeadReview"));'
    if ($LASTEXITCODE -ne 0) { throw "Could not verify canary cleanup." }
    [pscustomobject]@{
        ApiUrl = $ApiUrl
        Result = 'passed'
        Queue = ($operations.queue | ConvertTo-Json -Compress)
        Retention = ($operations.retention | ConvertTo-Json -Compress)
        Residue = $residue.Trim()
        VerifiedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
} finally {
    $jwtSecret = $null
    $adminToken = $null
    $secondToken = $null
    Remove-Item Env:LEADFORGE_CANARY_JWT_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:LEADFORGE_CANARY_CLAIMS -ErrorAction SilentlyContinue
    Remove-Item Env:TEST_API_URL -ErrorAction SilentlyContinue
    Remove-Item Env:TEST_ADMIN_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:TEST_SECOND_TENANT_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:TEST_LIVE_LEAD_ID -ErrorAction SilentlyContinue
    Remove-Item Env:TEST_LIVE_LEAD_EMAIL -ErrorAction SilentlyContinue
}
