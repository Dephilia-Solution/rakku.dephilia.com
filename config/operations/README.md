# Operational readiness — observability, backup dan incident

17 Oktober 2026. Dokumen dan tooling lokal. **Tidak ada backup, restore,
scheduler, alert delivery, provisioning, rotasi secret atau deployment yang
dijalankan.** Target RPO/RTO di bawah adalah usulan yang harus divalidasi pada
platform Neon/Vercel aktual.

## Observability

- `@rakku/observability` menulis satu JSON per event: timestamp, level, service,
  environment, event, correlation ID dan field terpilih. Field sensitif
  (`password`, `pin`, `token`, `secret`, `cookie`, `authorization`, API key,
  account number, email, phone, nama customer/owner, OTP) diredaksi sebelum
  output. String dibatasi 500 karakter dan kedalaman objek dibatasi.
- `x-request-id` dibuat/dinormalisasi di proxy Owner/POS dan diteruskan ke
  server. Job queue/provider event memiliki `correlation_id`; worker mencatat
  job ID/kind/correlation tanpa payload mentah.
- Health/readiness: `GET /api/health` di Owner dan POS melakukan `select 1`.
  Response 200 hanya jika database terjangkau; kegagalan 503 dengan error
  terredaksi. Endpoint ini bukan bukti provider/Auth/Neon siap.
- Error taxonomy: validation, authentication, authorization, not found,
  conflict, provider unavailable, provider verification, database, internal.
- `pnpm ops:snapshot` (read-only) mengeluarkan count payment pending/unknown,
  subscription pending/unknown, exception unresolved, dead-letter job, due job,
  settlement discrepancy, withdrawal pending dan checkout pause.
  `--check` exit 1 bila ada critical alert. `pnpm ops:restore-verify` memeriksa
  bucket balance vs journal, saldo negatif, exception dan dead-letter.
- Rekomendasi alert (belum disambungkan ke layanan alert nyata): dead-letter > 0,
  exception unresolved > 0, settlement discrepancy > 0, unknown payment creation
  > 0, checkout pause aktif, due job > 100, health 503 > 2 menit, error rate
  auth/checkout di atas baseline.

## Retention, access dan cleanup

- `pnpm ops:cleanup` adalah dry-run default; `--apply` menghapus hanya:
  sesi auth kedaluwarsa/revoked, rate-limit kedaluwarsa, job `done` lama, dan
  provider event `processed` yang tidak memiliki job pending/leased/dead-letter.
- Cleanup **tidak** menghapus invoice, payment intent, ledger, settlement report,
  journal, reconciliation, exception, dead-letter atau evidence finansial lain.
- Dead-letter/provider event invalid dipertahankan sampai operator review.
- Akses DB runtime harus NOBYPASSRLS dan least-privilege; tabel private tidak
  diberikan ke PUBLIC. Log/alert tidak boleh memuat credential, cookie, PIN,
  PII atau URL kredensial. Retention log mengikuti kebijakan platform; belum
  diverifikasi dalam sesi ini.

## Backup, PITR dan restore

Usulan target (harus disetujui dan diuji): **RPO ≤ 1 jam** dengan PITR Neon,
**RTO ≤ 4 jam** untuk restore ke branch terisolasi. Backup manual sebelum
migration besar; jangan mengandalkan snapshot aplikasi.

Restore drill (belum dijalankan):

1. Hentikan checkout/provider worker/approval pencairan; catat waktu insiden.
2. Restore PITR/backup ke Neon branch **terisolasi**; jangan menimpa production.
3. Arahkan aplikasi staging terisolasi ke branch restore; jangan pakai
   credential production.
4. Jalankan `pnpm ops:restore-verify` dan `config/settlement/opening-balance-read-only.sql`.
   Periksa migration history, bucket balance vs journal, exception, dead-letter,
   invoice/ledger counts, dan rekonsiliasi settlement.
5. Jalankan smoke auth/checkout/demo terhadap data sintetis; cocokkan saldo,
   order, stock dan ledger.
6. Catat RPO/RTO aktual, selisih, approval owner, dan tindakan koreksi. Jangan
   menghapus evidence atau memutar credential lama tanpa prosedur.

Backup/PITR, restore drill, retention platform, alert delivery dan privilege
aktual **belum terverifikasi**.

## Migration, rollback dan emergency controls

- Migration aktif 0001–0014 bersifat additive; jangan menulis ulang baseline.
  Migration runner membungkus file dalam satu transaksi. Forward-fix lebih
  disukai daripada down-migration destruktif.
- `pnpm ops:checkout-pause -- --enable` mengaktifkan flag DB; checkout order,
  draft completion, QRIS create/retry berhenti dengan 503. `--disable` membuka
  kembali. Env `RAKKU_CHECKOUT_PAUSED=1` memaksa pause tanpa DB. Flag tidak
  membatalkan transaksi yang sudah commit.
- Saat insiden: pause checkout, hentikan worker/approval, jangan hapus
  inbox/DLQ/ledger, catat correlation ID, komunikasikan status, lakukan
  forward-fix, lalu replay hanya job yang ditinjau.
- Rollback aplikasi tidak boleh kembali ke provider-before-invoice,
  local-expiry, can_view-only RBAC atau saldo available-sebelum-settlement.
  Simpan event/job/invoice/journal/settlement/exception evidence.

## Credential rotation

Urutan yang disarankan dan belum dijalankan:

1. Siapkan credential baru pada secret store terisolasi; jangan menaruhnya di
   file tracked/log.
2. Rotasi migrator DB/runtime role secara terkoordinasi; verifikasi TLS dan
   privilege. Jangan memakai ulang credential development di production.
3. Rotasi JWT Owner/POS/Auth cookie/cron/provider/webhook. Catat sesi yang
   dicabut; token lama harus ditolak. Jangan menghidupkan sesi revoked.
4. Validasi health, auth login/PIN, webhook signature, provider lookup dan
   job worker. Hapus credential lama setelah rollback window.
5. Jika rotasi gagal, hentikan penggunaan credential baru dan pulihkan melalui
   prosedur insiden; jangan menyalin secret ke tiket/chat.

## Re-auth / step-up

Step-up untuk transfer bank, withdrawal approval, refund/void dan adjustment
admin **belum diimplementasikan**. Saat ini boundary hanya Managed Auth/session,
origin dan RBAC. Ini blocker operasional sebelum production; implementasi harus
mempertahankan purpose/session dan audit actor.

## CI dan supply chain

`.github/workflows/ci.yml` menjalankan frozen install, typecheck seluruh
workspace/scripts, lint, unit/integration/demo, observability, provider, DB,
build isolasi empat app, HTTP guards, serta job PostgreSQL dua koneksi untuk
`test:concurrency`. Job audit menjalankan audit mentah dan
`scripts/dependency-audit-summary.mjs`: critical dan high yang tidak diketahui
gagal; high braces yang dipatch tetap tercatat sebagai advisory, bukan disembunyikan.
`minimum-release-age=1440` dan lockfile frozen menjadi guard supply-chain.
Workflow belum dieksekusi di GitHub dalam sesi ini.
