[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\backups")
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory, $repositoryRoot)
$containerName = "leadforge-postgres"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$fileName = "leadforge-prod-$timestamp.dump"
$containerPath = "/tmp/$fileName"
$hostPath = Join-Path $resolvedOutput $fileName

New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

$running = docker inspect --format '{{.State.Running}}' $containerName 2>$null
if ($LASTEXITCODE -ne 0 -or $running -ne "true") {
    throw "Container $containerName is not running. Start the local LeadForge stack before backing up."
}

try {
    docker exec $containerName pg_dump -U leadforge_app -d leadforge_prod -Fc -f $containerPath
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }
    docker cp "${containerName}:$containerPath" $hostPath
    if ($LASTEXITCODE -ne 0) { throw "docker cp failed." }
} finally {
    docker exec $containerName rm -f $containerPath 2>$null | Out-Null
}

$file = Get-Item -LiteralPath $hostPath
if ($file.Length -eq 0) { throw "The backup file is empty: $hostPath" }
$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $hostPath

[pscustomobject]@{
    Path = $file.FullName
    Bytes = $file.Length
    Sha256 = $hash.Hash
    CreatedAt = $file.CreationTimeUtc.ToString("o")
}
