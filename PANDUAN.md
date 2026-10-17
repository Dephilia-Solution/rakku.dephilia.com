# Panduan Penggunaan Rakku

Dokumen ini adalah panduan operasional **Rakku** untuk pemilik bisnis dan kasir. Semua contoh memakai data seed **BUILD COFFEE** agar mudah dicoba di environment development. Panduan ini diaudit terhadap source pada **7 Oktober 2026**.

> **Runtime Neon:** data Owner/POS kini memakai Neon. Password Owner dan PIN kasir yang disalin tetap berlaku; session POS baru berlaku 12 jam dan user/company/outlet nonaktif ditolak saat request. Superadmin mengaktifkan akun Managed Better Auth melalui invitation dan membuat password baru. Setup/cutover ada di [NEON_MIGRATION.md](NEON_MIGRATION.md).

> **Demo Neon yang aktif:** login Owner `demo_owner@rakku.test` / `DemoOwner2026!`; login POS dengan company `DEMO` / `DemoPOS2026!`, Outlet Demo, user `kasir_demo`, PIN `123456`. Database ini baru dan tidak memulihkan data Supabase lama. Contoh BUILD COFFEE di bagian bawah adalah panduan untuk seed tambahan, bukan data yang dipasang pada instalasi baru ini.

Panduan pengguna berfokus pada dua aplikasi yang saling terhubung:

| Aplikasi | URL | Untuk siapa |
|---|---|---|
| **Portal Owner** | `https://rakku.vercel.app` | Pemilik bisnis — kelola outlet, karyawan, produk, laporan |
| **POS Kasir** | `https://pos-rakku.vercel.app` | Kasir — mencatat transaksi, pesanan, meja, stok |

> **Catatan:** Menu publik (menu digital via QR) dibuka oleh pelanggan lewat browser, tanpa login. Contoh: `https://pos-rakku.vercel.app/menu/build-tembalang`.

> URL di atas adalah default yang tercatat di repository. Domain deployment aktual dapat berbeda. Kredensial BUILD di bawah berasal dari script seed dan tidak boleh dipakai di produksi.

---

## Bagian 0 — Akun & Data BUILD COFFEE

Seluruh contoh di panduan ini memakai tenant **BUILD COFFEE**. Berikut data login & isi datanya.

### 0.1 Akun Portal Owner

| Peran | Email | Password |
|---|---|---|
| Pemilik BUILD | `owner@build.test` | `build12345` |

### 0.2 Akun POS Kasir

Langkah 1 login POS memakai **Kode Perusahaan + Password**. Langkah 3 memilih akun, langkah 4 memasukkan **PIN**.

| Field | Nilai |
|---|---|
| Kode Perusahaan | `BUILD` |
| Password Perusahaan | `build123` |

Akun yang tersedia per outlet (semua PIN `123456`):

| Username | Role | Akses |
|---|---|---|
| `owner` | Owner | Semua outlet |
| `kepala-tembalang` | Kepala Cabang | Outlet Tembalang |
| `admin-tembalang` | Admin | Outlet Tembalang |
| `kasir-tembalang-1` | Kasir | Outlet Tembalang |
| `kasir-tembalang-2` | Kasir | Outlet Tembalang |
| `kasir-tembalang-3` | Kasir | Outlet Tembalang |

Pola yang sama berlaku untuk cabang **Banyumanik** (`kepala-banyumanik`, `admin-banyumanik`, `kasir-banyumanik-1..3`) dan **Pleburan** (`kepala-pleburan`, `admin-pleburan`, `kasir-pleburan-1..3`).

> Contoh flow di panduan ini utamanya memakai **`kasir-tembalang-1`** (role Kasir) dan **`owner`** (role Owner).

### 0.3 Outlet BUILD COFFEE

| Outlet | Slug QR Menu | URL Menu |
|---|---|---|
| BUILD COFFEE Tembalang | `build-tembalang` | `/menu/build-tembalang` |
| BUILD COFFEE Banyumanik | `build-banyumanik` | `/menu/build-banyumanik` |
| BUILD COFFEE Pleburan | `build-pleburan` | `/menu/build-pleburan` |

### 0.4 Data Menu per Outlet

