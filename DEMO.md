# Demo publik Rakku POS

## Route dan penggunaan

Jalankan aplikasi Owner dengan `pnpm dev:owner`, lalu buka `http://localhost:3000/demo`.

Demo mengikuti route aplikasi asli dengan prefix aplikasi:

| Aplikasi | Route contoh |
|---|---|
| Entry | `/demo` |
| Owner | `/demo/owner/dashboard`, `/demo/owner/outlets`, `/demo/owner/employees` |
| Produk Owner | `/demo/owner/products`, `/demo/owner/products/add?outlet=...`, `/demo/owner/products/[id]/edit` |
| Owner lainnya | `/demo/owner/orders`, `/demo/owner/reports`, `/demo/owner/tax-discounts`, `/demo/owner/tables`, `/demo/owner/settings` |
| Billing Owner | `/demo/owner/subscription`, `/demo/owner/subscription/checkout/[invoiceId]`, `/demo/owner/balance` |
| Login POS | `/demo/pos/login/select-outlet`, `/demo/pos/login/select-user`, `/demo/pos/login/enter-pin?user_id=...` |
| POS | `/demo/pos/register`, `/demo/pos/products`, `/demo/pos/orders`, `/demo/pos/reports` |
| Inventory POS | `/demo/pos/ingredients`, `/demo/pos/purchases`, `/demo/pos/expenses` beserta route add/edit yang tersedia |
| Konfigurasi POS | `/demo/pos/tables`, `/demo/pos/tax-discounts` |
| Invoice | `/demo/owner/orders/[id]/invoice`, `/demo/pos/orders/[id]/invoice` |
| Menu publik | `/demo/menu/pusat`, `/demo/menu/taman` |

`/demo?mode=pos` tetap mengarahkan ke pemilihan outlet. `/demo/pos/admin/products/...` adalah redirect kompatibilitas menuju `/demo/pos/products/...`.

Pengunjung tidak perlu mendaftar atau memakai akun Neon. Owner terbuka sebagai simulator Owner; POS mempertahankan pemilihan outlet, karyawan, dan PIN. Direct link ke halaman merchant POS tanpa kasir aktif diarahkan ke pemilihan outlet.

Penanda harian cukup badge **Demo** dan tombol **Opsi demo**. Menu opsi berisi Buka Owner/Kasir, pilih outlet/kasir, Reset Demo, panduan singkat, dan Keluar Demo. Penjelasan panjang tidak memenuhi area kerja. Label simulasi tetap terlihat pada pembayaran dan operasi eksternal.

## Identitas dan fixture

Company **Rakku Demo Cafe** (`DEMO_CAFE`), Owner **Owner Demo Rakku**, email `owner@rakku.invalid`, password company contoh `DemoCafe2026!`.

| Outlet | Alamat fiktif | Karyawan dan PIN awal |
|---|---|---|
| Rakku Demo Cafe — Pusat | Jl. Contoh Raya No. 10 | Rani / `rani_pusat` / Manager Outlet / `111111`; Bima / `bima_pusat` / Kasir / `222222` |
| Rakku Demo Cafe — Taman | Jl. Contoh Taman No. 25 | Dita / `dita_taman` / Manager Outlet / `333333`; Raka / `raka_taman` / Kasir / `444444` |

Owner tidak dihitung dalam empat karyawan. Assignment awal hanya ke outlet masing-masing. Manager mempunyai sembilan menu POS; Kasir memiliki Register, Orders, Reports, Tax & Discounts. Role, menu-level `can_view`, PIN, status, assignment dan opsi all-outlets dapat dicoba melalui komponen karyawan asli.

Setiap outlet mempunyai sepuluh produk, tiga kategori, empat tier, 15 bahan, delapan meja, 60 order completed dalam 30 hari, dua draft, satu pending QRIS, satu cancelled, empat pembelian multi-item, enam pengeluaran, dua opname. Produk: Espresso, Americano, Cappuccino, Caffe Latte, Kopi Susu Gula Aren, Matcha Latte, Chocolate Latte, Lemon Tea, Butter Croissant, French Fries. Harga/BOM/unit menggunakan `packages/demo/src/fixture.ts`.

