// One source for visible answers and JSON-LD; both must describe the same product.
export const questions = [
  ["Apakah Rakku hanya untuk cafe?", "Rakku paling cocok untuk kedai kopi, cafe, dan bisnis F&B kecil yang memiliki produk, transaksi, bahan baku, dan satu atau beberapa outlet."],
  ["Apakah ada paket gratis?", "Ada. Paket Free berlaku selamanya untuk 1 outlet, 2 karyawan, 30 produk, dan 500 transaksi per bulan. Fitur kasir inti seperti register, pesanan, draft, split bill, resep, dan QR menu tetap bisa dipakai."],
  ["Bagaimana cara upgrade dan membayar?", "Upgrade dilakukan dari halaman Langganan di dashboard Owner. Pembayaran memakai QRIS, lalu paket aktif otomatis setelah pembayaran berhasil. Pendaftar baru juga mendapat trial Pro 14 hari."],
  ["Apa yang terjadi kalau kuota transaksi habis?", "Transaksi masih bisa berjalan selama masa tenggang (tambahan 10% atau 3 hari). Setelah itu transaksi baru diblokir sampai upgrade — data lama tetap bisa diakses."],
  ["Kalau turun paket, apakah data hilang?", "Tidak. Data tetap tersimpan; hanya pembuatan baru di atas limit yang diblokir dan fitur Pro terkunci sampai upgrade lagi."],
  ["Apakah stok langsung berkurang saat transaksi?", "Ya. Setelah order berstatus selesai, stok bahan berkurang mengikuti resep produk dan tercatat di stock movement."],
  ["Apakah stok yang kurang akan memblokir transaksi?", "Tidak. Stok boleh minus agar operasional tidak berhenti. Rakku memberi peringatan supaya tim bisa melakukan pengecekan atau restock."],
  ["Apakah menu QR bisa menerima pesanan langsung?", "Belum. Menu QR pada fase ini bersifat view-only. Pelanggan dapat melihat katalog dan harga tanpa login atau memasang aplikasi."],
  ["Siapa yang bisa melihat laporan laba?", "Laporan HPP dan laba rugi ditujukan untuk Owner. Akses menu dapat diatur sesuai role perusahaan."],
  ["Apakah Rakku bisa memproses transaksi tanpa internet?", "Transaksi kasir Rakku membutuhkan koneksi internet. Pemasangan POS sebagai PWA tidak menyediakan antrean transaksi offline."],
] as const;
