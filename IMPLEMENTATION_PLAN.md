# Rencana Implementasi dan Rollout Rakku

17 Oktober 2026 · branch `codex/production-hardening` · perubahan lokal, belum deploy.

## Sasaran dan batas eksekusi

Autentikasi harus mengikuti identitas dan tahap sesi yang sah; transaksi bisnis tidak boleh meninggalkan order, stok, nominal atau ledger setengah tersimpan. Public launch tetap bergantung pada penutupan blocker dependency, RBAC, subscription/provider lifecycle, settlement, environment dan verifikasi operasional dalam audit.

Instruksi awal read-only telah diikuti untuk pemetaan/audit. Setelah persetujuan implementasi, perubahan dilakukan pada source dan database memory test saja. Database aktif, Managed Auth aktif, resource provider dan deployment tidak dimutasi. Perubahan dokumentasi milik pengguna yang sudah ada dipertahankan.

## Fondasi yang sudah dikerjakan lokal

| ID | Ruang lingkup dan berkas utama | Migration | Acceptance / bukti lokal |
|---|---|---|---|
| F01 | JWT audience/issuer/exp dan validasi payload: auth-utils, token wrappers Owner/POS | Tidak langsung; sesi baru memerlukan 0005 | Token verifikasi/pending tidak bisa dipakai sebagai sesi penuh; token tanpa exp ditolak |
| F02 | Registry sesi, logout/reset/status/credential/assignment revoke: db/sessions, owner-security, auth routes | 0005 | Consume sekali, reset atomik, token tidak hidup kembali sesudah akun diaktifkan ulang |
| F03 | Guard server Owner guest/onboarding, POS company/outlet/user/PIN, admin guest/activate/reset; SessionBoundary pada perubahan rute/history/tab | 0005 untuk sesi Owner/POS | Build lulus; navigasi positif/negatif merchant dan Managed Auth tetap perlu E2E staging |
| F04 | Ownership + atomic employee/assignment dan tier-price replacement: db/merchant, Owner endpoints | 0005 untuk revocation | Forged tenant/role/outlet ditolak, assignment/harga lama tetap utuh saat gagal |
| F05 | Rollback-only pada returned query/RPC error; proteksi paid order deletion | 0006 | Ignored error tidak menghasilkan partial commit; draft DELETE tidak menghapus paid order |
| F06 | Server quote katalog/tier/modifier/discount/tax/rounding: pricing/quote dan money, cash/draft/QRIS routes | 0006 | Forged amount/nama/modifier dan kuantitas buruk ditolak/diabaikan sesuai authoritative quote; split harus tepat |
| F07 | Checkout key+hash, lock/replay dan draft completion atomik; alokasi split disimpan bersama stock | 0006 | Replay mengembalikan order sama; reuse key dengan payload berbeda ditolak |
| F08 | Durable payment intent, timeout quarantine, late-payment recovery, exception dashboard | 0007 | Timeout tidak menghapus invoice atau membuat panggilan provider kedua; late success finalisasi sekali; cancelled receipt masuk rekonsiliasi |
| F09 | PWA authenticated network-only, purge cache lama, browser history/tab check, origin guard auth | Tidak | Source/build diperiksa; perlu E2E perangkat dan multi-tab merchant |
| F10 | Historical HPP dan marker deduction pada order tanpa resep; inventory metadata adjustment memakai movement | 0008 | Cost/recipe berubah setelah penjualan tidak mengubah snapshot/deduksi; ledger failure membatalkan seluruh side effect |
| F11 | Cron dry-run tanpa finalisasi, bounded sync, webhook failure response, filter revenue email completed+paid | Tidak | Review source dan build; integrasi scheduler/provider nyata belum dijalankan |
| F12 | Build dengan DB/provider diblokir dan direktori `.next-hardening` terpisah dari dev | Tidak | Tidak mengganggu server dev atau memakai resource aktif; gunakan perintah di bawah |
| F13 | RBAC CRUD: registry method/path deny-by-default, evaluator policy POS, snapshot/normalisasi/revision/audit grant, matriks Owner/Superadmin, onboarding eksplisit, demo parity | 0009 | 38 test DB (12 grant/role), 14 test auth (11 policy), 74 demo; build terisolasi Owner/POS/Superadmin lulus. Acceptance staging dan dua koneksi PostgreSQL belum dijalankan; rincian di `PHASE_2_REPORT.md` |
| F14 | Subscription lifecycle: request identity/hash, invoice reservation sebelum provider, state unknown, provider-confirmed terminal, activation/journal/reconciliation idempotent | 0010 | 10 test lifecycle/private policy; older callback tidak downgrade; journal failure rollback; late success/provider outage lulus. Sandbox/provider nyata belum dijalankan; rincian di `PHASE_3_REPORT.md` |
| F15 | Provider reliability: inbox event unik, job lease/retry/dead-letter/replay, webhook HMAC opsional, cron worker, outbox email | 0011 | 7 test job/inbox + 6 test provider handler + 3 signature; kontrak provider signature/cancel/refund tetap unknown; rincian di `PHASE_4_REPORT.md` |
| F16 | Settlement/saldo/exception: unsettled bucket, settlement cocok/selisih, journal settlement, exception investigate/resolve, withdrawal request identity, opening-balance review | 0012 | 5 test settlement/withdrawal + exception; statement/bank/re-auth belum diuji; rincian di `PHASE_5_REPORT.md` |
| F17 | Financial commands: request identity+hash, atomic default bank, atomic tier replacement, two-connection harness | 0012 | 5 test financial request; harness disiapkan tetapi belum dijalankan; rincian di `PHASE_6_REPORT.md` |
| F18 | Reporting/HPP/quota: WIB boundaries, history cap, estimated COGS, receipt discount math, email quota, usage counters | 0013 | 3 usage + 2 WIB + demo regression; storage quota/refund definitions belum utuh; rincian di `PHASE_7_REPORT.md` |
| F19 | Operational readiness: CI, observability/redaction, health, runtime pause, ops snapshot/cleanup/restore verify, backup/incident/rotation runbook | 0014 | 4 observability + 2 runtime flag + 2 maintenance; CI/restore/alert belum dijalankan; rincian di `PHASE_8_REPORT.md` |
| F20 | Pilot/launch gate: acceptance matrix, device/browser, legal/support, go/no-go, stop/rollback criteria | Tidak | Keputusan **NO-GO**; tidak ada acceptance merchant/staging nyata; rincian di `PHASE_9_REPORT.md` |

