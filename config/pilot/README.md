# Pilot merchant dan launch gate

17 Oktober 2026. **Keputusan saat ini: NO-GO untuk public launch.** Dokumen ini
adalah acceptance plan dan template bukti; tidak ada akun staging, transaksi uang
nyata, email merchant, printer, QRIS sandbox atau deployment yang dijalankan.

## Pilot scope

- Satu cafe pilot, satu company, 1–2 outlet, data sintetis/staging terisolasi.
- Uang nyata tidak boleh dipakai sampai provider contract, settlement dan refund
  disetujui pemilik + partner pembayaran.
- Volume awal dibatasi; hentikan ekspansi bila mismatch payment/ledger/stock.
- Support channel, on-call owner dan rollback/stop criteria harus disetujui
  sebelum pilot.

## Account/data acceptance matrix

| Area | State yang wajib diuji |
|---|---|
| Owner | anonymous, email unverified, verified tanpa company, onboarding, company-ready, suspended/inactive |
| POS | anonymous, pending company, outlet terpilih, user asing/tidak ditugaskan, inactive/locked, PIN salah/benar, full session, switch-user, revoked |
| Superadmin | tanpa Auth, Auth valid tanpa membership, invitation salah/expired/terpakai, active, disabled |

Untuk setiap state: direct URL, reload, Back/Forward, dua tab, BFCache, logout,
reset password, reassignment, PWA service-worker upgrade, dua akun pada satu
perangkat. Identitas/sesi lama tidak boleh terlihat atau dipakai. Offline tidak
boleh terlihat seperti transaksi sukses.

## Merchant flow acceptance

- Cash checkout, split payment, manual QRIS, dynamic QRIS.
- Draft create/edit/complete/delete; duplicate request; response hilang;
  timeout/late receipt; provider-confirmed expired/cancelled; cancel/retry.
- Purchase, expense, stock adjustment/opname, recipe/cost changes; invariant
  stock/movement/HPP.
- Withdrawal: minimum, limit harian, hold, approval, reject, double approval,
  parallel request, bukti transfer.
- Settlement: statement cocok, selisih, duplicate/overlapping statement,
  beberapa siklus settlement, opening balance review.
- Refund/void approval dan cash close shift **belum tersedia** sebagai workflow
  lengkap; jangan mengklaim lulus sampai diimplementasikan dan diuji.
- Receipt 58mm/80mm, tax/discount/rounding, print preview dan reprint.
- Report harian/bulanan WIB, HPP snapshot/estimated legacy, email report quota.
- Quota transaksi/email/storage dan cross-outlet isolation.

## Device/browser matrix

Baseline rilis: Chrome/Edge/Firefox 111+, Safari 16.4+. Next 16 tidak menjamin
Android WebView lama; `browserslist` Android 8/Chrome 62 pada POS tidak
membuktikan kompatibilitas perangkat. Isi tabel berikut dengan perangkat nyata:

| Perangkat/OS | Browser | Layar | Printer | Cash drawer | Touch | Hasil |
|---|---|---|---|---|---|---|
| _(belum diuji)_ | | | | | | |

Wajib dicoba minimal: Android tablet/HP umum, iPhone Safari, desktop Chrome,
printer thermal 58mm dan 80mm, cash drawer bila didukung, QRIS scan dari
bank/e-wallet, kondisi jaringan lambat/putus, dan dua akun pada satu perangkat.

## Custom domain, legal dan support

- Custom domain/HTTPS/cookie/origin/callback harus diverifikasi di staging;
  cookie Secure/HttpOnly/SameSite dan allowed origins harus cocok.
- Terms/Privacy sudah ada sebagai dokumen di repo, tetapi **belum review legal
  manusia**. Versi/consent/retention dan kewajiban PDP/PSE harus disetujui.
- Support/incident: kanal, jam layanan, severity, on-call, status page,
  komunikasi merchant, dan batas pilot harus ditetapkan.
- Onboarding merchant: checklist data, rekening, pajak, printer, QR menu,
  pelatihan kasir dan nomor eskalasi.

## Go/no-go template

| Field | Nilai |
|---|---|
| Tanggal keputusan | |
| Decision owner | |
| Pilot merchant/outlet | |
| Evidence staging | |
| Provider/settlement status | |
| Device acceptance | |
| Legal/consent review | |
| Support/on-call | |
| Blocker terbuka | |
| Rollback/stop owner | |
| Keputusan | NO-GO sampai seluruh blocker ditutup |

Stop criteria: mismatch ledger/settlement/stock, dead-letter terus bertambah,
payment unknown tanpa rekonsiliasi, kebocoran lintas tenant, error auth tinggi,
printer/QRIS gagal pada perangkat pilot, atau environment terbukti dibagi.

Rollback/stop: pause checkout (`pnpm ops:checkout-pause -- --enable`), hentikan
worker/approval pencairan, pertahankan inbox/DLQ/ledger, komunikasikan ke
merchant, forward-fix, replay job yang ditinjau, dan jangan menghapus evidence.

## Current blockers (evidence-based)

- Environment isolation fase 1 dan provider contract/sandbox belum selesai.
- RBAC, subscription, inbox/job, settlement dan laporan belum menjalani
  acceptance staging/browser nyata.
- Two-connection PostgreSQL harness belum dijalankan; restore/PITR/alert
  delivery belum diuji.
- Refund/void approval, cash close, step-up/re-auth dan storage quota penuh
  belum lengkap.
- Printer 58/80mm, cash drawer, QRIS perangkat, custom domain dan legal review
  belum diverifikasi.
- **Public launch tidak boleh dinyatakan siap berdasarkan demo, PGlite, build
  atau dokumen ini.**

## Metrics dan review

Pantau checkout success/latency, payment pending/unknown, settlement discrepancy,
dead-letter job, exception unresolved, ledger/stock mismatch, failed login/PIN,
email/report latency dan support tickets. Review harian selama pilot; ekspansi
hanya setelah minimal beberapa siklus settlement dan rekonsiliasi cocok.