- **5 kategori**: Minuman Kopi, Minuman Non-Kopi, Roti & Pastry, Makanan, Dessert.
- **39 produk** (contoh: Espresso Rp18.000, Cafe Latte Rp32.000, Butter Croissant Rp25.000, Nasi Goreng Spesial Rp45.000, Cheesecake Rp38.000).
- **2 tier harga**: Dine In & Take Away (harga sama saat ini, bisa diubah per outlet).
- **10 meja**: Meja 1 sampai Meja 10.
- **Modifier kopi**: Extra Shot (+Rp5.000), Oat Milk (+Rp8.000), Whipped Cream (+Rp5.000), Vanilla Syrup (+Rp5.000), Caramel Syrup (+Rp5.000), Less Ice (Rp0).

### 0.5 Role & Hak Akses

| Role | Menu yang bisa diakses di POS |
|---|---|
| **Owner** | Register, Pesanan, Laporan, Produk, Bahan Baku, Meja, Pajak, Pengeluaran, Pembelian |
| **Kepala Cabang** | Register, Pesanan, Laporan, Produk, Bahan Baku, Meja, Pengeluaran, Pembelian |
| **Admin** | Pesanan, Laporan, Produk, Bahan Baku, Meja, Pengeluaran, Pembelian |
| **Kasir** | Register, Pesanan, Meja |

> Script BUILD masih memakai slug lama `taxes` untuk akses pajak. Jika menu **Pajak & Diskon** tidak muncul setelah seed, aktifkan secara manual dari Portal Owner melalui **Karyawan → Role & Akses**.

---

## Bagian 1 — Portal Owner

### 1.1 Registrasi & Verifikasi Email

Dipakai untuk pengguna **baru** yang belum punya akun pemilik. (BUILD COFFEE sudah punya akun, jadi flow ini dilewati jika hanya ingin mencoba contoh.)

1. Buka `https://rakku.vercel.app/register`.
2. Isi form:
   - **Nama Lengkap** — mis. `Budi Pemilik`.
   - **Email** — mis. `budi@build.test`.
   - **Password** — minimal 8 karakter.
   - Centang persetujuan, lalu klik **Daftar**.
3. Anda diarahkan ke halaman **Cek Email**. Email verifikasi dikirim ke alamat tersebut (valid 1 jam).
4. Klik tombol **Verifikasi Email** di email → token diverifikasi otomatis → langsung diarahkan ke halaman **Onboarding**.
5. Jika email tidak masuk, kembali ke halaman Cek Email, isi email, klik **Kirim Ulang Email**.

### 1.2 Onboarding (Buat Perusahaan + Outlet Pertama)

Setelah verifikasi email, buat perusahaan dan outlet pertama. Sistem otomatis membuat:

- Tier harga **Dine In** dan **Take Away**.
- Role default **Owner** dan **Kasir** beserta akses menu awal.
- Trial paket **Pro selama 14 hari** jika data plan Pro tersedia.

**Langkah 1 — Informasi Perusahaan**
- **Nama Perusahaan** — mis. `BUILD COFFEE` → kode perusahaan disarankan otomatis (`BUILD`).
- **Password Perusahaan** — minimal 6 karakter. Ini dipakai kasir di **langkah 1 login POS**.
- Klik **Lanjut**.

**Langkah 2 — Outlet Pertama**
- **Nama Outlet** — mis. `BUILD COFFEE Tembalang`.
- **Alamat** (opsional).
- Klik **Buat Perusahaan** → langsung diarahkan ke **Dashboard**.

> Role custom tambahan dapat dibuat lewat **Karyawan → Role & Akses** selama fitur `custom_roles` tersedia pada paket aktif. Setelah trial Pro berakhir, company tanpa langganan aktif efektif menggunakan paket Free.

### 1.3 Login Owner

1. Buka `https://rakku.vercel.app/login`.
2. Isi **Email** (`owner@build.test`) dan **Password** (`build12345`).
3. (Opsional) centang **Ingat saya** agar sesi bertahan 30 hari (default 24 jam).
4. Klik **Masuk**.
   - Jika akun belum verifikasi email → diarahkan ke **Cek Email**.
   - Jika sudah punya perusahaan → masuk **Dashboard**.
   - Jika belum punya perusahaan → diarahkan ke **Onboarding**.

**Kesalahan umum:**
- *"Email atau password salah"* — kombinasi tidak cocok.
- *"Akun dinonaktifkan"* — akun dimatikan.
- *"Email belum diverifikasi..."* — verifikasi email dulu.

### 1.4 Dashboard