Empat migration baru bersifat additive; constraint NOT VALID memeriksa write baru sambil mempertahankan record historis untuk rekonsiliasi. File baseline/histori migration 0001–0004 tidak ditulis ulang.

## Pemeriksaan lokal

| Pemeriksaan | Hasil |
|---|---|
| `pnpm test:auth` | Fase 2: 14 lulus (11 policy route/method + 3 token), secret sintetis |
| `pnpm test:provider` | Fase 4: 3 lulus; HMAC timestamped/body mode, tamper/replay dan unverified |
| `pnpm test:observability` | 4 lulus; redaction secret/PII, correlation ID, error taxonomy, structured log |
| `pnpm test:env` / `test:dependencies` | 12 / 3 lulus |
| `pnpm test:db` | Fase 5–8: 80 lulus; settlement/unsettled, exception, financial identity, WIB, quota, runtime flags, maintenance cleanup, subscription/job/provider pada PGlite memory + migration 0001–0014 |
| `pnpm test:concurrency` | **SKIPPED** lokal; CI menyiapkan PostgreSQL service, tetapi workflow belum dieksekusi |
| `pnpm test:demo` | Fase 2–9: 74 domain + 3 network-policy lulus, termasuk role CRUD, subscription, laporan Jakarta dan quota demo |
| `pnpm typecheck` + `typecheck:scripts` | Fase 8–9: 19 task + scripts lulus, termasuk Landing dan Observability |
| Lint Owner/POS/Superadmin | Fase 8–9: 0 error; warning migrasi React Compiler tetap terlihat (Owner29/POS15/Admin5) |
| Build aplikasi terdampak dengan transport diblokir | Fase 8–9: Owner/POS/Superadmin/Landing lulus pada `.next-hardening-phase89`, termasuk Serwist POS, health dan ops API |
| `pnpm test:auth:http` | Fase 8–9: 20 assertion entry demo/guest/origin/token-purpose lulus; webhook DB diblokir 503; DB/Auth/provider diblokir |
| Demo browser acceptance `--isolated-build` | 5/5 routed browser suites lulus; artefak uji terpisah dari dev |
| Merchant positive-flow browser, Managed Auth live, provider sandbox, multi-connection concurrency | Belum dijalankan; wajib sebelum release |

