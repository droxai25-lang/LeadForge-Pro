# LeadForge Pro Production-Reality PRD

## 1. Purpose

LeadForge Pro must operate as a truthful, production-grade lead research and outbound system. A feature may appear in the product only when it is backed by a real data source, durable state, an authenticated integration, or a clearly labeled calculation whose inputs are visible to the user.

This document is the implementation contract for removing simulations, mock data, invented enrichment, fake success states, and disconnected UI paths while preserving the useful lead-ingestion, research, verification, campaign, and delivery workflows.

## 2. Product outcome

A user can:

1. Authenticate into one organization with a server-owned tenant context.
2. Import or explicitly enter real lead and account data.
3. Crawl public company pages through an SSRF-protected fetch path.
4. store extracted evidence and provenance rather than invented firmographics.
5. Run DNS and SMTP checks with honest, limited status semantics.
6. Ask a configured Ollama model to draft natural outreach from known facts.
7. Create a durable managed-client profile with target criteria, exclusions, and retention.
8. Approve or reject real leads for that client before preparing a delivery.
9. Produce deterministic CSV/JSON bytes with a persisted SHA-256 hash and delivery history.
10. Optionally review a normal subject and plain-text email before a separately authorized SMTP campaign.
11. Audit or delete duplicate and invalid records through tenant-scoped, explicit operations.

## 3. Non-negotiable truth rules

- Missing data remains missing. The system must not substitute a fictional person, title, company, revenue, employee count, source, verification result, reputation score, activity timestamp, or conversion rate.
- An unavailable dependency produces a typed failure or degraded health state. It must not produce a successful synthetic response.
- MX records prove that a domain accepts mail; they do not prove that a mailbox or person exists.
- SMTP `RCPT TO` acceptance is recorded as `mailbox_accepted`; it does not prove identity ownership or future deliverability.
- A queued job is not a sent email. `sent` is written only after the SMTP transport accepts the message.
- A model response is untrusted input. It must pass schema, content, length, and outbound-format validation.
- Analytics may display only stored facts or formulas whose user-controlled assumptions and limitations are visible. No hidden forecast coefficients are permitted.
- Development diagnostics must never mutate production business metrics.

## 4. Human-email contract

JSON may be used between LeadForge and an AI provider as an internal transport format. JSON must never be the email a recipient receives.

Before SMTP, every message must satisfy all of the following:

- Subject is a non-empty, single line of at most 200 characters.
- Body is non-empty plain text of at most 50,000 characters.
- Serialized JSON strings and objects are recursively unwrapped into subject/body fields.
- Object dumps, JSON arrays, markdown code fences, and unresolved personalization tokens are rejected.
- Spintax is resolved before dispatch; braces such as `{Hi|Hello}` cannot reach a recipient.
- Required lead fields are read from the selected stored lead. Missing fields cause a per-lead validation failure and are never replaced with “there,” “your company,” or another invented value.
- HTML is generated only from escaped plain text. Visible links may be wrapped for click tracking, but arbitrary model HTML is never accepted.
- The prompt requires concise, conversational prose, normal sentence structure, a low-pressure CTA, and no invented claims, customers, metrics, events, or personal details.
- The review UI previews the exact real lead being rendered. No sample persona is silently substituted.
- The SMTP worker receives only the normalized subject, plain text, and escaped HTML representation.

## 5. Functional requirements

### 5.1 Identity and tenancy

- Sessions use HttpOnly cookies; browser JavaScript does not persist bearer tokens.
- Refresh tokens rotate and are revocable.
- Every protected query derives `organizationId` from the verified session.
- Public registration is disabled by default.
- Registration may not silently join an existing organization based on email domain.
- Read-only users cannot call mutating `/api` endpoints.
- Organization listing returns only memberships visible to the current principal.

### 5.2 Lead ingestion

- Manual creation requires a real first name, job title, company, domain, and syntactically valid email.
- CSV/JSON imports validate required columns and report rejected rows.
- Duplicate detection uses normalized email within the organization.
- Import does not infer missing titles, names, industries, revenue, or company sizes.
- Bulk writes are transactional where partial persistence would create inconsistent state.
- Every newly created record stores a `sourceType`, `sourceReference`, and `sourceObservedAt` provenance tuple. Pre-migration records are explicitly `unknown`, never guessed from their IDs.

### 5.3 Web crawling and signal extraction

