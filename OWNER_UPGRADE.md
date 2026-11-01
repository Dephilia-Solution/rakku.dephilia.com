# Owner — layout, dashboard, import, dan verifikasi

## Audit dan keputusan arsitektur

- Tidak ada `AGENTS.md` di repository saat audit. Referensi dibaca dari README, DOCS, DEMO, dan kode aktual.
- Source memakai Next.js 16.4.2, React 19.3.1, Tailwind 3, Neon/Postgres.js/Drizzle 0.45.4, Silos, dan sandbox demo browser-memory. Dokumentasi versi 14 dan empat migrasi merupakan catatan rollout lama.
- Owner adalah app tersendiri: route utamanya `/dashboard`, `/outlets`, `/reports`, `/orders`, `/subscription`, `/balance`, `/settings`. `/owner` bukan prefix production. Demo memakai `/demo/owner/*`.
- Layout sebelumnya memakai max-width/padding per halaman, lima font CSS eksternal selain next/font, dan beberapa modal/form khusus. Dashboard menyebut hari ini tetapi menghitung omzet sepanjang waktu.
- Tier UUID bersifat outlet-specific; nama/slug dapat diubah. Import lama tidak menyimpan harga tier.
- Pembelian langsung tercatat dan menambah stok, memakai biaya terakhir; bukan purchase-order/penerimaan bertahap atau weighted average.
- Import memakai private staging dan konfirmasi transaksional. Backend baru melanjutkan mekanisme tersebut; guard Owner/POS, RLS, dan layanan inventory tetap dipakai.

## UI dan layout

`OwnerShell`/`DashboardContent` menyediakan container maksimum 1400px dan gutter fluid tunggal. Root max-width halaman distandarkan; checkout tetap menggunakan mode compact yang disengaja.

Primitives kecil: `OwnerPageHeader`, `OwnerSection`, `OwnerEmpty`, `OwnerError`, `OwnerSkeleton`, dan `OwnerSheet`. Warna utama Owner `#2E7D32`; font workspace memakai next/font DM Sans tanpa CSS import lima keluarga font terpisah. Angka memakai tabular figures.

Seluruh enam tab outlet berbagi header, toolbar, panel, loading/error/retry, dan aksi 44px: Informasi, Produk, Bahan Baku, Meja, Pajak & Diskon, Staf. Pada mobile tabel utama memiliki representasi card/list. Form outlet/meja memakai sheet; footer dan isi dapat bergulir terpisah.

Sheet bersama menahan fokus, mengembalikan fokus, menghormati reduced motion, mengunci scroll bertingkat, memakai safe area dan VisualViewport untuk perubahan tinggi keyboard. Back menutup sheet teratas. Margin sidebar tidak dianimasikan ketika beralih ke mobile. Ini tetap web; verifikasi Safari/perangkat fisik diperlukan untuk perilaku keyboard/notch nyata.

Editor kategori, tier, komposisi, pajak/diskon, bahan, opname, serta pembelian menggunakan wrapper sheet Owner yang sama. Back dari editor bahan di dalam komposisi hanya menutup editor teratas, tanpa meninggalkan draft produk. Toggle memiliki area sentuh 44px tanpa memperbesar track visualnya.

Katalog membatasi render 20 produk per halaman, menunda pencarian saat mengetik, dan mengindeks rentang harga per produk sekali, bukan memfilter semua tier untuk setiap baris. Editor dan import berat dimuat dinamis. Data awal/outlet serta cache memori private tetap mengikuti identitas sesi; mutasi menginvalidasi cache terkait.

## Definisi dashboard

- Filter: hari ini, tujuh tanggal WIB terakhir termasuk hari ini, atau bulan kalender berjalan hingga hari ini; seluruh outlet atau satu outlet milik perusahaan.
- Semua interval `[start,end)` dalam WIB. Periode sebelumnya memiliki jumlah hari yang sama dan berakhir saat periode sekarang dimulai.
- Batas histori paket berlaku pada kedua periode. Pembanding yang melampaui histori/bernilai nol tidak diberi persentase palsu.
- Batas bulan kuota dan tanggal/tampilan pembelian manual Owner/POS juga memakai WIB, independen dari timezone host/browser. Kasus awal bulan dengan host UTC dan pembelian dengan browser Tokyo diuji.
- Penjualan: `total_price` order `completed`, setelah diskon termasuk pajak. Ini bukan rekonsiliasi dana diterima. Draft, pending, dan cancelled dikecualikan.
- Grafik: penjualan/jumlah transaksi harian dengan tanggal kosong bernilai nol. Fokus/tap/tanggal pilihan menyediakan rincian tanpa chart library tambahan.
- Produk terlaris: jumlah unit lalu subtotal item historis; subtotal item tidak sama dengan total setelah pajak/diskon order.
- Metode pembayaran: klasifikasi metode utama pada order, bukan alokasi split bill.
- Outlet aktif: status administratif; aktivitas transaksi adalah order selesai terakhir pada periode terpilih, bukan status online.
- Bahan menipis: snapshot bahan aktif `stock_quantity <= min_stock_alert`, mengikuti outlet, bukan periode. Tidak menjumlahkan satuan yang berbeda.
- Pembelian: `purchase_date` pada periode terpilih, hanya bila fitur `inventory_advanced` tersedia. Tidak dihitung sebagai biaya operasional/laba dalam KPI penjualan ini.