Halaman pertama setelah login. Menampilkan:
- **3 kartu statistik**: Total Outlet, Total Karyawan, Total Penjualan (dari order selesai).
- **Outlet Terbaru** — 3 outlet pertama beserta jumlah karyawan & status, link **Kelola outlet**.
- **Karyawan Terbaru** — 3 karyawan terbaru beserta role, link **Kelola karyawan**.

Klik kartu/kartu statistik untuk berpindah ke halaman terkait.

### 1.5 Kelola Outlet

Buka menu **Outlet** di sidebar.

**Lihat daftar outlet** — tabel menampilkan nama, alamat, jumlah karyawan, status (Aktif/Nonaktif). Di HP tampil sebagai kartu.

**Tambah outlet**
1. Klik **Tambah Outlet**.
2. Isi **Nama Outlet** (wajib) dan **Alamat** (opsional).
3. Klik **Tambah Outlet**.
   - Contoh isian: nama `BUILD COFFEE Tembalang`, alamat `Jl. Ngesrep Timur V No.8, Tembalang, Semarang`.
   - Sistem otomatis membuat 2 tier harga (Dine In/Take Away) untuk outlet baru.

**Edit** — klik ikon pensil → ubah nama/alamat → **Simpan Perubahan**.

**Aktifkan/Nonaktifkan** — klik ikon X (nonaktifkan) atau ✓ (aktifkan). Outlet nonaktif tidak dipakai di login POS.

**Hapus** — klik ikon tong sampah → konfirmasi. ⚠️ Menghapus outlet juga menghapus data terkait (produk, order, dll). Outlet terakhir tidak bisa dihapus.

### 1.6 Kelola Karyawan

Buka menu **Karyawan** → tab **Karyawan**.

**Tambah karyawan**
1. Klik **Tambah Karyawan**.
   - Jika belum ada role, sistem mengingatkan untuk buat role dulu di tab **Role & Akses**.
2. Isi form:
   - **Nama Karyawan** — mis. `Kasir Tembalang 4`.
   - **Username** — huruf kecil, mis. `kasir-tembalang-4`. Dipakai kasir di langkah "pilih akun" login POS.
   - **PIN (6 digit)** — mis. `123456`. Hanya muncul saat tambah (tidak bisa diedit kemudian).
   - **Role** — pilih salah satu (Owner/Kepala Cabang/Admin/Kasir).
   - **Akses Outlet** — centang **Semua Outlet** untuk akses penuh, atau pilih outlet tertentu dari daftar.
3. Klik **Tambah Karyawan**.
   - ⚠️ Beritahu PIN ke karyawan secara manual.

**Edit** — klik pensil → ubah nama/username/role/akses outlet → **Simpan Perubahan**.

**Reset PIN** — klik ikon kunci → isi **PIN Baru (6 digit)** → **Reset PIN**. PIN lama langsung tidak berlaku.

**Aktifkan/Nonaktifkan** — klik ikon ✓/X. Karyawan nonaktif tidak bisa login POS.

**Hapus** — klik tong sampah → konfirmasi.

### 1.7 Role & Akses

Masih di menu **Karyawan**, pindah ke tab **Role & Akses**.

**Tambah role** — klik **Tambah Role** → isi **Nama Role** (mis. `Kasir`, `Koki`, `Supervisor`) → **Tambah**.

**Atur akses menu** — klik salah satu baris role di tabel → panel **Atur Akses Menu** terbuka:
- Centang menu yang boleh diakses role tersebut (Register, Pesanan, Laporan, Produk, Pajak & Diskon, dll).
- Gunakan **Pilih Semua** untuk memberi semua akses sekaligus.
- Perubahan tersimpan langsung saat dicentang.

**Ubah nama role** — klik pensil → ganti nama → **Simpan**.

**Hapus role** — klik tong sampah → konfirmasi. ⚠️ Role yang masih dipakai karyawan tidak bisa dihapus.

> 💡 Pengaturan akses ini menentukan menu yang tampil di aplikasi POS untuk tiap role.

### 1.8 Produk

Buka menu **Produk** di sidebar. Data produk dibedakan **per outlet** — pilih outlet di bagian atas halaman.

**Lihat daftar** — tabel produk dengan kategori, harga, status aktif/nonaktif; cari & filter kategori.

