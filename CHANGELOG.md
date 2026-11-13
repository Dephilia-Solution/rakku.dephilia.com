# Riwayat Pembaruan Rakku

> Berkas ini dihasilkan dari `apps/owner/src/content/release-notes.json` dengan `pnpm changelog:generate`. Ubah sumbernya, bukan berkas ini.
> Versi produk, deployment masing-masing aplikasi, dan migrasi database adalah hal berbeda. Status deployment dan migrasi harus diverifikasi pada environment tujuan.

## Belum dirilis

Perubahan berikut tercatat di source, tetapi belum dinyatakan sebagai rilis produk atau deployment production.

### Fitur baru

- [Superadmin, Owner, Landing] Promo pendaftaran dengan hak Pro 3 bulan kalender; memerlukan migrasi 0020.
- [Owner] Halaman riwayat pembaruan dan informasi versi build, dengan changelog bersama untuk tim.

### Peningkatan

- [Owner] Dashboard analitik, pengelolaan outlet, dan impor Excel untuk produk, bahan, karyawan, serta pembelian; kebutuhan migrasi dijelaskan di OWNER_UPGRADE.md.
- [Landing] Informasi dan S&K promo pendaftaran ditampilkan langsung di paket Pro.

### Perbaikan

- [Owner, POS] Perbaikan hydration pada grafik dashboard dan tampilan yang bergantung pada tanggal, zona waktu, atau waktu perangkat.

## v6.1.0 — tonggak historis

Tonggak awal pencatatan versi Rakku, berdasarkan riwayat pengembangan v6.1.

Tanggal rilis dan status deployment tidak diketahui; versi ini menjadi baseline dokumentasi.

### Ringkasan pengguna

- Pembayaran QRIS dinamis di kasir.
- Informasi saldo dan pengajuan pencairan untuk pemilik usaha.
- Pemantauan pencairan dan rekonsiliasi pembayaran.

### Catatan teknis

- M1–M4: ledger saldo merchant, QRIS dinamis Vessel, rekening dan withdrawal manual, serta rekonsiliasi dan analytics.
- Nomor migrasi Supabase historis 028–031 bukan penanda migrasi database Neon aktif.
