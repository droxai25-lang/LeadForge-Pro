# LeadForge Pro Completion Audit

Verified 2026-08-29. This document separates the completed private local
product from future hosted-service work and external authorization.

## Completion boundary

The completed product is an owner-operated, loopback-only managed-lead system.
DroxAI uses it on the local machine to research, verify, review, and deliver
lead batches. Customers receive only the agreed deliverable; they receive no
application access, package, image, credentials, database, or source code.

Customer-facing SaaS, public hosting, CRM synchronization, marketplace/package
distribution, recurring unattended discovery scheduling, and live outreach from an owned
domain are not represented as completed features.

## Deliverables

| Deliverable | Status | Evidence |
| :--- | :--- | :--- |
| Truthful ingestion | Complete | Manual, CSV, JSON batch, crawl, and waterfall paths validate real inputs and store explicit acquisition provenance. Legacy rows migrate as `unknown`. |
| Zero-seed market discovery | Complete for local operation | A niche, city, radius, confidence floor, and limit start a one-attempt BullMQ job that queries the current Overture Places release through bounded GeoParquet partitions. GeoNames resolves the market location. Neither path needs an API key. Duplicate/exclusion enforcement, cancellation, durable company provenance, and explicit failures remain enforced. Hunter is optional and credit-capped for named-contact enrichment. |
| Evidence-backed crawling | Complete for discovery and operator-triggered crawls | Each discovered company is automatically researched on its public site. DNS-pinned HTTPS, redirect revalidation, per-origin robots handling, bounded HTML snapshots, hashes, explicit outcomes, evidence-scoped AI analysis, and automatic snapshot retention are enforced. A named person is promoted only when the source directly contains name, job title, and email. |
| Verification semantics | Complete | Syntax, MX/domain acceptance, SMTP mailbox acceptance, catch-all risk, and failure states remain distinct. No DNS-only path marks a mailbox accepted. |
| Human email boundary | Complete | Model JSON is internal only. Subject/body are recursively normalized, unresolved templates/object dumps are rejected, and plain recipient prose is revalidated in the SMTP worker. |
| Durable campaign engine | Code-complete but disabled locally | Campaigns, snapshots, queue state, suppression, unsubscribe, single-attempt SMTP policy, and signed provider events are durable. Local startup rejects SMTP enablement. |
| Managed client operations | Complete | Durable client profiles, bounded target profiles, contact data, lifecycle status, and per-client retention. |
| Exclusions and review | Complete | Normalized client exclusions and client-specific lead approvals are tenant-scoped and rechecked immediately before batch preparation. |
| Auditable delivery | Complete | Deterministic allow-listed CSV/JSON bytes, SHA-256 persistence and response headers, delivery history, manual/automatic purge, and exact prepared-batch HTTPS delivery. |
| Operations and recovery | Complete for local operation | Real queue/dispatch/retention telemetry, safe pre-SMTP retry only, PostgreSQL backup, disposable restore drill, disposable migration verification, and guarded container upgrade/rollback. |
| Fake and duplicate removal | Complete for active code | Canned datasets, browser lead/campaign persistence, fake reset/reseed, hard-coded health, UUID-derived source labels, duplicate toast/export implementations, stale generated audit reports, and the checked-in source ZIP were removed. |
| Local deployment | Complete | Immutable non-root image `leadforge-pro:keyless-discovery-v4` is healthy on `127.0.0.1:3000`; PostgreSQL and Redis are network-internal; discovery caches are durable; SMTP is disabled; the previous container is retained as a rollback point. |

## Verification record

- `npx prisma validate` passed and Prisma Client 7.9.1 generated.
- `npm run lint` passed with no TypeScript errors.
- The default Vitest run passed 80 tests; 15 opt-in integration cases were
  skipped because they require explicit service credentials or fixtures.
- The authenticated live managed-delivery canary passed 3 tests against the
  running Express app, PostgreSQL, and Redis. It verified client isolation,
  approval enforcement, exact SHA-256 payload bytes, and exclusion rechecks.
