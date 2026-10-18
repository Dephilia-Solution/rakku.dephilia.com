# Fase 5 — Settlement, saldo dan exception

17 Oktober 2026 · perubahan lokal pada branch `codex/production-hardening`.

**Source fase 5 selesai lokal; statement provider, bank transfer dan acceptance staging belum dijalankan.** Tidak ada database aktif, provider, email atau transfer nyata yang dipakai.

## Perubahan

| Area | Sebelum | Sesudah |
|---|---|---|
| Saldo QRIS | Langsung masuk `available_balance` | Masuk `unsettled_balance` sampai statement provider cocok |
| Settlement | Hanya laporan agregat | Report `matched`/`discrepancy`; `settlement_credit` melepas unsettled→available dalam satu transaksi |
| Journal | Belum ada bucket unsettled | `unsettled_delta`, `unsettled_after`, `settlement_report_id`, `settled_at`; koreksi lewat reversal |
| Exception | Daftar read-only | Status `open/investigating/resolved`, actor/reference/proof/note; tanpa mutasi saldo |
| Withdrawal | Request tanpa key idempotensi | `request_id` unik per company; hold tetap hanya dari available |
| Review | Tidak ada | `config/settlement/opening-balance-read-only.sql` dan definisi invariant |

## Source utama

- `packages/db/migrations/0012_settlement_and_financial_commands.sql`
- `packages/ledger/src/index.ts` — `settleBalance`, saldo unsettled, adjustment reference.
- `packages/ledger/src/settlement.ts` — `recordSettlementReport`.
- `packages/db/src/payment-exceptions.ts` — investigate/resolve exception.
- `apps/superadmin/src/app/api/superadmin/reconciliation/route.ts` dan halaman reconciliation.
- `apps/superadmin/src/app/api/superadmin/reconciliation/exceptions/[intentId]/route.ts`.
- `apps/owner/src/lib/billing/withdrawal-service.ts` dan route withdrawal.
- `apps/owner/src/components/billing/BalanceClient.tsx`.
- `config/settlement/README.md`, `opening-balance-read-only.sql`.

## Invariant

- `sale_credit` hanya menambah unsettled; `settlement_credit` mengurangi unsettled dan menambah available dengan nominal yang sama.
- `settlement_credit` unik per `(company, settlement_report)`; report/receipt yang sudah settled tidak dilepas dua kali.
- Dengan `difference ≠ 0`, tidak ada dana yang dilepas dan report berstatus `discrepancy`.
- Withdrawal hold mengurangi available dan menambah pending (hold); reject mengembalikan, complete mengurangi pending dan menaikkan total withdrawn.
- Exception tidak pernah menambah saldo. Resolve hanya mencatat bukti; refund provider tetap harus melalui reversal journal dan bukti provider.
- Opening-balance review hanya SELECT; tidak ada edit saldo/ledger historis.

## Verifikasi aktual

| Pemeriksaan | Hasil |
|---|---|
| `pnpm --filter @rakku/db test` | 76 lulus; 5 settlement/withdrawal/exception |
| `pnpm test:demo` | 74 domain + 3 network-policy lulus |
| `pnpm typecheck` + scripts | 18 task + scripts lulus |
| Build Owner/POS/Superadmin | Lulus pada `.next-hardening-phase567` |
| `pnpm test:auth:http` | 20 assertion lulus |
| `pnpm test:concurrency` | **SKIPPED**; `TEST_DATABASE_URL` tidak diisi |
| Statement provider, transfer bank, re-auth, refund/cancel, restore | **Belum dijalankan** |

## Rollout dan rollback

1. Terapkan 0012 setelah 0009–0011 pada staging terisolasi; jalankan opening-balance review sebelum mengaktifkan settlement.
2. Pastikan runtime memiliki privilege `settlement_credit`, tabel settlement private, dan `financial_requests`.
3. Uji statement nyata: cocok, selisih, duplicate/overlapping, receipt ganda, late receipt, parallel withdrawal dan DB failure. Jangan melepas dana dari selisih yang belum ditinjau.
4. Jangan edit saldo/ledger historis. Koreksi memakai reversal/adjustment dengan actor, note dan reference. Rollback mempertahankan report, journal dan exception; jangan menghapus bukti.

## Blocker tersisa

- Statement settlement, fee aktual, rekonsiliasi berulang dan transfer bank nyata belum diuji.
- Refund/cancel provider belum tersedia; exception resolve bukan pengganti refund.
- Re-auth/step-up approval pencairan belum diimplementasikan.
- Harness dua koneksi dan restore/PITR belum dijalankan.
- Provider contract dan environment isolation dari fase 1–4 tetap terbuka.
