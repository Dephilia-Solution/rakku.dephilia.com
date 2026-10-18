# Flow Demo Rakku — Panduan Presentasi

> **Status dokumen:** mengikuti implementasi demo publik per 17 Oktober 2026.
> **Audiens:** presenter produk, sales engineer, QA, dan developer yang mendemokan Rakku.
> **Dokumen terkait:** [DEMO.md](DEMO.md) (arsitektur/operasional), [DOCS.md](DOCS.md) (referensi sistem), [packages/demo/README.md](packages/demo/README.md) (kontrak sandbox).

Dokumen ini bukan naskah marketing final. Isinya adalah alur presentasi yang sudah disesuaikan dengan route, komponen, dan perilaku demo yang benar-benar ada di repository. Gunakan angka, label tombol, dan batasan yang tertulis di sini agar demo tidak menjanjikan perilaku yang belum didukung runtime.

## Daftar isi

1. [Tujuan demo](#1-tujuan-demo)
2. [Siapa yang cocok memakai alur ini](#2-siapa-yang-cocok-memakai-alur-ini)
3. [Checklist sebelum demo](#3-checklist-sebelum-demo)
4. [Format demo yang disarankan](#4-format-demo-yang-disarankan)
5. [Golden Path 15 menit](#5-golden-path-15-menit-alur-utama)
6. [Segmen opsional](#6-segmen-opsional)
7. [Flow Demo Kasir saja](#7-flow-demo-kasir-saja-5-menit)
8. [Flow evaluator teknis](#8-flow-evaluator-teknis-1015-menit)
9. [Data demo yang perlu dihafal](#9-data-demo-yang-perlu-dihafal)
10. [Batasan yang harus disampaikan](#10-batasan-yang-harus-disampaikan-jujur)
11. [Troubleshooting](#11-troubleshooting-saat-presentasi)
12. [Checklist penerimaan demo](#12-checklist-penerimaan-demo)
13. [Tanya jawab singkat](#13-tanya-jawab-singkat)
14. [Setelah demo](#14-setelah-demo)
15. [Referensi cepat](#15-referensi-cepat)

---

## 1. Tujuan demo

Demo publik Rakku memiliki tiga tujuan:

1. **Menunjukkan alur bisnis nyata** — Owner mengelola cafe, kasir bertransaksi, stok bergerak, laporan berubah.
2. **Membuktikan kualitas produk** — UI, sidebar, laporan, dan alur pembayaran memakai komponen aplikasi asli, bukan mockup.
3. **Menjelaskan isolasi** — seluruh perubahan hanya ada di memori tab pengunjung; data fixture tidak berubah dan tidak menyentuh Neon/provider.

Prinsip yang harus dipegang presenter:

- Demo **interaktif**, bukan read-only. Pengunjung boleh mengubah produk, transaksi, stok, dan pengaturan.
- Demo **sementara**: reset/logout/refresh/tab baru kembali ke fixture awal.
- Demo **terisolasi**: pengunjung lain dan akun merchant asli tidak terpengaruh.
- Demo **disimulasikan** untuk layanan eksternal: QRIS, email, withdrawal, langganan, dan upload tidak memanggil provider nyata.
- Jangan menyebut data demo sebagai data production. Semua nama, alamat, supplier, rekening, dan transaksi adalah fiktif.

---

## 2. Siapa yang cocok memakai alur ini

| Audiens | Fokus yang disarankan |
|---|---|
| Calon merchant / owner cafe | Dashboard → produk/resep → transaksi → stok → laporan → biaya |
| Kasir / supervisor | Login PIN → register → pembayaran → draft/split → pesanan |
| Investor / stakeholder | Dashboard → pertumbuhan laporan → differensiasi inventory → plan |
| Evaluator teknis | Route asli, komponen bersama, isolasi network/storage, reset/BFCache/PWA |
| Tim internal | Regresi alur demo sebelum rilis |

Satu tab = satu pengunjung. Jangan mendemokan dua orang pada satu tab yang sama karena state bisnis akan tercampur dalam sandbox tersebut.

---

## 3. Checklist sebelum demo

### 3.1 Teknis

- [ ] Owner berjalan di `http://localhost:3000` (development: `pnpm dev:owner`).
- [ ] POS berjalan di `http://localhost:3001` bila ingin memperlihatkan redirect/CTA POS. Demo interaktif tetap berada di origin Owner.
- [ ] Build/start production lokal memakai URL yang benar:
  ```powershell
  $env:NEXT_PUBLIC_OWNER_URL = 'http://localhost:3000'
  $env:NEXT_PUBLIC_POS_URL = 'http://localhost:3001'
  pnpm build --concurrency=1
  ```
- [ ] Jika baru berpindah dari `next dev` ke production, hapus `.next` aplikasi terkait sebelum build. Artefak dev/build campuran dapat menyebabkan `MODULE_NOT_FOUND` atau `e[o] is not a function`.
- [ ] Buka **satu tab baru** ke `http://localhost:3000/demo`, lalu pilih **Demo Owner**. Tab baru menjamin fixture bersih.
- [ ] Jangan membuka akun merchant asli di tab yang sama. Demo memakai runtime sendiri dan tidak memakai cookie merchant.
- [ ] Siapkan koneksi internet hanya untuk aset aplikasi; aktivitas bisnis demo tidak memanggil API/DB/provider.
- [ ] Untuk segmen mobile, siapkan responsive mode 390×844 atau perangkat fisik; jangan mengubah zoom desktop di tengah transaksi.

### 3.2 Presentasi

- [ ] Reset demo sebelum audiens masuk agar tidak ada sisa transaksi uji.
- [ ] Pastikan nama company/fixture terlihat: **Rakku Demo Cafe**, Owner **Owner Demo Rakku**.
- [ ] Siapkan penjelasan singkat badge **Demo** dan menu **Opsi demo**.
- [ ] Siapkan daftar PIN: Rani `111111`, Bima `222222`, Dita `333333`, Raka `444444`.
- [ ] Tentukan format demo: 5, 15, 30, atau 45 menit (lihat §4).
- [ ] Siapkan browser kedua bila ingin memperagakan isolasi dua tab/pengunjung.

### 3.3 Data yang harus terlihat saat pembukaan

- [ ] Dua outlet: Pusat dan Taman.
- [ ] Empat karyawan, dua per outlet.
- [ ] Sepuluh produk per outlet, empat tier harga, kategori Coffee/Non-Coffee/Food.
- [ ] 15 bahan per outlet dengan beberapa indikator stok menipis.
- [ ] Delapan meja per outlet; Meja 1–3 sudah terisi oleh draft/pending, Meja 4–8 tersedia.
- [ ] 60 order completed per outlet dalam 30 hari, dua draft, satu pending QRIS, satu cancelled.
- [ ] Paket **Business** aktif.
- [ ] Sidebar POS menampilkan badge draft dan stok menipis tanpa angka terpotong.

---

## 4. Format demo yang disarankan

| Format | Durasi | Segmen wajib | Segmen opsional |
|---|---:|---|---|
| Express | 5 menit | Dashboard → satu transaksi tunai → stok → laporan | — |
| Golden path | 15 menit | Owner product edit → POS sale → inventory → Owner reports → reset | QR menu |
| Standard | 30 menit | Golden path + QRIS simulasi + role/PIN + meja/QR + plan invoice | Split bill, purchases/opname |
| Deep dive | 45 menit | Standard + withdrawal/ledger + email preview + offline/BFCache + isolation proof | Technical route audit |

Alokasi Golden Path:

| Menit | Segmen |
|---:|---|
| 0–2 | Buka demo, orientasi dashboard |
| 2–4 | Laporan penjualan & laba rugi singkat |
| 4–7 | Ubah harga/resep produk |
| 7–9 | Beralih ke POS, pilih outlet/kasir/PIN |
| 9–13 | Buat pesanan, tier, modifier, meja |
| 13–16 | Bayar tunai, kembalian, struk |
| 16–19 | Buktikan stok terpotong |
| 19–22 | Restock + stock opname |
| 22–25 | Kembali ke Owner: order, laporan, P&L |
| 25–27 | Meja & menu QR |
| 27–30 | Reset/logout, isolasi, tanya jawab |

---

## 5. Golden Path 15 menit (alur utama)

Peta alur:

```text
/demo
├── Demo Owner ──► Dashboard ──► Laporan ──► Produk (ubah harga/resep)
│                                                │
│                                                ▼
│                                        Opsi demo → Buka kasir
│                                                │
│                                                ▼
│                             Pilih outlet → akun → PIN → Register
│                                                │
│                                                ▼
│                             Pesanan → Payment → struk → stok
│                                                │
│                                                ▼
│                                    Bahan Baku → Pembelian/Opname
│                                                │
│                                                ▼
│                             Opsi demo → Buka Owner → Pesanan/Laporan
│                                                │
│                                                ▼
│                                        Reset Demo / Keluar Demo
└── Demo Kasir ─► Pilih outlet → akun → PIN → Register → Pesanan → Laporan
```

### 5.1 Buka demo — 0:00–0:30

**Route:** `http://localhost:3000/demo`

**Lakukan:**
1. Klik **Demo Owner**.
2. Pastikan URL menjadi `/demo/owner/dashboard`.

**Yang terlihat:** Dashboard Owner asli dengan sapaan `Halo, Owner Demo Rakku!`, kartu Total Outlet (2), Total Karyawan (4), dan Total Penjualan.

**Narasi:**
> “Ini bukan halaman tiruan. Yang Anda lihat adalah dashboard Owner Rakku dengan data cafe demo: dua cabang, empat karyawan, dan riwayat penjualan 30 hari. Semua perubahan dalam sesi ini hanya tersimpan di memori tab ini.”

**Catatan:**
- Badge kecil **Demo** dan tombol **Opsi demo** adalah satu-satunya chrome demo. Menu merchant lainnya berperilaku seperti aplikasi asli.
- Di **Opsi demo** tersedia: Buka kasir, Reset Demo, Panduan singkat, Keluar Demo.

### 5.2 Dashboard dan laporan — 0:30–4:00

**Route:** `/demo/owner/dashboard` → menu **Laporan** (`/demo/owner/reports`)

**Lakukan:**
1. Tunjukkan kartu ringkasan dan daftar outlet/karyawan.
2. Buka **Laporan**.
3. Pada tab **Penjualan**, pilih outlet **Pusat**, rentang **Semua** lalu **Hari ini**.
4. Buka tab **Laba Rugi**.

**Yang terlihat:**
- Total transaksi, pendapatan, rata-rata transaksi.
- Detail harian/produk/transaksi.
- HPP, pengeluaran, laba kotor/bersih (Business aktif).
- HPP dihitung dari resep × harga bahan saat laporan dibaca.

**Narasi:**
> “Laporan berasal dari order completed yang sama dengan yang nanti kita buat. HPP memakai resep dan last cost bahan saat ini; jadi ketika kita melakukan pembelian bahan, HPP historis dapat ikut berubah—ini mengikuti perilaku runtime asli, bukan angka dashboard terpisah.”

**Batasan yang perlu disebut:**
- Draft, pending, dan cancelled tidak dihitung sebagai penjualan completed.
- Laporan bukan snapshot biaya historis.

### 5.3 Ubah produk dan resep — 4:00–7:00

**Route:** Menu **Produk** (`/demo/owner/products`)

**Lakukan:**
1. Pilih outlet **Pusat** pada selector outlet.
2. Cari **Kopi Susu Gula Aren**, klik **Edit**.
3. Ubah harga tier **Gojek** dari `32.000` menjadi `35.000` (atau angka lain yang mudah diingat).
4. Opsional: ubah deskripsi, tambah modifier, atau buka **Kelola Resep** untuk melihat BOM.
5. Klik **Simpan Produk**.

**Yang terlihat:** toast sukses, daftar produk ter-update.

**Narasi:**
> “Owner dapat mengubah katalog tanpa deployment. Perubahan ini langsung dipakai oleh kasir pada sesi yang sama karena keduanya berbagi sandbox. Bahan resep juga dapat diubah; deduksi stok mengikuti BOM yang tersimpan.”

**Fakta bisnis yang bisa ditunjukkan:**
- Harga berbeda per tier Dine In/Take Away/Gojek/Grab.
- Modifier Extra Shot/Extra Susu menambah harga per tier.
- Modifier **tidak** menambah deduksi bahan ekstra karena runtime hanya memotong BOM produk utama.
- Upload gambar di demo hanya membuat object URL di memori; tidak ada upload Silos.

### 5.4 Beralih ke POS — 7:00–9:00

**Lakukan:**
1. Klik **Opsi demo** di kanan atas.
2. Pilih **Buka kasir**.
3. Di `/demo/pos/login/select-outlet`, pilih **Rakku Demo Cafe — Pusat**.
4. Pilih **Rani** (Manager Outlet).
5. Masukkan PIN `111111`. PIN tersubmit otomatis setelah digit keenam.

**Yang terlihat:** `/demo/pos/register` dengan sidebar POS asli. Badge draft `2` dan badge stok menipis `1` terlihat utuh di sudut ikon.

**Narasi:**
> “Langkah company sudah diverifikasi oleh entry point demo. Pengunjung tetap merasakan pemilihan outlet, pemilihan akun, dan PIN. Rani adalah Manager Outlet sehingga seluruh menu POS tersedia.”

**Catatan:**
- Bila memilih **Bima** (`222222`), hanya menu **Kasir, Pesanan, Laporan, dan Pajak & Diskon** yang muncul.
- `Ganti User` di sidebar POS membawa kembali ke pemilihan akun; keranjang dikosongkan, data cafe tetap.
- Beralih Owner/POS tidak mengubah data bisnis.

### 5.5 Buat pesanan — 9:00–13:00

**Lakukan:**
1. Pilih tier **Gojek** pada selector tier (ini adalah tier harga, bukan tipe order).
2. Cari **Kopi Susu Gula Aren** dan klik produknya.
3. Di modal produk, centang **Extra Shot** (opsional), isi catatan `Less ice`, lalu klik **Tambahkan**.
4. Tambahkan **satu Kopi Susu Gula Aren lagi** sehingga quantity menjadi **2** (langsung dari grid atau tombol tambah pada keranjang).
5. Opsional: tambahkan **Butter Croissant** agar ada item Food.
6. Isi **Nama Customer** menjadi `Tamu Demo` (wajib untuk checkout).
7. Pilih meja **Meja 4** pada selector meja; Meja 1–3 terlihat terisi.
8. Periksa keranjang: quantity, modifier, catatan, subtotal, diskon produk (Matcha aktif), pajak 10%, total.

**Yang terlihat:** harga tier Gojek yang baru (jika mengubah Kopi Susu), baris modifier, pajak **Pajak Demo 10%**, dan meja terpilih.

**Narasi:**
> “Kasir memilih tier harga, modifier, catatan, pelanggan, dan meja. Perubahan produk di Owner tadi sudah terlihat di sini tanpa reload karena satu sandbox.”

**Batasan:**
- Dynamic QRIS tidak tersedia untuk draft/split.
- Stok belum berubah sampai pembayaran selesai.
- Modifier hanya memengaruhi harga.

### 5.6 Bayar tunai dan cetak struk — 13:00–16:00

**Lakukan:**
1. Klik **Payment** di keranjang.
2. Pilih metode **Tunai**.
3. Isi uang diterima, misalnya `100000`.
4. Periksa kembalian.
5. Klik **Selesaikan Transaksi**.
6. Pada struk, tunjukkan item, total, pajak, kasir, meja, dan tombol **Print** (58 mm).
7. Tutup invoice.

**Yang terlihat:** invoice completed, kembalian, dan label simulasi pembayaran.

**Narasi:**
> “Pembayaran tunai menyelesaikan order, memotong stok sesuai resep, dan mengisi meja. Struk mengikuti format 58 mm aplikasi asli.”

**Catatan:**
- Kartu dan QRIS manual juga menyelesaikan order tetapi **tidak** menambah saldo merchant.
- QRIS dinamis hanya lewat simulasi dan menambah saldo bersih MDR 0,7%.
- Meja completed tetap berstatus occupied sampai diubah manual, mengikuti runtime asli.

### 5.7 Buktikan stok bergerak — 16:00–19:00

**Route:** menu **Bahan Baku** (`/demo/pos/ingredients`)

**Lakukan:**
1. Cari **Biji kopi**.
2. Cari **Susu full cream**.
3. Cari **Bubuk matcha** untuk menunjukkan indikator menipis.

**Yang terlihat untuk dua Kopi Susu Gula Aren:**
| Bahan | Sebelum | Sesudah |
|---|---:|---:|
| Biji kopi | 6.000 g | 5.964 g |
| Susu full cream | 20.000 ml | 19.700 ml |
| Sirup gula aren | 5.000 ml | 4.950 ml |
| Air mineral | 50.000 ml | 49.940 ml |
| Es batu | 20.000 g | 19.800 g |

- Matcha Pusat `150 g` dengan minimum `200 g` menampilkan badge menipis.
- Croissant Taman `6 pcs` dengan minimum `8 pcs` juga menipis.

**Narasi:**
> “Setiap item memotong resep tepat sekali. Bahan outlet lain tidak ikut berubah. Angka ini berasal dari movement yang sama dengan laporan dan ledger.”

**Catatan:** angka ini berlaku jika resep tidak diubah pada langkah 5.3. Jika BOM diubah, deduksi mengikuti resep baru. Stok boleh menjadi negatif saat penjualan; kebijakan production tidak diubah.

### 5.8 Restock dan stock opname — 19:00–22:00

**Restock:**

1. Buka **Pembelian** (`/demo/pos/purchases`).
2. Klik **Tambah Pembelian**.
3. Isi supplier fiktif, tanggal hari ini, lalu tambahkan baris **Biji kopi** sebanyak `1000 g` dengan harga beli `130` per gram.
4. Simpan.

**Yang terlihat:** stok Biji kopi bertambah 1.000 g dan `cost_per_unit` menjadi `130` (last cost).

**Stock opname:**

1. Kembali ke **Bahan Baku**.
2. Cari **Bubuk matcha**, klik ikon **Stock Opname**.
3. Isi stok fisik absolut `250 g`, catatan `Opname demo`, lalu **Simpan Opname**.
4. Badge menipis Matcha Pusat hilang karena 250 > 200.

**Narasi:**
> “Pembelian menambah stok dan memperbarui last cost. Stock opname memakai stok absolut beserta selisih, bukan menambah/mengurangi secara relatif. Keduanya tercatat sebagai movement inventory.”

**Catatan:**
- Opname/edit stok tersedia pada plan dengan advanced inventory; default demo Business.
- Perubahan last cost dapat mengubah HPP historis saat laporan dibaca.

### 5.9 Validasi di Owner — 22:00–25:00

**Lakukan:**
1. **Opsi demo → Buka Owner**.
2. Menu **Pesanan** (`/demo/owner/orders`), cari invoice/nomor transaksi tadi.
3. Buka invoice untuk melihat item, kasir Rani, meja, dan total.
4. Menu **Laporan** → tab **Penjualan** → **Hari ini**; bandingkan angka sebelum/sesudah.
5. Buka **Laba Rugi**; tunjukkan HPP dan pengeluaran.
6. Kembali ke **Dashboard**; kartu penjualan ikut berubah.

**Narasi:**
> “Transaksi yang dibuat kasir langsung menjadi sumber laporan Owner. Tidak ada sinkronisasi manual atau angka dashboard terpisah. Ini bukti satu state bisnis untuk dua antarmuka.”

### 5.10 Meja dan menu QR — 25:00–27:00

**Meja:**

1. Menu **Meja** (`/demo/owner/tables`).
2. Tunjukkan **Meja 4** occupied setelah transaksi.
3. Buka edit dan ubah menjadi available (opsional) untuk memperlihatkan pelepasan manual.

**Menu QR:**

1. Menu **Pengaturan** (`/demo/owner/settings`) → bagian **Menu QR**.
2. Tunjukkan QR/link Pusat dan Taman.
3. Salin URL menu lalu buka di tab baru (`/demo/menu/pusat` atau `/demo/menu/taman`).

**Yang terlihat:** menu publik view-only dengan nama outlet, kategori, produk aktif, harga, deskripsi, dan gambar. Tidak ada stok, biaya, resep, PIN, atau data internal.

**Narasi:**
> “QR publik selalu menampilkan fixture awal pada tab/perangkat lain dan tidak membawa sesi pengunjung. Perubahan pada sesi ini bisa dilihat di katalog/POS, tetapi link publik tidak membagikan sandbox.”

**Catatan:** link mengekspos hanya data menu; bukan kemampuan untuk memesan atau membayar.

### 5.11 Reset, logout, dan isolasi — 27:00–30:00

**Lakukan:**
1. **Opsi demo → Reset Demo**.
   - Dari Owner: halaman saat ini dimuat ulang dengan fixture baru.
   - Dari POS: kembali ke pemilihan outlet karena sesi kasir baru belum ada.
2. Ulangi buka Owner, pastikan transaksi tadi hilang dan stok kembali ke target awal.
3. Buka tab baru ke `/demo/owner/outlets`; tunjukkan data tab baru tetap fixture, bukan salinan tab pertama.
4. Klik **Keluar Demo**; kembali ke `/demo`.

**Narasi:**
> “Reset dan logout membuang seluruh sandbox dan mengembalikan data awal. Refresh, tab baru, atau membuka demo lagi juga mulai dari fixture. Data tidak disimpan di cookie, localStorage, sessionStorage, IndexedDB, atau Cache Storage, dan tidak ada aktivitas yang ditulis ke Neon.”

**Poin isolasi yang bisa disebut:**
- Setiap tab adalah pengunjung terpisah.
- Respons lama dari sesi sebelumnya diabaikan.
- Object URL gambar sesi dicabut saat reset/keluar.
- Tab yang disembunyikan tidak logout.

---

## 6. Segmen opsional

### 6.1 QRIS dinamis + saldo + withdrawal (8–10 menit)

1. Dari POS Register, buat pesanan baru dan isi customer.
2. Klik **Payment** → pilih **QRIS** → gunakan mode dinamis → **Tampilkan QRIS**.
3. Di panel simulasi QRIS, klik **Berhasil**.
4. Tunjukkan label **“Simulasi QRIS — tidak menerima pembayaran nyata”**, nominal, QR ilustrasi, dan countdown.
5. Buka Owner → **Saldo** (`/demo/owner/balance`).
6. Tunjukkan saldo available, pending, MDR 0,7%, dan ledger.
7. Untuk withdrawal: ada satu pengajuan seed berstatus pending. Gunakan kontrol simulator:
   - **Proses**, lalu **Selesaikan**, atau
   - **Tolak** untuk mengembalikan hold.
8. Setelah pending selesai/ditolak, klik **Tarik Dana**, pilih rekening fiktif, isi minimal `50000`, lalu submit.
9. Selesaikan pengajuan baru melalui kontrol simulator.

**Narasi:**
> “QRIS dinamis di demo tidak memanggil Vessel. Sukses mensimulasikan finalisasi order, stok, dan saldo bersih setelah MDR. Cash, kartu, dan QRIS manual tidak menambah saldo. Withdrawal memindahkan saldo available ke pending; reject mengembalikan, complete menyelesaikan tepat sekali. Tidak ada transfer bank nyata.”

**Batasan yang harus disebut:**
- Minimum withdrawal Rp50.000, fee Rp0, satu pengajuan pending, batas Rp10 juta/hari.
- Dynamic QRIS tidak tersedia untuk draft atau split bill.
- Refund/disbursement otomatis tidak ada.
- Saldo tidak boleh negatif.

### 6.2 Draft, split bill, dan invoice (5 menit)

**Draft:**
1. Tambahkan produk dan isi customer.
2. Klik **Bayar Nanti**.
3. Buka daftar draft (ikon/badge draft di area kasir).
4. Pilih draft untuk dilanjutkan, lalu bayar.
5. Tunjukkan stok **belum** berkurang sebelum completion dan hanya berkurang sekali setelah bayar.

**Split bill:**
1. Buat pesanan baru → **Payment** → **Split Bill**.
2. Bagi alokasi menjadi dua metode (Tunai/Kartu/QRIS manual) yang totalnya tepat sama dengan bill.
3. Selesaikan; tunjukkan stok hanya terpotong sekali.
4. Dynamic QRIS tidak tersedia untuk split.

### 6.3 Role, menu access, dan PIN (4–5 menit)

1. Sebagai Owner, buka **Karyawan** → tab **Role & Akses**.
2. Tunjukkan matriks V/C/E/D untuk role Kasir: Register penuh, Orders tanpa create, Reports/Tax & Discounts view-only. Ubah satu flag dan simpan; revision berubah.
3. Buka **POS**, **Ganti User**, pilih **Bima** (`222222`).
4. Tunjukkan sidebar hanya berisi menu Kasir.
5. (Opsional) Akses langsung `/demo/pos/ingredients`; halaman menolak dengan tampilan error yang menyediakan Muat Ulang ke menu yang diizinkan.
6. Kembali ke Owner, ubah akses/PIN, lalu login ulang untuk melihat efeknya.

**Narasi:**
> “Pembatasan bukan sekadar menyembunyikan menu. Editor memakai grant V/C/E/D dengan full replacement dan revision. Production POS menegakkan capability per method/path; demo POS masih menyimulasikan visibilitas menu.”

### 6.4 Paket dan invoice langganan (3–4 menit)

1. Owner → **Langganan** (`/demo/owner/subscription`).
2. Tunjukkan paket aktif **Business**, usage/quota, periode, dan riwayat invoice.
3. Klik **Bayar Pro** untuk membuat invoice lokal.
4. Di halaman checkout, gunakan panel simulator **Berhasil / Gagal / Kedaluwarsa / Batal**.
5. Sukses mengubah paket ke Pro dan mencatat periode. Retry membuat invoice baru; invoice lama tidak diaktifkan ulang.
6. Kembali ke Business dengan checkout yang sama bila perlu.

**Narasi:**
> “Invoice dan QR di sini lokal. Tidak ada Vessel atau pembayaran nyata. Activation bersifat idempotent; invoice gagal/expired/cancelled tidak mengubah paket.”

**Batasan penting:**
- Teks lama “Pembayaran via QRIS (Vessel)” masih berasal dari komponen asli; di demo gunakan simulator di bawah kartu pembayaran.
- Tombol paket **Free** dinonaktifkan oleh UI existing, sehingga downgrade Free tidak dapat dipilih dari UI demo. Alur yang tersedia adalah Business ↔ Pro (dan invoice). Free tetap diuji di domain test, bukan jalur presentasi.
- Paket Pro dan Business sama-sama memiliki fitur penuh; feature gate tidak berubah pada transisi tersebut.

### 6.5 Email laporan (2 menit)

1. Buka **Laporan** sebagai Owner.
2. Buka aksi kirim/preview email laporan.
3. Isi penerima fiktif dan buat preview.
4. Tunjukkan preview/outbox lokal dan pesan bahwa email tidak dikirim.

**Narasi:**
> “Demo tidak memanggil Echo dan tidak mengirim email. Pada plan Pro/Business preview diizinkan; Free diblokir oleh feature gate email. Notifikasi billing/withdrawal hanya muncul di sandbox.”

### 6.6 Mobile dan responsive (2 menit)

1. Ubah viewport ke 390×844.
2. Owner: bottom navigation + **Lainnya**.
3. POS: bottom navigation + **Lainnya**; sidebar rail pada landscape.
4. Tunjukkan sidebar desktop tetap proporsional saat collapse (256/64 px Owner, 240/64 px POS) dan badge angka tidak terpotong.

---

## 7. Flow Demo Kasir saja (5 menit)

Cocok untuk audiens kasir/supervisor tanpa membahas setup Owner.

**Route:** `/demo/pos/login/select-outlet`

1. Pilih **Pusat** → **Bima** → PIN `222222`.
2. Register: pilih tier, tambah produk, isi customer.
3. Bayar tunai; tunjukkan kembalian dan struk.
4. Buka **Pesanan**; cari invoice.
5. Buka **Laporan**; tunjukkan penjualan hari ini.
6. Tunjukkan menu yang tidak tersedia untuk Kasir (**Produk, Bahan Baku, Pembelian**).
7. **Opsi demo → Reset Demo** untuk mengakhiri.

**Narasi:**
> “Kasir hanya melihat menu yang diizinkan. Pemilihan outlet, akun, dan PIN tetap realistis, tetapi password company tidak diuji dan tidak ada akun Neon.”

---

## 8. Flow evaluator teknis (10–15 menit)

Fokus pada arsitektur, bukan cerita bisnis.

1. **Route asli:** tunjukkan `/demo/owner/outlets`, `/demo/pos/register`, `/demo/owner/products/add` sebagai route Next nyata; back/forward browser berfungsi.
2. **Komponen bersama:** jelaskan `OwnerShell`/`PosShell`, `OwnerDashboardView`, auth POS, dan `PublicMenuView` dipakai production dan demo.
3. **Runtime boundary:** `packages/ui/src/merchant-runtime.tsx`; di luar provider memakai fetch/router production; di demo memakai adapter lokal.
4. **Isolasi:** tunjukkan dua tab berbeda; tab A diubah, tab B tetap fixture.
5. **Tanpa persistence:** DevTools → Application: tidak ada state bisnis baru di localStorage/sessionStorage/IndexedDB/cookie/Cache Storage demo.
6. **Tanpa provider:** semua pembayaran/email/upload berlabel simulasi; tidak ada request keluar untuk aktivitas bisnis.
7. **Lifecycle:** refresh, reset, logout, back/BFCache; state lama tidak muncul kembali.
8. **PWA:** POS `/demo` memakai NetworkOnly; demo utama ada di origin Owner tanpa service worker.
9. **Perintah verifikasi:**
   ```powershell
   pnpm test:demo
   pnpm test:demo:browser
   pnpm --config.verify-deps-before-run=false --filter @rakku/db test
   pnpm typecheck --concurrency=1
   pnpm lint --concurrency=1
   ```
   Untuk StrictMode/development: `node packages/demo/e2e/run-production.mjs --routed --dev-owner`.

**Batasan teknis:**
- Editor role memakai CRUD grant; dispatcher POS demo masih menu-level dan bukan enforcement produksi.
- Stok boleh minus; meja completed tetap occupied sampai dilepas.
- QRIS dinamis tidak tersedia untuk draft/split.
- HPP memakai resep/last cost saat laporan dibaca.
- Modifier tidak menambah deduksi bahan.

---

## 9. Data demo yang perlu dihafal

### 9.1 Akun dan outlet

| Outlet | Alamat fiktif | Karyawan | PIN |
|---|---|---|---|
| Rakku Demo Cafe — Pusat | Jl. Contoh Raya No. 10 | Rani / Manager Outlet | `111111` |
| Rakku Demo Cafe — Pusat | — | Bima / Kasir | `222222` |
| Rakku Demo Cafe — Taman | Jl. Contoh Taman No. 25 | Dita / Manager Outlet | `333333` |
| Rakku Demo Cafe — Taman | — | Raka / Kasir | `444444` |

Company: **Rakku Demo Cafe** (`DEMO_CAFE`). Owner: **Owner Demo Rakku**. Email contoh: `owner@rakku.invalid`. Password company contoh: `DemoCafe2026!`. Tidak ada akun yang dibuat di Neon.

### 9.2 Menu dan harga awal (ribuan rupiah)

| Produk | Kategori | Dine In | Take Away | Gojek | Grab |
|---|---|---:|---:|---:|---:|
| Espresso | Coffee | 18 | 18 | 22 | 22 |
| Americano | Coffee | 22 | 22 | 27 | 27 |
| Cappuccino | Coffee | 28 | 28 | 34 | 34 |
| Caffe Latte | Coffee | 30 | 30 | 36 | 36 |
| Kopi Susu Gula Aren | Coffee | 26 | 26 | 32 | 32 |
| Matcha Latte | Non-Coffee | 32 | 32 | 39 | 39 |
| Chocolate Latte | Non-Coffee | 28 | 28 | 34 | 34 |
| Lemon Tea | Non-Coffee | 20 | 20 | 25 | 25 |
| Butter Croissant | Food | 24 | 24 | 29 | 29 |
| French Fries | Food | 24 | 24 | 29 | 29 |

Modifier contoh: **Extra Shot +Rp5.000**, **Extra Susu +Rp3.000** pada Dine In/Take Away; tier Gojek/Grab memakai delta **+Rp6.000/+Rp4.000**.

Pajak/diskon: **Pajak Demo 10% aktif**; **Service Demo Rp1.000 nonaktif**; **Matcha Latte 10%** aktif; **Promo Demo Rp5.000** nonaktif; satu diskon telah berakhir.

### 9.3 Target stok awal (setelah seluruh riwayat seed)

| Bahan | Unit | Pusat | Taman | Minimum | Biaya/unit |
|---|---|---:|---:|---:|---:|
| Biji kopi | gram | 6.000 | 4.000 | 500 | 120 |
| Susu full cream | ml | 20.000 | 14.000 | 2.000 | 25 |
| Sirup gula aren | ml | 5.000 | 3.500 | 500 | 35 |
| Bubuk matcha | gram | 150 | 500 | 200 | 500 |
| Bubuk cokelat | gram | 2.000 | 1.500 | 200 | 100 |
| Teh | gram | 500 | 350 | 100 | 100 |
| Simple syrup | ml | 5.000 | 3.000 | 300 | 20 |
| Sirup lemon | ml | 2.000 | 1.500 | 200 | 50 |
| Air mineral | ml | 50.000 | 35.000 | 5.000 | 1 |
| Es batu | gram | 20.000 | 15.000 | 2.000 | 1 |
| Croissant siap panggang | pcs | 40 | 6 | 8 | 8.500 |
| Kentang beku | gram | 8.000 | 5.000 | 1.000 | 30 |
| Minyak goreng | ml | 5.000 | 3.500 | 500 | 30 |
| Saus tomat | gram | 2.000 | 1.500 | 200 | 35 |
| Garam | gram | 1.000 | 750 | 100 | 10 |

Stok adalah **target akhir** setelah 60 order, pembelian, dan opname seed. Opening movement dihitung dari target dikurangi movement lain; tidak ada movement duplikat untuk menambal tampilan.

### 9.4 Status awal

- 60 completed per outlet (120 total), 2 draft, 1 pending QRIS, 1 cancelled per outlet.
- 8 meja; Meja 1–3 occupied karena draft/pending; Meja 4–8 available.
- 4 pembelian multi-item, 6 pengeluaran, 2 stock opname per outlet.
- Saldo/ledger dari QRIS historis; contoh withdrawal completed, rejected, dan requested.
- Plan Business aktif satu bulan kalender dari sesi dibuka.
- Draft berlaku 24 jam; QR pending 15 menit; clock memakai `Asia/Jakarta`.

---

## 10. Batasan yang harus disampaikan jujur

| Area | Batasan |
|---|---|
| Pembayaran | QRIS hanya simulasi; payload tidak dapat dibayar. Vessel tidak dipanggil. |
| Saldo | Hanya QRIS dinamis sukses yang mengkredit saldo (gross − MDR 0,7%). Cash/kartu/QRIS manual tidak. |
| Withdrawal | Tidak ada transfer bank nyata; minimum Rp50.000, satu pending, batas Rp10 juta/hari. |
| Email | Preview/outbox lokal; Echo tidak dipanggil. Free diblokir feature gate email. |
| Upload | Object URL di memori; tidak ada Silos/Sharp/server. |
| Publik menu | Selalu fixture awal, tidak memakai sandbox sesi dan tidak bisa memesan. |
| Plan | Bisnis aktif; UI existing menonaktifkan pemilihan Free. Pro/Business dapat disimulasikan. |
| Permission | Editor/role contract memakai grant V/C/E/D + revision; dispatcher POS demo masih menu-level. Production POS menegakkan CRUD di server. |
| HPP | Resep/last cost saat laporan dibaca; bukan snapshot historis. |
| Stok | Boleh minus saat penjualan; pembelian memperbarui last cost. |
| Modifier | Tidak memotong bahan tambahan otomatis. |
| Meja | Completed tetap occupied sampai dilepas manual. |
| Reset | Owner: route saat ini dengan fixture baru. POS: kembali ke pemilihan outlet. Refresh/tab baru juga fixture baru. |
| Superadmin | Tidak dibuka di demo publik. Kontrol withdrawal ada di simulator Owner. |
| Data | Semua identitas dan transaksi fiktif; bukan data merchant. |

---

## 11. Troubleshooting saat presentasi

| Gejala | Tindakan |
|---|---|
| `/demo` blank atau error runtime | Pastikan build/develop Owner berjalan. Jika habis `next dev`, hapus `apps/owner/.next` lalu build ulang. |
| POS tidak bisa masuk | Buka `/demo/pos/login/select-outlet`, pilih outlet → akun → PIN. Jangan langsung ke `/demo/pos/register` pada sesi baru. |
| Tombol bayar tidak aktif | Isi nama customer; untuk tunai isi uang cukup; split harus tepat total. |
| QRIS dinamis tidak muncul | Pilih QRIS mode dinamis, bukan manual; tidak tersedia untuk draft/split. |
| Simulation QRIS tidak terlihat | Intent harus berstatus pending; setelah **Tampilkan QRIS** dibuat, panel simulasi muncul. |
| Stok tidak berubah | Stok hanya berubah saat order completed. Draft/pending belum memotong. |
| Meja tidak bisa dibuat available | Ada draft/pending yang masih memakai meja. Selesaikan/batalkan dulu. |
| Angka sidebar terpotong | Sudah diperbaiki. Jika build lama, rebuild aplikasi. |
| Data kembali setelah refresh | Perilaku yang benar; refresh memulai fixture baru. |
| Ingin mengulang bersih | **Opsi demo → Reset Demo**, lalu mulai dari Owner lagi. |
| Menu role tidak berubah | Simpan role, lalu **Ganti User** dan login ulang. |
| Withdrawal baru gagal | Maksimal satu pengajuan pending; selesaikan/tolak yang ada dulu. |
| Email preview gagal | Plan harus Pro/Business; Free diblokir. |
| Tab demo lain terlihat berbeda | Setiap tab adalah sesi independen; ini fitur isolasi, bukan bug. |

---

## 12. Checklist penerimaan demo

Gunakan checklist ini setelah gladi bersih.

- [ ] `/demo` dapat dibuka tanpa login dan menampilkan pilihan Owner/Kasir.
- [ ] Dashboard Owner menampilkan dua outlet dan empat karyawan.
- [ ] Owner dapat mengubah produk/harga/resep dan hasilnya terlihat di POS.
- [ ] POS dapat login dengan outlet/akun/PIN; switch user berfungsi.
- [ ] Register mendukung tier, modifier, catatan, customer, meja, pajak/diskon.
- [ ] Tunai menghitung kembalian; struk 58 mm dapat dicetak.
- [ ] QRIS simulasi sukses/gagal/expired/cancel/retry berfungsi; tidak memanggil provider.
- [ ] Draft tidak memotong stok; completion memotong tepat sekali.
- [ ] Split bill menyelesaikan total dan tidak menggandakan stok.
- [ ] Stok dua Kopi Susu berkurang sesuai BOM; outlet lain tidak berubah.
- [ ] Pembelian menambah stok dan last cost; opname menyetel absolut dan selisih.
- [ ] Badge stok menipis hilang setelah restock/opname yang sesuai.
- [ ] Order POS terlihat di Pesanan, Laporan, dan Dashboard Owner.
- [ ] Laporan Laba Rugi memakai HPP dari resep/biaya saat dibaca.
- [ ] Role dan assignment dibatasi pada boundary data.
- [ ] Withdrawal memindahkan saldo, reject mengembalikan, complete menyelesaikan.
- [ ] Menu publik menampilkan fixture awal dan tidak membocorkan data internal.
- [ ] Reset/logout/refresh/tab baru kembali ke fixture.
- [ ] Dua tab independen; tab A tidak mengubah tab B.
- [ ] Tidak ada aktivitas demo di Neon, cookie merchant, atau browser storage.
- [ ] Tidak ada request ke Vessel/Echo/Silos/API merchant untuk aktivitas demo.
- [ ] Layout desktop/mobile dan badge sidebar tampil benar.

---

## 13. Tanya jawab singkat

**Apakah data yang saya ubah tersimpan?**
Tidak. Semua perubahan berada di memori tab. Reset, logout, refresh, atau tab baru mengembalikan fixture awal.

**Apakah pengunjung lain melihat perubahan saya?**
Tidak. Setiap tab memiliki sandbox sendiri. Link menu publik juga tidak membawa sesi Anda.

**Apakah ini benar-benar membayar?**
Tidak. QRIS adalah payload demo yang tidak dapat dibayar. Tidak ada Vessel, bank, atau dana nyata. Saldo/ledger hanya simulasi.

**Apakah email benar-benar terkirim?**
Tidak. Demo hanya menampilkan preview/outbox lokal.

**Kenapa laporan lama berubah setelah restock?**
Karena HPP memakai resep dan last cost saat laporan dibaca, sesuai runtime asli. Tidak ada snapshot biaya historis.

**Kenapa stok bisa minus?**
Runtime production mengizinkan penjualan melebihi stok; demo mengikuti kebijakan itu.

**Apakah saya bisa mencoba Free?**
Tombol Free pada UI langganan existing dinonaktifkan. Demo tersedia untuk Business/Pro dan simulasi invoice. Batas/gate Free diuji di domain test.

**Apakah demo memakai Supabase/Neon?**
Tidak. Runtime merchant memakai Neon, tetapi demo publik memakai sandbox browser. Tidak ada query database atau layanan provider untuk aktivitas demo.

**Bisakah demo dipakai di ponsel?**
Ya. Layout responsive mengikuti aplikasi asli; gunakan satu tab per pengunjung.

---

## 14. Setelah demo

1. **Opsi demo → Keluar Demo** (atau **Reset Demo** jika akan memulai audiens baru).
2. Tutup tab menu publik bila dibuka.
3. Tidak perlu menghapus cache/storage merchant; demo tidak menulis ke sana.
4. Bila memakai build production lokal, hentikan server yang dijalankan untuk demo.
5. Jika ada kegagalan yang mencurigakan, catat route, langkah, dan pesan error; jalankan `pnpm test:demo` dan `pnpm test:demo:browser` sebelum menyimpulkan bug.

---

## 15. Referensi cepat

- Arsitektur, lifecycle, fixture lengkap: [DEMO.md](DEMO.md)
- Kontrak command sandbox: [packages/demo/README.md](packages/demo/README.md)
- Pengujian browser: [packages/demo/e2e/README.md](packages/demo/e2e/README.md)
- Referensi sistem production: [DOCS.md](DOCS.md)
