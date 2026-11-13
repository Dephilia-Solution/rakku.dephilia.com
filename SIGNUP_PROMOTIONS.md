# Promo Pendaftaran — Pro gratis 3 bulan

## Aturan

- Pengguna baru mendapat paket **Pro gratis 3 bulan kalender sejak akun Owner didaftarkan**, jika campaign aktif dan tanggal pendaftarannya termasuk periode promo WIB.
- Default campaign **Promo Pengguna Baru 2026** berakhir **31 Desember 2026, sepanjang hari WIB**. Tanggal mulai default adalah tanggal penerapan migrasi/seed dalam WIB.
- Contoh: daftar **31 Desember 2026 pukul 23.59 WIB → akhir akses 31 Maret 2027 pukul 23.59 WIB**. Pendaftaran mulai 1 Januari 2027 tidak mendapat campaign ini.
- Jika tanggal asal tidak tersedia di bulan tujuan, akhir bulan di-clamp: 30 November + 3 bulan → 28 Februari; tahun kabisat diperhitungkan. Ini bukan 90 hari.
- Hak dicadangkan saat pendaftaran akun. Verifikasi email atau onboarding pada Januari tidak membatalkan hak Desember, dan tidak memulai ulang hitungan tiga bulan.
- Penutupan/edit campaign tidak memotong hak yang sudah diberikan. Jika onboarding baru selesai setelah haknya kedaluwarsa, pengguna masuk Free; tiga bulan tidak dimulai ulang.
- Pendaftar tanpa promo masuk paket Free. Akun existing dan trial 14 hari yang sudah berjalan **tidak diperpanjang atau diubah otomatis**. Owner lama yang belum menyelesaikan onboarding tidak diberi campaign secara retroaktif.
- Paket berbayar yang sudah aktif tidak ditimpa saat pemberian ulang/retry. Saat akses gratis berakhir, resolver memakai Free tanpa menghapus data.

## Wadah input promo

Buka **Superadmin → Promo Pendaftaran** (`/promotions`).

Field: nama promo, paket premium aktif, durasi **1–24 bulan kalender**, tanggal mulai dan akhir pendaftaran (WIB, inklusif), S&K, serta toggle aktif. Preview menghitung contoh tanggal daftar → tanggal akhir hak. Default contoh 31 Desember 2026 → 31 Maret 2027 untuk 3 bulan.

- Daftar campaign menunjukkan status Nonaktif/Terjadwal/Aktif/Berakhir dan jumlah penerima.
- Detail menampilkan hingga 100 penerima terbaru beserta tanggal hak masing-masing dan 30 riwayat perubahan terbaru.
- Edit/nonaktif hanya berlaku untuk pendaftaran berikutnya. Penerima lama memakai snapshot yang tersimpan.
- Dua promo aktif dengan rentang tanggal bertabrakan ditolak database, termasuk dua permintaan bersamaan.
- Pengeditan memakai revision; data yang berubah sejak form dibuka menghasilkan HTTP 409 dan pilihan untuk meninjau revisi terbaru.
- Tidak tersedia hard-delete campaign. Nonaktifkan melalui Edit supaya riwayat penerima tetap ada.

## Implementasi

| Area | File |
| --- | --- |
| Skema / seed awal | `packages/db/migrations/0020_signup_promotions.sql` |
| Service campaign, reservasi, penerapan | `packages/db/src/signup-promotions.ts` |
| Tipe dan helper kalender WIB | `packages/shared-types/src/signup-promotions.ts` |
| Pendaftaran / onboarding transaksional | `apps/owner/src/lib/supabase/queries.owner.ts` |
| API Superadmin | `apps/superadmin/src/app/api/superadmin/promotions/route.ts` |
| UI Superadmin | `apps/superadmin/src/app/(protected)/promotions/page.tsx` |
| API informasi publik | `apps/owner/src/app/api/public/signup-promotion/route.ts` |
| Notice bersama | `packages/ui/src/SignupPromotionNotice.tsx` |

Tiga tabel private: `signup_promotions` untuk konfigurasi, `signup_promotion_enrollments` untuk keputusan/snapshot per Owner, dan `signup_promotions_audit` untuk before/after konfigurasi beserta actor Superadmin. Tabel memakai FORCE RLS, platform-only; endpoint publik hanya mengeluarkan whitelist informasi campaign, tidak identitas penerima.

Pendaftaran Owner dan reservasi dilakukan dalam **transaksi yang sama**. Bahkan keputusan tanpa promo disimpan agar retry tidak mendapat campaign yang baru diaktifkan belakangan. Onboarding membaca reservasi tersebut sambil mengunci Owner/perusahaan; tidak menghitung ulang berdasarkan deadline campaign. Trigger menolak perubahan snapshot/tanggal hak yang telah diberikan.

API pengelolaan membutuhkan Superadmin aktif dan pemeriksaan origin existing. `GET /api/public/signup-promotion` adalah read-only, `Cache-Control: no-store`, dan CORS publik untuk landing yang dideploy terpisah. Notice menggunakan waktu server + clock monotonic, memeriksa deadline, dan refresh saat fokus/kembali ke tab. Respons unavailable tidak menampilkan janji promo palsu.