Opening stock dihitung dari saldo target dikurangi seluruh movement lain, bukan ditambal dengan movement duplikat. Pusat Matcha 150 g dan Taman Croissant 6 pcs mulai dengan alert menipis. Dua Kopi Susu Gula Aren memotong kopi 36 g, susu 300 ml, aren 50 ml, air 60 ml, es 200 g pada satu outlet.

Pajak Demo 10% aktif, Service Demo Rp1.000 nonaktif, diskon Matcha 10% aktif, Promo Demo Rp5.000 nonaktif, dan satu promo lampau. Business aktif satu bulan kalender dari waktu membuka sesi. Riwayat QRIS membentuk saldo/ledger serta contoh withdrawal completed/rejected/requested. Seluruh identitas/supplier/rekening adalah fiktif. Clock memakai kalender `Asia/Jakarta`; fixture deterministik untuk clock yang sama.

## Arsitektur

```text
apps/owner/src/app/demo/layout.tsx           metadata + CSS POS yang diperlukan
  ├─ (sandbox)/layout.tsx                   DemoProvider bersama
  │    ├─ page.tsx                          entry /demo
  │    ├─ owner/layout.tsx                  DemoArea + OwnerShell asli
  │    │    └─ route/page.tsx                komponen Owner asli + projection sandbox
  │    └─ pos/layout.tsx                    DemoArea
  │         ├─ login/...                    komponen login POS asli
  │         └─ (merchant)/layout.tsx         PosShell asli + guard
  │              └─ route/page.tsx           komponen POS asli + projection sandbox
  └─ menu/[slug]/page.tsx                   fixture baru + PublicMenuView POS asli
```

Provider pada route group `(sandbox)` tetap mounted saat Next soft navigation antarfitur dan Owner/POS. **Halaman mempunyai bundle sendiri**, bukan satu switch komponen besar yang mengimpor seluruh fitur. Query, add/edit, invoice, tombol back/forward, URL langsung, serta active sidebar memakai Next App Router sesungguhnya.

Komponen merchant tidak diduplikasi:

- `OwnerShell` dan `PosShell` dipakai oleh layout production maupun demo.
- Dashboard production dan demo memakai `OwnerDashboardView` yang sama.
- Halaman client outlet/karyawan/settings dan empat langkah login POS dipindah menjadi komponen; route asli dan demo sama-sama mengimpornya.
- Produk, laporan, pesanan, ingredient, purchase, expense, tax/discount, invoice, subscription dan balance merender client existing langsung.
- Menu publik production/demo memakai `apps/pos/src/components/menu/PublicMenuView.tsx` yang sama.

### Boundary data dan navigasi

`packages/ui/src/merchant-runtime.tsx` adalah context client netral. Default di luar provider tetap menggunakan fetch/router/toast asli. Demo memberikan local request adapter, logical pathname tanpa prefix untuk active menu, href berprefix `/demo/{owner|pos}`, serta store/gambar scoped.

`packages/demo/src/runtime/request.ts` memetakan kontrak API actual ke engine lokal, memeriksa app/permission/outlet/resource, dan menghasilkan error bila URL/konteks tidak valid. Tidak ada monkey-patch fetch, fallback API nyata, atau flag `isDemo=true` yang memberi hak platform. Callback/request dan pembacaan JSON setelah sandbox berakhir ditolak.

Form logout/switch-user terikat lewat `MerchantForm`; tidak ada listener global yang mencegat seluruh form/click. Sidebar menggunakan store memori per controller pada demo, sehingga collapse/expand tidak menulis preference merchant atau tertukar antara Owner dan POS. Lebar konten mengikuti 256/64 px Owner dan 240/64 px POS. Phone bottom nav, landscape rail, dan breakpoint 767/768 menggunakan komponen serta perbaikan helper bersama.

### Lokasi kode

| Lokasi | Fungsi |
|---|---|
| `packages/demo/src/{fixture,engine,models,business,entities,access}.ts` | Fixture, command atomik, kalkulasi, permission, relasi dan simulator |
| `packages/demo/src/runtime/` | HTTP-compatible adapter, stable projection, payload normalizer, resolver route |
| `apps/owner/src/components/demo/` | Provider tab-local, runtime area, guard/shell bindings, kontrol ringkas dan slot simulasi |
| `apps/owner/src/app/demo/(sandbox)/` | Route namespace Owner/POS dan wrapper per fitur |
| `apps/owner/public/demo-assets/` | Ilustrasi statis lokal |
| `packages/demo/src/*.test.ts` | Domain, adapter, source parity, provider/storage sentinels, route contracts |
| `packages/demo/e2e/routed.mjs` | Browser acceptance terhadap route dan UI asli |