**Tambah produk** — klik **Tambah Produk** → form berisi:
- **Nama** (mis. `Es Kopi Susu`), **Kategori**, **Deskripsi**, status **Aktif**.
- **Harga** dasar + **harga per tier** (Dine In / Take Away) jika berbeda.
- **Gambar** — unggah JPG/PNG/WebP maksimal 2MB (otomatis dikompres).
- **Modifier** (opsional) — tambahan seperti Extra Shot/Oat Milk beserta selisih harganya.
- **Resep (Bahan Baku)** — daftar bahan + jumlah yang dipakai (mis. Espresso = 18 gr Espresso Beans + 1 Cup 16oz). Ini dasar perhitungan HPP di laporan laba rugi.

**Edit produk** — klik produk → ubah data → **Simpan**.

**Kelola kategori** — dari halaman Produk, buka pengelola kategori (tambah/ubah urutan/hapus).

**Kelola tier harga** — dari halaman Produk, buka pengelola tier (tambah tier seperti GoFood/Grab/Gojek, ubah urutan).

### 1.9 Pajak & Diskon

Buka menu **Pajak & Diskon** → pilih **outlet** di bagian atas. Ada 3 tab:

**Tab Pajak** — tambah pajak:
- **Nama** (mis. `PPN 11%`), **Tipe** (Persentase/Fixed), **Nilai** (mis. `11`), **Urutan**.
- Aktifkan/nonaktifkan lewat toggle. Pajak aktif otomatis dihitung di kasir.

