# Fase 3 — Lifecycle pembayaran subscription

17 Oktober 2026 · perubahan lokal pada branch `codex/production-hardening`.

**Implementasi source fase 3 selesai secara lokal; acceptance provider/staging belum dijalankan.** Tidak ada sandbox Vessel, database aktif, email, cron, rotasi secret atau deployment yang dipanggil. Fase 1–2 tetap memiliki blocker resource/staging.

## Perubahan utama

| Bagian | Sebelum | Sesudah |
|---|---|---|
| Checkout | Provider dipanggil sebelum invoice disimpan | Invoice/request intent disimpan dan `provider_state=creating` sebelum provider call |
| Idempotency | Tidak ada request identity | `subscription_payment_requests` unik per company/request + hash payload; invoice aktif dipakai ulang |
| Timeout | Invoice tidak ada / error langsung | Invoice `unknown` dipertahankan, tidak membuat attempt pengganti otomatis |
| Expiry | `expired_at` lokal menandai expired | Hanya terminal status yang dikonfirmasi provider |
| Aktivasi | Claim invoice + subscription/company | Satu transaksi: invoice, company, subscription, journal append-only, job email |
| Callback lama | Bisa menerapkan plan lama | `applied_at=null`, journal unapplied dan `subscription_reconciliation` |
| Retry/duplicate | Rentan double activation | Claim idempotent; retry mengembalikan `already`, journal/subscription tidak ganda |

## State machine

Invoice status: `pending`, `unknown`, `success`, `expired`, `failed`, `cancelled`.
Provider state: `not_created → creating → accepted → unknown/terminal`.

- `creating`: reservation sudah commit; provider call belum pasti.
- `accepted`: provider transaction ID/QR tersimpan.
- `unknown`: timeout/response tak terbaca; invoice tetap ada dan dapat direkonsiliasi.
- `terminal`: provider mengonfirmasi success/expired/failed/cancelled.
- `success` + `applied_at`: plan diterapkan.
- `success` + `reconciliation_reason`: pembayaran diterima tetapi tidak diterapkan karena ada aktivasi lebih baru.

## Source yang berubah

- `packages/db/migrations/0010_subscription_payment_lifecycle.sql`: provider state, request journal, payment journal, reconciliation, indeks dan RLS.
- `packages/db/src/subscription-billing.ts`: reservation, binding transaksi provider, accepted/pending/terminal/uncertain, activation + journal + reconciliation.
- `packages/db/src/subscription-billing.test.ts`: 9 test lifecycle, termasuk request identity, duplicate, late success, older callback, identity mismatch, journal failure rollback dan RLS policy.
- `apps/owner/src/lib/billing/subscription.ts`: re-verify provider, tidak ada expiry lokal, outbox email job.
- `apps/owner/src/app/api/owner/subscription/checkout/route.ts`: reservation-first, request hash/idempotency, 202 uncertain.
- Route invoice/sync: mengembalikan `activated`/`reconciled` dan status 503/409 untuk outage/mismatch.
- `SubscriptionClient`, `CheckoutClient` dan checkout page: request identity, status unknown/reconciled, countdown tidak dianggap pembatalan.
- `packages/shared-types/src/billing.ts`: status `unknown`, provider state dan field reconciliation.

## Bukti legacy dan journal

- `attempt_no`, `provider_state`, `provider_created_at`, `terminal_at`, `applied_at`, `applied_subscription_id`, `reconciliation_reason` bersifat additive.
- Invoice lama `success` diberi `applied_at` dari `paid_at/updated_at/created_at` karena aplikasi lama hanya menulis success setelah aktivasi. Journal historis tidak dikarang.
- `subscription_payment_journal` append-only memiliki unique invoice, platform SELECT/INSERT RLS.
- `subscription_reconciliation` menyimpan invoice, amount, reason dan provider payload untuk workflow fase 5.
- `subscription_payment_requests` memiliki primary key `(company_id, request_id)` dan hash payload; payload berbeda → 409.

## Verifikasi aktual

| Pemeriksaan | Hasil |
|---|---|
| `pnpm --filter @rakku/db test` | 61 lulus; 10 di antaranya lifecycle/private policy subscription, PGlite 0001–0011 |
| `pnpm test:auth` | 14 lulus; token/policy tidak berubah |
| `pnpm test:provider` | 3 lulus; signature HMAC opsional |
| `pnpm test:demo` | 74 domain + 3 network-policy lulus |
| `pnpm typecheck` | 18/18 task lulus |
| Build terisolasi Owner/POS/Superadmin | Lulus pada `.next-hardening-phase34`, termasuk route checkout/invoice/webhook/provider-jobs |
| Vessel sandbox, timeout nyata, callback nyata, dua koneksi PostgreSQL, restore | **Belum dijalankan** |

## Rollout dan rollback

1. Selesaikan isolasi environment dan backup/restore point staging. Terapkan 0005–0011 melalui migrator; 0010 bergantung pada tabel subscription/plan lama dan 0011 menyediakan job email yang dipakai aktivasi. Deploy kode setelah kedua migration siap.
2. Hentikan checkout/worker lama selama boundary. Client lama yang tidak mengirim request identity tetap aman karena server memakai invoice aktif untuk dedupe, tetapi UI lama tidak menampilkan status `unknown`/reconciled.
3. Uji dengan akun sintetis: duplicate checkout, response hilang setelah provider accepted, timeout sebelum accepted, late success setelah plan berubah, provider terminal, activation/journal rollback dan dua koneksi concurrent.
4. Rollback aplikasi tidak boleh kembali ke provider-before-invoice/local-expiry. Simpan invoice, journal, reconciliation dan provider event. Hentikan worker, forward-fix, dan jangan menghapus bukti.

## Blocker tersisa

- Kontrak Vessel signature/lookup/cancel/refund belum terkonfirmasi; lihat `config/provider/README.md`.
- Sandbox/provider nyata, callback nyata, email delivery dan dua koneksi PostgreSQL belum diuji.
- Reconciliation subscription baru berupa evidence; workflow refund/approve adalah fase 5.
- Invoice yang provider-accepted tetapi DB update gagal sebelum provider ID tersimpan hanya dapat dipulihkan jika callback membawa transaction ID yang cocok dengan invoice; lookup by invoice tidak tersedia di client source.
- Fase 1 environment isolation dan fase 2 staging acceptance tetap terbuka.