- Canary cleanup left zero managed clients, delivery batches, client
  exclusions, and lead reviews.
- The production Vite/esbuild build completed. A clean Docker build installed
  the lockfile with zero reported npm vulnerabilities.
- All eleven repository migrations applied successfully to a verified-absent
  disposable database. The two newest migrations add public company fields,
  dataset provenance, and truthful zero-named-contact discovery runs. No
  disposable verification databases remained afterward.
- Live `/api/health/ready` returned HTTP 200 with PostgreSQL and Redis healthy.
  The app container reports healthy and publishes only
  `127.0.0.1:3000->3000/tcp`.
- Live BullMQ counts were zero for waiting, delayed, active, failed, completed,
  prioritized, and waiting-child jobs after the canary.
- Backup `leadforge-prod-20260828-172055.dump` is 62,670 bytes with SHA-256
  `21297677EB08EFF31B3BD2E0B4A7034AE28BB468D3F5551E33FCA6D0E90A095B`.
  It passed a disposable restore drill and the drill database was removed.
- The authenticated queued keyless-discovery canary completed against the exact
  deployed image. Run `8030fc75-630d-42ad-9b1f-f50b81ecfaf5` discovered one
  real company, used zero paid searches, created zero invented named contacts,
  retained two crawl-evidence records, and exported deterministic CSV with
  SHA-256 `21afc097f79f233b68fae1bad63d8906f02445e899dee85fd7ce850312c402b1`.
  Canary cleanup removed only its own records.
- The browser-loaded production UI returned the operator sign-in screen with no
  captured console warnings or errors after the deployed container reload.
- Active image: `leadforge-pro:keyless-discovery-v4`. Immediate rollback
  container: `leadforge-app-pre-keyless-v4-20260829`.

## External release blockers

These items do not prevent the completed private managed-lead workflow, but
they do prevent an honest claim that LeadForge is ready for public SaaS or
owned-domain outreach:

1. `leads.droxaillc.com` needs reviewed DNS, TLS, routing, and a valid public
  `APP_URL`; the current local profile intentionally leaves it unset.
2. Owned-domain SMTP requires verified SPF, DKIM, and DMARC, provider limits,
  monitored canaries, and provider-originated bounce/complaint/ambiguous-outcome
  exercises. The Ethereal canary proves mechanics, not production authority.
3. Privacy notice, contracted retention/deletion terms, Overture and GeoNames
  attribution obligations, and jurisdiction-specific data resale and outreach
  review require owner/legal approval.
4. The separate host database named `leadforge_prod` has legacy migration names
  whose files are absent from this repository. It must remain untouched until
  those files are recovered or a reviewed re-baseline is approved.
5. A public multi-user product requires invitation/admin provisioning, email
  verification, tenant API keys, hosted isolation coverage, rate/usage limits,
  billing, and support operations.
6. A Hunter key is optional; no live Hunter lookup is claimed until a key and
  operator-selected credit budget are configured. Keyless company discovery
  can legitimately return zero named people because the system refuses to
  infer identities. Recurring discovery schedules, recrawl freshness policies,
  and CRM adapters remain future integrations. Missing providers never trigger
  synthetic fallback data.

## Operating references

- `PHASE_A_LOCAL_OPERATIONS.md` — start, verify, operate, back up, restore, and
  protect source code.
- `PRODUCTION_REALITY_PRD.md` — truth rules, human-email contract, implemented
  phases, and hosted release gates.
- `scripts/backup-postgres.ps1` — custom-format backup and digest.
- `scripts/restore-drill.ps1` — safe disposable restore validation.
- `scripts/verify-migrations.ps1` — clean migration-chain validation.
- `scripts/upgrade-local.ps1` — guarded loopback upgrade with rollback.
- `scripts/run-managed-delivery-canary.ps1` — authenticated live workflow and
  cleanup verification.
- `scripts/run-keyless-discovery-canary.ps1` — authenticated queued discovery,
  automatic research, deterministic export, and exact cleanup verification.
