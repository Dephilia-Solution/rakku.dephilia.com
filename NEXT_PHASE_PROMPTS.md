# Prompt kelanjutan Rakku — fase 2–9

17 Oktober 2026. Gunakan **satu blok prompt per giliran**, sesuai urutan dependensi IMPLEMENTATION_PLAN.md. Fondasi auth/transaksi dan fase 1 source sudah dikerjakan lokal; resource environment masih dibagi dan env:check masih menolak konfigurasi aktif. Build/demo test tidak membuktikan staging atau production aman.

## Aturan yang berlaku pada semua prompt

- Baca RAKKU_HANDOFF/START_HERE.md beserta referensinya bila tersedia, SYSTEM_MAP.md, PRODUCTION_READINESS_AUDIT.md, IMPLEMENTATION_PLAN.md, PHASE_1_REPORT.md, aturan repository dan source aktual. Dokumen adalah peta; keputusan mengikuti kode dan temuan terbaru.
- Kerjakan source, migration baru, uji terisolasi dan dokumentasi sampai reviewable. Pertahankan perubahan pengguna/pekerjaan lain. Jangan reset checkout, menulis ulang baseline migration, atau mengerjakan fase lain diam-diam.
- Jangan memakai DB/Auth/provider aktif, mengirim email, memutar secret aktif, menjalankan migration pada DB aktif, atau deploy. Bila membutuhkan layanan nyata, siapkan kontrak, adapter, fixture dan runbook dahulu; catat prasyarat yang belum terpenuhi. Jangan mengisi ketidakpastian provider dengan asumsi keberhasilan.
- Transaction menjaga invariant DB lintas tabel; periksa affected rows dan ownership. Panggilan eksternal membutuhkan durable intent, idempotency dan recovery: transaction PostgreSQL tidak membatalkan transaksi provider.
- Isolasi company/outlet, purpose/stage sesi, origin dan revocation tetap berlaku. Jangan menampilkan token, cookie, PIN, password, PII atau URL kredensial dalam output/log/fixture.
- Jalankan uji relevan, typecheck/lint dan build terisolasi aplikasi terdampak. Gunakan direktori build unik dan transport eksternal yang diblokir. Demo tidak menggantikan acceptance merchant staging. Laporkan hasil aktual, kegagalan/limitasi, migration/rollout/rollback dan blocker tersisa. Perbarui audit/rencana; berhenti setelah fase yang diminta selesai secara lokal.

Persiapan environment tetap prasyarat acceptance staging: ikuti config/environments/README.md. Provisioning/rotasi resource aktif memerlukan lingkup tersendiri; jangan dilakukan sebagai efek samping prompt berikut.

## Fase 2 — RBAC CRUD dan isolasi akses

~~~text
Lanjutkan tepat fase 2 production hardening Rakku: RBAC CRUD. Baca dokumen dan aturan umum NEXT_PHASE_PROMPTS.md, lalu periksa source aktual dan perubahan lokal sebelum mengedit. Jangan menyentuh resource aktif atau deploy.

Inventarisasi seluruh endpoint POS; petakan method + path ke capability view/create/edit/delete eksplisit. Periksa apps/pos/src/lib/db.ts, proxy.ts, session resolver, menu helpers, Owner role editor, Superadmin access matrix, shared types dan query/RLS. Menu tersembunyi bukan pembatas keamanan. Deny unknown endpoint secara default; pisahkan auth/public/internal endpoint dengan tepat. Cegah spoofed header capability dan bypass melalui helper/RPC langsung.

Tentukan kebijakan legacy grant sebelum backfill: tampilkan dampak can_view lama secara read-only, simpan snapshot grant dan siapkan migration additive dengan pemetaan eksplisit. Jangan memberi semua role seluruh permission diam-diam. Tambahkan UI matriks CRUD yang sama dengan enforcement API. Perubahan permission/role/assignment harus segera berlaku pada sesi aktif, refresh dan switch-user.

Uji view-only, creator, editor, deleter, operator dan tanpa grant pada seluruh method terkait; lintas company/outlet, unknown path, spoofed metadata, inactive/revoked session dan failure saat mengganti grant. Regresikan Owner/POS/Superadmin yang sudah login, termasuk onboarding, pilih outlet/user dan PIN. Buat matriks endpoint-capability serta coverage aktual.

