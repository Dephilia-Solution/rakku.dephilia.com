# Isolasi environment Rakku

Profil `development.env.example`, `staging.env.example`, dan `production.env.example` hanya template audit tanpa kredensial. Salin manual ke nama yang sama dengan akhiran `.env.local` setelah resource terpisah tersedia; file lokal tersebut sudah tercakup aturan ignore. Jangan menyalin konfigurasi production ke development/staging.

`pnpm env:check` bersifat read-only. Ia membaca tiga profil, konfigurasi efektif Owner/POS/Superadmin, `.env.local` root dan `.env.neon`; tidak memuat nilai ke `process.env`, tidak membuka koneksi DB, dan tidak memanggil provider. Kegagalan hanya mencetak kode, label file dan nama variabel. URL, password, token dan fingerprint tidak dicetak, termasuk pada URL yang tidak valid.

Pemeriksaan menolak database yang sama walaupun memakai hostname pooler/direct atau role berbeda; endpoint Auth, secret sesi, key/account provider dan URL aplikasi yang sama lintas environment; role migrator/runtime yang tidak terpisah; TLS yang tidak memverifikasi sertifikat; serta file aplikasi yang tidak cocok dengan profil environment yang ditinjau. Pemakaian endpoint API vendor yang sama diperbolehkan bila akun dan key terpisah. `VESSEL_MODE` dan `*_ACCOUNT_ID` adalah metadata audit, bukan konfigurasi yang mengubah perilaku provider.

Next.js tetap membaca `.env.local` ketika build/start production. Checker memodelkan urutan `.env` → `.env.production` → `.env.local` → `.env.production.local` (nilai paling akhir menang). Di deployment, variabel proses dari platform menang atas file; checker lokal ini tidak membuktikan nilai efektif di platform. Staging berjalan dengan `NODE_ENV=production` dan `RAKKU_ENVIRONMENT=staging`, dengan nilai diinjeksi eksplisit melalui secret store/CI; Next tidak otomatis membaca `staging.env.local`. Jangan memasukkan file profil lengkap ke bundle atau environment publik.

## Urutan persiapan resource

1. Buat DB/branch Neon development dan staging terpisah dari production, dengan data uji sintetis. Jangan memakai salinan data pribadi production tanpa prosedur tersendiri. Pastikan endpoint DB dan endpoint Neon Auth masing-masing sesuai branch/target.
2. Gunakan role `rakku_runtime` dengan NOBYPASSRLS, tanpa ownership/create privilege, serta role migrator terpisah melalui endpoint direct. URL remote menggunakan `sslmode=verify-full`. Checker tidak dapat membuktikan grants/ownership/privilege role tanpa pemeriksaan DB terotorisasi.
3. Sediakan akun/key sandbox Vessel serta akun/sender Echo dan bucket/account Silos yang terpisah untuk setiap environment. Tinjau izin, saldo, webhook, callback, allowed origins dan recipient email melalui kontrol provider. Key berbeda saja tidak membuktikan akun, saldo atau bucket terisolasi.
4. Buat secret Owner, POS, cookie Neon Auth dan cron yang independen untuk tiap environment/purpose. Simpan di secret store. Mengganti secret aktif akan memutus sesi; rotasi aktif harus melalui rollout terpisah. `VESSEL_WEBHOOK_SECRET` opsional dan hanya diisi setelah kontrak signature provider dikonfirmasi; bila dipakai, nilainya harus terpisah per environment dan tidak masuk log.
5. Isi profil audit secara privat, kemudian sesuaikan konfigurasi aplikasi/deployment target melalui prosedur yang ditinjau. Jangan copy seluruh profil ke tiap aplikasi: migrator credentials tidak boleh diberikan ke runtime aplikasi. Owner membutuhkan Owner secret, POS membutuhkan POS secret, Superadmin membutuhkan Auth cookie secret.
6. Jalankan `pnpm test:env` dan `pnpm env:check`. Tinjau semua mismatch. Tidak ada mode force/skip yang menyatakan isolasi berhasil bila profil hilang atau resource dibagi.
7. Sebelum migrasi/deploy, lakukan pemeriksaan read-only target platform, Auth issuer/origin, privilege role dan identitas provider terhadap profil yang telah ditinjau. Bukti tersebut, backup/restore point dan acceptance staging tetap wajib; perbandingan string lokal tidak menggantikannya.

## Build dan regresi tanpa resource aktif

PowerShell:

```powershell
$env:RAKKU_BUILD_DIRECTORY = '.next-hardening-phase1'
pnpm build:isolated owner pos superadmin landing
pnpm test:auth:http
$env:PLAYWRIGHT_MODULE_PATH = '<lokasi instalasi playwright lokal>'
$env:DEMO_OWNER_URL = 'http://127.0.0.1:3550'
$env:DEMO_POS_URL = 'http://127.0.0.1:3551'
pnpm test:demo:browser --isolated-build
```

Build terisolasi mengarahkan DB/Auth/provider ke loopback port tertutup dan menggunakan secret sintetis. Hasilnya bukan artefak deployment. Runner hanya menghentikan proses yang dibuat sendiri. Gunakan nama direktori unik bila ada pekerjaan lain dalam checkout yang sama.

Status 17 Oktober 2026: profil terisolasi belum diisi/provision; checker menolak konfigurasi yang sekarang dibagi lintas target. Tidak ada environment aktif yang diubah dalam fase ini.