- Only public HTTP(S) destinations are reachable.
- DNS is checked for IPv4 and IPv6 private, loopback, link-local, multicast, documentation, and metadata ranges.
- Every redirect is revalidated before it is followed.
- Requests have bounded size, redirect count, and timeout.
- Extracted text is treated as untrusted evidence, not executable instruction.
- AI summaries reference only captured page content and return `unknown` when evidence is insufficient.
- Application HTTP requests pin the validated public IP and revalidate every redirect. Infrastructure-level egress policy remains a defense-in-depth release requirement for a hosted environment.

### 5.4 Email verification

- Syntax, disposable-domain, MX, SPF, and DMARC checks return separate evidence.
- `domain_accepts_mail` is the maximum status produced by DNS alone.
- SMTP probing is rate-limited and records host, response class, latency, and checked time.
- Catch-all results are classified as risky, never valid.
- A network error is `unverified`; it is never acceptance.
- Contact creation through a permutation probe requires an explicit first name and job title.
- The UI explains that SMTP acceptance does not confirm human identity.

### 5.5 AI generation

- Local Ollama on loopback is supported without an API key.
- Remote model endpoints require HTTPS and a bearer credential.
- A hard timeout aborts stalled inference.
- Provider errors are returned explicitly; no canned copy or synthetic enrichment is substituted.
- Structured generation is validated before persistence.
- User-editable campaign copy is normalized again at dispatch, even if it passed earlier validation.
- Prompt inputs must distinguish observed facts from user-supplied positioning.
- Generated copy must never claim a customer, result, funding event, hiring signal, personal fact, or metric that is absent from stored evidence.

### 5.6 Campaigns and SMTP dispatch

- A mailbox is persisted only after DNS/host policy checks and `nodemailer.verify()` succeed.
- SMTP secrets are encrypted at rest and never returned by APIs or logged.
- Allowed SMTP hosts and ports are configurable.
- Dispatch requires `SMTP_SENDING_ENABLED=true`, Redis connectivity, a verified mailbox, at least one tenant-owned lead, a subject, and a body.
- A configured mailbox credential failure cannot fall back to a different environment mailbox.
- Enqueueing creates durable dispatch records but does not mark leads contacted.
- The worker marks the dispatch and lead in one successful post-send transition.
- Worker failures persist `failed` with an actionable, non-secret error.
- Daily limits and throttles are enforced from actual sends, not simulated warmup counters.
- Unsubscribe suppression and bounce/complaint handling are required before broad production campaigns.

### 5.7 Inbound replies

- Webhooks require timestamped HMAC signatures over the raw body.
- Requests outside the replay window or with a reused webhook ID are rejected.
- The mailbox/tenant association is resolved server-side.
- AI classification produces a review draft only; it does not auto-send.
- The draft is normalized to plain human text before storage or approval.
- Unsubscribe intent immediately suppresses future campaign sends.

### 5.8 Hygiene, analytics, and audit

- Hygiene findings are computed from stored tenant records.
- Duplicate candidates identify the exact lead IDs affected.
- Purge accepts only whitelisted issue types or an explicit ID list.
- Dashboards show observed counts and timestamps only.
- Forecasting remains absent until the schema contains real opportunities, values, outcomes, and enough history to calibrate a disclosed model.
- Audit logs identify actor, tenant, action, target count, status, trace ID, and safe metadata.

### 5.9 Health and operations

- `/api/health/live` reports process liveness only.
- `/api/health/ready` checks PostgreSQL and Redis and returns 503 when a required dependency is unavailable.
- Production startup fails if PostgreSQL is unavailable.
- Sending readiness separately reports SMTP enablement, queue state, and mailbox availability.
- Logs never contain passwords, tokens, full secret envelopes, raw reset URLs, or webhook secrets.

## 6. Data-model changes

Required current changes:

- `Lead.lastContactedAt` records the last successful SMTP acceptance time.
- `Lead.sentCount` counts successful outbound messages only.
- `Lead.engagementScore` defaults to zero.
- `Mailbox.warmupEnabled` defaults false and is not exposed as a functional product mode.
- Mailbox reputation/authentication indicators default to unknown/unverified.

Implemented in Phase 1:

- Durable campaign, campaign-step, enrollment, suppression, and provider-event aggregates.
- Per-lead rendered dispatch snapshots with unique idempotency keys.
- Signed unsubscribe links and tenant-scoped suppression records.
- Provider event uniqueness across provider and event ID.

Implemented after Phase 1:

- Durable crawl evidence with bounded snapshots, hashes, outcomes, and lead/account links.
- Durable managed clients, client exclusions, client-specific lead reviews, and delivery batches.
- Exact delivery payload hashes, fields, lead IDs, recipients, lifecycle timestamps, and retention state.
- Explicit lead acquisition provenance for all new records, with honest `unknown` migration state for legacy rows.

Hosted-product follow-up, outside the private local operating scope:

- Provider enrichment and encrypted third-party integration credentials.
- Crawl scheduling, tenant quotas, and recrawl freshness policy.
- Invitation/admin provisioning, tenant API keys, and CRM adapters.
- Backwards-compatible enum migrations for remaining legacy string statuses.

## 7. Delivery plan

### Phase 0 — Stop lying and make the build trustworthy

Status: implemented in the `phase0-production-reality` branch.

- Repair parser/schema/build failures.
- Add the human-email outbound boundary and regression tests.
- Make SMTP and Redis fail closed.
- Remove fictional preview leads, canned AI fallbacks, simulations, fake warmup, and fabricated forecast/analytics surfaces.
- Correct verification semantics.
- Remove browser-persisted bearer tokens.
- Add real health/readiness checks and core SSRF protections.
- Add real hygiene audit endpoints and explicit purge targeting.

### Phase 1 — Durable campaign execution

Status: implemented in the working tree; service-backed release verification remains required.

- Persist campaigns, steps, enrollments, schedules, and per-lead rendered snapshots.
- Add an idempotent scheduler and a single-attempt SMTP policy that records ambiguous provider outcomes as `delivery_unknown` instead of risking an automatic duplicate.
- Enforce suppression, unsubscribe, bounce, complaint, and per-mailbox daily limits.
- Add signed inbound delivery-provider events with durable idempotency and reconciliation.
- Keep production authorization blocked until end-to-end tests run against PostgreSQL, Redis, and a disposable SMTP test server.

### Phase 1 acceptance criteria

- Campaigns, steps, enrollments, and every personalized step snapshot survive a process restart.
- Launch is atomic: invalid personalization prevents all enrollment and dispatch writes.
- Queue jobs contain only a durable dispatch ID; mutable recipient content is read from PostgreSQL.
- A duplicate queue delivery cannot resend a terminal dispatch.
- SMTP transport errors after an attempt become `delivery_unknown` and are never automatically retried.
- Suppression is checked at launch and immediately before SMTP.
- Unsubscribe GET renders confirmation without mutating state; signed POST suppresses and cancels pending sends.
- Hard-bounce and complaint events suppress future mail, and duplicate provider event IDs are idempotent.
- Draft UI state is stored through the campaign API, not browser `localStorage`.
- Recipient-facing mail is normalized again in the worker and remains normal human-readable subject and prose, never serialized JSON.

### Phase 2 — Evidence-backed enrichment

Status: crawl evidence and automated raw-snapshot retention are implemented; provider enrichment, scheduling/quotas, and recrawl policy remain outside the completed local managed-delivery scope.

- Introduce provider interfaces with explicit `found`, `not_found`, `rate_limited`, and `failed` outcomes.
- Persist raw evidence and normalized attributes with provenance.
- Implement crawl budgets, robots policy, content limits, and DNS-pinned egress.
- Add prompt-injection defenses and evidence citations to generated hooks.

Implemented crawl slice:

- Durable tenant-scoped crawl evidence records use explicit `found`, `not_found`, `rate_limited`, `blocked`, and `failed` outcomes.
- HTTPS-only SSRF validation is carried into DNS-pinned connections and repeated for redirects.
- Robots policy, HTML content type, selected response headers, bounded raw snapshots, byte counts, truncation state, SHA-256 digests, extracted DOM metadata, deterministic technology markers, and bounded AI analysis are persisted together.
- Evidence list/detail/delete routes enforce tenant ownership; raw hostile HTML is not returned by application APIs.
- Generated hooks and lead personalization carry a durable evidence UUID and source URL.
- Demo webhook defaults and fake bearer-token defaults were removed; a real HTTPS destination is mandatory.
- The hourly retention pass removes expired raw snapshots while preserving evidence metadata, hashes, and normalized analysis.

### Current product slice — private managed delivery

Status: implemented. Local service-backed verification is recorded below.