Email onboarding menyebut paket/durasi/tanggal akhir yang benar-benar diberikan; pengguna tanpa hak aktif menerima sambutan Free. Banner/halaman Langganan memakai tanggal individu dalam WIB. Email kedaluwarsa tidak lagi mengasumsikan durasi 14 hari. Cron trial memakai compare-and-set status/tanggal supaya snapshot batch lama tidak menurunkan paket yang sudah dibayar/diperpanjang.

## Rollout

**Migrasi belum dijalankan pada database online oleh sesi coding ini.** Jangan deploy endpoint pendaftaran baru sebelum skema siap: skema yang belum tersedia menghasilkan `PROMOTION_SCHEMA_NOT_READY`/503 dan transaksi signup dibatalkan, sehingga pengguna tidak kehilangan bonus diam-diam.

1. Pada target deployment yang sesuai, terapkan migrasi melalui mekanisme existing:

   ```powershell
   pnpm db:migrate
   ```

   Runner menerapkan seluruh migrasi tertunda berurutan dan memeriksa checksum. `0020` mengikuti `0019`; pada instalasi yang masih sebelum `0019`, perhatikan juga kebutuhan rollout import di `OWNER_UPGRADE.md`. Migrasi tidak mengubah Owner/perusahaan existing.

2. Migrasi membuat campaign default jika paket Pro aktif sudah ada dan tanggal WIB belum melewati 31 Desember 2026. Untuk instalasi baru yang plans-nya belum di-seed:

   ```powershell
   pnpm db:seed
   ```

   Seed default idempotent; pengaturan campaign yang sudah diedit/dinonaktifkan admin tidak direset. Setelah 2026, default campaign kedaluwarsa tidak dibuat/diaktifkan otomatis.

3. Deploy Owner, Superadmin dan Landing. URL Owner pada landing tetap memakai `NEXT_PUBLIC_OWNER_URL` existing.
4. Periksa **Promo Pendaftaran**: Pro, durasi 3, tanggal mulai rollout, akhir `2026-12-31`, aktif, dan S&K. Uji signup/onboarding memakai akun pengujian pada environment tersebut.

## Pengujian lokal

```powershell
pnpm test:db
pnpm --filter @rakku/owner typecheck
pnpm --filter @rakku/superadmin typecheck
pnpm --filter @rakku/landing typecheck
pnpm typecheck:scripts
pnpm build:isolated owner pos superadmin landing
```

Suite baru di `packages/db/src/signup-promotions.test.ts` memakai PostgreSQL in-memory (PGlite), tanpa membaca env atau menyentuh Neon. Mencakup batas WIB, akhir bulan/tahun kabisat, signup 31 Desember, onboarding Januari, penutupan/edit promo, keputusan tanpa promo, akun lama, masa akses individual melalui resolver plan asli, upgrade berbayar, retry, rollback, revision/overlap, snapshot immutable, default seed dan RLS.

Pengujian autentikasi HTTP menambahkan guard GET/POST/PUT promo dan halaman protected. Build isolated memakai database/provider loopback yang diblokir; hasil lokal ini bukan klaim migrasi/deploy online sudah dilakukan.

### Hasil sesi implementasi

- **135 tes DB/PGlite lulus**, termasuk 12 tes promo yang baru.
- Typecheck DB, Owner, Superadmin, Landing dan scripts lulus.
- Lint Owner/Superadmin/Landing lulus tanpa error; warning hook existing masih ada. Halaman promo baru lulus lint tersendiri tanpa warning.
- Build production terisolasi **empat app lulus** di `.next-hardening-promotions`. Landing sempat mengalami kegagalan unduhan Google Fonts; retry berhasil tanpa perubahan font aplikasi.
- **44 pemeriksaan HTTP guard lulus**, termasuk GET/POST/PUT promo serta redirect halaman protected.
- **10 pemeriksaan browser** pada halaman register dan pricing asli, lebar 390/1440px: informasi promo, tombol register terjangkau, tidak ada horizontal overflow, cutoff WIB otomatis menyembunyikan promo, respons tanpa promo/unavailable, dan fetch notice lintas origin. Data promo pada browser dimock; DB/provider tetap diblokir dan tidak ada signup yang dikirim.
- Artefak browser lokal: `C:\Users\alifd\AppData\Local\Temp\opencode\rakku-signup-promo-2nVKLF`.

Untuk menjalankan ulang pemeriksaan browser dengan Playwright eksternal:

```powershell
$env:RAKKU_BUILD_DIRECTORY = '.next-hardening-promotions'
$env:PLAYWRIGHT_MODULE_PATH = '<folder-tools-yang-memiliki-node_modules-playwright>'
node scripts/test-signup-promotion-browser.mjs
```

Belum ada verifikasi login Superadmin positif atau signup/email pada environment online; keduanya mengikuti rollout migrasi di atas. Tidak ada dependency production baru. Lockfile root yang sudah dimodifikasi sebelumnya tersinkronisasi oleh tooling pnpm terhadap workspace yang ada; perubahan pengguna sebelumnya tetap dipertahankan.
