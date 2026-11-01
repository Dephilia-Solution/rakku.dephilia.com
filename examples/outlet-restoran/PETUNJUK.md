# Contoh Outlet Restoran — Dapur Nusantara

File utama: **Dapur-Nusantara-Outlet-Lengkap.xlsx**.

Workbook ini berisi contoh data fiktif restoran keluarga dengan masakan Indonesia. Harga, biaya, dan stok awal adalah asumsi untuk contoh pengisian, bukan penawaran pemasok atau data harga pasar.

Dataset mencakup **36 menu dalam 8 kategori**, **75 bahan baku**, **347 baris komposisi per porsi**, serta referensi **12 meja / 48 kursi**. Nilai stok awal contoh adalah **Rp12.043.500**; harga jual menu berkisar **Rp7.000–Rp75.000**.

## Import ke Rakku

1. Pilih outlet tujuan yang masih kosong atau belum memiliki nama produk/bahan yang sama.
2. Buka **Outlet → Kelola Outlet → Produk → Import**.
3. Unggah workbook lengkap ini satu kali. Import Produk juga membaca sheet **BahanBaku** dan **Komposisi**.
4. Periksa preview produk, bahan baru, komposisi, dan kuota paket, lalu konfirmasi setelah semua baris valid.

**Jangan mengimpor sheet bahan secara terpisah sebelum mengimpor workbook lengkap ini.** Baris bahan pada contoh memiliki stok dan biaya awal nonnol untuk pembuatan bahan baru. Jika bahan tersebut sudah ada, gunakan referensi `id_bahan`/nama+satuan yang benar dan kosongkan atau isi 0 pada kolom pembukaan bahan lama.

Pastikan migrasi `0016_owner_inventory_and_composition.sql` telah diterapkan pada environment tujuan sebelum menjalankan import bahan dan komposisi. Kuota produk dan bahan baku harus mencukupi; jumlah yang dibutuhkan tertera pada sheet **Ringkasan**.

## Isi workbook

| Sheet | Fungsi |
|---|---|
| `Produk` | Menu, kategori, harga jual, deskripsi, dan kode produk lokal file; dibaca importer Produk. |
| `BahanBaku` | Satuan, stok awal, biaya per satuan, stok minimum, dan kode bahan; dibaca importer. |
| `Komposisi` | Pemakaian bahan per satu porsi produk; dibaca importer. Kolom tambahan menyediakan keterangan dan perhitungan. |
| `EstimasiHPP` | Perhitungan HPP, selisih harga dengan bahan, rasio biaya bahan, dan jumlah jenis bahan per menu; referensi. |
| `Ringkasan` | Ringkasan outlet, jumlah data, nilai stok awal, dan grafik perbandingan harga/HPP; referensi. |
| `ProfilOutlet` | Identitas fiktif outlet dan asumsi operasional; diisi manual di aplikasi. |
| `Meja` | Contoh nama meja, status, area, dan kapasitas referensi; diisi manual di aplikasi. |
| `Petunjuk` | Cara pengisian, formula, dan aturan import. |

## Aturan satuan dan biaya

- Komposisi adalah jumlah **per satu porsi**, bukan untuk satu batch masak.
- Bahan yang dicatat dalam **gram** harus dipakai dalam gram; bahan **ml** dalam ml; bahan **pcs** dalam pcs.
- `biaya_per_satuan` mengikuti satuan tersebut: beras Rp16/gram setara Rp16.000/kg.
- Kolom `id_bahan` sengaja kosong karena contoh ini membuat bahan baru.
- `kode_produk` dan `kode_bahan` adalah kode penghubung di workbook, bukan SKU atau ID database yang dibuat aplikasi.
- Angka maksimum dua desimal dan tidak menggunakan pemisah ribuan pada data import.
- Harga menu belum memasukkan pajak dan biaya layanan. HPP mencakup bahan yang tercantum, bukan gaji, sewa, gas/listrik, susut tambahan, atau kemasan takeaway.
- Jumlah minyak pada resep adalah alokasi pemakaian per porsi, bukan seluruh isi penggorengan.
- Setiap menu memakai stok bahan bersama; stok awal bukan jaminan kapasitas penjualan gabungan seluruh menu.

## Mengedit contoh

Pertahankan nama sheet import dan judul kolom pada baris pertama. Tambahkan menu beserta kode uniknya di `Produk`, bahan baru di `BahanBaku`, dan hubungan bahan per menu di `Komposisi`. Formula HPP menggunakan data dari sheet tersebut. Excel akan menghitung ulang formula saat workbook dibuka atau data diubah.

## Hasil pemeriksaan file

- Parser dan validasi importer aplikasi: **0 kesalahan**.
- Import percobaan pada PostgreSQL in-memory terisolasi: **36 produk, 75 bahan, 347 komposisi, dan 8 kategori** berhasil dibuat.
- **75 pencatatan stok awal** dibuat dengan pelaku Owner.
- Nilai HPP seluruh **36 menu** sesuai hasil perhitungan dari database percobaan.
- Pengulangan konfirmasi batch tidak menggandakan data.
- Pemeriksaan ini tidak memakai atau mengubah database aktif.
