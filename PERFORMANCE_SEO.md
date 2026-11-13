# Performa dan SEO/GEO Rakku

## Perubahan yang diterapkan

### Landing

- Origin canonical: `https://rakku.dephilia.com`, dapat diganti melalui `SITE_URL` saat build.
- `/robots.txt`, `/sitemap.xml`, canonical homepage, metadata sosial, dan `/opengraph-image` dihasilkan Next.js.
- Sitemap hanya berisi homepage yang benar-benar tersedia. Anchor seperti `#harga` bukan URL halaman baru.
- Deployment dengan `VERCEL_ENV=preview` memakai noindex dan robots yang melarang crawling.
- `SITE_INDEXABLE=false` secara eksplisit menonaktifkan indexing untuk production personal/non-production: HTML mengirim `noindex, nofollow`, sitemap kosong, dan robots tetap mengizinkan crawler membaca metadata noindex. Tanpa nilai `false`, production tetap indexable. `VERCEL_ENV=preview` tetap noindex dan memblokir crawling meskipun variabel disetel `true`.
- JSON-LD memuat Organization, WebSite, WebApplication, dan FAQPage. Jawaban schema memakai sumber yang sama dengan FAQ tampilan.
- Semua jawaban FAQ dirender server dan accordion native berfungsi tanpa JavaScript.
- Konten utama tidak disembunyikan oleh animasi awal. Animasi preview berhenti saat tidak terlihat/tab browser tidak aktif.
- Optimasi gambar Next.js aktif; `sizes` dan rasio logo diperbaiki. Gambar sumber tetap tersedia.

Structured data tidak menjamin rich result. Tidak ada rating, ulasan, identitas bisnis, atau alamat yang dibuat-buat. GEO mengandalkan konten publik yang dapat diakses, jelas, dan konsisten.

### Owner / POS

- `React.cache` membagikan validasi sesi di dalam satu server render. Ini bukan cache autentikasi lintas request; Route Handler tetap melakukan validasi untuk request baru.
- Client tenant POS dan daftar menu juga dibagikan selama server render. Pengaturan scope tenant/RLS dan guard API dipertahankan.
- Data perusahaan yang sudah divalidasi dipakai kembali oleh layout dan endpoint sesi Owner.
- Statistik outlet dan omzet dashboard dihitung di SQL; server tidak mengunduh semua produk/assignment/order untuk menjumlahkannya.
- Laporan penjualan Owner memakai endpoint `/api/owner/reports/sales?range=today&page=1`. Ringkasan dihitung atas seluruh periode, detail maksimal 50 transaksi per halaman, dengan batas waktu WIB dan batas histori paket.
- Batas histori laporan POS diterapkan dalam query SQL sebelum order diambil.
- Register POS menggunakan jumlah draft awal dari server. Pembaruan produksi meminta `count_only=1`, bukan semua draft beserta itemnya.
- Tab workspace outlet produksi memakai History API untuk state tampilan, bukan navigasi server penuh. Bagian yang tidak aktif dimuat sebagai chunk terpisah.

### Kebijakan cache browser

Katalog Owner menggunakan TanStack Query secara imperative di balik `useMerchantRequest`:

- Hanya GET produk, kategori, tier harga, harga per tier, pajak, dan diskon yang dicache.
- Masa segar 30 detik; data dibuang setelah tidak dipakai selama 5 menit.
- Cache hanya di memori milik shell autentikasi, dipisahkan dengan identitas akun/perusahaan/sesi dan URL resource/outlet.
- Respons yang gagal tidak dianggap data segar. GET serentak dibagikan tetapi masing-masing konsumen menerima Response yang dapat dibaca sendiri.
- Mutasi berhasil membatalkan GET katalog yang berjalan dan menginvalidasi cache katalog.
- Sesi, transaksi, saldo, stok, dan semua mutasi tetap melalui jaringan. Demo memakai adapter dan isolasinya sendiri.
- Preferensi sidebar dan outlet terakhir menggunakan localStorage; outlet yang tersimpan tetap divalidasi terhadap daftar akses terkini.

Cache ini tidak melakukan sinkronisasi langsung antarperangkat/origin. Checkout selalu memvalidasi harga dan hak akses di server. Revisi katalog lintas Owner–POS merupakan pekerjaan lanjutan, bukan jaminan cache saat ini.

### Superadmin

- Endpoint yang sebelumnya memanggil autentikasi dua kali kini memakai satu authenticated client per handler.
- Audit log tidak mengirim dua request awal untuk filter yang sama.
- Analytics pembayaran mengembalikan agregat SQL dan seri 14 hari dengan kalender WIB.
- Analytics langganan menghitung pendapatan dan konversi dari database, bukan hanya halaman invoice/notifikasi terbaru. Daftar invoice tetap dibatasi 200 dengan kolom yang diperlukan.

## Menguji perubahan

Tes cache tanpa database:

```powershell
pnpm test:owner-cache
```

Tes SQL menggunakan PGlite terisolasi, tanpa koneksi database aktif:

```powershell
pnpm --filter @rakku/db exec tsx --wasm-num-compilation-tasks=1 --test src/owner-dashboard.test.ts
```