Tidak ada backend state, `Map` server tenant, token/cookie demo, TTL, layanan berbayar, atau schema/migration baru. Instance browser memiliki salinan immutable fixture dan store sendiri. `pnpm db:demo` adalah **tenant testing permanen Neon yang terpisah** dan tidak digunakan/reset oleh demo publik.

## Lifecycle dan cache

| Tindakan | Efek |
|---|---|
| Soft navigation / Back / Forward / Owner ↔ POS | Sandbox bisnis sama, komponen fitur dimuat sesuai route |
| Ganti kasir/outlet atau masuk login POS | Actor/keranjang dibersihkan, data bisnis tetap |
| Reset Demo | Sandbox baru di route saat ini; seluruh local UI remount |
| Keluar Demo / logout sidebar | Sandbox dibuang dan kembali `/demo` |
| Refresh/tab baru/kunjungan ulang | Fixture awal |
| Hide tab/berpindah aplikasi | Tidak logout |
| Navigasi keluar group atau BFCache restore | Disposal controller; restore membuat fixture baru |

Disposal menghentikan scope, listener dan timer, mencabut URL gambar, membuang cart/sidebar memory, serta menginvalidasi request generasi lama. Cleanup adapter tidak dipasang sebagai destructive effect yang membunuh adapter saat StrictMode replay. `pagehide` membantu cleanup sinkron sebelum BFCache; reset kunjungan baru tetap dijamin oleh tidak adanya persistence, bukan event unload.

Tidak ada state bisnis demo dalam cookie/localStorage/sessionStorage/IndexedDB/Cache Storage. Preference/cache/session merchant tetap utuh. Route `/demo/**` force-dynamic/no-store; POS Serwist tidak meng-cache route demo. Aset statis boleh di-cache. Offline setelah halaman terisi tetap menggunakan memori; route baru memerlukan bundle yang tersedia/koneksi. Tidak ada offline order queue.

## Perilaku bisnis dan batasan source

Seluruh CRUD/menu merchant yang ada digunakan dari UI aslinya, dengan mutasi melalui sandbox. Completed order memotong BOM/movement sekali. Draft/pending belum memotong stok. Pembelian menambah stok dan last cost; opname mencatat stok absolut/selisih. Dashboard dan laporan berasal dari order completed serta expense yang sama. HPP membaca resep/biaya bahan **saat laporan dibuat**, tanpa snapshot biaya historis. Modifier memengaruhi harga; tidak ditambahkan deduksi bahan extra yang belum didukung source. Stok boleh minus saat penjualan.

QRIS dynamic memakai payload `RAKKU-DEMO-NOT-PAYABLE`, countdown/intent lokal dan kontrol simulasi. Sukses memfinalisasi order/stok/meja dan ledger gross − `round(gross × 0.007)`. Manual QRIS tidak mengkredit saldo. Dynamic QRIS tidak tersedia pada draft/split. Meja completed tetap occupied sampai dilepas manual, mengikuti source.

Withdrawal mengikuti minimum Rp50.000, fee Rp0, satu pending request, batas Rp10 juta/hari WIB. Hold/reject/complete menghasilkan transisi ledger idempotent dan saldo nonnegatif. Tidak ada transfer bank, refund provider/disbursement otomatis, atau Superadmin production yang dibuka.

Subscription invoice/retry/expiry/aktivasi/renewal di memori mengikuti period/grace engine. Downgrade tidak menghapus data existing; kuota/feature gate tetap diperiksa. Email adalah preview/notifikasi lokal: Owner gate `email_reports` memblokir Free meskipun catalog mencantumkan lima email; simulator menegakkan gate pada kedua mode dan catalog Pro 100/bulan. POS production belum punya check feature email yang sama. Tidak ada Echo/Auth/token reset nyata.

Upload JPG/PNG/WebP maksimum 2 MiB disimpan melalui object URL terdaftar di sandbox, tidak ke Silos/Sharp/server. Seed assets tidak terhapus oleh remove image. Public QR mengarah ke dua outlet fixture awal di origin Owner, tidak membawa generation/session capability. Produk/resep/cost/PIN/internal stock tidak menjadi payload menu publik.

