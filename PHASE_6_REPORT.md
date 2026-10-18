# Fase 6 — Command keuangan dan concurrency

17 Oktober 2026 · perubahan lokal pada branch `codex/production-hardening`.

**Source parsial selesai lokal; acceptance dua koneksi PostgreSQL belum dijalankan.** Tidak ada database aktif yang disentuh.

## Perubahan

| Command/area | Perubahan |
|---|---|
| Purchase | `runFinancialCommand` dengan `Idempotency-Key`/`requestId`; replay mengembalikan hasil tersimpan |
| Expense create | Request identity + hash payload; insert dalam transaksi identity |
| Superadmin balance adjustment | Request identity; reference ID dipakai bila UUID sehingga replay tidak menggandakan adjustment |
| Withdrawal request | `request_id` unik per company; duplicate request mengembalikan withdrawal yang sama |
| Default bank | Clear/set default, insert/update, delete+promotion dijalankan dalam satu transaksi dengan advisory lock company |
| Product tier prices | Memakai `replaceProductTierPrices` transaksional/locked, bukan delete lalu insert terpisah |
| Modifier tier prices | Helper transaksional baru; PATCH modifier memakai transaction |
| Concurrency harness | `scripts/test-financial-concurrency.mjs` untuk withdrawal lock dan duplicate credit pada dua koneksi |

## Source utama

- `packages/db/migrations/0012_settlement_and_financial_commands.sql` — `app_private.financial_requests`.
- `packages/db/src/financial-commands.ts` — request identity, stable payload hash, rollback-only result.
- `packages/db/src/merchant.ts` — `replaceProductTierPrices`, `replaceModifierTierPrices`, `saveEmployee`.
- Route purchase/expense POS, bank-account Owner, adjustment Superadmin, product/modifier tier prices.
- `scripts/test-financial-concurrency.mjs`, root script `test:concurrency`.

## Semantik idempotensi

- Key sama + command/hash sama → result lama; tidak ada side effect kedua.
- Key sama + payload/command berbeda → `REQUEST_CONFLICT` 409.
- Execute gagal → transaksi rollback; side effect dan request record tidak tersimpan.
- Tanpa key → command berjalan normal (belum replay-safe).
- Financial request dan usage/exception/settlement rows bersifat platform-only dengan FORCE RLS.

## Verifikasi aktual

| Pemeriksaan | Hasil |
|---|---|
| `pnpm --filter @rakku/db test` | 76 lulus; 5 financial request identity |
| `pnpm typecheck` + scripts | 18 task + scripts lulus |
| `pnpm test:demo` | 74 + 3 lulus |
| Build Owner/POS/Superadmin | Lulus pada `.next-hardening-phase567` |
| `pnpm test:concurrency` | **SKIPPED**; tidak ada `TEST_DATABASE_URL` disposable |
| Dua koneksi nyata, deadlock/retry, fault injection | **Belum dijalankan** |

## Rollout dan rollback

1. Terapkan 0012 bersama fase 5; jangan aktifkan client lama yang mengirim payload berbeda dengan key sama.
2. Uji harness pada DB disposable: `RAKKU_ALLOW_DISPOSABLE_DB=1 TEST_DATABASE_URL=... pnpm test:concurrency` setelah migration. Harness menolak URL yang sama dengan env aplikasi.
3. Rollback mempertahankan `financial_requests` dan journal; jangan menghapus request history. Hentikan command baru dan forward-fix, bukan mengedit saldo/stock.

## Blocker tersisa

- Belum semua command memiliki request identity: modifier/recipe/pricing-tier/refund/void dan beberapa form client belum mengirim key.
- Client form purchase/expense belum mengirim `Idempotency-Key` secara stabil per submit.
- Harness dua koneksi belum dijalankan; PGlite tidak membuktikan `SKIP LOCKED`/deadlock.
- Re-auth/step-up, ownership audit seluruh endpoint admin POS dan rollback drill tetap terbuka.
- Beberapa replace-all lain (mis. pricing option/recipe) belum diaudit ulang menyeluruh.