Perintah build: `pnpm build:isolated owner pos superadmin`. Output default ada di `.next-hardening`; gunakan `RAKKU_BUILD_DIRECTORY=.next-hardening-auth-session` yang sama saat build dan test untuk memisahkan pekerjaan paralel. Konfigurasi dev/deploy normal tetap memakai `.next`. Artefak build terisolasi berisi konfigurasi pengujian dan tidak boleh dipakai sebagai artefak rilis; lakukan build rilis ulang dengan environment target yang telah diverifikasi. Untuk browser acceptance gunakan `pnpm test:demo:browser --isolated-build` dan `PLAYWRIGHT_MODULE_PATH` menuju instalasi Playwright lokal. Runner membatasi DB/provider ke loopback port tertutup dan hanya menutup proses yang dibuatnya sendiri. `pnpm test:auth:http` juga memakai tiga server build terisolasi pada port 3510–3512 untuk memeriksa guest guard, origin dan token lintas purpose tanpa database/provider aktif.

Demo domain tidak diubah menjadi merchant live dan tidak menggunakan registry sesi/DB. Jangan menafsirkan demo test sebagai smoke test production.

## Backlog berikutnya, menurut ketergantungan

Fase 1 source telah dikerjakan: Next16.4.2/React19.3.1 pada empat aplikasi, Drizzle0.45.4, pembaruan dependency, patch keamanan braces dan checker isolasi yang menolak konfigurasi shared. Fase 2 source selesai lokal: RBAC CRUD dengan migration 0009, policy POS deny-by-default, matriks Owner/Superadmin dan demo parity. Fase 3-7 source selesai lokal: subscription lifecycle/provider jobs (0010-0011), settlement/saldo/exception (0012), financial command identity dan reporting/quota WIB (0013). Fase 8 tooling operasional selesai lokal (0014, CI/observability/health/pause/cleanup/restore runbook), dan fase 9 menyiapkan pilot/launch gate dengan keputusan **NO-GO**. **Prasyarat resource fase 1, provider contract, CI/restore/alert, concurrency dua koneksi dan acceptance staging/pilot belum selesai**; hasil dan batas buktinya ada di `PHASE_1_REPORT.md`–`PHASE_9_REPORT.md`, `config/provider/README.md`, `config/settlement/README.md`, `config/operations/README.md` dan `config/pilot/README.md`.

| Tahap / prioritas | Implementasi konkret | Migration / rollback | Acceptance dan uji |
|---|---|---|---|
| 1 · P0 · Dependency dan lingkungan | Source selesai lokal: Next16/React19, patch Drizzle/transitives/braces, checker + templates/runbook isolasi. Provision/pemisahan DB/Auth/provider/secret staging masih terbuka | Tidak ada migration baru fase 1; rollback source+lockfile bersama tanpa drop data foundation. Resource aktif tidak diubah | Build 4 app + Serwist/HTTP lulus. Audit mentah 0 critical/1 high braces dengan patch lokal teruji; env checker masih menolak resource shared. Rincian acceptance pada PHASE_1_REPORT |
| 2 · P0 · RBAC CRUD | **Source selesai lokal:** snapshot/normalisasi 0009, registry method/path deny-by-default, evaluator POS, matriks Owner/Superadmin, onboarding eksplisit, demo parity. Tidak ada backfill otomatis dari `can_view`; impact report read-only tersedia | 0009 additive; rollback mempertahankan snapshot/audit/revision. Rollback aplikasi saja membuka kembali enforcer lama yang overbroad | 38 DB + 14 auth + 74 demo lulus, build terisolasi lulus. **Staging belum:** sesi POS nyata setelah grant berubah, browser editor, dua koneksi PostgreSQL, privilege runtime 0009 |
| 3 · P0 · Subscription payment | **Source selesai lokal:** reservation sebelum provider, request identity/hash, state `unknown`, provider-confirmed terminal, activation/journal/reconciliation transaksional, older-callback reconciliation | 0010 additive; invoice/journal/reconciliation dipertahankan saat rollback | 10 lifecycle/private-policy test lulus. **Staging belum:** provider timeout nyata, sandbox callback, dua koneksi concurrent checkout/activation |
| 4 · P0 · Provider reliability | **Source selesai lokal:** inbox event unik, job lease/backoff/dead-letter/replay, HMAC opsional, cron worker, outbox email; kontrak signature/cancel/refund tetap unknown | 0011 additive; worker berhenti tanpa menghapus backlog/event | 7 job/inbox + 5 handler + 3 signature test lulus. **Staging belum:** callback sandbox nyata, worker race multi-instance, signature provider aktual, DLQ replay |
| 5 · P0/P1 · Settlement dan exception | **Source selesai lokal:** unsettled/available/hold, settlement matched/discrepancy, settlement journal, exception investigate/resolve, withdrawal request identity, opening-balance read-only. **Belum:** provider statement nyata, refund/cancel, bank transfer, re-auth | 0012 additive; journal/settlement/exception evidence dipertahankan saat rollback | 5 test settlement/withdrawal lulus. Statement provider, rekonsiliasi berulang, refund timeout, parallel withdrawal dan DB failure staging belum dijalankan |
| 6 · P1 · Seluruh command keuangan | **Source parsial:** generic request identity/hash untuk purchase/expense/adjustment/withdrawal, atomic default bank dan tier price replacement. Command lain/client form belum seluruhnya memakai key | 0012 `financial_requests`; harness dua koneksi disiapkan | 5 test identity lulus; `pnpm test:concurrency` **SKIPPED** tanpa DB disposable. Simultaneous checkout/purchase/withdrawal dan deadlock belum diuji |
| 7 · P1 · Reporting/quotas | **Source parsial:** WIB boundaries, history cap owner/POS, estimated COGS, receipt discount/rounding, email quota + usage counter, index laporan. Storage quota/refund/fee/settlement definition belum utuh | 0013 usage counters + indeks; legacy COGS tetap null/estimated | 3 usage + 2 WIB + demo regression lulus; boundary WIB/leap, report-to-ledger, storage quota dan parallel reservation staging belum diuji |
| 8 · P1 · Operasional/security | **Source/tooling selesai lokal:** CI workflow, observability/redaction, health, runtime checkout pause, ops snapshot/cleanup/restore verify, runbook backup/incident/rotation, audit summary. **Belum:** CI GitHub runner, restore/PITR drill, alert delivery, log drain, re-auth/step-up | 0014 runtime flags additive; evidence finansial tidak dihapus cleanup | 4 observability + 2 runtime + 2 maintenance test lulus; build empat app lulus. Restore/alert/CI/privilege belum diverifikasi |
| 9 · P1/P2 · Pilot dan launch | **Dokumen acceptance selesai:** `config/pilot/README.md` dengan matrix akun/flow/device/legal/support, go/no-go, stop/rollback. **Belum:** refund/void approval, cash close, step-up, printer/cash drawer/QRIS device, custom domain, legal review, pilot nyata | Pilot terbatas; ekspansi dapat dihentikan tanpa menghapus transaksi | **NO-GO**. Tidak ada merchant acceptance, rekonsiliasi statement nyata, device test atau approval legal |