Presentasi production/demo sama. SQL production mengagregasi data dan mengembalikan seri/breakdown terbatas. Demo memakai agregator murni dengan waktu sandbox. Endpoint pembaruan: `GET /api/owner/dashboard?range=week&outlet_id=all`.

## Template produk v2

Sheet terlihat: `Produk`, `Komposisi`. Lima kolom produk lama tetap dipertahankan:

```text
kode_produk,nama,kategori,harga,deskripsi,harga_tier:<slug>,...,gambar
```

Tier aktif diambil dari outlet saat unduhan. Sheet very-hidden `_rakku_import` berisi schema 2, domain, company/outlet UUID, serta `{id,name,slug,header}` setiap tier. Mapping diverifikasi saat validate **dan confirm**. Rename, slug berubah, tier dihapus/diganti/ditambah/nonaktif membuat template stale; urutan tampilan saja boleh berubah. Tidak membuat tier otomatis.

- Harga numerik nonnegatif, maksimal dua desimal; nol berarti harga nol eksplisit.
- Sel tier kosong mempertahankan override existing; produk/tier tanpa override memakai harga dasar.
- Harga tier lain/inaktif tidak terhapus karena hanya harga yang disuplai digabungkan ke set existing.
- Template v1 tetap didukung dengan perilaku base-price lama.
- `Komposisi`: `kode_produk,kode_bahan,jumlah_per_porsi`. Bahan harus sudah tersedia/aktif pada outlet; tidak menggunakan UUID database sebagai input bisnis.
- Struktur sheet yang salah memblokir workbook. Workbook linked/v2 dengan error tidak disimpan parsial.

UI import memakai satu alur template → file → preview, dengan aturan format di bagian yang dapat dibuka. Ringkasan menonjolkan hitungan yang relevan dan hanya menampilkan informasi teknis saat detail dibuka. Produk dikelompokkan bersama komposisi di bawah nama produk; pembelian dikelompokkan bersama item; bahan/karyawan tampil per record. Preview menandai baru/update/skip dan baris yang perlu ditinjau, sedangkan nilai lengkap, tier, mapping gambar, dan peringatan tersedia per record. Kategori baru memerlukan persetujuan eksplisit. Preview dipaginasi; error CSV meng-escape formula dan menghapus PIN/hash secara rekursif.

Sebelum unggah, browser memeriksa signature XLSX, nama/urutan sheet/header, formula, kode duplikat/bentuk dasar, field wajib, angka dan presisi, satuan, tanggal, serta batas baris. Masalah ditampilkan dengan sheet/baris/kolom dan file tidak dikirim. Validasi server tetap otoritatif untuk referensi database, konflik, kuota, tier, gambar, akses, dan konfirmasi. Route validate memfilter lookup produk/bahan/pembelian ke referensi yang dipakai workbook dan tidak menunggu penghapusan Silos sebelum merespons. Jika masih ada 500, respons dan structured log memuat ID laporan serta fase kegagalan (auth, body, parse, lookup, image processing, stage, atau response).

## Excel + ZIP gambar

Pilih XLSX dan ZIP gambar terpisah sebelum validasi. `gambar` menunjuk nama/path relatif dalam ZIP, misalnya `foto/PRD001.jpg`. Path komputer dan URL remote tidak dipakai.

| Batas | Nilai |
|---|---|
| XLSX | 2 MiB; produk/bahan 500, karyawan 100, komposisi 2000 baris |
| ZIP gambar | 3 MiB; total XLSX + ZIP 4 MiB, overhead multipart dibatasi 256 KiB |
| Arsip gambar | 120 entri / 100 file; total ekstraksi 32 MiB; rasio maksimal 100:1 |
| Gambar sumber | JPG/PNG/WebP, 2 MiB, satu frame, 8192px per sisi / 16 juta piksel |
| Gambar hasil | WebP kualitas 80, fit-inside 800×800, auto-orientasi, tanpa upscaling/crop/EXIF |
| Pemrosesan/upload | 2 worker; maksimal 12 MiB hasil gambar per batch |
| Staging perusahaan | 10 preview aktif; 32 MiB gambar belum attached/selesai cleanup |
| Validasi | 10 percobaan per Owner per 10 menit pada server |

