# Provider contract, subscription lifecycle and job recovery

17 Oktober 2026. Source-derived contract and local runbook. **No Vessel sandbox,
production account, webhook, cron, email or active database was called.**
Provider signature/cancel/refund/lookup details that are not present in the
repository remain unconfirmed and are marked below. Do not treat this document as
provider certification.

## Source-derived Vessel contract

| Area | Evidence in source | Status |
|---|---|---|
| Base URL + auth | `VESSEL_API_URL`, `VESSEL_API_KEY`; `Authorization: Bearer <key>`; 10s timeout | Confirmed from client source |
| Create QRIS | `POST /api/v1/payments` body `tenant_id`, `invoice_number`, `amount`, `expired_in_minutes`, optional `callback_url`; response `success/data` with `transaction_id`, `invoice_number`, `payment_status`, `qr_string`, `expired_at` | Confirmed from client source |
| Status lookup | `GET /api/v1/payments/:transactionId`; response `id`, `invoice_number`, `payment_status`, `amount`, `qr_string`, `expired_at`, `paid_at` | Confirmed from client source |
| Provider sync | `POST /api/v1/payments/:transactionId/check`; response `transaction_id`, `payment_status`, `doku_status`, `synced` | Confirmed from client source; not used for subscription activation |
| Idempotency header | No provider idempotency key is sent or documented in source | **Unknown**; Rakku uses its own invoice/request identity |
| Webhook signature | No signature/HMAC verification existed in source. Optional HMAC-SHA256 adapter now exists but header names/algorithm/replay window are **not provider-confirmed** | **Unknown**; disabled unless `VESSEL_WEBHOOK_SECRET` is configured |
| Lookup by invoice number | No provider client function | **Unknown** |
| Cancel/refund | No provider client or documented API | **Unknown/unsupported**; do not claim cancellation or refund |
| Rate limits | Not present in source | **Unknown** |
| Settlement/receipt | Not present in subscription path | **Unknown**; phase 5 evidence required |
| Callback retry policy | Not present in source | **Unknown** |

`packages/vessel-client/src/index.ts` implements an optional timestamped HMAC
adapter (`x-vessel-signature`, `x-vessel-timestamp`, `sha256=` prefix accepted,
300s default tolerance) plus a body-only mode. The real provider must confirm
these exact values before enabling `VESSEL_WEBHOOK_SECRET`. When the secret is
empty, the inbox records `signature_status=unverified`; activation still performs
a fresh provider status lookup and never trusts the callback body.

## Subscription invoice state machine

Invoice status:

- `pending`: invoice exists; provider may or may not have accepted creation.
- `unknown`: provider creation is uncertain or an unmapped provider state occurred.
- `success`: provider-confirmed success. `applied_at` set when the subscription was applied; `reconciliation_reason` set when it was not.
- `expired`, `failed`, `cancelled`: only set from a provider-confirmed terminal status.

Provider state (`subscription_invoices.provider_state`):

`not_created` → `creating` → `accepted` → `unknown` / `terminal`.

- Checkout reserves the invoice and transitions it to `creating` **before** the
  provider call. The provider call happens outside the DB transaction.
- Provider success moves the invoice to `accepted`; timeout/network/ambiguous
  response moves it to `unknown` and keeps the invoice. It is never deleted or
  locally expired.
- `processInvoice` re-verifies provider identity, invoice number and amount.
  Success activation is one transaction: invoice claim, company plan/expiry,
  `subscriptions`, append-only journal, and optional outbox email job. A repeated
  call returns `already`, with no second subscription or journal.
- A callback older than the latest subscription row is recorded as `success`
  with `applied_at=null`, `reconciliation_reason=superseded_by_newer_activation`,
  an unapplied journal row and a `subscription_reconciliation` row. It cannot
  downgrade or overwrite a newer plan.
- Local `expired_at` is display-only. Only provider-confirmed terminal statuses
  change the invoice to `expired`/`failed`/`cancelled`.
- Request identity lives in `app_private.subscription_payment_requests`
  (`company_id + request_id` unique) with a payload hash. Retrying the same
  checkout key returns the same invoice; reusing it with a different plan/cycle/
  amount returns `REQUEST_CONFLICT`. Active pending invoices are also reused
  across new client-generated keys to prevent duplicate QRIS creation.

## Durable webhook and job processing

- `app_private.provider_events` is the inbox. `event_key = SHA-256(provider,
  transaction_id, invoice_number, status, paid_at, amount, signature-status,
  raw body)` dedupes delivery and prevents an invalid-signature delivery from
  blocking the later valid one. Invalid signatures are retained for audit but
  are never enqueued. Webhook payloads over 256 KiB are rejected; edge rate
  limiting still needs to be configured at the platform.
- `app_private.job_queue` is the durable work queue. `(kind, unique_key)` is
  unique. `vessel.webhook:<event_id>` and `subscription.payment_email:<invoice_id>`
  are idempotent.
- Webhook route stores the event and enqueues the job in one DB transaction,
  then attempts a bounded inline worker run. If inline processing fails, the
  route still returns 200 because the event is durable. If storing fails, it
  returns 503 so the provider retries.
- Worker claims with `FOR UPDATE SKIP LOCKED`, leases, bounded batches and a
  deadline. Retry backoff is exponential with jitter; max attempts move the job
  to `dead_letter`. Replay resets only an explicit dead-letter job to pending.
- `GET/POST /api/cron/provider-jobs` protects the worker with `CRON_SECRET`.
  `?dry=1` only counts due/dead-letter jobs and performs no writes. The billing
  cron also processes a bounded job batch when not dry.
- `pnpm provider:jobs -- --list` lists counts/dead letters without payloads;
  `pnpm provider:jobs -- --replay <job-id>` explicitly replays one dead-letter.
  It was not run against an active database in this session.

### Operational recovery

1. Stop new provider calls only if the incident requires it; keep the inbox and
   queue. Do not delete provider events, jobs, invoices, journal or reconciliation.
2. Inspect `provider_events` by ID/status and `job_queue` by state/attempts.
   Correlation IDs and errors must not contain API keys, cookies or PII.
3. Replay a dead-letter only after the referenced invoice/intent exists or the
   provider outage is over. One replay increments `replay_count`; a repeated
   replay of the same dead-letter returns null.
4. If a provider accepted a payment but the app crashed before claim, the
   invoice remains `pending`/`unknown`; the worker/cron re-verifies. Never create
   a replacement charge from the client after an uncertain response.
5. Rollback keeps 0010/0011 tables and evidence. Stop workers, deploy a
   forward-fix, and leave backlog intact. Do not return to checkout-before-
   invoice or local-expiry behavior.

## Local verification

- `pnpm --filter @rakku/db test`: 61 tests, including 10 subscription lifecycle/
  private-policy, 7 job/inbox and 6 provider-event tests, all on PGlite memory.
- `pnpm test:provider`: 3 webhook signature tests.
- `pnpm test:auth`: 14 tests.
- `pnpm test:demo`: 74 domain + 3 network-policy tests.
- PGlite is single-connection. Two-worker `SKIP LOCKED` race, real provider
  sandbox callback, real email delivery, scheduler registration and PostgreSQL
  concurrency remain staging acceptance items.