Tahap 1–5 adalah launch blockers. Tahap 6–9 menentukan reliability operasional; prioritas detail dapat diperbarui berdasarkan hasil staging. Pekerjaan yang memerlukan provider/akun/infrastruktur aktif tidak dianggap selesai hanya karena ada implementasi lokal.

## Urutan rollout foundation ini

1. Sediakan environment staging terisolasi dan backup/restore point yang telah diuji. Verifikasi fingerprint target tanpa mencetak URL/secret.
2. Periksa migration 0005–0011 dengan role migrator dan grants runtime yang benar. Untuk 0009, jalankan `config/rbac/impact-read-only.sql`, review setiap company/role ID, lalu pastikan snapshot/audit/RLS dan privilege invoker trigger sesuai `config/rbac/README.md`. Untuk 0010–0011, verifikasi RLS tabel privat, privilege `job_queue`/`provider_events`/journal, dan konfirmasi kontrak Vessel di `config/provider/README.md`. Tinjau legacy quantity/amount/cost yang melanggar constraint sebelum VALIDATE CONSTRAINT.
3. Terapkan migration di staging terlebih dahulu, lalu rilis aplikasi yang kompatibel. Pause edit grant dan hentikan worker lama selama boundary migration/release. Deploy kode yang memahami provider_state/request idempotency; client lama dengan payload menu-only harus menerima 400. Aktifkan cron `provider-jobs`/billing setelah migrasi 0011, lalu verifikasi runtime flags/checkout pause pada 0014. **Tidak ada langkah ini yang telah dijalankan ke database aktif dalam sesi ini.**
4. Logout/login ulang seluruh browser Owner/POS. Token lama tanpa issuer/audience/session ID akan ditolak. Link verifikasi lama perlu dikirim ulang. Jangan menggabungkan client lama yang tidak mengirim requestId dengan API baru. Perubahan grant mencabut sesi POS role terkait; uji refresh dan switch-user.
5. Jalankan acceptance berikut menggunakan akun uji staging, bukan akun production.
6. Setelah seluruh blocker ditutup, rollout production bertahap melalui prosedur deployment terotorisasi, pantau exception/revenue/stock/latency/error, dan hentikan ekspansi bila mismatch muncul.

## Matriks acceptance staging wajib