Batas body sengaja diatur untuk menjaga request upload tetap ringan dan di bawah limit umum hosting Vercel. File yang lebih besar dipecah menjadi beberapa batch, bukan dikirim sebagai ZIP besar.

ZIP menolak traversal, path OS, symlink, enkripsi, nested archive, duplicate normalized paths, ZIP64, header/range yang tidak konsisten, CRC gagal, dan output dekompresi berlebih. XLSX juga diperiksa sebagai ZIP sebelum SheetJS membaca XML: entry/total/aktual inflation dibatasi, objek eksternal/macro/entity ditolak.

Server memakai Sharp; gagal decode menolak file, tanpa fallback raw bytes. Provider upload dilakukan di luar transaksi DB. Byte WebP privat dan provider ID distaging dengan lease, hash, expiry, dan state; konfirmasi memasang relasi produk/gambar secara atomik. Retry memakai ID yang sudah tersimpan, dan intent cleanup dapat diulang tanpa menyentuh gambar attached.

Preview kedaluwarsa setelah 24 jam. Cleanup tersedia di `POST /api/owner/import/cleanup` serta cron terproteksi `GET /api/cron/import-cleanup` (01:30 UTC/hari di vercel.json). Cron membatasi company/budget waktu per panggilan dan memerlukan `CRON_SECRET` saat deployment. Validasi tidak menjalankan penghapusan Silos. Konfirmasi dapat menjalankan cleanup expired secara oportunistik sebelum memproses batch; cron tetap menangani sisa pekerjaan.

## Import pembelian

Template terpisah pada tab Bahan Baku → Pembelian → Import Pembelian:

```text
Pembelian: kode_pembelian,tanggal,pemasok,catatan
Detail Pembelian: kode_pembelian,kode_bahan,jumlah,satuan,biaya_per_satuan(Rp)
```

Contoh (ganti kode bahan/satuan dengan master outlet):

| kode_pembelian | tanggal | pemasok | catatan |
|---|---|---|---|
| BELI-20261101-01 | 2026-11-01 | Pemasok Bahan | Restock awal bulan |

| kode_pembelian | kode_bahan | jumlah | satuan | biaya_per_satuan(Rp) |
|---|---|---:|---|---:|
| BELI-20261101-01 | BHN001 | 1000 | gram | 120 |
| BELI-20261101-01 | BHN002 | 2000 | ml | 25 |

- Tanggal berupa teks kalender `YYYY-MM-DD`, disimpan 00:00 WIB; bukan formula/serial Excel.
- Maksimal 100 header, 10.000 detail, 1–100 bahan aktif berbeda per header. Unit harus sama, tanpa konversi.
- Supplier adalah teks sesuai model aktual, bukan entitas supplier baru; pajak/diskon pembelian tidak ditambahkan karena belum didukung layanan pembelian.
- `inventory_advanced` diperiksa di template, validation, dan confirmation. Owner/outlet/bahan dan kuota sumber terkait tetap divalidasi server.
- Konfirmasi memanggil `recordPurchase` yang sama melalui transaksi staging. Header/item, penambahan stok, biaya terakhir, stock movements, actor Owner dan receipt referensi commit bersama atau rollback seluruh workbook.
- Identitas `(company,outlet,kode_pembelian)` plus hash payload mencegah restock ganda saat file diunggah sebagai batch baru. Payload identik dilewati; referensi sama dengan isi berbeda ditolak.
- Urutan header menentukan urutan proses; pembelian baru terakhir menentukan biaya terakhir, termasuk jika tanggalnya lebih awal. Replayed purchase tidak mengubah biaya.
- Ini append-only, bukan edit pembelian historis. Ingredient master update tetap mempertahankan stok aktual; opening stock hanya untuk bahan baru.

## API dan file utama

- `apps/owner/src/components/layout/{OwnerShell,DashboardContent}.tsx`, `app/globals.css`, `tailwind.config.ts`: fondasi seluruh halaman.
- `components/ui/OwnerPrimitives.tsx`, `OwnerSheet.tsx`; `packages/ui/src/SlideOver.tsx`; `hooks/useModalHistory.ts`: state dan interaksi sheet.
- `components/owner/OwnerDashboardView.tsx`, production/demo dashboard pages, `api/owner/dashboard/route.ts`, `lib/owner-data.ts`.
- `packages/shared-types/src/owner-dashboard.ts`, `packages/db/src/owner-dashboard.ts`, `packages/demo/src/runtime/owner-dashboard.ts`: kontrak/metrik.
- Seluruh `components/outlet/Outlet*Section.tsx`, hub/workspace, `ImportExcelPanel.tsx`, `ImportHistory.tsx`.
- `lib/import/{import-excel,import-spec,workbook-archive,import-images,import-http,import-assets,demo-import}.ts`.
- `api/owner/import/{template,validate,confirm,batches,cleanup}/route.ts`, `api/owner/products/upload/route.ts`, `api/cron/import-cleanup/route.ts`.
- `packages/db/src/imports.ts`, `migrations/0019_comprehensive_imports.sql`, dan Silos client.
- `packages/demo/src/import-{models,engine,images}.ts`, `runtime/import.ts`, `DemoProvider.tsx`: simulator generasi-lokal.
- Test unit/PGlite, `packages/demo/e2e/owner-upgrade.mjs`, runner/isolation helper, `scripts/test-auth-http.mjs`, serta CI.