**Tab Diskon Produk** — diskon untuk produk tertentu dalam periode tanggal:
- Nama, tipe (Persentase/Fixed), nilai, **tanggal mulai & berakhir**, pilih **produk**.
- Badge **Berjalan**/**Kadaluarsa** menunjukkan status periode.

**Tab Diskon Pesanan** — diskon untuk seluruh transaksi, dengan periode tanggal. Hanya diskon pertama yang aktif dipakai di kasir.

### 1.10 Laporan

Buka menu **Laporan** di sidebar.

**Laporan Laba Rugi**
- Pilih **rentang tanggal** (Hari Ini / Kemarin / Minggu Ini / Semua) dan **outlet**.
- Menampilkan: **Total Pendapatan**, **HPP (Harga Pokok Penjualan)** dari resep × harga bahan, **Laba Kotor**, **Total Pengeluaran**, **Laba Bersih**, dan jumlah transaksi.

**Kirim laporan via email** — klik **Kirim Email** → isi alamat email → sistem mengirim ringkasan laporan penjualan (total transaksi, pendapatan, item terlaris, 20 transaksi teratas).

### 1.11 Pesanan

Buka menu **Pesanan** di sidebar → pilih outlet.
- Menampilkan daftar order (nomor, waktu, total, metode bayar, status).
- Klik satu pesanan untuk melihat detail & **invoice** (bisa dicetak).

> Pesanan hanya untuk **lihat & cetak** — pembuatan pesanan dilakukan di aplikasi POS.

### 1.12 Pengaturan & QR Menu

Buka menu **Pengaturan** di sidebar. Terdiri dari 3 bagian:

**Profil Perusahaan** — nama & logo. Klik **Simpan** setelah mengubah.

**Menu QR**
- Menampilkan **QR code** untuk setiap outlet BUILD (Tembalang, Banyumanik, Pleburan).
- Klik **Salin URL** untuk menyalin link menu digital (mis. `https://pos-rakku.vercel.app/menu/build-tembalang`).
- Cetak & tempel di meja — pelanggan membuka menu tanpa login.

**Password Perusahaan** — ganti password yang dipakai kasir di **langkah 1 login POS** (minimal 6 karakter).

### 1.13 Langganan dan Batas Paket

Buka menu **Langganan** untuk melihat paket aktif, masa trial/berlangganan, penggunaan kuota, pilihan paket, dan riwayat invoice.

Paket yang tersedia:

| Paket | Batas utama |
|---|---|
| **Free** | 1 outlet, 2 karyawan, 30 produk, 10 bahan baku, 500 transaksi/bulan |
| **Pro** | 3 outlet, 15 karyawan, 500 produk, bahan baku tak terbatas, 5.000 transaksi/bulan |
| **Business** | Outlet, karyawan, produk, bahan baku, dan transaksi tak terbatas |

Fitur seperti role custom, laba rugi, email report, pembelian, dan stock opname mengikuti feature gate paket. UI menampilkan banner saat trial mendekati akhir atau penggunaan transaksi mencapai 80%.

**Upgrade paket**

1. Buka **Langganan**.
2. Pilih paket dan siklus bulanan/tahunan.
3. Sistem membuat invoice dan QRIS Vessel.
4. Scan QR, lalu tunggu status diperbarui otomatis atau klik **Saya sudah bayar**.
5. Setelah provider mengonfirmasi pembayaran, plan dan masa aktif diperbarui.

Invoice pending mempunyai waktu kedaluwarsa. Webhook provider, polling halaman, dan cron harian dapat menyinkronkan status invoice.

### 1.14 Saldo, Rekening, dan Tarik Dana

Buka menu **Saldo** (`/balance`) untuk melihat saldo hasil QRIS Dinamis Rakku.

- **Saldo tersedia** dapat diajukan untuk withdrawal.
- **Saldo pending** adalah dana yang sedang ditahan untuk pengajuan withdrawal.
- **Riwayat transaksi** menampilkan kredit penjualan, hold, pencairan, pengembalian hold, fee, dan adjustment.
- Pembayaran **QRIS Manual** tidak masuk saldo Rakku karena uang diterima langsung melalui QRIS merchant.

**Tambah rekening bank**

1. Buka bagian rekening di halaman Saldo.
2. Isi nama bank, nomor rekening, dan nama pemilik rekening.
3. Simpan dan pilih rekening default bila diperlukan.

**Ajukan tarik dana**

1. Pilih rekening tujuan.
2. Masukkan nominal minimal Rp50.000.
3. Kirim pengajuan. Sistem memindahkan nominal dari saldo tersedia ke saldo pending.
4. Superadmin memproses transfer manual.
5. Status menjadi **Selesai** setelah referensi/bukti transfer dicatat, atau **Ditolak** dan saldo dikembalikan.

Saat ini hanya satu withdrawal pending yang diizinkan per company dan batas pengajuan harian adalah Rp10 juta. Nilai ini berasal dari konstanta implementasi dan dapat berubah jika source diperbarui.

---

## Bagian 2 — POS Kasir

### 2.1 Login POS (4 Langkah)

Buka `https://pos-rakku.vercel.app/login`.

**Langkah 1 — Kode & Password Perusahaan**
- Kode: `BUILD`, Password: `build123`.
- Klik **Lanjut**.
- Pesan yang mungkin muncul:
  - *"Kode perusahaan tidak ditemukan"* (401).
  - *"Akun perusahaan dinonaktifkan"* (403).
  - *"Akun terkunci. Coba lagi beberapa menit."* (423) — setelah **10 kali** password salah, terkunci **15 menit**.
  - *"Password salah, sisa percobaan: N"*.

**Langkah 2 — Pilih Outlet**
- Pilih **BUILD COFFEE Tembalang** (atau cabang lain).
- Klik **Lanjut**.

**Langkah 3 — Pilih Akun**
- Pilih akun, mis. **`kasir-tembalang-1`** (atau **`owner`**).
- Klik **Lanjut**.

**Langkah 4 — Masukkan PIN**
- Masukkan **123456**, klik **Verifikasi**.
- Pesan yang mungkin muncul:
  - *"Akun terkunci 15 menit karena 5 kali salah PIN"* (423).
  - *"PIN salah, sisa percobaan: N"*.
- Berhasil → masuk ke halaman sesuai menu pertama yang diizinkan role (untuk Kasir = **Register**).

> **Logout / ganti akun:** dari menu pengguna (avatar) pilih **Keluar** atau **Ganti Pengguna**.

### 2.2 Register (Buat Pesanan)

Menu **Register** adalah layar utama kasir.

1. **Pilih produk** — geser kategori di atas (Minuman Kopi, Non-Kopi, dst), klik kartu produk (mis. **Cafe Latte**). Bisa cari lewat kotak pencarian.
2. **Pilih tier harga** — di atas daftar produk pilih **Dine In** atau **Take Away** (mengubah harga yang dipakai).
3. **Pilih modifier** (untuk produk kopi) — mis. **Oat Milk** (+Rp8.000), **Extra Shot** (+Rp5.000), atau **Less Ice** (gratis). Klik **Simpan**.
4. **Isi data pesanan** di panel kanan:
   - **Nama Pelanggan** (wajib).
   - **Meja** — pilih dari daftar (Meja 1–10).
   - Atur jumlah item (tambah/kurang), atau klik item untuk ubah/lihat rincian.
5. Pilih aksi:
   - **Bayar Nanti** → simpan sebagai **draft** (diteruskan ke pembayaran kapan pun, lihat §2.3).
   - **Payment** → langsung ke layar pembayaran.

> **Draft**: pesanan yang disimpan "Bayar Nanti" bisa diakses kembali dari panel draft di layar Register dan diselesaikan pembayarannya.

### 2.3 Pembayaran

Di layar pembayaran:

1. **Pilih metode bayar**:
   - **Tunai** — isi nominal uang; sistem menghitung **kembalian** dan menyediakan saran nominal.
   - **QRIS Manual** — catat pembayaran dari QRIS milik merchant. Dana tidak masuk saldo Rakku.
   - **QRIS Dinamis (Rakku)** — sistem membuat QR unik via Vessel dan menunggu konfirmasi pembayaran.
   - **Kartu** — catat transaksi sebagai pembayaran kartu.
2. **Split Bill** (opsional) — bagi pesanan ke beberapa orang: pilih pembagian item per orang, masing-masing dengan metode bayar sendiri. Semua item harus terbagi.
3. Untuk Tunai, QRIS Manual, atau Kartu, klik **Bayar** → pesanan selesai (`completed`, `paid`) → invoice muncul.
4. Untuk QRIS Dinamis, scan QR dan tunggu polling status. Setelah provider mengonfirmasi, order diselesaikan, stok dipotong, meja diperbarui, dan saldo merchant dikredit setelah MDR.

**QRIS Dinamis**

- QR berlaku sekitar 15 menit dan status dicek otomatis setiap beberapa detik.
- Jika kedaluwarsa, kasir dapat membuat QR baru (**Coba Lagi**) atau membatalkan order pending.
- QRIS Dinamis dinonaktifkan untuk split bill dan penyelesaian draft.
- MDR memakai model pass-through 0,7%; saldo merchant menerima gross dikurangi pembulatan MDR.
- Refund otomatis belum tersedia. Koreksi saldo dilakukan manual oleh superadmin dan tercatat di ledger.

### 2.4 Daftar Pesanan

Menu **Pesanan**:
- Ringkasan: total transaksi, total pendapatan, rata-rata.
- **Filter**: Semua / Hari Ini / 7 Hari Terakhir.
- **Cari** berdasarkan nomor order (mis. `#...`).
- **Pagination**: 10/20/50/100 per halaman.
- Klik baris untuk membuka detail; ikon printer → **cetak ulang invoice**.

> Daftar ini **read-only** — tidak ada batal/refund/ubah status dari sini.

### 2.5 Meja

Menu **Meja**:
- Tampilan grid/daftar meja dengan status **Tersedia**/**Terisi**.
- **Generate Meja** — buat sekaligus "Meja N" (maksimal 100, melanjutkan nomor terakhir).
- **Tambah/Edit** meja manual, **nonaktifkan/aktifkan**, **hapus** (dengan konfirmasi).

