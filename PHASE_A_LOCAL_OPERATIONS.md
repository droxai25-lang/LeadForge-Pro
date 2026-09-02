# Phase A — Private Local Operations

LeadForge is currently an owner-operated research system. Customers receive
reviewed lead deliverables, never application access, packages, container
images, credentials, or source code.

## Enforced boundary

- `LOCAL_ONLY_MODE=true` is the default.
- Direct Node execution binds to `127.0.0.1` unless `HOST` is explicitly set.
- Local-only mode refuses a wildcard bind outside the declared container
  runtime.
- Docker Compose listens on the container interface but publishes only
  `127.0.0.1:3000` on the Windows host.
- PostgreSQL and Redis are exposed only to the Compose network.
- `SMTP_SENDING_ENABLED=true` is rejected during startup.
- `APP_URL` may be empty or loopback-only.
- `CORS_ORIGINS` may be empty or contain only loopback origins.
- Campaign delivery remains unavailable. Lead research and reviewed exports do
  not require SMTP.

## Required local environment

Create `.env` from `.env.example` and replace every placeholder secret with an
independent random value. Keep these exact Phase A settings:

```dotenv
LOCAL_ONLY_MODE=true
CONTAINERIZED=false
HOST=127.0.0.1
APP_URL=
CORS_ORIGINS=
SMTP_SENDING_ENABLED=false
HUNTER_DISCOVERY_ENABLED=false
HUNTER_API_KEY=
HUNTER_MAX_EMAIL_CREDITS_PER_RUN=25
```

To enable real discovery, create a Hunter key, replace only the three Hunter
values in `.env`, and rerun `scripts\upgrade-local.ps1` with the current image.
The script rejects Hunter's dummy `test-api-key`, validates the credit ceiling,
and passes the key to Docker without printing it.

Docker Compose overrides `HOST` and `CONTAINERIZED` inside the application
container while preserving `LOCAL_ONLY_MODE=true` and the loopback-only host
port.

Do not commit `.env`. It is ignored by Git.

## Start and verify on Windows

Run from the repository root:

```powershell
Set-Location -LiteralPath 'C:\Users\droxa\LeadForge-Pro'
docker compose up --build -d
docker compose ps
Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000/api/health/live'
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

The host listener must report `127.0.0.1`, not `0.0.0.0`, `::`, a LAN address,
or a public address.

Open the application only at:

```text
http://127.0.0.1:3000
```

## Stop

```powershell
Set-Location -LiteralPath 'C:\Users\droxa\LeadForge-Pro'
docker compose down
```

Do not add `--volumes`; that would delete the PostgreSQL and Redis volumes.

## Operator workflow

1. Open **Market Discovery**, state a concrete niche/location, optionally
  select a managed client, and set a maximum number of paid domain searches.
  Company discovery may return more domains than the paid ceiling; the worker
  stops contact searches at the exact operator budget and never auto-retries.
2. Review discovered companies and named contacts. `provider_verified` means
  Hunter supplied a valid verification result; it is not SMTP acceptance or
  proof of identity. Excluded and duplicate contacts are not recreated.
3. Use **Research all websites** to persist source-page crawl evidence. Retain
  source URLs and crawl evidence for material claims. Treat MX,
  catch-all, and SMTP acceptance as distinct evidence states.
4. Open **Export / Managed Delivery**, create the client, and record its written
  target profile, delivery contact, and retention period.
5. Add every email, domain, and company exclusion supplied by the client.
6. Remove duplicates and unsupported records, then approve or reject each lead
  for that specific client. A lead approved for one client is not implicitly
  approved for another.
7. Prepare CSV or JSON using only the agreed fields. Preparation fails if any
  selected lead is not tenant-owned, approved, or passes a new exclusion.
8. Download the exact server payload. The browser verifies the response bytes
  against the stored SHA-256 hash before saving them.
9. Deliver the file outside LeadForge or send an existing JSON batch to an
  approved HTTPS webhook. Record the actual recipient/destination only after
  delivery.
10. Use delivery history to retain the batch ID, exact lead IDs, fields, hash,
  destination, and timestamps. The hourly retention pass removes expired
  payload bytes but preserves this metadata.

AI output is never evidence. It may summarize stored evidence, but it must not
invent a person, address, title, company fact, buying signal, or verification
outcome.

## Backups

Create a database backup before migrations, upgrades, or material batch work.
Store backups outside Git and record a SHA-256 digest. The `backups/` directory
is ignored because dumps may contain client data and encrypted credentials.

From the repository root, create a custom-format backup with a SHA-256 sidecar:

```powershell
.\scripts\backup-postgres.ps1
```

Before an upgrade, verify the selected dump by restoring it into a uniquely
named disposable database and checking baseline table counts:

```powershell
.\scripts\restore-drill.ps1 -BackupPath '.\backups\leadforge-prod-YYYYMMDD-HHMMSS.dump'
```

The restore script refuses unsafe database names, verifies that the disposable
database does not already exist, terminates only its own drill connections, and
removes it afterward. A backup that has not passed this drill is not proven
recoverable.

## Source privacy

The canonical GitHub repository is private. Before pushing, confirm:

```powershell
gh repo view moonrox420/LeadForge-Pro --json nameWithOwner,visibility,isPrivate
git status --short --branch
git diff --check
```

Never attach the repository, container image, database dump, `.env`, source map,
or application bundle to a customer delivery.

Changing a repository from public to private does not retract copies obtained
while it was public. Any credential that was ever committed must be rotated even
if it was later removed.

## Public-mode release boundary

Do not set `LOCAL_ONLY_MODE=false`, configure a public `APP_URL`, publish port
3000, enable SMTP, or deploy `render.yaml` during Phase A. Those changes belong
to a separately reviewed hosted-service release.
