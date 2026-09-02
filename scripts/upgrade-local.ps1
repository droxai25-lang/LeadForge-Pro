[CmdletBinding()]
param(
    [string]$ImageName = "leadforge-pro:autonomous-discovery-v6",
    [string]$RollbackName = "leadforge-app-pre-keyless-v4-20260829",
    [string]$DiscoveryVolume = "leadforge-discoverydata",
    [string]$EnvironmentFile = (Join-Path $PSScriptRoot '..\.env')
)

$ErrorActionPreference = "Stop"
$activeName = "leadforge-app"

foreach ($containerName in @($activeName, $RollbackName)) {
    if ($containerName -notmatch '^leadforge-app(?:-[a-z0-9-]+)?$') {
        throw "Refusing unsafe container name: $containerName"
    }
}
if ($ImageName -notmatch '^leadforge-pro:[a-zA-Z0-9._-]+$') {
    throw "Refusing unsafe image name: $ImageName"
}
if ($DiscoveryVolume -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_.-]+$') {
    throw "Refusing unsafe discovery volume name: $DiscoveryVolume"
}

$imageId = docker image inspect $ImageName --format '{{.Id}}' 2>$null
if ($LASTEXITCODE -ne 0 -or -not $imageId) { throw "Image is not available: $ImageName" }

$activeId = docker inspect $activeName --format '{{.Id}}' 2>$null
if ($LASTEXITCODE -ne 0 -or -not $activeId) { throw "Active container is not available: $activeName" }
$running = docker inspect $activeName --format '{{.State.Running}}'
if ($LASTEXITCODE -ne 0 -or $running -ne "true") { throw "Active container is not running: $activeName" }

docker inspect $RollbackName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { throw "Rollback container already exists: $RollbackName" }

$networkJson = docker inspect $activeName --format '{{json .NetworkSettings.Networks}}'
if ($LASTEXITCODE -ne 0) { throw "Could not inspect the active container network." }
$networkName = (($networkJson | ConvertFrom-Json).PSObject.Properties.Name | Select-Object -First 1)
if (-not $networkName -or $networkName -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_.-]+$') {
    throw "Could not resolve a safe Docker network name."
}

$environment = @(docker inspect $activeName --format '{{range .Config.Env}}{{println .}}{{end}}' | Where-Object { $_ -and $_.Contains('=') })
if ($LASTEXITCODE -ne 0 -or $environment.Count -eq 0) { throw "Could not inspect the active container environment." }
$environmentMap = @{}
foreach ($entry in $environment) {
    $separator = $entry.IndexOf('=')
    if ($separator -gt 0) { $environmentMap[$entry.Substring(0, $separator)] = $entry.Substring($separator + 1) }
}

# Overlay only the known discovery settings from the repository environment
# file. The API key is passed directly to Docker and is never printed.
$discoveryEnvironment = @{
    OVERTURE_DISCOVERY_ENABLED = if ($environmentMap['OVERTURE_DISCOVERY_ENABLED']) { $environmentMap['OVERTURE_DISCOVERY_ENABLED'] } else { 'true' }
    HUNTER_DISCOVERY_ENABLED = if ($environmentMap['HUNTER_DISCOVERY_ENABLED']) { $environmentMap['HUNTER_DISCOVERY_ENABLED'] } else { 'false' }
    HUNTER_API_KEY = if ($environmentMap['HUNTER_API_KEY']) { $environmentMap['HUNTER_API_KEY'] } else { '' }
    HUNTER_MAX_EMAIL_CREDITS_PER_RUN = if ($environmentMap['HUNTER_MAX_EMAIL_CREDITS_PER_RUN']) { $environmentMap['HUNTER_MAX_EMAIL_CREDITS_PER_RUN'] } else { '25' }
}
if (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf) {
    foreach ($line in Get-Content -LiteralPath $EnvironmentFile) {
        if ($line -match '^\s*(OVERTURE_DISCOVERY_ENABLED|HUNTER_DISCOVERY_ENABLED|HUNTER_API_KEY|HUNTER_MAX_EMAIL_CREDITS_PER_RUN)\s*=\s*(.*)\s*$') {
            $value = $Matches[2].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $discoveryEnvironment[$Matches[1]] = $value
        }
    }
}
if ($discoveryEnvironment.HUNTER_DISCOVERY_ENABLED -notin @('true', 'false')) {
    throw "HUNTER_DISCOVERY_ENABLED must be true or false."
}
if ($discoveryEnvironment.OVERTURE_DISCOVERY_ENABLED -notin @('true', 'false')) {
    throw "OVERTURE_DISCOVERY_ENABLED must be true or false."
}
$creditLimit = 0
if (-not [int]::TryParse($discoveryEnvironment.HUNTER_MAX_EMAIL_CREDITS_PER_RUN, [ref]$creditLimit) -or $creditLimit -lt 0 -or $creditLimit -gt 100) {
    throw "HUNTER_MAX_EMAIL_CREDITS_PER_RUN must be an integer between 0 and 100."
}
if ($discoveryEnvironment.HUNTER_DISCOVERY_ENABLED -eq 'true') {
    if ($discoveryEnvironment.HUNTER_API_KEY -eq 'test-api-key' -or $discoveryEnvironment.HUNTER_API_KEY.Length -lt 16) {
        throw "Enabled Hunter discovery requires a real API key; Hunter's dummy test key is not accepted."
    }
}