Selesaikan source, migration, tests, build terisolasi dan rollout/rollback grant + aplikasi. Perbarui audit/rencana, laporkan hasil dan berhenti sebelum fase 3.
~~~

## Fase 3 — Lifecycle pembayaran subscription

~~~text
Kerjakan tepat fase 3 Rakku: subscription payment yang durable dan idempotent. Ikuti aturan umum NEXT_PHASE_PROMPTS.md. Periksa billing checkout, processInvoice, cron, webhook dan plan activation; proteksi pembayaran order tidak otomatis melindungi subscription.

Simpan invoice/request/attempt intent sebelum provider call. Tambahkan request identity + payload hash, unique reference dan locking agar duplicate checkout, response hilang dan retry tidak membuat tagihan/aktivasi ganda. Pertahankan invoice pada timeout/status tidak pasti. Jangan menganggap expired hanya dari jam lokal. Retry/cancel mengikuti status terminal terverifikasi sesuai kontrak; hindari lock DB selama network call panjang.

Tulis state transition pending/unknown/success/failed/confirmed expired/cancelled, late success dan exception. Verifikasi invoice/payment ID, amount, company, plan/cycle dan attempt sebelum aktivasi. Simpan aktivasi, masa berlaku, invoice dan journal terkait dalam transaction. Callback lama tidak boleh menurunkan/menimpa plan yang lebih baru; uang yang tidak bisa diterapkan masuk rekonsiliasi.

Gunakan adapter palsu dan fixture kontrak tanpa akun aktif. Uji duplicate/out-of-order callback, timeout sebelum/sesudah accepted, crash setelah intent, DB failure saat finalisasi dan pembayaran invoice lama sesudah plan berubah. Buat migration additive, kompatibilitas client/API dan rollback yang mempertahankan bukti.

Selesaikan source, regression auth/transaksi, build dan dokumen state machine/acceptance. Perbarui audit/rencana lalu berhenti sebelum fase 4. Kontrak provider yang belum terbukti tetap blocker.
~~~

## Fase 4 — Kontrak provider, event delivery dan recovery

~~~text
Lanjutkan tepat fase 4 Rakku: provider reliability. Ikuti aturan umum NEXT_PHASE_PROMPTS.md. Baca source Vessel/Echo/Silos clients, payment/subscription, webhook, cron dan dokumentasi resmi provider. Jangan memanggil layanan aktif atau mengarang dukungan cancel/refund/lookup.

Buat matriks kontrak: signature/HMAC/raw body, timestamp/replay window bila didukung, identity/amount/status, idempotency key, lookup by invoice, cancel/refund, timeout dan rate limits. Implementasikan berdasarkan bukti primer; dokumentasikan unknown. Callback unmatched harus disimpan dan dapat dipulihkan, bukan dibalas sukses lalu hilang.

Bangun durable inbox/outbox/job dengan unique event key, transaction bersama perubahan domain, lease/claim multi-worker, retry backoff+jitter, max attempts, dead-letter dan replay terkontrol. Duplicate/out-of-order delivery harus aman. Scheduler memakai cursor, pagination dan deadline agar backlog tidak berhenti di batch yang sama. Dry-run bebas side effect; correlation ID tidak mengandung secret.

Uji provider accepted lalu aplikasi crash, worker crash sebelum/sesudah commit, duplicate delivery, invalid signature/amount/identity, unmatched receipt, outage, lease expiry dan race worker. Pastikan order, stock, subscription, ledger dan email tidak digandakan. Gunakan adapter palsu dan PostgreSQL disposable terisolasi; catat tes yang belum dijalankan.

Selesaikan source/migration additive, tests dan runbook DLQ/replay/rollback tanpa menghapus backlog. Perbarui audit/rencana dan berhenti sebelum fase 5. Sandbox nyata tetap prasyarat terpisah.
~~~

## Fase 5 — Settlement, saldo dan penyelesaian exception

~~~text
Kerjakan tepat fase 5 Rakku: settlement dan payment exception. Ikuti aturan umum NEXT_PHASE_PROMPTS.md. Telusuri ledger, QRIS, fee, reconciliation, balance, withdrawal dan bukti transfer. Tulis definisi akuntansi/invariant sebelum mengubah saldo.

Pisahkan receipt/clearing, unsettled, available, withdrawal hold, fee dan liability. Duplicate receipt/late payment pada cancelled order tidak boleh masuk available balance atau hilang. Cocokkan settlement ke statement/referensi provider; timestamp lokal bukan bukti settlement. Saldo berasal dari journal immutable, seimbang dan bereferensi unik.

