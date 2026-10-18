# Settlement, saldo dan exception — definisi dan runbook

17 Oktober 2026. Local source only. No active database, provider statement,
bank transfer or production data was used.

## Definisi akuntansi

| Bucket | Arti | Boleh dicairkan? |
|---|---|---|
| `unsettled_balance` | Pembayaran provider sudah diterima Rakku, belum dicocokkan dengan statement provider | Tidak |
| `available_balance` | Dana yang sudah disettlement dan tidak sedang di-hold | Ya |
| `pending_balance` | Hold withdrawal (`requested`/`processing`) | Tidak; akan keluar atau kembali |
| `total_fees` | Akumulasi MDR/fee QRIS yang dicatat saat receipt | Bukan saldo merchant |
| `total_withdrawn` | Akumulasi withdrawal selesai | Bukan saldo |
| Liability | `available + pending + unsettled` | Kewajiban Rakku ke merchant |

`balance_transactions` adalah journal append-only. `balance_after` adalah
available setelah mutasi; `unsettled_after` adalah unsettled setelah mutasi.
Koreksi tidak mengubah baris historis: gunakan reversal/adjustment dengan
referensi dan catatan. `settlement_credit` memindahkan dana dari unsettled ke
available dan hanya dibuat sekali per `(company, settlement_report)`.

Migration 0012 menandai sale_credit lama sebagai `settled_at = created_at`
secara transisional karena skema lama sudah mengkreditkannya ke available.
Tidak ada nominal yang diubah dan tidak ada jurnal baru; flag ini mencegah
statement berikutnya melepas dana lama untuk kedua kali.

## Settlement workflow

1. Provider statement memberikan gross, MDR dan net untuk periode.
2. `POST /api/superadmin/reconciliation` memanggil `recordSettlementReport`:
   - mengunci `sale_credit` yang belum memiliki `settlement_report_id` dalam periode;
   - menghitung expected net dari journal;
   - menyimpan report berstatus `matched` atau `discrepancy`;
   - hanya jika `difference = 0`, membuat `settlement_credit` per company dan
     menandai receipt sebagai settled dalam transaksi yang sama;
   - jika ada selisih, dana tetap unsettled dan report harus ditinjau.
3. Repeated/overlapping statements tidak boleh melepas receipt yang sudah
   settled. Report dengan provider reference yang sama ditolak oleh unique index.
4. Jangan memakai timestamp lokal sebagai bukti settlement. Gunakan statement/
   provider reference. Batas periode laporan memakai Asia/Jakarta.

## Exception workflow

`app_private.payment_reconciliation` menyimpan receipt yang tidak dapat
diterapkan (late payment pada order cancelled, duplicate payment, dan kasus
terkait). Aksi yang tersedia:

- `investigate`: status `investigating`, assigned actor, tanpa mutasi saldo.
- `resolve`: status `resolved`, wajib note, resolution type/reference/proof,
  actor dan timestamp, tanpa mengubah saldo.

Refund/cancel provider belum memiliki API yang terbukti. Karena exception tidak
pernah dikreditkan ke available, menyelesaikan exception bukan berarti membuat
saldo baru. Jika kelak refund nyata tersedia, catat reversal journal terpisah
dengan bukti provider; jangan menandai refunded hanya dari klik admin.

## Withdrawal

- Request memiliki `request_id` unik per company; replay mengembalikan request
  yang sama dan tidak membuat hold kedua.
- Nominal harus integer rupiah, memenuhi minimum, limit harian dan satu pending
  request. Hold dan withdrawal row dibuat dalam satu transaksi.
- Hanya `available_balance` yang dapat di-hold. Unsettled/exception tidak boleh
  menjadi sumber pencairan.
- Completed/rejected finalization mengunci row dan idempotent; approval kedua
  tidak membuat ledger transition kedua.
- Re-auth/step-up untuk transfer dan pencairan belum diimplementasikan; ini
  prasyarat operasional sebelum production.

## Opening balance review

`opening-balance-read-only.sql` hanya membaca bucket saldo, ledger, settlement
dan withdrawal. Jalankan pada target terisolasi dengan role review yang berhak.
Output hanya company ID, count dan nominal; tidak ada nama, rekening, email atau
credential. Jangan menjalankan UPDATE/backfill dari file ini.

Gunakan hasilnya untuk:

1. membandingkan `merchant_balances` dengan journal per company;
2. menemukan receipt yang belum settled atau settlement ganda;
3. menemukan hold withdrawal yang tidak memiliki withdrawal aktif;
4. menyiapkan reversal journal untuk koreksi yang disetujui, bukan mengedit
   saldo/ledger historis.

## Local verification

- `pnpm --filter @rakku/db test`: settlement, hold, withdrawal finalization,
  exception, quota dan WIB tests pada PGlite memory.
- `pnpm test:concurrency`: harness dua koneksi PostgreSQL; **SKIPPED** tanpa
  `TEST_DATABASE_URL` + `RAKKU_ALLOW_DISPOSABLE_DB=1`. Belum dijalankan pada DB
  nyata.
- Provider statement, bank transfer, refund, production balance dan restore/PITR
  tetap belum terverifikasi.