if ($environmentMap['LOCAL_ONLY_MODE'] -ne 'true') { throw "Upgrade requires LOCAL_ONLY_MODE=true." }
if ($environmentMap['CONTAINERIZED'] -ne 'true') { throw "Upgrade requires CONTAINERIZED=true." }
if ($environmentMap['SMTP_SENDING_ENABLED'] -ne 'false') { throw "Upgrade requires SMTP_SENDING_ENABLED=false." }
if ($environmentMap['APP_URL']) { throw "Upgrade requires an empty APP_URL." }
if ($environmentMap['CORS_ORIGINS']) { throw "Upgrade requires an empty CORS_ORIGINS value." }
if (-not $environmentMap['DATABASE_URL']) { throw "The active container has no DATABASE_URL." }

$environment = @($environment | Where-Object {
    $_ -notlike 'CRAWL_EVIDENCE_RETENTION_DAYS=*' -and
    $_ -notlike 'OVERTURE_DISCOVERY_ENABLED=*' -and
    $_ -notlike 'OVERTURE_DUCKDB_EXTENSION_DIR=*' -and
    $_ -notlike 'GEONAMES_DATA_DIR=*' -and
    $_ -notlike 'HUNTER_DISCOVERY_ENABLED=*' -and
    $_ -notlike 'HUNTER_API_KEY=*' -and
    $_ -notlike 'HUNTER_MAX_EMAIL_CREDITS_PER_RUN=*'
})
$environment += 'CRAWL_EVIDENCE_RETENTION_DAYS=180'
$environment += "OVERTURE_DISCOVERY_ENABLED=$($discoveryEnvironment.OVERTURE_DISCOVERY_ENABLED)"
$environment += 'OVERTURE_DUCKDB_EXTENSION_DIR=/app/.runtime/duckdb_extensions'
$environment += 'GEONAMES_DATA_DIR=/app/.runtime/geonames'
$environment += "HUNTER_DISCOVERY_ENABLED=$($discoveryEnvironment.HUNTER_DISCOVERY_ENABLED)"
$environment += "HUNTER_API_KEY=$($discoveryEnvironment.HUNTER_API_KEY)"
$environment += "HUNTER_MAX_EMAIL_CREDITS_PER_RUN=$creditLimit"

docker run --rm --network $networkName --entrypoint npx -e "DATABASE_URL=$($environmentMap['DATABASE_URL'])" $ImageName prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "Active-database migration failed; the running container was not changed." }

docker volume inspect $DiscoveryVolume 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    docker volume create $DiscoveryVolume | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not create the persistent discovery cache volume." }
}

$renamed = $false
$newId = $null
try {
    docker update --restart=no $activeName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not disable restart on the rollback container." }
    docker stop --time 30 $activeName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not stop the existing application container." }
    docker rename $activeName $RollbackName
    if ($LASTEXITCODE -ne 0) { throw "Could not preserve the existing application container." }
    $renamed = $true

    $createArgs = @(
        'create',
        '--name', $activeName,
        '--restart', 'always',
        '--network', $networkName,
        '--publish', '127.0.0.1:3000:3000',
        '--mount', "type=volume,source=$DiscoveryVolume,target=/app/.runtime",
        '--health-cmd', 'wget -qO- http://127.0.0.1:3000/api/health/live || exit 1',
        '--health-interval', '10s',
        '--health-timeout', '5s',
        '--health-retries', '3',
        '--health-start-period', '20s'
    )
    foreach ($entry in $environment) { $createArgs += @('--env', $entry) }
    $createArgs += $ImageName
    $createOutput = & docker @createArgs
    if ($LASTEXITCODE -ne 0 -or -not $createOutput) { throw "Could not create the replacement application container." }
    $newId = ([string]$createOutput).Trim()

    docker start $activeName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not start the replacement application container." }

    $healthy = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 1
        docker exec $activeName wget -qO- http://127.0.0.1:3000/api/health/live 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $healthy = $true
            break
        }
    }
    if (-not $healthy) { throw "Replacement application did not become healthy within 30 seconds." }

    $binding = docker port $activeName 3000/tcp
    if ($LASTEXITCODE -ne 0 -or $binding.Trim() -ne '127.0.0.1:3000') {
        throw "Replacement application is not restricted to 127.0.0.1:3000."
    }

    [pscustomobject]@{
        ActiveContainer = $activeName
        ActiveImage = $ImageName
        ActiveImageId = $imageId.Trim()
        RollbackContainer = $RollbackName
        Listener = $binding.Trim()
        Health = 'passed'
        UpgradedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
} catch {
    if ($newId) {
        $currentId = docker inspect $activeName --format '{{.Id}}' 2>$null
        if ($LASTEXITCODE -eq 0 -and $currentId -eq $newId) {
            docker rm --force $activeName 2>$null | Out-Null
        }
    }
    if ($renamed) {
        docker rename $RollbackName $activeName 2>$null
        if ($LASTEXITCODE -eq 0) {
            docker update --restart=always $activeName 2>$null | Out-Null
            docker start $activeName 2>$null | Out-Null
        }
    }
    throw
}