Build terisolasi dan tes HTTP (jalankan berurutan, pastikan ruang disk cukup):

```powershell
pnpm build:isolated landing owner pos superadmin
$env:RAKKU_ISOLATED_BUILD = '1'
pnpm test:landing:seo
pnpm test:auth:http
```

Build default terisolasi memakai `.next-hardening`. Bila memakai `RAKKU_BUILD_DIRECTORY` lain, gunakan nilai yang sama saat menjalankan tes. Tes SEO menyalakan server pada port loopback kosong dan menghentikannya setelah selesai.

Opsional: `node scripts/test-landing-seo.mjs --browser` memeriksa tampilan 390px/1440px dan FAQ tanpa JavaScript. Membutuhkan Playwright dan Chrome; lokasi instalasi Playwright dapat diberikan lewat `PLAYWRIGHT_MODULE_PATH`. Screenshot ditulis ke direktori sementara `opencode`.

## Hasil verifikasi lokal — 31 Oktober 2026

- Build production terisolasi: Landing, Owner, POS, dan Superadmin lulus.
- Tes cache: 3 lulus.
- Tes SQL outlet/laporan/analytics: 4 lulus, termasuk batas hari WIB, isolasi perusahaan, pagination, dan total penuh lintas halaman.
- Tes HTTP guard: 32 pemeriksaan lulus dengan transport database/provider diblokir.
- Browser demo routed: 5/5 suite lulus; mencakup navigasi, mobile, dan transaksi POS yang terlihat di Owner.
- SEO HTTP dan browser tanpa JavaScript: lulus. Robots/sitemap 200, metadata canonical benar, seluruh FAQ ada dalam HTML awal.
- Contoh hasil optimizer gambar 384px: 196.950 → 7.596 byte (sekitar 96% lebih kecil). Ini ukuran satu aset, bukan klaim peningkatan kecepatan seluruh halaman.
- Lint empat app: tidak ada error; masih ada warning hooks pada kode yang sudah ada.

Saat verifikasi, disk D mencapai **0 byte kosong** dan build gagal dengan ENOSPC. Artefak build percobaan dibersihkan; verifikasi dilanjutkan dengan output sementara di disk C. Setelah seluruh artefak verifikasi dibersihkan, ruang kosong D sekitar **417 MB**. Ruang D yang sangat terbatas perlu dibereskan sebelum memakai dev/build normal. Direktori build lama milik pekerjaan lain tidak dihapus.

Pengukuran p95 request merchant dengan login/data staging serta Core Web Vitals pengguna production belum dilakukan. Waktu build terisolasi bukan ukuran TTFB merchant.

## Deploy dan indexing

1. Deploy perubahan landing ke production Vercel yang melayani `rakku.dephilia.com`.
2. Pada project Vercel pribadi (`alifdhimasctr/stocko`), set `SITE_INDEXABLE=false` di environment deployment yang digunakan dan redeploy. Ini mengirim meta robots `noindex, nofollow` dan mengosongkan sitemap. Robots mengizinkan crawler membaca metadata noindex sambil tetap melarang `/api/`.
3. Pada project Vercel production organization, set `SITE_URL=https://rakku.dephilia.com` dan `SITE_INDEXABLE=true` (atau biarkan tidak disetel). Jangan gunakan `VERCEL_ENV=preview`. `SITE_URL` memiliki default domain tersebut.
4. Pastikan `NEXT_PUBLIC_OWNER_URL` dan `NEXT_PUBLIC_POS_URL` pada production organization menunjuk domain aplikasi production.
5. Periksa respons publik `/robots.txt`, `/sitemap.xml`, canonical homepage, dan `/opengraph-image` setelah deploy.
6. Verifikasi properti Search Console. Gunakan DNS atau isi `GOOGLE_SITE_VERIFICATION` dengan token HTML-tag lalu rebuild bila memilih metode tersebut.
7. Submit `https://rakku.dephilia.com/sitemap.xml`, lakukan URL Inspection pada homepage, lalu minta indexing.
8. Pantau Page indexing, canonical yang dipilih Google, dan Performance Search Console. Gunakan PageSpeed Insights/data lapangan untuk LCP, INP, dan CLS.

Perubahan kode lokal tidak otomatis melakukan deploy atau meminta Google mengindeks.

## Pengembangan berikutnya

- Tambahkan pagination/filter server untuk daftar pesanan POS/Owner dan audit log; endpoint daftar lama masih memiliki pembacaan histori luas.
- Ukur query count, durasi auth/data, antrean pool, ukuran respons, dan p50/p95 pada data staging representatif. Cocokkan region fungsi dengan Neon sebelum mengubah ukuran pool.
- Evaluasi indeks melalui EXPLAIN; jangan menambahkan indeks duplikat hanya berdasarkan nama tabel.
- Tambahkan mekanisme revisi katalog lintas aplikasi sebelum memperpanjang masa cache.
- Bandingkan Webpack/Turbopack pada startup dan navigasi hangat secara terkontrol, termasuk kompatibilitas Serwist dan target Android POS.
- Tambahkan halaman fitur/panduan publik berkonten asli dan kontak bisnis terverifikasi untuk memperkuat pencarian organik.