### 2.6 Menu QR Publik (untuk Pelanggan)

Pelanggan membuka link/scan QR (dari Pengaturan owner, §1.12), mis. `https://pos-rakku.vercel.app/menu/build-tembalang`.

Yang tampil:
- Nama outlet + header "Scan & order — menu digital".
- Daftar kategori dengan produk (gambar, nama, deskripsi, harga).
- Harga yang tampil adalah harga dasar produk (tier/modifier **tidak** ditampilkan ke publik).

Bersifat **view-only** — pelanggan tidak bisa memesan dari sini (pemesanan dilakukan kasir di Register). Jika menu kosong muncul teks *"Menu belum tersedia"*.

### 2.7 Laporan

Menu **Laporan** (untuk role yang punya akses):
- Pilih rentang tanggal → ringkasan **total pendapatan**, **jumlah transaksi**, **item terlaris**.
- **Kirim Email** → laporan HTML dikirim ke alamat email yang diisi.

### 2.8 Bahan Baku (Stok)

Menu **Bahan Baku** (role Owner/Kepala Cabang/Admin):
- Daftar bahan dengan stok, satuan (gram/ml/pcs/kg/liter), biaya per unit, **alert stok minimum**.
- Bahan yang stoknya di bawah minimum ditandai ikon **peringatan** (badge di menu).
- **Tambah bahan** → form: nama, satuan, stok, min stok, biaya per unit.
- **Opname / Penyesuaian stok** → atur jumlah stok baru (validasi non-negatif).
- **Edit/Hapus/Aktifkan** bahan.
- Stok bahan otomatis **berkurang** setiap transaksi yang memakai produk dengan resep (potong stok otomatis).