- Durable tenant-scoped client profiles store executable qualification contracts, contact details, lifecycle status, and a bounded default retention period.
- Per-client email/domain/company exclusions are normalized, uniquely constrained, and rechecked at delivery preparation time.
- Lead review is client-specific. Only explicitly approved, tenant-owned, non-excluded leads can enter a delivery batch.
- CSV and JSON payloads are deterministic and limited to an allow-list of fields. The exact bytes and SHA-256 hash are persisted together.
- Export returns those exact bytes with the hash in a response header. The UI recalculates the browser hash before saving.
- Webhook delivery accepts only an existing retained JSON batch, uses DNS-pinned HTTPS with no redirects, and never constructs an unreviewed live-lead payload.
- Delivery and manual purge are durable audited transitions. Automatic retention removes payload bytes but preserves batch metadata and history.
- Operations telemetry reports actual BullMQ state, failed jobs, ambiguous dispatch state, and retention counts. Retry is available only for failures known not to have attempted SMTP.

### Current product slice — evidence-qualified opportunity discovery

Status: implemented in source with zero-input autonomous candidate coverage, a built-in DroxAI qualification contract, durable evidence, and qualified-only export; local queued/deployed verification is a release gate.

- Overture Places supplies real public businesses, websites, business emails, phones, addresses, categories, confidence, and record IDs under source-dependent CDLA Permissive 2.0, Apache 2.0, or CC0 licensing. Every export links the current Overture attribution page. GeoNames resolves qualified locations from a locally cached CC-BY 4.0 dump. Neither requires a lead-vendor API key.
- Autopilot requires no operator-supplied niche or location. Its durable tenant state owns a cursor over the complete locally cached GeoNames city frontier, advances higher-population markets first, pages through bounded Overture results, prevents overlapping runs, and schedules the next research batch after completion.
- DroxAI's seller offer and observable conversion/automation opportunity contract are maintained in source. The normal Start endpoint accepts no targeting payload; the old niche/location/client-contract workflow remains only as an explicit advanced one-off override.
- DuckDB selects only STAC partitions intersecting the bounded search radius. Social/directory URLs, closed businesses, low-confidence records, duplicate domains, malformed data, and entries without a company website are rejected.
- The worker automatically follows robots policy, crawls a bounded set of same-origin homepage/contact/about/team pages, and stores URL, headers, timestamp, bounded raw snapshot, SHA-256, extracted company contacts, and failure outcome.
- Generic public business email is never represented as a named person. A crawl creates a person lead only when structured page evidence directly contains a name, job title, and email together; that address is stored as `source_observed`, not deliverability-verified.
- Hunter Domain Search is optional named-person enrichment after free company discovery. The documented `test-api-key` is rejected; missing, disabled, invalid, quota-limited, blocked, and malformed provider states remain explicit failures with no generated fallback.
- A managed client profile is an executable qualification contract: client offer, target industries/geography, company characteristics, desired buyer roles, weighted qualifying signals, disqualifying signals, minimum evidence count/quality, and minimum opportunity score. Legacy free-form profiles cannot start new discovery runs.
- Every candidate is evaluated only from stored crawl facts. Signal observations carry their exact source URL, observation timestamp, snapshot hash, evidence quality, and explicit contract weight. The opportunity score is matched operator-selected weight divided by total selected weight; no model generates or adjusts it.
- Missing-capability signals mean "not observed across the bounded public pages crawled," not proof that the business has no private or unlinked capability. Crawl failures never become absence evidence.
- A candidate is qualified only when required signals, company constraints, evidence count/quality, score threshold, exclusions, and disqualifying conditions all pass. Otherwise the durable record states `disqualified`, `insufficient_evidence`, or `failed` with reasons.
- Every run stores the provider, contract snapshot, query, criteria, limits, paid-domain-search ceiling, evaluated/qualified/rejected/failure counters, outcome, error, creator, client, timestamps, and durable company/contact/signal provenance.
- BullMQ jobs have exactly one attempt. External reads and optional provider-credit use can be ambiguous after interruption, so stale in-flight runs become `partial` and are never automatically retried.
- Candidate discovery is separated from optional paid domain searches. Hunter is skipped for every rejected candidate; the worker checks cancellation and the exact paid-search ceiling before each post-qualification Hunter lookup.
- Contacts without a valid email, first name, or job title are discarded. Tenant duplicates are linked, client exclusions prevent lead creation, and new contacts become `hunter`-sourced leads plus optional client-specific pending reviews.
- Hunter's `valid` result is stored as `provider_verified`. It is not relabeled as domain acceptance, SMTP mailbox acceptance, identity proof, delivery, or consent.
- The Opportunity Discovery UI exposes the client offer, buyer roles, deterministic signal catalog and weights, required-signal toggles, public-contact constraints, evidence/score thresholds, keyless candidate bounds, optional post-qualification enrichment ceiling, evaluated/qualified/rejected/failure counts, cited observations, best public route, evidence-only outreach angle, and rejected-candidate audit.
- Direct discovery CSV and managed-client delivery batches query `qualificationStatus = qualified` at the server boundary. Empty qualified sets return no export, and rejected directory records cannot enter the payload. Exact bytes, record count, source attribution, and SHA-256 remain auditable.

