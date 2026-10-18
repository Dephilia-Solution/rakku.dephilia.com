# Fase 4 — Provider contract, event delivery dan recovery

17 Oktober 2026 · perubahan lokal pada branch `codex/production-hardening`.

**Source fase 4 selesai lokal; kontrak Vessel aktual dan acceptance sandbox belum diverifikasi.** Tidak ada provider, webhook, cron, email, database aktif atau deployment yang dijalankan.

## Provider contract matrix

Detail lengkap ada di `config/provider/README.md`.

| Area | Source evidence | Status |
|---|---|---|
| Base URL/auth | `VESSEL_API_URL`, Bearer `VESSEL_API_KEY`, timeout 10s | Confirmed source |
| Create QRIS | `POST /api/v1/payments` (`tenant_id`, invoice, amount, expiry, callback) | Confirmed source |
| Status | `GET /api/v1/payments/:transactionId` | Confirmed source |
| Sync/check | `POST /api/v1/payments/:transactionId/check` | Confirmed source; tidak dipakai untuk aktivasi subscription |
| Webhook signature | Tidak ada verifikasi di source lama; adapter HMAC opsional ditambahkan | **Unknown**; jangan aktifkan secret sebelum provider mengonfirmasi header/algoritma/window |
| Lookup by invoice | Tidak ada client function | **Unknown** |
| Idempotency key | Tidak dikirim/didokumentasikan provider | **Unknown**; Rakku memakai request identity sendiri |
| Cancel/refund/rate limit/settlement | Tidak ada client/API source | **Unknown/unsupported** |

## Inbox, job queue dan worker

- `app_private.provider_events`: event key SHA-256 dari provider/reference/status/paid_at/amount/raw/signature-status; duplicate delivery tidak membuat job kedua.
- `app_private.job_queue`: `(kind, unique_key)` unik; state `pending/leased/done/dead_letter`.
- Webhook menyimpan event + job dalam satu transaksi, lalu menjalankan worker inline bounded. Jika worker gagal, event tetap durable dan route tetap 200; jika penyimpanan gagal → 503.
- Worker memakai `FOR UPDATE SKIP LOCKED`, lease, batch, deadline, exponential backoff+jitter, max attempts, dead-letter dan replay eksplisit.
- `GET/POST /api/cron/provider-jobs` (`CRON_SECRET`) adalah worker scheduler; `?dry=1` hanya membaca count. Cron billing juga memproses batch job sebelum/sesudah sync harian.
- `scripts/provider-jobs.ts` menyediakan `--list`/`--replay <id>` tanpa mencetak payload/secret. Script tidak dijalankan ke DB aktif.

## Idempotensi dan recovery

- Duplicate/out-of-order callback: event unik, invoice claim, activation/journal guard, `processed_at`, email job unik.
- Invalid signature: event disimpan sebagai audit `signature_status=invalid`, tidak di-enqueue. Signature status ikut event key agar invalid delivery tidak memblokir delivery valid.
- Unmatched receipt: event + job dipertahankan; job retry hingga max attempts lalu dead-letter. Replay dapat dilakukan setelah invoice/intent tersedia.
- Provider outage: `ProviderUnavailableError` retryable; `ProviderVerificationError`/identity/amount mismatch dead-letter.
- Provider accepted lalu app crash: invoice `creating/unknown` dipertahankan; callback yang memiliki transaction ID dapat mengikat invoice setelah status provider diverifikasi ulang.
- Worker crash sebelum `done`: lease expiry memungkinkan klaim ulang. Worker crash setelah commit: activation idempotent dan email job unik mencegah duplikasi.
- Correlation ID memakai hash prefix, bukan secret. Error disanitasi/terpotong; payload provider tidak berisi API key.

## Source yang berubah

- `packages/db/migrations/0011_provider_jobs.sql`
- `packages/db/src/jobs.ts`, `provider-events.ts`, test `jobs.test.ts`, `provider-events.test.ts`
- `packages/vessel-client/src/index.ts`, `webhook.test.ts`
- `apps/owner/src/lib/billing/vessel-events.ts`, `provider-jobs.ts`
- `apps/owner/src/app/api/webhooks/vessel/route.ts`
- `apps/owner/src/app/api/cron/provider-jobs/route.ts`, `cron/billing/route.ts`
- `scripts/provider-jobs.ts`, `config/provider/README.md`, env templates

## Verifikasi aktual

| Pemeriksaan | Hasil |
|---|---|
| `pnpm --filter @rakku/db test` | 61 lulus; 7 job/inbox + 6 provider handler |
| `pnpm test:provider` | 3 lulus; valid/tamper/stale/unverified/body mode |
| `pnpm test:auth` | 14 lulus |
| `pnpm test:demo` | 74 + 3 lulus |
| `pnpm typecheck` | 18/18 task lulus; `pnpm typecheck:scripts` lulus |
| `pnpm test:auth:http` | 20 assertion lulus; webhook dengan DB diblokir sekarang 503 (durable inbox unavailable), bukan 200 palsu |
| Build terisolasi Owner/POS/Superadmin | Lulus pada `.next-hardening-phase34`; route provider-jobs dan webhook terdaftar |
| Vessel sandbox, HMAC provider aktual, dua worker PostgreSQL, email delivery, scheduler platform | **Belum dijalankan** |

PGlite hanya satu koneksi. Test membuktikan logika lease/claim/retry/dead-letter/replay dan handler, bukan race `SKIP LOCKED` multi-worker atau transport provider nyata.

## Runbook rollback dan DLQ

1. Jangan hapus `provider_events`, `job_queue`, invoice, journal atau reconciliation. Hentikan worker jika diperlukan; event baru tetap dapat masuk ke inbox.
2. Inspeksi `pnpm provider:jobs -- --list`; nilai `last_error` harus bebas secret/PII. Dry-run cron hanya menghitung tanpa writes.
3. Replay hanya dead-letter yang sudah ditinjau dan hanya setelah invoice/intent tersedia atau outage selesai. Setiap replay menaikkan `replay_count`; replay kedua pada job yang sama tidak menemukan dead-letter.
4. Rollback aplikasi ke kode lama akan menghilangkan inbox/worker dan mengembalikan provider-before-invoice/local-expiry. Gunakan forward-fix; pertahankan 0010/0011 dan bukti.
5. Untuk signature yang belum terkonfirmasi, biarkan `VESSEL_WEBHOOK_SECRET` kosong sehingga event tercatat `unverified` dan provider status tetap di-re-verify. Jangan mengaktifkan HMAC tebakan.

## Blocker tersisa

- Signature/header/replay window, lookup invoice, cancel/refund dan rate limit Vessel belum dikonfirmasi provider.
- Webhook publik belum memiliki edge rate limit; payload dibatasi 256 KiB, tetapi perlindungan flood/abuse harus dipasang di platform sebelum launch.
- Sandbox nyata, callback nyata, retry provider, multi-worker race, lease expiry pada PostgreSQL bersama, email delivery dan scheduler platform belum diuji.
- Fase 5 masih harus menyelesaikan settlement/clearing/refund; reconciliation subscription baru berupa evidence.
- Environment isolation fase 1 dan acceptance staging fase 2–3 tetap terbuka.
