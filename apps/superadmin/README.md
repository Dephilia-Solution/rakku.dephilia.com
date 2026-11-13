# Rakku Superadmin — development lokal

Dari root repository:

```powershell
pnpm dev:superadmin
```

Default: `http://localhost:3002`. Argumen Next dapat diteruskan, misalnya `pnpm --filter @rakku/superadmin dev --port 3012`.

## Perbaikan crash alokasi memori Windows

Gejala yang diperiksa:

- Proses berhenti ketika mengompilasi `/login/page`.
- `RangeError: Array buffer allocation failed`.
- Webpack `Caching failed for pack`.
- V8 `Committing semi space failed` / `JavaScript heap out of memory`, diikuti exit 134 atau native Windows fail-fast.

Pada mesin yang diperiksa, drive C hanya mempunyai beberapa ratus MB ruang kosong dan memori virtual/commit bebas sangat terbatas. Batas heap otomatis Next dev berdasarkan total RAM bukan ukuran memori yang masih tersedia. Penulisan cache filesystem Webpack juga membutuhkan buffer native di luar heap V8.

Perbaikannya:

1. `scripts/dev-superadmin.mjs` memberikan default **heap 1024 MiB / semi-space 8 MiB** lewat `NODE_OPTIONS` hanya kepada proses Next dev dan turunannya. Ini penting karena versi Next yang terpasang dapat mengganti batas heap yang hanya diberikan sebagai argumen CLI Node. `NODE_OPTIONS` yang sudah ditentukan operator tetap dihormati.
2. `next.config.mjs` memakai cache **memory / maxGenerations: 1** pada development. Tahap serialisasi pack filesystem tidak dipakai. Restart bisa memerlukan kompilasi awal lagi; proses dev tetap mempunyai cache memori untuk sesi yang berjalan.
3. Hook cache tersebut hanya ditambahkan ketika `NODE_ENV=development`. Build production mempertahankan konfigurasi cache/build worker default.

Perubahan ini mengurangi tekanan memori compiler, tetapi tidak menambah kapasitas RAM, pagefile atau disk Windows. Kosongkan beberapa GB di drive C dan tutup dev server/aplikasi berat yang sedang tidak digunakan. Bila drive C terus sempit, periksa konfigurasi virtual memory/pagefile melalui pengaturan Windows pada drive yang mempunyai ruang cukup. Sesi coding ini tidak mengubah pagefile atau menghapus file pengguna.

### Pengaturan opsional

- `RAKKU_SUPERADMIN_HEAP_MB` mengubah default heap, 256–8192 MiB, jika tidak ada batas eksplisit di `NODE_OPTIONS`. Atur lewat environment terminal sebelum menjalankan perintah dev.
- `RAKKU_SUPERADMIN_DISK_CACHE=1` mengembalikan cache filesystem development. Gunakan setelah resource mesin memadai jika ingin mengutamakan cache antar-restart.
- Menaikkan heap tidak menyelesaikan kehabisan commit Windows; sesuaikan dengan memori yang benar-benar tersedia.

## Verifikasi regresi

```powershell
node --test scripts/dev-superadmin.test.mjs
node scripts/test-superadmin-dev.mjs
pnpm --filter @rakku/superadmin typecheck
pnpm typecheck:scripts
```

Empat uji launcher/config lulus: batas efektif di proses Node, penghormatan opsi operator, validasi override, dan pemisahan cache dev/production.

Uji server memanggil script dev Superadmin dengan port loopback pengujian dan output `.next-hardening-superadmindev`. **Start dan restart berhasil:** `/login` HTTP 200, tujuh aset halaman HTTP 200, request berikutnya HTTP 200, dan proses tetap hidup setelah pemeriksaan idle/cache tanpa pesan alokasi buffer gagal. Auth/DB/provider diarahkan ke loopback yang diblokir; uji ini memeriksa kompilasi dan penyajian login, bukan autentikasi akun online.

Log/hasil pengujian: `.temp/opencode/superadmin-dev-memory/{first-start.log,restart.log,results.json}`. `cold.log` di folder tersebut adalah percobaan awal yang masih memakai cache filesystem dan menunjukkan bahwa pembatasan heap saja belum cukup.