Tambahkan workflow investigate/associate/refund/resolution yang didukung kontrak, dengan authorization, approval, actor/reason/proof dan idempotency. Status akhir mengikuti bukti provider. Jangan edit balance/ledger/order historis, hapus exception, atau menandai refunded hanya dari klik admin. Koreksi melalui reversal journal.

Withdrawal mereservasi available balance dalam transaction. Cegah dua withdrawal memakai saldo sama; unsettled/exception funds tidak boleh ditarik. Finalisasi/rejection/reversal idempotent dan auditable. Tinjau origin, sesi dan re-auth tindakan sensitif.

Uji reconciliation berulang, fee/rounding, multi/partial settlement bila didukung, duplicate/late receipt, refund timeout, withdrawal paralel, double approval dan DB failure. Siapkan migration additive + rekonsiliasi saldo pembuka read-only tanpa menerapkan ke DB aktif. Selesaikan tests, UI/API, build dan runbook; perbarui audit/rencana lalu berhenti sebelum fase 6.
~~~

## Fase 6 — Semua command keuangan dan concurrency

~~~text
Lanjutkan tepat fase 6 Rakku: seluruh command keuangan dan operasi replace-all. Ikuti aturan umum NEXT_PHASE_PROMPTS.md. Inventarisasi mutasi purchase, expense, withdrawal, refund/void, admin/inventory adjustment, default bank, modifier, tier, recipe dan jalur keuangan lain dari source.

Tetapkan invariant, ownership/company/outlet, permission, idempotency identity+hash, unique reference, lock order dan efek ledger/stock/cost tiap command. Terapkan transaction, periksa returned error/affected rows dan rollback semua langkah terkait saat gagal. Jangan pisahkan delete-old/insert-new atau clear-default/set-default. Validasi finite numbers, precision, sign dan total server-side; nominal client bukan sumber kebenaran.

Panggilan eksternal memakai durable intent/recovery fase sebelumnya. Retry otomatis hanya untuk kegagalan transient yang aman; replay mengembalikan hasil sama, reuse ID dengan payload berbeda ditolak. Koreksi melalui reversal, bukan edit saldo/stock/paid order diam-diam.

Bangun dan jalankan harness dua koneksi PostgreSQL pada DB disposable yang terbukti terisolasi, tanpa env aktif. Uji checkout/purchase/expense/withdrawal/adjustment bersamaan, duplicate request, deadlock/retry, response hilang dan fault injection sebelum/sesudah side effect. Periksa invariant akhir lintas tabel, bukan hanya HTTP status. PGlite satu koneksi bukan bukti concurrency. Jika server belum tersedia, siapkan harness dan tandai acceptance concurrency tetap terbuka.

Selesaikan source/migration additive, daftar command + coverage, regresi auth/RBAC/tenant, build dan rollout/rollback. Perbarui audit/rencana lalu berhenti sebelum fase 7.
~~~

## Fase 7 — Reporting, HPP, receipt dan kuota

~~~text
Kerjakan tepat fase 7 Rakku: konsistensi laporan dan plan quotas. Ikuti aturan umum NEXT_PHASE_PROMPTS.md. Periksa report API/SQL, receipt, email, pricing/cart, HPP snapshot, opening stock, plan gates dan storage.

Tulis definisi gross sales, product/order discount, subtotal net/gross, tax, rounding, paid revenue, refund, fee, settlement dan profit. Subtotal sekarang net dari product discount sedangkan discount_amount mencakup product+order discount; jangan mengurangi diskon dua kali pada receipt. Rancang kompatibilitas data lama/baru dengan metadata/versioning additive bila perlu, lalu selaraskan cart, quote, receipt, report dan email.

Gunakan boundary Asia/Jakarta di query harian/bulanan dan index yang sesuai. HPP historis memakai snapshot order_item; legacy tanpa snapshot harus berlabel estimasi, bukan diisi biaya sekarang sebagai fakta historis. Opening-stock journal/valuation harus dapat direkonsiliasi tanpa mengubah histori sewenang-wenang.

Enforce report history, email/month, storage dan transaction quota di API termasuk upload/export. Kuota company lintas outlet akurat tanpa membuka data outlet terlarang. Counter/reservation usage aman terhadap request paralel, gagal kirim/upload dan replay; frontend gate saja tidak cukup.