## Migrasi dan rollout

`0019_comprehensive_imports.sql` **belum dijalankan pada database aktif**. Ia memperluas domain/check dan kolom staging, menyimpan hasil konfirmasi/warnings/expiry/actor, serta menambahkan private asset staging dan purchase-reference receipts dengan FORCE RLS platform-only.

1. Verifikasi target staging dan checksum/status migrasi sampai 0018. 0017/0018 yang sudah ada tidak ditimpa/diubah oleh peningkatan ini. Endpoint validate mengembalikan `IMPORT_SCHEMA_NOT_READY`/503 dengan request ID jika kolom atau tabel migrasi belum ada, bukan menyamarkan mismatch schema sebagai 500 generik.
2. Review backup/lock/kompatibilitas dan terapkan 0019 di staging sebelum memakai endpoint import baru.
3. Jalankan acceptance terautentikasi dengan Silos sandbox, termasuk upload/delete failure, lalu deploy Owner dengan schema yang sudah siap.
4. Pastikan runtime role mendapat grant private-table yang dicerminkan migrasi, serta Silos upload/delete dan `CRON_SECRET` terkonfigurasi.
5. Batch lama tanpa `confirmation_result` memakai fallback replay legacy; batch baru menyimpan rincian hasil asli.

## Pengujian dan batas verifikasi

```powershell
pnpm test:owner-import
pnpm test:owner-cache
pnpm test:reporting-dates
pnpm test:db
pnpm test:demo
pnpm typecheck
pnpm lint
pnpm build:isolated owner pos superadmin landing
```

Browser memakai existing isolated builds dan Playwright/Chrome eksternal:

```powershell
$env:RAKKU_BUILD_DIRECTORY = '.next-hardening'
$env:DEMO_OWNER_URL = 'http://localhost:3520'
$env:DEMO_POS_URL = 'http://localhost:3521'
node packages/demo/e2e/run-production.mjs --owner-upgrade --isolated-build
```

Dataset/unit: 123 DB/PGlite tests, 100 demo tests, 22 parser/archive/image/provider-mock tests, 3 cache tests, 3 network-policy tests, dan 1 tes format tanggal lintas timezone lulus. Build terisolasi empat app lulus. Browser mencakup matriks 360/375/390/430/768/1024/1440/1920, filter dashboard, form sheet/fokus/Back bertingkat, tanggal pembelian dari browser Tokyo, pagination katalog setelah import 21 produk, gambar ZIP, dan pembelian beberapa transaksi. Artifact/screenshot ditulis runner ke folder temporary `opencode/rakku-owner-upgrade-*`.

Verifikasi akhir: **8/8 suite upgrade Owner**, **5/5 suite regresi routed Owner/POS**, **40 pemeriksaan HTTP guard**, dan **19/19 package typecheck** lulus. Lint workspace lulus tanpa error; warning hooks pada pola existing masih dilaporkan. Build POS memiliki warning cache Webpack pada dynamic import esbuild dalam konfigurasi Serwist, tanpa kegagalan build.

Bukti akhir lokal: `C:\Users\alifd\AppData\Local\Temp\opencode\rakku-owner-upgrade-vNXmyU` berisi dashboard desktop/mobile, katalog mobile, inventori desktop, hasil import produk/gambar dan pembelian, serta sheet iPhone 13/Pixel 7/iPad Mini. Screenshot memakai viewport yang terlihat dengan transisi selesai; pemeriksaan geometrinya juga memastikan konten tidak tertutup sidebar. `results.json` mencatat hasil suite.

PGlite/mock provider dan demo bukan bukti deploy/Neon/Silos production. Belum ada pengukuran EXPLAIN/p95 database aktif, concurrency dua koneksi untuk import, browser Safari/iOS fisik, maupun kapasitas hosting pada import maksimum. Emulasi sentuh Chromium dan pengujian viewport dilaporkan terpisah dari perangkat nyata.

Silos belum memiliki kontrak upload idempotency-key. Crash/timeout ambigu setelah remote success sebelum provider ID diterima masih dapat meninggalkan orphan yang tidak teridentifikasi. Cleanup terjadwal mengurus ID yang sudah tercatat; accounting storage seluruh aset lama dan garbage collection gambar lama yang pernah attached masih memerlukan audit lanjutan.