### Phase 3 — Tenant lifecycle and integrations

- Add invitation, email verification, password reset completion, session management, and admin provisioning.
- Add tenant-scoped API keys and ingestion webhooks.
- Add CRM adapters with encrypted credentials, incremental sync, idempotency, and conflict reporting.
- Add automated tenant-isolation coverage for every aggregate.

### Phase 4 — Observability and calibrated intelligence

- Add metrics, traces, queue dashboards, dead-letter handling, and alert thresholds.
- Add model-quality evaluation fixtures for factuality, tone, JSON unwrapping, and unsafe content.
- Introduce forecasts only after real opportunity outcome data exists and the assumptions can be calibrated and disclosed.

## 8. Phase 0 acceptance criteria

- `npm run lint` exits zero.
- `npm test` exits zero with regression coverage for email normalization, template rendering, hygiene auditing, and SSRF/network policy.
- `npm run build` emits the SPA and bundled server.
- Repository search finds no active fictional preview lead, warmup simulator, GTM simulator, fabricated revenue forecast, synthetic acquisition-source distribution, or local-storage session token.
- An AI response containing JSON is unwrapped; the SMTP body contains ordinary prose.
- An AI response that remains an object dump is rejected.
- Missing personalization data or malformed spintax prevents enqueueing.
- SMTP disabled, Redis unavailable, missing mailbox, or credential failure prevents enqueue/send and cannot increment sent/contact counters.
- DNS-only verification cannot produce a mailbox-valid status.
- Every tenant-protected mutation rejects a read-only principal.

## 9. Production release gate

Phase 0 makes the repository honest and buildable; it does not by itself authorize high-volume production outreach. A production release additionally requires:

- migration applied to the target PostgreSQL database;
- Redis persistence and queue recovery configured;
- verified SMTP domain, SPF, DKIM, and DMARC owned by the operator;
- unsubscribe and suppression enforcement;
- bounce and complaint event ingestion;
- privacy notice, retention policy, and jurisdiction-specific outreach review;
- integration and tenant-isolation test suite against production-equivalent services;
- backup and restore drill;
- monitored canary campaign with low daily limits and manual review.

## 10. Definition of done

A feature is done only when its UI, API, domain logic, persistence, authorization, failure behavior, audit event, automated tests, configuration, and operator documentation all agree. If a dependency is absent, the feature is unavailable and says why. It never pretends to have succeeded.

## 11. Current operating decision — private managed leads

LeadForge is not being distributed or exposed as customer-facing SaaS during
the current operating phase. DroxAI runs the application locally and sells
reviewed, evidence-backed lead deliverables. Customers receive neither source
code nor application access.

- The canonical GitHub repository is private. It was previously public, so the
  visibility change does not retract copies that may already exist.
- `LOCAL_ONLY_MODE=true` rejects live SMTP, public `APP_URL` values, and
  non-loopback CORS origins during startup.
- Direct Node execution defaults to `127.0.0.1`; Docker listens inside its
  network namespace and publishes only `127.0.0.1:3000` on the host.
- PostgreSQL and Redis are not published to the host.
- The active local container runs with `SMTP_SENDING_ENABLED=false`, an empty
  `APP_URL`, and an empty CORS allow-list.
- Managed outreach is a separate future service and requires its own written
  authorization and release review.

The operator runbook is `PHASE_A_LOCAL_OPERATIONS.md`. The managed lead
operations slice is implemented: durable client profiles, delivery batches,
per-client exclusions, review state, export hashes, delivery history, and
retention enforcement. Hosted SaaS, customer application access, and source
distribution are explicitly outside this operating decision.

## 11. Phase 1 verification record

Verified on 2026-08-28:

- `npx prisma validate` passed and the Prisma client generated successfully.
- `npm run lint` passed with no TypeScript errors.
- `npm test` passed 37 tests; 12 opt-in service-backed tests were skipped by the default suite.
- `npm run build` produced the production SPA and bundled server.
- All repository migrations applied successfully to a new disposable PostgreSQL database, and `prisma migrate status` reported that disposable schema up to date. The disposable database was then removed.
- The repository-aligned Docker PostgreSQL database was backed up and retained its existing 3 organizations, 11 leads, mailbox, and dispatch while the pending migrations were applied. The rebuilt application reports all five repository migrations applied with none pending.
- A clean immutable Docker image installed the current production lockfile, built the frontend and server, and started as the non-root service user. The public health endpoint returned HTTP 200 with PostgreSQL and Redis healthy; protected campaign and unsigned delivery-webhook requests returned HTTP 401.
- Both Phase 1 signing secrets were configured at 32 or more characters, and the outbound BullMQ queue reported zero waiting, delayed, active, completed, failed, or paused jobs after deployment.
- The service-backed non-delivery Phase 1 suite passed 3 tests against the live Docker app, PostgreSQL, and Redis: durable campaign reads, cross-tenant isolation, and manual suppression lifecycle. Its cleanup removed the temporary campaign and suppression.
- A real one-message Ethereal canary traversed the authenticated API, PostgreSQL campaign/enrollment/dispatch records, BullMQ, the production SMTP worker, STARTTLS authentication, and the public disposable SMTP service. The dispatch made exactly one attempt, recorded one accepted recipient and the provider's `250` response, and transitioned to `sent` only after SMTP acceptance.
- The public Ethereal preview returned HTTP 200 and contained the approved human subject, `Hi Casey,` greeting, prose body, `Dustin Hill` signoff, and visible unsubscribe text. It did not contain a serialized JSON `body` property.
- A signed `delivered` provider event processed once and the identical event was idempotently acknowledged as a duplicate. Provider-event reconciliation is no longer coupled to click tracking, and the opt-in fixture now verifies this with `trackClicks=false`.
- The visible signed unsubscribe token opened the confirmation page, POST confirmation created a durable `unsubscribe` suppression, and a second campaign launch for the same recipient failed with HTTP 409 without queueing another message.
- The canary exposed and fixed a Prisma/PostgreSQL incompatibility: `pg_advisory_xact_lock` returns the pseudo-type `void`, so its result is now cast to text before Prisma deserialization. The failed pre-fix job was identified by exact ID and removed; the successful canary then exercised the corrected transactional quota lock.
- All synthetic tenant rows were cascade-deleted after verification. Final counts returned to 3 organizations, 11 leads, one mailbox, one dispatch, and zero provider events; every BullMQ job count returned to zero. The temporary Ethereal SMTP allowlist entry was removed.

Not yet verified and therefore still blocking production authorization:

- A separate host PostgreSQL `leadforge_prod` database has migration records named `20260822021505_init` and `20260823000000_add_security_indexes`, but those exact migration files are absent from the repository. It was backed up and schema-diffed but deliberately left unchanged. The repository's migrations must not be deployed to that database until the original files are recovered or a reviewed re-baseline is approved.
- The preserved production `APP_URL` value is present but malformed. Authenticated health reports `appUrlValid=false` and `deliveryConfiguration.ready=false`; production campaign launch remains blocked until a valid public HTTPS application URL is configured.
- The Ethereal canary proves SMTP mechanics and recipient formatting, but it does not authorize outreach from the operator's owned domain. SPF, DKIM, DMARC, provider sending limits, privacy/retention policy, and jurisdiction-specific review remain required.
- No real hard-bounce, complaint, or ambiguous post-attempt SMTP outcome was generated by an external provider. Those failure paths remain covered by domain/unit and signed service-integration tests rather than a provider-originated event.

## 12. Phase 2 crawl-evidence verification record

Verified on 2026-08-28:

