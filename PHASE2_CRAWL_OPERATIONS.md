# Phase 2 crawl-evidence operations

## Production contract

The webpage crawler performs one bounded HTTPS-origin crawl. It never fabricates a successful fetch, silently substitutes a demo response, or treats AI output as source evidence.

Each attempt persists one tenant-owned `CrawlEvidence` row with an explicit outcome:

- `found`: the origin returned supported HTML and a bounded snapshot was stored.
- `not_found`: the origin returned HTTP 404 or 410.
- `rate_limited`: the origin or `robots.txt` returned HTTP 429.
- `blocked`: SSRF validation, authentication, authorization, or robots policy denied the crawl.
- `failed`: DNS, timeout, unsupported-content, upstream, or other transport processing failed.

The API returns the evidence UUID on both successful and recorded failed attempts. A failed attempt is not converted into an empty successful result.

## Network and content boundaries

- Only HTTPS origins on fully qualified public hostnames are accepted.
- Credentials, custom ports, IP literals, loopback, private, link-local, multicast, documentation, and cloud-metadata ranges are rejected.
- DNS results are validated as public and pinned into the actual Undici connection. Every redirect is independently revalidated and receives a new pinned dispatcher.
- `robots.txt` is checked before the page. Explicit denial, authentication denial, throttling, server failure, timeout, or an oversized policy blocks the crawl fail-closed. HTTP 404/410 means no policy was published and permits the origin request.
- Only `text/html` and `application/xhtml+xml` responses are analyzed.
- Successful snapshots are capped at 512 KiB. Error snapshots are capped at 64 KiB. `robots.txt` is capped at 128 KiB.
- The SHA-256 digest identifies the exact stored byte prefix. `snapshotTruncated=true` means the remote document exceeded the storage budget.
- Only an allowlist of useful response headers is persisted. Cookies and authentication headers are not stored.

## AI analysis boundary

The stored HTML snapshot is untrusted input. The model prompt labels it as data and forbids following instructions found in the page. Model JSON is parsed, type-checked, whitespace-normalized, length-limited, and item-limited before persistence or rendering.

`analysisStatus` is one of:

- `completed`: bounded model output was stored.
- `not_requested`: no model endpoint was configured or the snapshot contained no useful text.
- `failed`: the source snapshot remains available, but no generated claims are presented as successful.

Every generated hook returned to the UI carries the crawl evidence UUID and source URL. When a verified lead is created, its personalization prompt names that evidence UUID and forbids claims absent from the snapshot. Recipient-facing campaign content still passes through the separate human-email normalization boundary before queueing and SMTP.

## Evidence API

All routes require authentication and are tenant-scoped:

- `POST /api/signals/scrape-domain` performs the real crawl and returns evidence metadata.
- `GET /api/signals/crawl-evidence?domain=example.com&limit=25` lists bounded evidence metadata. `limit` is clamped to 1–100.
- `GET /api/signals/crawl-evidence/:id` returns selected headers and extracted data, but never returns the stored raw HTML snapshot.
- `DELETE /api/signals/crawl-evidence/:id` requires sales leadership or developer administration and deletes only the exact tenant-owned evidence record.

Database access is required to inspect a raw snapshot. Treat it as hostile HTML: do not render it in a browser or execute scripts from it.

## Operational checks

Before authorizing this slice in another environment:

1. Apply all repository migrations to a disposable PostgreSQL database.
2. Confirm `CrawlEvidence` has 21 columns and the `CrawlOutcome` enum exists.
3. Run `npm test`, `npm run lint`, `npx prisma validate`, and `npm run build`.
4. Crawl a stable public HTML origin with `createLead=false`.
5. Confirm the API response and database row agree on evidence UUID, outcome, digest, byte count, robots decision, and final URL.
6. Confirm another tenant receives HTTP 404 for the evidence detail.
7. Delete the exact canary evidence through the authenticated API and confirm no canary row remains.

## Still outside this slice

- Real Hunter company/contact discovery is implemented separately and fails closed until an operator configures a real key; this crawler never simulates provider data.
- Crawl scheduling, per-tenant crawl budgets, retention automation, and recrawl freshness policy remain Phase 2 work.
- DNS-pinned crawling prevents the client from switching to an unvalidated address during connection setup, but outbound infrastructure-level egress controls are still recommended.
- A stored public snapshot is evidence that content was observed at a time and URL; it is not proof that every statement on the source page is true.
