[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath
)

$ErrorActionPreference = "Stop"
$containerName = "leadforge-postgres"
$resolvedBackup = (Resolve-Path -LiteralPath $BackupPath).Path
if ([System.IO.Path]::GetExtension($resolvedBackup) -ne ".dump") {
    throw "BackupPath must reference a .dump file created by backup-postgres.ps1."
}

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$databaseName = "leadforge_restore_$timestamp"
$containerPath = "/tmp/$databaseName.dump"
$created = $false

$existing = docker exec $containerName psql -U leadforge_app -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$databaseName';"
if ($LASTEXITCODE -ne 0) { throw "Could not inspect PostgreSQL." }
if ($existing -and $existing.Trim()) { throw "The disposable database name already exists: $databaseName" }

try {
    docker exec $containerName createdb -U leadforge_app $databaseName
    if ($LASTEXITCODE -ne 0) { throw "Could not create disposable restore database." }
    $created = $true
    docker cp $resolvedBackup "${containerName}:$containerPath"
    if ($LASTEXITCODE -ne 0) { throw "Could not copy the backup into the PostgreSQL container." }
    docker exec $containerName pg_restore -U leadforge_app -d $databaseName --exit-on-error $containerPath
    if ($LASTEXITCODE -ne 0) { throw "pg_restore failed; the backup is not verified." }

    $counts = docker exec $containerName psql -U leadforge_app -d $databaseName -tAc 'SELECT json_build_object(''organizations'', (SELECT count(*) FROM "Organization"), ''leads'', (SELECT count(*) FROM "Lead"), ''deliveryBatchTablePresent'', to_regclass(''"DeliveryBatch"'') IS NOT NULL);'
    if ($LASTEXITCODE -ne 0) { throw "The restored schema could not be queried." }

    [pscustomobject]@{
        BackupPath = $resolvedBackup
        Sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedBackup).Hash
        RestoredCounts = $counts.Trim()
        VerifiedAt = (Get-Date).ToUniversalTime().ToString("o")
    }
} finally {
    docker exec $containerName rm -f $containerPath 2>$null | Out-Null
    if ($created) {
        docker exec $containerName dropdb -U leadforge_app $databaseName 2>$null | Out-Null
    }
}
