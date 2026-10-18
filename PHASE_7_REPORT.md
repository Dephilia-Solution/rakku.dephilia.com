# Fase 7 — Reporting, HPP, receipt dan quota

17 Oktober 2026 · perubahan lokal pada branch `codex/production-hardening`.

**Source fase 7 selesai sebagian; acceptance laporan/storage/provider belum dijalankan.** Tidak ada data atau layanan aktif yang dipakai.

## Perubahan

| Area | Perubahan |
|---|---|
| Timezone | Helper Asia/Jakarta (`jakartaDayStart`, `jakartaRangeBounds`, `jakartaMonthKey`, `isWithinJakartaRange`) dipakai owner/POS reports dan email |
| Report history | Owner profit-loss dan POS page membatasi rentang "Semua" sesuai `report_history_days` paket |
| HPP | `cogs_amount` snapshot dipakai bila ada; legacy dihitung sebagai estimasi dan diberi label `estimatedCogs`/`hasEstimatedCogs`, bukan fakta historis |
| Report definition | Response menambahkan paid revenue, discount, tax, rounding, range dan definition version |
| Receipt | Subtotal ditampilkan sebagai net; diskon produk tidak dikurangkan dua kali; order discount dan pembulatan ditampilkan terpisah |
| Email quota | `usage_counters` at company/month; owner dan POS report email me-reserve quota sebelum kirim dan melepas reservation saat gagal |
| Index | Index company/status/date untuk orders, expenses dan balance transactions |
| Quota helper | `reserveUsage`/`releaseUsage` atomik dengan row lock; storage counter tersedia untuk integrasi berikutnya |

## Source utama

- `packages/shared-types/src/reporting.ts`
- `packages/db/src/usage.ts`, migration `0013_usage_quota_counters.sql`
- `apps/owner/src/app/api/owner/reports/profit-loss/route.ts`
- `apps/owner/src/app/api/owner/reports/send-email/route.ts`
- `apps/pos/src/app/api/reports/send-email/route.ts`
- `apps/pos/src/app/(dashboard)/reports/page.tsx`, `ReportsClient.tsx`
- `apps/pos/src/components/register/InvoiceReceipt.tsx`
- `apps/owner/src/components/reports/ProfitLossClient.tsx`

## Definisi yang dipakai

- `totalRevenue`/`paidRevenue`: completed + paid order, dibatasi WIB.
- `discountAmount`: total diskon produk+order yang tersimpan pada order.
- `taxAmount`, `roundingAmount`: nilai order yang tersimpan.
- `totalHpp`: snapshot `cogs_amount`; jika null, estimasi dari resep/cost saat laporan dibaca dan ditandai estimated.
- `grossProfit = paidRevenue − totalHpp`; `netProfit = grossProfit − expenses`.
- Receipt: item subtotal sudah net product discount; hanya order discount yang dikurangkan lagi, lalu tax dan rounding.
- Email quota: satu reservasi per email report per company per bulan Jakarta; limit `email_reports_month`, `-1` unlimited.

## Verifikasi aktual

| Pemeriksaan | Hasil |
|---|---|
| `pnpm --filter @rakku/db test` | 76 lulus; 2 WIB + 3 usage counter |
| `pnpm test:demo` | 74 + 3 lulus; termasuk laporan Jakarta/quota demo |
| `pnpm typecheck` + scripts | 18 task + scripts lulus |
| Build Owner/POS/Superadmin | Lulus pada `.next-hardening-phase567` |
| `pnpm test:auth:http` | 20 assertion lulus |
| Browser report/receipt, leap/month WIB nyata, storage quota, parallel email reservation | **Belum dijalankan** |

## Rollout dan rollback

1. Terapkan 0013 setelah 0012. Pastikan runtime memiliki privilege usage counter.
2. Uji boundary WIB harian/bulanan/leap, receipt dengan product+order discount+pajak+pembulatan, legacy COGS, dan quota email lintas outlet.
3. Rollback mempertahankan usage counter dan snapshot HPP; jangan mengisi COGS historis dengan biaya sekarang. Hentikan report email baru bila quota counter bermasalah dan forward-fix.

## Blocker tersisa

- Storage quota belum di-reserve/dilepas end-to-end pada upload/delete aset; helper tersedia.
- Definisi refund/fee/settlement belum disatukan ke seluruh report; report masih fokus sales/HPP/expenses.
- POS report memuat order lalu membatasi history di server; belum ada pagination/query report terpisah.
- Receipt product-discount classification memakai metadata `type=fixed,value=0`; perlu versioning eksplisit untuk data baru.
- Belum ada browser acceptance, printer 58/80mm, atau perbandingan report dengan ledger/statement nyata.