- `npx prisma validate`, `npm run lint`, the production build, and `git diff --check` passed.
- The full test suite passed 48 tests; 12 opt-in service-backed tests remained skipped by the default suite. Crawl tests cover target normalization, byte caps and hashing, HTTP outcome classification, robots precedence, content types, model-output bounds, safe header selection, and DNS-pinned lookup behavior.
- The immutable `leadforge-pro:phase2-crawl-evidence` image built successfully with zero reported npm vulnerabilities.
- All six migrations applied to a disposable PostgreSQL database. The resulting `CrawlEvidence` table had 21 columns, and the disposable database was removed.
- Before the additive production migration, a custom-format backup was saved as `backups/leadforge_docker_prod_pre_crawl_evidence_20260828.dump` (57,624 bytes, SHA-256 `AD5CC04F04B4B6FBE763E7DB8E5E6F199EF10F385B18C195DEC0F077D239EC4B`).
- The repository-aligned Docker database applied the crawl-evidence migration and reports six successful migrations.
- The application container was replaced with final image `leadforge-pro:phase2-crawl-evidence-v2`, returned HTTP 200 health, and retained the exact Phase 1 container as `leadforge-app-phase2-pre-crawl-evidence-20260828` plus the first Phase 2 image container as rollback points.
- A live `droxaillc.com` attempt returned current HTTP 404 and persisted a truthful `not_found` record; the exact canary row was then deleted.
- A live `example.com` canary returned HTTP 200 and persisted `found`, robots allowed, 559 stored bytes, no truncation, and SHA-256 `ff67a9d764d6a2367a187734e697f6a53217db9a21c101d410a113ca871a299d`. Bounded AI analysis completed against that snapshot.
- Evidence detail returned HTTP 200 to its tenant, omitted the raw snapshot, and returned HTTP 404 to a second tenant. The database contained exactly one matching durable row before cleanup and zero afterward.
- On the final image, cross-tenant evidence deletion returned HTTP 404, owning-admin deletion returned HTTP 200 with `deletedCount=1`, and both the synthetic evidence and synthetic audit row were removed after verification.

Still blocking full Phase 2 authorization:

- Hunter discovery is now implemented with environment-only credentials; a generalized encrypted multi-provider credential aggregate remains future hosted work.
- Crawl scheduling, quotas/budgets, recrawl freshness, and infrastructure-level egress policy are not implemented. Automated raw-snapshot retention is implemented.
- The registered apex and `www` DroxAI hosts currently return HTTP 404, and `leads.droxaillc.com` has no DNS record. `APP_URL` therefore remains invalid and campaign sending remains fail-closed.

## 13. Private managed-delivery verification record

Verified on 2026-08-28:

- Durable managed clients, normalized exclusions, client-specific lead review,
  deterministic CSV/JSON batches, exact SHA-256 hashes, delivery transitions,
  and payload retention are implemented end to end.
- Existing leads gained explicit acquisition provenance without fabrication;
  all 11 pre-migration rows are `unknown`, and each live creation path writes
  its actual source, reference, and observation time.
- `npx prisma validate`, Prisma generation, TypeScript lint, the default test
  suite, the production build, and `git diff --check` passed. The default suite
  passed 63 tests with 15 opt-in service tests skipped.
- The immutable `leadforge-pro:managed-operations-v1` image installed the
  lockfile with zero reported npm vulnerabilities and built successfully.
- All seven repository migrations applied from empty to a disposable database;
  four managed-delivery tables, lead provenance, and three check constraints
  were verified, and the disposable database was removed.
- A pre-migration PostgreSQL dump of 62,670 bytes with SHA-256
  `21297677EB08EFF31B3BD2E0B4A7034AE28BB468D3F5551E33FCA6D0E90A095B`
  passed a disposable restore drill.
- The guarded upgrade applied both additive migrations and preserved 3
  organizations and 11 leads. The final app is healthy only on
  `127.0.0.1:3000`; PostgreSQL and Redis report ready; SMTP remains disabled;
  the prior app is retained as `leadforge-app-pre-managed-20260828`.
- An authenticated live canary passed 3 tests for cross-tenant isolation,
  approval enforcement, exact export hashing, and exclusion rechecks. Cleanup
  left zero managed clients, delivery batches, exclusions, or reviews, and all
  BullMQ job counts returned to zero.

This record authorizes the private local managed-lead workflow only. The
external release blockers are enumerated in `PROJECT_COMPLETION_AUDIT.md` and
remain prerequisites for public hosting or owned-domain outreach.

## 14. Real market-discovery verification record

Verified on 2026-08-28:

- The strict Hunter client rejects disabled, missing, placeholder, and dummy
  keys; uses `X-API-KEY` rather than query-string credentials; validates and
  bounds provider data; filters contacts missing name/title/email; classifies
  quota and transport failures; and never retries a provider call.
- Seven discovery-client regression tests pass. The full default suite passes
  71 tests with 15 opt-in service tests skipped; TypeScript, Prisma validation,
  Prisma generation, the production build, and the Docker-contained production
  build pass.
- All nine repository migrations applied from zero to a disposable PostgreSQL
  database. Validation asserted three discovery tables, four managed-delivery
  tables, lead provenance, and the `hunter` lead-source enum before cleanup.