Uji boundary WIB/day/month/leap year, discount+tax+rounding+refund, legacy, perubahan resep/cost serta quota lintas outlet/paralel. Cocokkan laporan dengan transaksi/ledger menurut definisi tertulis. Selesaikan source/migration additive, tests, build dan acceptance; perbarui audit/rencana lalu berhenti sebelum fase 8.
~~~

## Fase 8 — CI, observability, backup dan keamanan operasional

~~~text
Lanjutkan tepat fase 8 Rakku: operational readiness. Ikuti aturan umum NEXT_PHASE_PROMPTS.md. Evaluasi audit dependency terbaru, patch braces, lint warnings React Compiler, SDK Auth dan environment; jangan menyembunyikan advisory/warning tanpa alasan dan bukti.

Bangun CI reproducible: frozen lockfile, typecheck seluruh workspace+scripts, lint, unit/integration/concurrency, dependency-security regression, audit dan build terisolasi empat app. Secret sintetis dan transport eksternal diblokir. Bedakan audit mentah dari mitigasi pnpm patch; hapus patch hanya setelah upstream fixed release terverifikasi dan regresi lulus. Pertahankan supply-chain policy/minimum release age.

Tambahkan structured logs, trace/correlation IDs, error taxonomy dan metrics/alert untuk pending/unknown payment, mismatch ledger/settlement/stock, webhook/job failure, login abuse dan latency. Redact secret/PII. Siapkan retention/access controls dan cleanup sesi/rate limit/inbox/outbox tanpa menghapus bukti finansial.

Siapkan backup/PITR/restore, target RPO/RTO, migration compatibility, rollback/forward fix, incident response, credential rotation dan emergency checkout pause. Re-auth/step-up untuk bank/payout/refund/operasi admin sensitif harus mempertahankan purpose dan sesi yang benar.

Validasi lokal dengan fault injection, redaction tests dan restore harness. Jangan provisioning, rotasi secret, mengaktifkan scheduler, deploy atau mengirim alert/email nyata. Tandai restore drill, alert delivery, privilege dan platform env yang belum terverifikasi sebagai blocker. Selesaikan source/config/runbook, perbarui audit/rencana lalu berhenti sebelum fase 9.
~~~

## Fase 9 — Pilot merchant dan keputusan launch

~~~text
Kerjakan tepat fase 9 Rakku: persiapan pilot dan launch gate. Ikuti aturan umum NEXT_PHASE_PROMPTS.md. Mulai dari blocker/bukti fase 1–8 aktual. Jangan menyatakan production-ready jika environment dibagi, reconciliation tidak cocok atau acceptance penting belum dijalankan.

Siapkan acceptance akun/data sintetis di staging terisolasi: Owner anonymous/unverified/onboarding/company-ready/suspended, POS company/outlet/user/PIN/full/switch/revoked, Superadmin Auth tanpa membership/active/disabled. Uji direct URL login/register/onboarding/select-outlet/PIN, reload, Back/Forward, multi-tab, dua akun satu perangkat, logout/reset/reassignment, BFCache dan service-worker upgrade. Identitas lama tidak boleh terlihat/terpakai; transaksi offline tidak boleh seolah sukses.

Verifikasi printer 58/80mm, cash drawer, QRIS, touch/mobile dan perangkat merchant. Baseline Next16 adalah browser modern; ES2017/browserslist lama tidak membuktikan dukungan WebView lama. Catat perangkat/browser yang benar-benar diuji dan batas dukungan. Cakup cash close, split, draft completion, duplicate request, refund/void approval, timeout/late receipt, settlement/withdrawal dan beberapa siklus rekonsiliasi.

Tinjau custom domain/HTTPS/cookie/origin, Terms/Privacy/consent versioning, support/incident, onboarding merchant dan batas pilot. Pertahankan dokumen legal yang sudah ada; tandai review manusia yang dibutuhkan. Susun go/no-go berbukti, owner, blocker, rollback/stop criteria dan metrik.

Selesaikan code/test/runbook lokal yang diperlukan. Jangan membuat transaksi uang nyata, mengirim email merchant, mengubah akun aktif, menerapkan migration atau deploy. Laporkan acceptance yang benar-benar dilakukan dan prasyarat staging/perangkat/provider. Perbarui audit/rencana dan keputusan kesiapan berdasarkan bukti.
~~~
