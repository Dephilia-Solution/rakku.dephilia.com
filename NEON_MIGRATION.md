# Rakku: konfigurasi dan migrasi penuh ke Neon

Dokumen ini adalah panduan developer/operator untuk konfigurasi Neon, deployment, aktivasi Superadmin, dan pemulihan. Referensi arsitektur/schema/API ada di [DOCS.md](DOCS.md); quick start ada di [README.md](README.md). Dokumentasi diselaraskan pada 12 Oktober 2026; hasil rollout di bawah berasal dari pemeriksaan 8 Oktober 2026.

## Daftar isi

- [Setup aktif dan status verifikasi](#setup-aktif-database-baru-dan-akun-demo)
- [Environment dan domain](#environment-dan-domain)
- [Runtime aktif](#runtime-aktif)
- [1. Project, Auth, dan role](#1-siapkan-project-auth-dan-role)
- [2. Environment variables](#2-environment-variables)
- [3. Instalasi database baru](#3-baseline-dan-database-development-kosong)
- [4. Superadmin](#4-superadmin-invitation-dan-aktivasi)
- [5. Otorisasi dan transaksi](#5-otorisasi-dan-transaksi)
- [6. Deploy dan verifikasi](#6-deploy-dan-verifikasi-environment)
- [7. Copy source opsional](#7-opsional-rekonsiliasi-dan-copy-source-lama)
- [8. Pemulihan dan rollback](#8-pemulihan-dan-rollback)
- [9. Pemeriksaan kode](#9-pemeriksaan-kode)

## Setup aktif: database baru dan akun demo

Keputusan instalasi saat ini adalah **database baru**, tanpa memulihkan data Supabase lama. Baseline 4 migration sudah diterapkan, runtime role `rakku_runtime` sudah dibuat, dan Managed Better Auth pada database yang sama sudah terverifikasi.

`.env.neon` menjadi sumber konfigurasi privat. Root `.env.local` dipakai script; `.env.local` dan `.env.production.local` masing-masing app sudah memakai pooled runtime URL yang sama. File production yang tracked hanya berisi URL publik. Variabel Supabase, SMTP legacy, `PG*`, dan template `POSTGRES_*` telah dibersihkan dari konfigurasi aktif.

| Akun demo | Credential |
|---|---|
| Owner | `demo_owner@rakku.test` / `DemoOwner2026!` |
| Company POS | kode `DEMO` / `DemoPOS2026!` |
| Kasir POS | `kasir_demo` / PIN `123456` |

Demo berisi satu Owner, satu kasir, satu outlet, dua produk, satu meja, dua pricing tier, dan opening stock yang memiliki audit trail. Trial Pro berlaku 14 hari. `pnpm db:demo` idempotent: tidak menggandakan akun atau mereset stok/credential existing.

Superadmin `alifdhimasctr@gmail.com` sudah aktif dalam allowlist dengan role `superadmin`. Aktivasi dan penggunaan invitation terkonfirmasi pada `2026-10-08T17:01:33.265Z`. Password dibuat dan diuji oleh pemilik akun; tidak ada password/session admin yang diambil verifier otomatis.

Instalasi terverifikasi memakai PostgreSQL 18.6, database `neondb`, runtime role `rakku_runtime` (`NOINHERIT NOBYPASSRLS`), dan migration owner `neondb_owner` pada endpoint direct. Migration owner memiliki hak bypass RLS; hanya runtime role yang dipasang pada aplikasi. Owner/POS/Superadmin lokal dan deployment yang diverifikasi memakai resource Neon yang sama. Pemisahan branch/database development-production belum diterapkan.

### Hasil verifikasi pascadeploy

- Owner development `https://rakku.vercel.app`: login demo, session, dan dashboard lulus.
- POS development `https://pos-rakku.vercel.app`: guard API anonim, login company/outlet/user/PIN, catalog/register, dan menu QR publik lulus.
- Superadmin `https://superadmin-rakku.vercel.app`: `/activate`, proxy Neon Auth, dan guard anonim lulus. Developer telah menyelesaikan aktivasi akun; allowlist Neon mengonfirmasi email admin berstatus `active`, role `superadmin`, dan invitation memiliki `used_at`.
- Superadmin production `https://admin.rakku.dephilia.com`: masih mengembalikan 404 untuk `/activate` dan `/api/auth/get-session` saat pemeriksaan ini; assignment project/deployment Vercel perlu disamakan dengan URL Vercel.
- Production Owner `https://app.rakku.dephilia.com`, POS `https://pos.rakku.dephilia.com`, dan Landing `https://rakku.dephilia.com`: domain telah dikonfirmasi, belum ada hasil smoke test tercatat.

Sesuai keputusan developer, invitation terakhir memakai URL Vercel yang berfungsi. Root script `.env.local` / `.env.neon` memakai `SUPERADMIN_URL=https://superadmin-rakku.vercel.app`. Konfigurasi app production masih mencantumkan domain custom dengan alias Vercel. Kedua domain dan `http://localhost:3002` telah diterima trusted origins Neon Auth. Invitation pending sebelumnya dibatalkan saat link baru diterbitkan.

Rollout Neon telah terverifikasi pada URL **development Vercel**. Perbaikan assignment custom domain ditunda. Instalasi aktif tidak membutuhkan baseline/seed ulang. Status tersebut bukan klaim bahwa semua domain production atau transaksi pembayaran nyata telah diuji.

```powershell
pnpm smoke:production --vercel-only
pnpm admin:status
```

Nama script `smoke:production` berasal dari rollout awal. Defaultnya menguji Owner/POS Vercel dan kedua host Superadmin; flag `--vercel-only` melewati custom domain Superadmin. Smoke melakukan login dan membaca data, tanpa membuat order/provider payment atau mengubah stok; login dapat menambah audit event dan memperbarui waktu login. Default masih gagal pada hasil pemeriksaan terakhir karena custom domain 404.

## Environment dan domain

| App | Localhost | Development (Vercel) | Production (Dephilia) |
|---|---|---|---|
| Landing | `http://localhost:3003` | URL belum dikonfirmasi | `https://rakku.dephilia.com` |
| Owner | `http://localhost:3000` | `https://rakku.vercel.app` | `https://app.rakku.dephilia.com` |
| POS | `http://localhost:3001` | `https://pos-rakku.vercel.app` | `https://pos.rakku.dephilia.com` |
| Superadmin | `http://localhost:3002` | `https://superadmin-rakku.vercel.app` | `https://admin.rakku.dephilia.com` |

Development/production di tabel adalah klasifikasi Rakku. Deployment URL Vercel dapat tetap berada pada environment Vercel **Production** dan memakai build Next.js production. Nama `.env.production` juga tidak membuktikan bahwa nilai di dalamnya sudah menunjuk domain Dephilia.

**Profil URL yang dituju:** isi URL Owner/POS pada app yang memakai link tersebut; `SUPERADMIN_URL` di root untuk invitation dan pada app Superadmin untuk validasi origin.

| Variable | Localhost | Development Vercel | Production Dephilia |
|---|---|---|---|
| `NEXT_PUBLIC_OWNER_URL` | `http://localhost:3000` | `https://rakku.vercel.app` | `https://app.rakku.dephilia.com` |
| `NEXT_PUBLIC_POS_URL` | `http://localhost:3001` | `https://pos-rakku.vercel.app` | `https://pos.rakku.dephilia.com` |
| `SUPERADMIN_URL` | `http://localhost:3002` | `https://superadmin-rakku.vercel.app` | `https://admin.rakku.dephilia.com` |

File tracked dan cloud env tidak berubah hanya karena profil ini ditetapkan. Nilai publik pada beberapa `.env.production` masih Vercel. Production perlu domain assignment, env sesuai profil, dan redeploy tersendiri.

Untuk isolasi data, siapkan resource/branch Neon development dan production masing-masing, dengan Auth URL dan database dari branch yang sama, lalu verifikasi konfigurasi tiap deployment. Ini rekomendasi lanjutan; kondisi aktif masih berbagi database/Auth. Cookie secrets dan JWT secrets juga perlu sesuai environment yang dituju.

## Runtime aktif

| Bagian | Implementasi |
|---|---|
| Data aplikasi | Neon Postgres, SQL berparameter melalui Drizzle + `postgres.js` |
| Superadmin | Neon Managed Better Auth, SDK `@neondatabase/auth`, Next.js 16 |
| Owner | Tabel `owners`, bcrypt, JWT 24 jam/30 hari, data di Neon |
| POS | Company/password, outlet/user/PIN, JWT 12 jam, data di Neon |
| Gambar/email/pembayaran | Silos / Echo / Vessel |

Neon Data API tidak digunakan. Browser mengakses route Next.js; koneksi PostgreSQL hanya berada di server. Dependency `@rakku/supabase-clients`, `@supabase/supabase-js`, dan `@supabase/ssr` telah dihapus dari runtime. Beberapa query masih memakai nama folder historis `lib/supabase`, tetapi tidak mengakses Supabase/PostgREST.

`packages/db/src/query.ts` mempertahankan kontrak hasil `{ data, error, count }` dan bentuk relasi yang dipakai UI. Query divalidasi terhadap catalog PostgreSQL dan dikompilasi menjadi SQL berparameter. Relasi menggunakan FK aktual, termasuk `!inner`, hint FK, relasi tunggal, dan array anak. Fungsi bisnis finansial/stok memakai transaksi SQL langsung.

## 1. Siapkan project, Auth, dan role

Langkah ini untuk resource **baru**, bukan pengulangan setup database aktif.

1. Buat project Neon dekat region deployment; instalasi yang diverifikasi memakai AWS `us-east-1`.
2. Tentukan branch/database tujuan. Bila melakukan copy source lama, gunakan PostgreSQL major version yang kompatibel untuk rehearsal.
3. Aktifkan **Managed Better Auth** pada branch yang benar. Auth dan database runtime harus menunjuk branch/database yang sama.
4. Daftarkan origin Superadmin pada trusted domains Auth sesuai environment, termasuk alias yang benar-benar dipakai. Instalasi rollout mengizinkan localhost, Vercel, dan domain Dephilia pada tabel di atas.
5. Aktifkan email/password dan siapkan konfigurasi pengiriman email Auth. Email invitation Rakku memakai Echo; email verification/reset Managed Better Auth memakai konfigurasi Auth. Uji kedua flow secara terpisah.

Auth URL diperoleh dari **Branch → Auth → Configuration**, bukan dari pooled connection string PostgreSQL. `auth:check` menguji origin dengan akun sengaja tidak ada; response yang diharapkan `401 INVALID_EMAIL_OR_PASSWORD`, bukan login sukses atau bukti email reset terkirim.

Gunakan migration owner terpisah dari runtime role. `db:provision` membuat role dari `DATABASE_URL` yang disiapkan operator: username harus `rakku_runtime`, password hex 64 karakter (32 byte acak), serta endpoint/database sama dengan `DATABASE_URL_UNPOOLED`. Generate password baru untuk instalasi tersebut:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Simpan password pada konfigurasi privat dan URL-encode credential bila diperlukan. Isi kedua connection strings, lalu:

```powershell
pnpm db:provision
```

Script membuat `LOGIN NOINHERIT NOBYPASSRLS`, memverifikasi login, dan tidak mengubah password role existing. Runtime tidak boleh menjadi superuser, memiliki `BYPASSRLS`, atau memiliki tabel/schema. `db:migrate` memeriksa role dan memberi privilege yang diperlukan; UPDATE/DELETE ledger dan stock movements tidak diberikan. Jangan memberi runtime membership ke migration owner atau `neon_superuser`.

## 2. Environment variables

Salin file `.env.example` root dan masing-masing app menjadi `.env.local`.

| Variable | Lokasi | Fungsi |
|---|---|---|
| `DATABASE_URL` | Root script + Owner/POS/Superadmin | URL pooled Neon dengan runtime role |
| `DATABASE_URL_UNPOOLED` | Root script saja | URL direct Neon dengan migration owner |
| `SOURCE_DATABASE_URL` | Root script saja, opsional | URL direct source lama untuk copy/check/assets; tidak diperlukan pada instalasi baru aktif |
| `NEON_AUTH_BASE_URL` | Superadmin | Endpoint HTTPS Managed Better Auth branch |
| `NEON_AUTH_COOKIE_SECRET` | Superadmin | Secret acak minimal 32 karakter |
| `SUPERADMIN_URL` | Root + Superadmin | Origin app untuk invitation dan validasi Origin |
| `SUPERADMIN_ALLOWED_ORIGINS` | Superadmin | Alias origin yang diperbolehkan, dipisah koma |
| `NEXT_PUBLIC_OWNER_URL` / `NEXT_PUBLIC_POS_URL` | Sesuai template app | Link auth, callback provider, menu QR, dan CTA mengikuti profil URL |
| `OWNER_JWT_SECRET` / `POS_JWT_SECRET` | App terkait | Secret JWT minimal 32 karakter |
| `ECHO_*`, `SILOS_*`, `VESSEL_*`, `CRON_SECRET` | Sesuai `.env.example` | Integrasi yang sudah ada |

Tidak ada credential database dengan prefix `NEXT_PUBLIC_`. App tidak memerlukan URL/key Supabase lagi. `.env.neon` adalah sumber privat instalasi saat ini; scripts database default membaca `.env.local` root, sementara Next.js membaca env di direktori app. `.env.production.local` hanya untuk build/start lokal production dan tidak otomatis dikirim ke Vercel. `.env.production` tracked hanya boleh berisi nilai publik.

Driver menormalisasi URL Console: parameter libpq `channel_binding` tidak diteruskan sebagai server GUC; koneksi hosted memakai TLS dengan certificate verification (`sslmode=verify-full`). Script migrasi menolak URL Neon pooled/port transaction pooler. Snapshot/copy memakai koneksi direct.

Untuk scripts Neon database dengan file lain: `$env:NEON_ENV_FILE = '.env.neon'`. `admin:invite` selalu memuat `.env.local` root, bukan memilih file lewat `NEON_ENV_FILE`; process env dapat mengisi/override nilainya. `auth:check` default membaca `.env.neon` dan juga menerima `NEON_ENV_FILE`; `env:check` khusus membaca `.env.neon` serta membandingkan file lokal pada instalasi bersama saat ini. Setelah branch/env dipisahkan, checker tersebut perlu disesuaikan karena saat ini mengharapkan runtime URL/Auth secret sama.

`SUPERADMIN_ALLOWED_ORIGINS` berlaku pada guard Rakku; trusted domains Neon Auth adalah konfigurasi terpisah. Untuk rollout dua host, masukkan alias Vercel bila `SUPERADMIN_URL` menunjuk Dephilia, atau sebaliknya. Jangan menganggap alias env otomatis terdaftar di Console Neon. Connection strings dan dump tidak disimpan di Git; `.env*.local`, `.env.neon`, `*.dump`, dan `*.backup` di-ignore.

## 3. Baseline dan database development kosong

```powershell
pnpm install
pnpm db:provision
pnpm db:migrate
pnpm db:seed
pnpm db:demo
pnpm admin:invite admin@example.com
pnpm dev
```

Migration aktif:

- `0001_baseline.sql`: 39 tabel aplikasi, schema privat invitation/allowlist, indexes, triggers.
- `0002_atomic_functions.sql`: ledger dan deduksi stok atomik/idempotent, invoker-security.
- `0003_tenant_policies.sql`: forced RLS, context tenant/platform, FK deferrable.
- `0004_tenant_integrity.sql`: validasi kesesuaian company/outlet pada FK parent.

History/checksum disimpan di `rakku_migrations.history`; migration yang sudah diterapkan tidak boleh diedit. Baseline hanya dapat diterapkan ke `public` yang kosong. Schema managed `neon_auth` tidak disentuh.

`db:seed` menambahkan menu dan plan referensi tanpa menimpa nilai existing; `db:demo` membuat satu tenant testing. Pada instalasi aktif keduanya sudah dijalankan. **Jangan jalankan seed sebelum copy source**, karena tabel target harus kosong dan UUID plan/menu source harus dipertahankan. Legacy seeds RAKKU/TOKOKO/BUILD bukan bagian setup DEMO.

## 4. Superadmin: invitation dan aktivasi

Akun Superadmin dibuat melalui invitation, bukan signup publik. Bila sebelumnya memakai Supabase Auth, password/session lama tidak dipindahkan; penerima membuat password baru.

```powershell
pnpm admin:invite admin@example.com
pnpm admin:status admin@example.com
```

CLI mengirim link via Echo; tidak mencetak token mentah. Link memakai fragment URL agar token tidak masuk access log. Token acak 256-bit, hash SHA-256 disimpan, berlaku 24 jam, dan sekali pakai. Invitation baru membatalkan link pending lama untuk email yang sama.

Penerima membuka `/activate#token=...`, mengisi nama dan password minimal 12 karakter. Server:

1. Memeriksa token dan expiry.
2. Membuat akun Managed Better Auth jika belum ada.
3. Melakukan sign-in untuk membuktikan kepemilikan credential dan mengambil subject asli.
4. Dalam transaksi, mengunci invitation, mencocokkan email, menyimpan allowlist, dan menandai token digunakan.

Jika Managed Better Auth meminta verifikasi email, verifikasi email lalu ulangi aktivasi dengan password yang sama. Jika Auth creation berhasil tetapi aktivasi DB terputus, percobaan ulang dengan password akun dapat melanjutkan aktivasi.

Pastikan `SUPERADMIN_URL` pada root env menunjuk host yang tersedia sebelum mengirim invitation. CLI mencetak activation origin, tetapi token hanya dikirim lewat email. `admin:status [email]` menampilkan membership dan invitation terakhir; tanpa argumen memakai email admin instalasi saat ini. Status invitation kedaluwarsa tidak membatalkan membership yang sudah aktif.

Allowlist ada di `app_private.superadmins`. Login Neon tanpa membership aktif tidak mendapat akses panel/API. Public signup dan admin-plugin proxy tidak dipublikasikan oleh app. SDK session cache dibatasi 60 detik; membership/status aplikasi diperiksa kembali oleh layout/API. `src/proxy.ts` hanya session gate, bukan pengganti pemeriksaan allowlist.

Untuk mencabut akses aplikasi:

```sql
UPDATE app_private.superadmins SET status = 'inactive' WHERE email = 'admin@example.com';
```

Password berikutnya direset melalui `/reset-password`. Logout memanggil Managed Better Auth sign-out. Semua session Supabase Superadmin lama harus login ulang. Kolom audit lama `created_by`/`processed_by` tetap berupa teks historis; tidak ditulis ulang ke subject Neon baru.

## 5. Otorisasi dan transaksi

POS middleware memeriksa JWT dan Origin untuk API privat, kemudian menulis metadata route server-side. Client-supplied metadata ditimpa. Database boundary memeriksa user, company, outlet, role, dan outlet assignment yang masih aktif, lalu memeriksa akses menu. Kontrak permission UI saat ini adalah **menu-level `can_view`**, bukan CRUD permission terpisah.

Client tenant memasang `app.scope`, `app.company_id`, `app.outlet_id`, dan `app.user_id` secara transaction-local. Runtime role tidak memiliki bypass/ownership; RLS dan trigger tenant links membatasi data/fk. Client tenant bersifat request-local dan tidak boleh disimpan global. Platform client hanya digunakan oleh kode server tepercaya setelah otorisasi, atau integrasi sistem yang sudah memverifikasi provider.

Owner mengecek ulang status owner, status company, dan kepemilikan company dari database. Middleware tidak membuka koneksi PostgreSQL. Protected layout dan API melakukan pemeriksaan authoritative. Superadmin API memakai session Neon + allowlist; bila header Origin ada, guard memeriksa kecocokan dengan `SUPERADMIN_URL` atau alias pada `SUPERADMIN_ALLOWED_ORIGINS`.

Operasi yang ditransaksikan:

- Order tunai: header, items, split payments, stok, dan meja.
- Draft: pembuatan/replacement items dan completion/deduksi stok.
- QRIS finalization: verifikasi provider **di luar transaksi**, lalu lock intent/order, completion, stok/meja, ledger credit, dan status success bersama.
- Ledger: lock saldo per company, idempotency key mencakup company, pengecekan saldo/pending nonnegatif.
- Pembelian/opname: perubahan stok dan movement bersama; update stok memakai aritmetika SQL/row lock.
- Withdrawal request: serialisasi company, limit check, insert dan hold bersama.
- Withdrawal complete/reject: lock withdrawal, ledger transition, dan status bersama; transition yang bersaing ditolak.
- Subscription activation dan onboarding: state terkait commit bersama.

Email berada setelah commit dan memakai notification idempotency yang sudah ada. HTTP/provider calls tidak diletakkan di dalam transaksi database.

Transaksi/RLS tidak menggantikan validasi business input: order standar masih menerima harga/pajak/diskon/total client, dan izin POS masih menu-level `can_view`. Cookie session Owner/POS memakai `Secure` pada build production; cookie sementara `pending_login` belum memakai atribut tersebut. Temuan runtime lain dan cakupan pengujian ada di [DOCS.md](DOCS.md#16-catatan-teknis--known-issues).

## 6. Deploy dan verifikasi environment

1. Hubungkan repository ke empat project Vercel, masing-masing Root Directory `apps/owner`, `apps/pos`, `apps/superadmin`, atau `apps/landing`; ikuti `vercel.json` app terkait. Build memakai `pnpm --filter @rakku/<app> build`, output `.next`.
2. Integrasi Neon boleh dibuat melalui satu project Vercel. Pasang `DATABASE_URL` pooled dengan runtime role secara manual pada tiga app server; env integrasi ber-prefix tidak otomatis dibaca sebagai `DATABASE_URL`. Landing tidak memerlukan database.
3. Pasang JWT/Auth/integrasi secrets pada Project Settings, tanpa migration-owner URL di runtime app. Pilih branch/database/Auth sesuai environment yang benar-benar disiapkan.
4. Isi URL publik mengikuti matriks. Callback Vessel untuk subscription dan QRIS order menuju `<URL Owner>/api/webhooks/vessel`; production berarti `https://app.rakku.dephilia.com/api/webhooks/vessel`. Link verifikasi/reset Owner dan QR menu juga mengikuti URL env.
5. Assign domain Dephilia pada project/deployment yang sesuai, set `SUPERADMIN_URL`/alias dan trusted domains Auth, lalu redeploy setelah env build-time berubah. Saat custom domain belum tersedia, invitation memakai URL Vercel yang berfungsi.
6. Set `CRON_SECRET` dan pastikan cron Owner `/api/cron/billing` (`0 1 * * *`, 01:00 UTC) aktif pada deployment yang dituju. Karena database saat ini bersama, tentukan deployment penanggung jawab cron sebelum menjalankannya pada beberapa environment.
7. Jalankan pemeriksaan sesuai cakupan di bawah. `vercel.json` tidak mengatur domain assignment atau mengunggah file env lokal.

### Pemeriksaan instalasi yang sudah berjalan

```powershell
pnpm env:check
pnpm db:inspect
pnpm db:check
pnpm db:smoke
pnpm smoke:http
pnpm auth:check
pnpm smoke:production --vercel-only
pnpm admin:status
```

- `env:check` khusus profil database bersama/file lokal instalasi ini; bukan audit cloud env Vercel.
- `db:check` tanpa source memeriksa tabel/invarians finansial target. Bila `SOURCE_DATABASE_URL` diisi, pemeriksaan juga membandingkan data source-target.
- `db:smoke` menguji driver PostgreSQL/Drizzle asli, bcrypt/PIN, relations/count, tenant RLS, dan transaksi rollback di Neon.
- `smoke:http` menjalankan dev servers berurutan pada `127.0.0.1:3100`–`3102`, login DEMO Owner/POS, catalog/register, serta session/guard anonim Superadmin. Tidak menjalankan Landing atau login admin berpassword.
- `auth:check` menguji localhost `3002` dan kedua domain Superadmin langsung ke Auth memakai akun sengaja tidak ada. Host aplikasi 404 dapat tetap memiliki trusted origin Auth yang benar.
- `smoke:production --vercel-only` menguji deployment development Vercel. Default tanpa flag menambahkan domain production Superadmin; tidak menguji Landing atau mengganti Owner/POS ke Dephilia otomatis.

Untuk menguji Owner/POS production setelah domain/env tersedia:

```powershell
$env:OWNER_PRODUCTION_URL = 'https://app.rakku.dephilia.com'
$env:POS_PRODUCTION_URL = 'https://pos.rakku.dephilia.com'
pnpm smoke:production
$env:OWNER_PRODUCTION_URL = $null
$env:POS_PRODUCTION_URL = $null
```

Overrides dibaca dari process env, bukan otomatis dari `.env.neon`. Host Superadmin pada script masih tetap Vercel dan Dephilia. Script mengharapkan tenant DEMO tersedia; database production yang terpisah tanpa DEMO memerlukan pemeriksaan memakai akun testing yang sesuai. Domain Landing, CTA, dan login/logout/reset Superadmin perlu diperiksa terpisah. QRIS/provider callback nyata, stock/order/withdrawal workflows, dan cross-tenant/concurrency di deployment tetap memerlukan uji integrasi.

### Troubleshooting domain Superadmin 404

Bandingkan `/activate` dan `/api/auth/get-session` pada alias Vercel dan custom domain. Bila alias memberi 200 tetapi custom domain 404, periksa assignment domain, project, deployment aktif, dan env di Vercel. Trusted origin yang salah menghasilkan penolakan Auth, bukan halaman Next.js 404. Setelah assignment diperbaiki, ulangi smoke tanpa `--vercel-only`, lalu ubah origin invitation ke production bila itu environment yang dituju. Tidak perlu menerapkan ulang baseline atau mereset akun aktif.

## 7. Opsional: rekonsiliasi dan copy source lama

**Tidak digunakan pada instalasi aktif.** Developer memilih database baru setelah koneksi Supabase source tidak tersedia. Bagian ini disimpan untuk kasus lain yang benar-benar membutuhkan pemindahan data source.

### 7.1 Rekonsiliasi sebelum rehearsal

Live schema harus diaudit; history migration Supabase memiliki repair/manual drift. Bandingkan seluruh columns/defaults, constraints, indexes, triggers, functions, sequence, dan data dengan baseline. `supabase_full_export.sql` bukan restore source yang valid.

Known drift yang diakomodasi baseline: `modifiers.group_name`, `order_items.note`, `split_payments.items`, dan `products.image_silo_id`. Source column tambahan atau tipe berbeda harus direkonsiliasi terlebih dahulu. Copy menolak tabel aplikasi source yang belum dipetakan dan tabel wajib yang hilang.

Jika ada gambar produk yang masih bergantung pada Supabase Storage, jalankan pada source **sebelum snapshot final**:

```powershell
pnpm db:images
```

Utilitas ini mengunggah gambar ke Silos lalu memperbarui metadata source, sehingga source/target checksum tetap sama setelah copy. Source memerlukan akses update `products`; URL gambar private yang tidak dapat diunduh perlu ditangani terlebih dahulu. Jangan menghentikan Storage sebelum seluruh URL legacy berhasil dipindahkan.

### 7.2 Rehearsal dan cutover maintenance window

1. Rehearse di Neon staging dengan snapshot production-sized dan konfigurasi Auth staging.
2. Buat branch tujuan kosong, siapkan runtime role, jalankan `db:migrate`, aktifkan Managed Better Auth, kirim invitation, dan verifikasi admin tujuan. Jangan seed tabel public sebelum copy. Copy tidak menyentuh `app_private` atau `neon_auth`.
3. Simpan deployment Supabase terakhir beserta environment untuk emergency rollback.
4. Aktifkan maintenance mode pada semua app. Hentikan **semua** writers: POS/Owner/Superadmin lama, cron, webhook, scripts, dan instance lama.
5. Ambil backup final menggunakan `pg_dump -Fc --schema=public` pada koneksi direct; simpan di storage backup privat.
6. Isi source/target URLs untuk production branch yang benar.
7. Jalankan copy dan check:

```powershell
pnpm db:copy --write-freeze-confirmed
pnpm db:check
```

Copy membaca source pada snapshot repeatable-read, memindahkan 39 tabel dalam satu transaksi target, menolak target yang sudah berisi data, mempertahankan UUID/hash password/PIN/JSON, dan mereset sequence order ke watermark source atau maximum row. Constraints diperiksa sebelum commit. Tidak ada truncate, drop, atau dual write.

`db:check` membandingkan row counts dan SHA-256 isi seluruh kolom source per tabel, termasuk hash auth dan stok. Check juga memeriksa saldo terhadap ledger, pending terhadap withdrawal terbuka, payment success terhadap order/ledger, company/outlet, dan URL Storage legacy. Riwayat opening stock lama tidak direkonstruksi; isi stok dan movement harus identik dengan source. Selesaikan discrepancy sebelum membuka writes.

8. Ubah environment Owner/POS/Superadmin ke runtime Neon. Superadmin juga memakai Auth URL/cookie secret Neon; hapus key Supabase dari deployment baru.
9. Deploy **semua** apps dan smoke test selagi writes masih ditutup.
10. Verifikasi login Owner/POS, invitation/login/logout/reset Superadmin, CRUD, invoice, cash/split/draft, QRIS callback/polling, pembelian/opname, withdrawal, report, dan menu QR publik.
11. Uji ID lintas company/outlet, menu-hidden endpoint, user/company/outlet disabled, akun Neon tanpa allowlist, serta completion/rejection atau callback yang bersaing.
12. Buka writes/webhooks/cron hanya setelah check lulus. Pantau error/auth/payment dan rekonsiliasi.

Supabase Auth password/session, service role, `auth.role()`, Storage metadata, dan policy Supabase tidak diimpor ke Neon. Data Owner/POS custom auth di `public` dipindahkan sebagai data PostgreSQL biasa.

## 8. Pemulihan dan rollback

**Instalasi baru aktif:** tidak ada snapshot source Supabase yang dicopy. Pemulihan memakai backup/restore Neon atau forward repair, dengan penghentian writers dan rekonsiliasi data sesuai titik pemulihan. Jangan menganggap deployment Supabase lama berisi tenant DEMO atau transaksi Neon terbaru. Rollback kode juga harus memakai versi yang kompatibel dengan schema/Auth/env Neon.

**Hanya untuk copy source pada §7:** sebelum writes Neon dibuka, deployment/environment lama dapat dikembalikan ke source dan writers source dibuka lagi. Setelah Neon menerima writes, source sudah stale; gunakan forward repair atau reverse-delta migration terkontrol. Mengganti URL saja akan kehilangan transaksi baru. Simpan source read-only dan backup final selama recovery window yang disepakati.

## 9. Pemeriksaan kode

```powershell
pnpm test:db
pnpm typecheck --concurrency=1
pnpm typecheck:scripts
pnpm lint --concurrency=1
pnpm build --concurrency=1
```

Untuk mesin dengan RAM terbatas:

```powershell
$env:NODE_OPTIONS = '--max-old-space-size=1024'
pnpm build --concurrency=1
```

Rollout Neon mencatat **13/13 tests PGlite**, typecheck app/package/scripts, lint, dan build keempat app lulus. Tests menggunakan PostgreSQL in-memory, bukan mock query: baseline, FK relations/hints/inner filters, pagination/count, parameter safety, numeric/JSON shapes, RLS, ledger idempotency, stock rollback, payment late-failure/retry, dan invitation sekali pakai.

Tests tersebut tidak membuktikan delivery email Managed Auth/Echo, credential/provider Vessel production, seluruh concurrency bisnis, atau domain cloud sudah benar. Pemeriksaan database/HTTP dan smoke Vercel yang tercatat lulus sesuai cakupan §6; custom domain Superadmin tetap outstanding pada hasil terakhir.
