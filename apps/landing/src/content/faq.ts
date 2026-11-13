// One source for visible answers and JSON-LD; both must describe the same product.
export const questions = [
  ["Rakku cocok untuk usaha seperti apa?", "Rakku cocok untuk kedai kopi, cafe, dan resto yang ingin menghubungkan kasir, resep, stok bahan, dan laporan. Kamu bisa mulai dari satu outlet dan menambah cabang sesuai paket."],
  ["Apakah ada paket gratis?", "Ada. Paket Free mencakup 1 outlet, 2 karyawan, 30 produk, 10 bahan baku, dan 500 transaksi per bulan. Kasir, pesanan, draft, split bill, resep, serta QR menu tersedia untuk mulai berjualan."],
  ["Bagaimana masa akses gratis pengguna baru dihitung?", "Ikuti paket, durasi, dan S&K pada penawaran yang sedang aktif. Masa akses dihitung sejak daftar akun. Contoh: jika kamu mendapat 3 bulan kalender saat daftar 31 Desember 2026, akses berakhir 31 Maret 2027. Batas pendaftaran promo tidak memotong hak yang sudah diberikan. Tanpa promo aktif, akun baru menggunakan paket Free."],
  ["Bagaimana cara upgrade dan membayar?", "Buka halaman Langganan di dashboard Owner, pilih paket serta siklus pembayaran, lalu bayar lewat QRIS. Paket aktif setelah pembayaran berhasil. Harga langganan dan penawaran pengguna baru ditampilkan terpisah agar kamu bisa membaca ketentuannya."],
  ["Apa yang terjadi kalau kuota transaksi habis?", "Ada masa tenggang terbatas: tambahan 10% transaksi atau 3 hari, mana yang lebih dulu tercapai. Setelah itu transaksi baru diblokir sampai upgrade. Data lama tetap bisa diakses."],
  ["Kalau turun paket, apakah data hilang?", "Tidak. Data tetap tersimpan; hanya pembuatan baru di atas limit yang diblokir dan fitur Pro terkunci sampai upgrade lagi."],
  ["Kapan stok bahan berkurang?", "Setelah transaksi selesai, Rakku mencatat pemakaian bahan sesuai resep dan jumlah porsi terjual. Misalnya, dua Kopi Susu Gula Aren pada contoh resep memakai 36 g kopi dan 300 ml susu. Add-on memengaruhi harga; pemakaian bahan mengikuti resep produk utama."],
  ["Apakah stok yang kurang akan memblokir transaksi?", "Tidak. Stok boleh minus agar operasional tidak berhenti. Rakku memberi peringatan supaya tim bisa melakukan pengecekan atau restock."],
  ["Apakah menu QR bisa menerima pesanan langsung?", "Belum. Menu QR pada fase ini bersifat view-only. Pelanggan dapat melihat katalog dan harga tanpa login atau memasang aplikasi."],
  ["Apa yang bisa dilihat dari dashboard dan laporan?", "Dashboard Owner menampilkan penjualan, tren transaksi, menu favorit restomu, dan bahan yang mencapai stok minimum. Laporan HPP dan laba rugi tersedia mulai paket Pro; akses menu tim mengikuti role yang kamu atur."],
  ["Apakah Rakku bisa memproses transaksi tanpa internet?", "Transaksi kasir Rakku membutuhkan koneksi internet. Pemasangan POS sebagai PWA tidak menyediakan antrean transaksi offline."],
] as const;
