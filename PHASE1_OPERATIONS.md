# Phase 1 campaign operations

## Required configuration

Campaign launch is unavailable unless all of these are configured:

- PostgreSQL through `DATABASE_URL`;
- Redis through `REDIS_URL` (BullMQ and the application cache use the same parsed URL);
- `SMTP_SENDING_ENABLED=true`;
- one tenant-owned mailbox that passed connection verification and has `status=active`;
- an HTTPS `APP_URL` in production;
- distinct secrets of at least 32 characters in `UNSUBSCRIBE_SECRET` and `DELIVERY_WEBHOOK_SECRET`.

Generate secrets with a cryptographically secure generator. Do not reuse the JWT, mailbox-encryption, inbound-webhook, unsubscribe, or delivery-webhook secret for another purpose.

An authenticated `GET /api/health` includes `deliveryConfiguration` booleans for SMTP enablement, production `APP_URL` validity, and both signing-secret strength checks. Public health continues to expose dependency state only. A malformed `APP_URL` makes campaign launch return HTTP 503 before any dispatch is created or queued.

## Database migration

For a new database:

```powershell
npx prisma migrate deploy
npx prisma migrate status
```

Do not deploy to a database when `prisma migrate status` reports applied migration names that are missing locally. Recover the exact historical migration files first. If they cannot be recovered, take and verify a database backup, compare the live schema to `prisma/schema.prisma`, and perform a reviewed Prisma baseline operation. Do not use `migrate reset` on a database containing real data.

## Container deployment

Back up PostgreSQL and verify the backup before changing the application image. Build and replace the application as an immutable image so the bundle, `package-lock.json`, production dependencies, Prisma CLI, schema, and migrations come from the same source revision:

```powershell
docker compose build app
docker compose up -d --no-deps app
docker compose exec app npx prisma migrate status
Invoke-WebRequest http://127.0.0.1:3000/api/health -UseBasicParsing
```

The entrypoint applies pending migrations before starting the server. Never copy a new `dist` or `prisma` directory into an old container: an old `node_modules` tree can make a valid build fail only at runtime. Retain the previous image or stopped container until the new container is healthy and the migration, authorization, queue, and data-preservation checks pass.

Shell entrypoints must use LF line endings. `.gitattributes` enforces LF for `*.sh`, and the Dockerfile normalizes the entrypoint during the build so Windows working-tree settings cannot create an invalid Linux shebang.

## Delivery-provider event contract

Send provider events to `POST /api/webhooks/delivery/:provider` with:

- `x-webhook-id`: the provider's stable unique event ID;
- `x-webhook-timestamp`: current Unix time in seconds;
- `x-webhook-signature`: lowercase HMAC-SHA256 hex over `<timestamp>.<exact raw JSON body>` using `DELIVERY_WEBHOOK_SECRET`.

The JSON body must include `eventType`, one of `delivered`, `hard_bounce`, `soft_bounce`, `complaint`, or `unsubscribe`; it must also include `dispatchId` or `providerMessageId`. `recipientEmail` is validated against the stored dispatch when supplied. Duplicate provider and event ID pairs are idempotent.

Hard bounces, complaints, and unsubscribe events immediately create or update a tenant suppression and stop pending enrollments. Soft bounces are recorded but do not create a permanent suppression.

## Ambiguous SMTP outcomes

The worker makes one SMTP attempt. If the transport throws after the attempt begins, the dispatch becomes `delivery_unknown`; it is not retried automatically. An operator must reconcile the provider message ID/logs and recipient history before deciding whether any new message is appropriate. This protects recipients from duplicates after a network failure or worker crash.

After SMTP acceptance, the dispatch stores the provider message ID, a bounded sanitized provider response, and bounded accepted/rejected envelope-recipient arrays. Treat these fields as transport evidence: they prove what the SMTP server reported, not inbox placement or human receipt.

## Service-backed acceptance suite

The non-delivery campaign CRUD, persistence, suppression, and tenant-isolation gate requires:

- `TEST_API_URL`;
- `TEST_ADMIN_TOKEN`;
- `TEST_SECOND_TENANT_TOKEN`.

Run:

```powershell
npx vitest run tests/phase1_campaign_execution.integration.test.ts
```

The provider-reconciliation and queue gate is additionally protected by `TEST_PHASE1_LIVE=true`. Set it only against an isolated production-equivalent environment with a disposable SMTP receiver, then also supply:

- `TEST_PHASE1_LIVE=true`;
- `TEST_LIVE_MAILBOX_ID`;
- `TEST_LIVE_LEAD_ID`;
- `TEST_LIVE_LEAD_EMAIL`;
- `DELIVERY_WEBHOOK_SECRET`.

Inspect the disposable SMTP receiver and confirm that the received MIME message contains an ordinary subject and human-readable plain-text/HTML body, not JSON. Confirm the visible unsubscribe URL opens a confirmation page and that POST confirmation prevents all later campaign steps. Then exercise a unique hard-bounce event, the same event a second time, and a complaint event; verify the second hard-bounce event is a no-op and both permanent failure types create suppressions.

Provider delivery events do not require click tracking. Run at least one reconciliation case with `trackClicks=false` to ensure privacy-oriented campaigns still receive delivery and bounce state transitions.

## Canary release

Start with one internal recipient and one campaign step. Then use a small reviewed cohort and a daily limit below the mailbox provider's documented allowance. Monitor `failed`, `delivery_unknown`, bounce, complaint, unsubscribe, and suppression counts before increasing volume. A queue acknowledgement is never evidence that a message was sent; only SMTP acceptance changes the dispatch to `sent`.