- Owner guest, email belum verified, verified tanpa company, company siap, suspended/inactive: akses langsung setiap login/register/check-email/forgot/reset/onboarding/dashboard; reload, Back/Forward, dua tab, logout/reset dan re-enable.
- POS anonymous, pending company, outlet terpilih, user asing/tidak ditugaskan/inactive/locked, PIN salah/benar, full session, switch-user dan revoked session. Full session selalu keluar dari semua `/login/*` dan user tidak dapat mengganti tenant melalui auth API.
- RBAC: view-only/creator/editor/deleter/operator/tanpa grant pada seluruh method, cross-company/outlet, unknown endpoint, spoofed header, sesi revoked/inactive, grant berubah saat sesi aktif, refresh/switch-user, stale revision dan rollback audit. Owner/Superadmin editor round-trip dan konflik revision. Dua koneksi PostgreSQL untuk save grant bersamaan dan raw DML/race deletion.
- Superadmin no session, Managed Auth valid tanpa membership, invitation salah/expired/terpakai, active member, disabled member; guest pages dan API sign-in/activation tidak mengganti sesi aktif.
- Uji 20 checkout paralel, replay request identik, key berbeda/berubah, double-click, response hilang, pool saturation, deadlock dan retry. Verifikasi order/item/split/stock/HPP/ledger sebagai satu invariant.
- Sandbox QRIS: success, pending melewati expiry lokal, provider confirmed expired/cancelled, late success, duplicate attempt, forged callback, provider timeout sebelum/sesudah accepted dan DB gagal setelah verified payment.
- Subscription: duplicate checkout/requestId, response hilang setelah provider accepted, provider timeout sebelum/sesudah accepted, late success setelah plan berubah, out-of-order callback, activation/journal rollback, older invoice reconciliation dan refund/cancel yang belum didukung.
- Provider inbox/outbox: duplicate delivery, unmatched receipt, invalid signature/amount/identity, app crash sebelum/sesudah activation commit, worker crash sebelum `done`, lease expiry, multi-worker race, outage, retry/backoff/jitter, max-attempt DLQ dan replay terkontrol. Dry-run harus nol side effect.
- Settlement/saldo: statement cocok, selisih, duplicate/overlapping statement, receipt settled ganda, unsettled withdrawal denial, parallel withdrawal, finalize/reject/double approval, exception investigate/resolve dengan bukti. Jalankan `config/settlement/opening-balance-read-only.sql`.
- Financial concurrency: dua koneksi PostgreSQL pada DB disposable untuk checkout/purchase/expense/withdrawal/adjustment, duplicate request identity, deadlock/retry, crash sebelum/sesudah side effect; periksa invariant tabel, bukan hanya status HTTP.
- Reporting/quota: boundary WIB harian/bulanan/leap, diskon produk+order+pajak+rounding+refund, HPP snapshot vs estimated legacy, receipt math, history cap, email/storage/transaction quota lintas outlet dan parallel reservation.
- Refund/withdrawal/settlement tidak dinyatakan aman sampai workflow dan rekonsiliasi lengkap; cocokkan dengan statement provider.
- PWA dua akun pada perangkat sama, multi-tab, history restore, worker upgrade, online/offline; tidak ada data sesi sebelumnya atau transaksi offline yang seolah berhasil.

## Rollback dan kompatibilitas

Jangan drop migration/data baru untuk rollback aplikasi. Simpan registry, invoice, receipt, subscription journal/reconciliation, provider event, job queue, snapshot, settlement/exception evidence, financial request, usage counter, audit grant dan ledger agar audit/recovery tetap mungkin. Jika foundation bermasalah, hentikan checkout baru, worker provider dan approval pencairan, lalu gunakan forward-fix yang kompatibel. Rollback ke aplikasi lama mengembalikan kelemahan revocation/idempotency/RBAC/local-expiry/saldo-available-sebelum-settlement sehingga bukan rollback aman tanpa kontrol tambahan. Untuk RBAC, pertahankan enforcement baru atau hentikan operasi tulis; jangan hapus snapshot/audit/revision dan jangan menghidupkan sesi yang sudah dicabut. Jangan menghapus backlog/DLQ; replay hanya job yang sudah ditinjau. Untuk settlement, koreksi melalui reversal journal, bukan edit saldo/ledger.

Constraint baru menjaga write baru, tetapi backfill/validation data historis adalah pekerjaan terpisah. Receipt exception harus diselesaikan dengan provider dan bukti yang dapat diaudit; jangan mengedit balance/stock/paid order langsung untuk menutup selisih.