### 2.9 Pembelian

Menu **Pembelian** (role Owner/Kepala Cabang/Admin):
- Daftar pembelian yang sudah tercatat.
- **Tambah Pembelian** → form: **supplier**, tanggal, catatan, dan baris item (bahan + jumlah + biaya per unit) → total otomatis dihitung.
- Setelah disimpan, **stok bahan otomatis bertambah** sesuai jumlah yang dibeli.

### 2.10 Pengeluaran

Menu **Pengeluaran** (role Owner/Kepala Cabang/Admin):
- Kelola pengeluaran operasional dengan kategori preset: **Listrik, Air, Galon, Plastik/Kemasan, Gaji, Sewa, Bahan Lain, Lainnya**.
- Tambah/edit/hapus pengeluaran. Data ini dipakai laporan **Laba Rugi** (total pengeluaran).

### 2.11 Produk (Admin POS)

Menu **Produk** (role Owner/Kepala Cabang/Admin) — CRUD lengkap sama seperti Portal Owner (§1.8), langsung di konteks outlet yang sedang aktif:
- Tambah/edit/hapus produk, aktif/nonaktif.
- Unggah gambar produk.
- Kelola **kategori**, **tier harga**, **modifier**, dan **resep** (bahan baku per produk).

### 2.12 Pajak & Diskon (POS)

Menu **Pajak & Diskon** — mengelola pajak dan diskon untuk outlet aktif, sama seperti Portal Owner (§1.9). Perubahan langsung berlaku di kasir.

---

## Bagian 3 — Ringkasan Alur Peran

### 3.1 Alur Kasir (mis. `kasir-tembalang-1`)

1. Login 4 langkah: `BUILD` + `build123` → pilih outlet → pilih akun → PIN `123456`.
2. Register: pilih produk → tier → modifier → meja → nama pelanggan → **Bayar Nanti** atau **Payment**.
3. Pembayaran (Tunai/QRIS Manual/QRIS Dinamis/Kartu) → invoice.
4. Cek daftar pesanan & cetak ulang invoice.
5. Kelola meja (generate/tandai tersedia).

### 3.2 Alur Owner (mis. `owner`)

1. Login Portal Owner: `owner@build.test` / `build12345`.
2. Dashboard → pantau outlet/karyawan/penjualan.
3. Kelola outlet, karyawan, role & akses.
4. Kelola produk (termasuk harga tier, gambar, resep), pajak & diskon.
5. Lihat Laporan Laba Rugi & kirim email laporan.
6. Cetak/salin QR menu dari Pengaturan.
7. Pantau paket dan kuota di Langganan.
8. Pantau saldo QRIS Dinamis, rekening, dan withdrawal di Saldo.
9. Bisa juga login ke POS sebagai `owner` (PIN `123456`) untuk mencatat transaksi di semua outlet.

### 3.3 Alur Setup Bisnis Baru (ringkas)

1. Registrasi → verifikasi email → onboarding (buat company, outlet, tier, role default, dan trial Pro).
2. Tinjau role default; buat role custom dan atur hak akses bila paket mendukung.
3. Tambah karyawan (nama, username, PIN, role, outlet).
4. Tambah produk + kategori + tier + modifier + resep.
5. Atur pajak & diskon.
6. Tambah bahan baku + catat pembelian.
7. Cetak QR menu untuk tiap outlet.
8. Kasir mulai login & bertransaksi.

---

## Catatan

- Panduan ini mencerminkan **sistem saat ini** — menu **Outlet** dan **Karyawan** di Portal Owner masih terpisah di sidebar.
- Tier **GoFood / Grab / Gojek** tersedia di pengelola tier harga dan dapat ditambahkan per outlet, tetapi contoh BUILD hanya memakai **Dine In** dan **Take Away**.
- Metode pembayaran mendukung **Tunai, QRIS Manual, QRIS Dinamis, dan Kartu**, plus **Split Bill** dengan batasan QRIS Dinamis di atas.
- Seluruh contoh data (akun, outlet, menu, meja, role) berasal dari seed **BUILD COFFEE**.
- Hak akses POS saat ini menentukan menu yang tampil, tetapi belum seluruh API menegakkan izin create/edit/delete. Batasi akses deployment sampai hardening server-side selesai.
- Sistem belum menyediakan alur refund QRIS otomatis.