- The guarded upgrade applied the additive migration and replaced the active
  app with `leadforge-pro:real-discovery-v4` on `127.0.0.1:3000`; the prior
  discovery build remains recoverable as
  `leadforge-app-pre-discovery-v4-20260828`.
- An internally authenticated deployed canary returned HTTP 200 discovery
  readiness with Redis connected and Hunter disabled/unconfigured. A run start
  returned HTTP 503 with the exact configuration requirement and created zero
  discovery runs, companies, or contacts.

Not yet verified:

- No real `HUNTER_API_KEY` is configured. A provider-backed query, credit
  counter comparison, durable company/contact result, lead promotion, and live
  website-research handoff cannot be claimed until the operator adds that key
  and runs the low-budget canary.

## 15. Evidence-qualified opportunity-discovery verification record

Verified on 2026-08-29:

- Client profiles and inline runs now require a versioned, executable qualification contract. Free-form legacy profiles are identified as not qualification-ready and can be replaced in the managed-client UI; no default rules are silently assigned to them.
- The deterministic signal engine, contract validation, evidence-weighted scoring, disqualification rules, best directly evidenced public contact selection, evidence-only outreach angle, and qualified-only CSV boundary are covered by an end-to-end acceptance test. The test starts with niche, location, client offer, and criteria; proves a candidate qualifies from observed deficiencies; proves a scheduling-enabled candidate is rejected; and proves repeat exports are byte-identical and omit the rejected business.
- TypeScript, Prisma schema validation, the production Vite/esbuild bundle, and the full default suite pass: 86 tests passed, 15 opt-in service tests skipped, and no test failed.
- All 12 repository migrations applied from zero to a disposable PostgreSQL database. Validation asserted the `OpportunitySignal` table, 14 qualification/export columns, nine qualification constraints, existing managed-delivery structures, and the qualified-prospect delivery-batch cardinality rule before the disposable database was removed.
- The guarded local upgrade applied `20260829040000_add_opportunity_qualification` and deployed `leadforge-pro:opportunity-discovery-v5` healthy on `127.0.0.1:3000`. `leadforge-app-pre-opportunity-v5-20260829` preserves the prior v4 container for rollback.
- A bounded internally authenticated live canary started with HVAC, Dallas, the client offer, and an explicit six-signal contract. It evaluated five public-source candidates, qualified five, made zero paid searches, persisted 13 crawl-evidence records plus linked signal evidence, and exported exactly the five qualified records. Every matched signal had URL, timestamp, observation, and snapshot hash. The final deployed-image CSV bytes matched SHA-256 `b5300421cb96643cc4b26f4830b7e920fdf5da2840493234c932187d617c69c9`; canary run and signal rows were then removed.

Scope boundary:

- This proves the owner-operated local prospect-research and qualified-batch workflow. It does not authorize SMTP outreach, assert private buying intent, guarantee that bounded absence observations cover unlinked/offline systems, or prove named contacts where no public page directly publishes them. Hunter remains optional and unverified because it is not required for this workflow.

## 16. Zero-input autonomous discovery acceptance gate

The release is complete only when a deployed-image canary calls `POST /api/discovery/autopilot/start` with no niche, location, offer, provider key, or qualification payload and receives a durable `overture_autopilot` run. That run must select its own public market from the persisted worldwide GeoNames frontier, perform zero paid searches, research owned websites, persist factual opportunity evidence with URL, observation time, and snapshot hash, reject insufficient candidates, and expose only qualified prospects through the export boundary. The canary must also prove that Stop prevents another scheduled batch and clean up only its own test run and frontier state.

Verified on 2026-08-29 against `leadforge-pro:autonomous-discovery-v6`: the production image passed 91 automated tests with 15 opt-in service tests skipped, built successfully, and applied all 13 repository migrations to an empty disposable PostgreSQL database. The guarded upgrade applied `20260829050000_add_autonomous_discovery_frontier`, kept `leadforge-app-pre-autonomous-v6-20260829` for rollback, and exposed only `127.0.0.1:3000` with a healthy container.

The deployed-image canary sent an empty POST body. LeadForge selected New York City from its own cursor, evaluated three Overture candidates, qualified two from cited website observations, rejected one, performed zero paid searches, and returned a qualified-only export. The canary then disabled Autopilot and removed its run, accounts, evidence, leads, logs, and frontier row; the database cleanup check found zero remaining canary runs and zero Autopilot rows.