Kontrak command rinci ada di [`packages/demo/README.md`](packages/demo/README.md). Aturan menu adalah **`can_view`**, bukan create/edit/delete grants terpisah.

## Pengujian

```powershell
pnpm test:demo
pnpm test:db
pnpm typecheck --concurrency=1
pnpm typecheck:scripts
pnpm lint --concurrency=1
pnpm build --concurrency=1
```

`test:demo` memeriksa domain, facade existing API, route contracts, isolasi antarvisitor, BOM/ledger/report, idempotency, quota/period/permission, gambar, serta imports provider yang sengaja melempar. `test:db` memakai PGlite, bukan Neon bersama. Node 24 direkomendasikan (provider hook memerlukan ≥22.15).

Build dan browser production lokal:

```powershell
$env:NEXT_PUBLIC_OWNER_URL = 'http://localhost:3000'
$env:NEXT_PUBLIC_POS_URL = 'http://localhost:3001'
pnpm build --concurrency=1
$env:PLAYWRIGHT_MODULE_PATH = '<direktori-tools>\node_modules'
$env:DEMO_E2E_BROWSER_CHANNEL = 'chrome'
pnpm test:demo:browser
```

Untuk menguji development/React StrictMode:

```powershell
node packages/demo/e2e/run-production.mjs --routed --dev-owner
```

Wrapper menjalankan/membersihkan server miliknya dengan provider/DB transport diblokir. Browser menginstrumentasi network/storage, menjaga sentinel merchant dan memeriksa effect bisnis melalui DOM. Artifacts JSON/screenshot di temporary directory. Harness standalone lama sudah tidak dipakai dan tidak ikut repository; perintah default memakai suite routed.

Tidak diperlukan feature flag/secret baru untuk demo. Set URL Owner/POS existing sebelum build. Tenant seed, cron, smoke login dan reset database tidak dijalankan untuk pengujian ini.

### Hasil verifikasi route baru

| Pemeriksaan | Hasil |
|---|---|
| `pnpm test:demo` | 74 domain/adapter/route tests + 3 request-policy tests lulus |
| `pnpm test:db` | 13 PGlite regression tests lulus |
| `pnpm typecheck --concurrency=1` | 17 task lulus |
| `pnpm typecheck:scripts` | Lulus |
| `pnpm lint --concurrency=1` | Lulus tanpa warning/error ESLint |
| `pnpm build --concurrency=1` | Keempat aplikasi lulus; Serwist POS aktif |
| Browser development/StrictMode | 5/5 routed suites lulus |
| Browser production lokal | 5/5 routed suites lulus |

Run production terbaru menyimpan JSON/screenshot di temporary
`opencode/rakku-routed-demo-R8L4o9`; development di
`opencode/rakku-routed-demo-N2xbnE`. Tests membuktikan sidebar/konten sejalan,
soft navigation menjaga perubahan/keranjang, penjualan POS memengaruhi stok dan
order Owner, tab lain tetap fixture, reset/logout menghapus perubahan, menu mobile
berfungsi, dan feature-page bundles tidak dimuat sebelum dibuka. Seluruh suite
selesai tanpa pelanggaran network/storage atau perubahan sentinel merchant.

### Catatan perbaikan

- Sidebar POS (production dan demo) semula menempatkan badge jumlah draft/stok pada slot ikon 44 px yang dibungkus `overflow-hidden`, sehingga angka di sudut atas terpotong. Badge kini diposisikan relatif terhadap wrapper ikon yang rapat di dalam slot, seperti pola `BottomNav`, sehingga tetap terlihat pada posisi expanded, collapsed, dan rail tanpa mengubah markup atau layout lain. Verifikasi browser mengukur ukuran badge, memeriksa posisinya di dalam sidebar, dan hit-testing `elementFromPoint` agar badge tidak tertutup overflow; screenshot `pos-sidebar-badges.png` menyertakan hasil visualnya.
- Menjalankan `next dev` dan `next build` bergantian pada direktori `.next` yang sama dapat meninggalkan artefak campuran (`e[o] is not a function` / `MODULE_NOT_FOUND`). Hapus `.next` aplikasi sebelum build production setelah sesi development.
