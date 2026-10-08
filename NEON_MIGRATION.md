# Rakku: konfigurasi dan migrasi penuh ke Neon

## Setup aktif: database baru dan akun demo

Keputusan instalasi saat ini adalah **database baru**, tanpa memulihkan data Supabase lama. Baseline 4 migration sudah diterapkan, runtime role `rakku_runtime` sudah dibuat, dan Managed Better Auth pada database yang sama sudah terverifikasi.

`.env.neon` menjadi sumber konfigurasi privat. Root `.env.local` dipakai script; `.env.local` dan `.env.production.local` masing-masing app sudah memakai pooled runtime URL yang sama. File production yang tracked hanya berisi URL publik. Variabel Supabase, SMTP legacy, `PG*`, dan template `POSTGRES_*` telah dibersihkan dari konfigurasi aktif.

| Akun demo | Credential |
|---|---|
| Owner | `demo_owner@rakku.test` / `DemoOwner2026!` |
| Company POS | kode `DEMO` / `DemoPOS2026!` |
| Kasir POS | `kasir_demo` / PIN `123456` |

Demo berisi satu Owner, satu kasir, satu outlet, dua produk, satu meja, dua pricing tier, dan opening stock yang memiliki audit trail. Trial Pro berlaku 14 hari. `pnpm db:demo` idempotent: tidak menggandakan akun atau mereset stok/credential existing.

Superadmin canonical origin: `https://admin.rakku.dephilia.com`. Alias yang juga diizinkan: `https://superadmin-rakku.vercel.app`. Keduanya sudah lulus pemeriksaan trusted origins langsung ke Managed Better Auth. Invitation telah dikirim ke email admin yang dipilih developer; membership menjadi aktif setelah pemilik email menyelesaikan aktivasi.

```powershell
pnpm env:check
pnpm db:inspect
pnpm db:provision
pnpm db:migrate
pnpm db:seed
pnpm db:demo
pnpm db:check
pnpm db:smoke
pnpm smoke:http
pnpm auth:check
```

`db:smoke` memeriksa driver PostgreSQL/Drizzle asli di Neon, termasuk rollback transaksi. `smoke:http` menjalankan app lokal berurutan dan menguji login Owner, login company/outlet/user/PIN POS, catalog/register, serta session endpoint dan penolakan API Superadmin tanpa login. Env privat lokal tidak otomatis dikirim ke Vercel; masukkan nilai dari `.env.production.local` ke Project Settings masing-masing project.

## Target runtime

| Bagian | Implementasi |
|---|---|
| Data aplikasi | Neon Postgres, SQL berparameter melalui Drizzle + `postgres.js` |
| Superadmin | Neon Managed Better Auth, SDK `@neondatabase/auth`, Next.js 16 |
| Owner | Tabel `owners`, bcrypt, JWT 24 jam/30 hari, data di Neon |
| POS | Company/password, outlet/user/PIN, JWT 12 jam, data di Neon |
| Gambar/email/pembayaran | Silos / Echo / Vessel |

Neon Data API tidak diaktifkan. Browser mengakses route Next.js; koneksi PostgreSQL hanya berada di server. Beberapa file query masih memakai nama folder historis `lib/supabase`, tetapi tidak mengimpor SDK Supabase atau mengakses PostgREST.

`packages/db/src/query.ts` mempertahankan kontrak hasil `{ data, error, count }` dan bentuk relasi yang dipakai UI. Query divalidasi terhadap catalog PostgreSQL dan dikompilasi menjadi SQL berparameter. Relasi menggunakan FK aktual, termasuk `!inner`, hint FK, relasi tunggal, dan array anak. Fungsi bisnis finansial/stok memakai transaksi SQL langsung.

## 1. Siapkan project dan role

1. Buat project Neon pada region **AWS**, dekat region deployment app.
2. Gunakan PostgreSQL major version yang sama dengan source untuk rehearsal pertama.
3. Buat branch staging untuk pengujian dan branch produksi untuk cutover.
4. Aktifkan **Managed Better Auth** pada branch yang benar. Auth dan database runtime harus menunjuk branch/database yang sama.
5. Daftarkan origin aplikasi lokal/produksi pada trusted domains Managed Better Auth.
6. Aktifkan email/password dan konfigurasi email verification/password reset. Uji pengiriman email reset sebelum cutover.

Managed Better Auth saat ini tidak mendukung Azure, IP Allow, atau Private Networking. Auth URL diperoleh dari **Branch → Auth → Configuration**, bukan dari connection string PostgreSQL.

Gunakan migration owner terpisah dari runtime role. Buat runtime role melalui SQL Editor, dengan password acak yang disimpan di secret manager:

```sql
CREATE ROLE rakku_runtime LOGIN NOINHERIT NOBYPASSRLS PASSWORD '<password-runtime-acak>';
```

Runtime role tidak boleh menjadi superuser, memiliki `BYPASSRLS`, atau memiliki tabel/schema. `pnpm db:migrate` memeriksa role dan memberi privilege CRUD/execute yang diperlukan; UPDATE/DELETE ledger dan stock movements tidak diberikan. Jangan memberi runtime membership ke migration owner atau `neon_superuser`.

## 2. Environment

Salin file `.env.example` root dan masing-masing app menjadi `.env.local`.

| Variable | Lokasi | Fungsi |
|---|---|---|
| `DATABASE_URL` | Root script + Owner/POS/Superadmin | URL pooled Neon dengan runtime role |
| `DATABASE_URL_UNPOOLED` | Root script saja | URL direct Neon dengan migration owner |
| `SOURCE_DATABASE_URL` | Root script saja | URL direct Supabase Postgres untuk audit/copy/check/assets |
| `NEON_AUTH_BASE_URL` | Superadmin | Endpoint HTTPS Managed Better Auth branch |
| `NEON_AUTH_COOKIE_SECRET` | Superadmin | Secret acak minimal 32 karakter |
| `SUPERADMIN_URL` | Root + Superadmin | Origin app untuk invitation dan validasi Origin |
| `SUPERADMIN_ALLOWED_ORIGINS` | Superadmin | Alias origin yang diperbolehkan, dipisah koma |
| `OWNER_JWT_SECRET` / `POS_JWT_SECRET` | App terkait | Secret JWT minimal 32 karakter |
| `ECHO_*`, `SILOS_*`, `VESSEL_*`, `CRON_SECRET` | Sesuai `.env.example` | Integrasi yang sudah ada |

Tidak ada credential database dengan prefix `NEXT_PUBLIC_`. App tidak memerlukan URL/key Supabase lagi. Konfigurasi lokal telah diselaraskan ke `.env.neon`; salin env privat production ke Vercel Project Settings, bukan ke file tracked.

Driver menormalisasi URL Console: parameter libpq `channel_binding` tidak diteruskan sebagai server GUC; koneksi hosted memakai TLS dengan certificate verification (`sslmode=verify-full`). Script migrasi menolak URL Neon pooled/port transaction pooler. Snapshot/copy memakai koneksi direct.

Untuk script dengan file env lain, set `NEON_ENV_FILE`. Jangan menampilkan connection string atau menyimpan dump di Git. File `*.dump` dan `*.backup` di-ignore.

## 3. Baseline dan database development kosong

```powershell
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm seed
pnpm backfill:owners
pnpm admin:invite admin@example.com
pnpm dev
```

Migration aktif:

- `0001_baseline.sql`: 39 tabel aplikasi, schema privat invitation/allowlist, indexes, triggers.
- `0002_atomic_functions.sql`: ledger dan deduksi stok atomik/idempotent, invoker-security.
- `0003_tenant_policies.sql`: forced RLS, context tenant/platform, FK deferrable.
- `0004_tenant_integrity.sql`: validasi kesesuaian company/outlet pada FK parent.

History/checksum disimpan di `rakku_migrations.history`; migration yang sudah diterapkan tidak boleh diedit. Baseline hanya dapat diterapkan ke `public` yang kosong. Schema managed `neon_auth` tidak disentuh.

`db:seed` hanya untuk database development baru: menambahkan menu dan plan referensi tanpa menimpa nilai existing. **Jangan jalankan seed sebelum copy produksi**, karena tabel target harus kosong dan UUID plan/menu source harus dipertahankan.

## 4. Superadmin: invitation dan aktivasi

Password Supabase Auth tidak dapat dipindahkan langsung ke Managed Better Auth. Akun harus dibuat dengan password baru.

```powershell
pnpm admin:invite admin@example.com
```

CLI mengirim link via Echo; tidak mencetak token mentah. Link memakai fragment URL agar token tidak masuk access log. Token acak 256-bit, hash SHA-256 disimpan, berlaku 24 jam, dan sekali pakai. Invitation baru membatalkan link pending lama untuk email yang sama.

Penerima membuka `/activate#token=...`, mengisi nama dan password minimal 12 karakter. Server:

1. Memeriksa token dan expiry.
2. Membuat akun Managed Better Auth jika belum ada.
3. Melakukan sign-in untuk membuktikan kepemilikan credential dan mengambil subject asli.
4. Dalam transaksi, mengunci invitation, mencocokkan email, menyimpan allowlist, dan menandai token digunakan.

Jika Managed Better Auth meminta verifikasi email, verifikasi email lalu ulangi aktivasi dengan password yang sama. Jika Auth creation berhasil tetapi aktivasi DB terputus, percobaan ulang dengan password akun dapat melanjutkan aktivasi.

Allowlist ada di `app_private.superadmins`. Login Neon tanpa membership aktif tidak mendapat akses panel/API. Public signup dan admin-plugin proxy tidak dipublikasikan oleh app. SDK session cache dibatasi 60 detik; membership/status aplikasi diperiksa pada setiap boundary server.

Untuk mencabut akses aplikasi:

```sql
UPDATE app_private.superadmins SET status = 'inactive' WHERE email = 'admin@example.com';
```

Password berikutnya direset melalui `/reset-password`. Logout memanggil Managed Better Auth sign-out. Semua session Supabase Superadmin lama harus login ulang. Kolom audit lama `created_by`/`processed_by` tetap berupa teks historis; tidak ditulis ulang ke subject Neon baru.

## 5. Otorisasi dan transaksi

POS middleware memeriksa JWT dan Origin untuk API privat, kemudian menulis metadata route server-side. Client-supplied metadata ditimpa. Database boundary memeriksa user, company, outlet, role, dan outlet assignment yang masih aktif, lalu memeriksa akses menu. Kontrak permission UI saat ini adalah **menu-level `can_view`**, bukan CRUD permission terpisah.

Client tenant memasang `app.scope`, `app.company_id`, `app.outlet_id`, dan `app.user_id` secara transaction-local. Runtime role tidak memiliki bypass/ownership; RLS dan trigger tenant links membatasi data/fk. Client tenant bersifat request-local dan tidak boleh disimpan global. Platform client hanya digunakan oleh kode server tepercaya setelah otorisasi, atau integrasi sistem yang sudah memverifikasi provider.

Owner mengecek ulang status owner dan kepemilikan company dari database. Middleware tidak membuka koneksi PostgreSQL. Protected layout dan API melakukan pemeriksaan authoritative. Superadmin API memakai session Neon + allowlist; Origin request harus cocok dengan `SUPERADMIN_URL` atau salah satu alias pada `SUPERADMIN_ALLOWED_ORIGINS`.

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

## 6. Rekonsiliasi source sebelum rehearsal

Live schema harus diaudit; history migration Supabase memiliki repair/manual drift. Bandingkan seluruh columns/defaults, constraints, indexes, triggers, functions, sequence, dan data dengan baseline. `supabase_full_export.sql` bukan restore source yang valid.

Known drift yang diakomodasi baseline: `modifiers.group_name`, `order_items.note`, `split_payments.items`, dan `products.image_silo_id`. Source column tambahan atau tipe berbeda harus direkonsiliasi terlebih dahulu. Copy menolak tabel aplikasi source yang belum dipetakan dan tabel wajib yang hilang.

Jika ada gambar produk yang masih bergantung pada Supabase Storage, jalankan pada source **sebelum snapshot final**:

```powershell
pnpm db:images
```

Utilitas ini mengunggah gambar ke Silos lalu memperbarui metadata source, sehingga source/target checksum tetap sama setelah copy. Source memerlukan akses update `products`; URL gambar private yang tidak dapat diunduh perlu ditangani terlebih dahulu. Jangan menghentikan Storage sebelum seluruh URL legacy berhasil dipindahkan.

## 7. Rehearsal dan cutover maintenance window

1. Rehearse di Neon staging dengan snapshot production-sized dan konfigurasi Auth staging.
2. Buat production branch kosong, jalankan `db:migrate`, aktifkan Managed Better Auth, kirim invitation, dan verifikasi akun admin produksi. Copy tidak menyentuh `app_private` atau `neon_auth`.
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

## 8. Rollback

Sebelum writes Neon dibuka: kembalikan deployment/environment lama ke Supabase, lalu buka writers source. Session Superadmin lama mungkin perlu login ulang ke deployment lama.

Setelah Neon menerima writes produksi: source telah stale. Gunakan forward repair atau reverse-delta migration terkontrol; mengganti URL saja akan kehilangan transaksi baru. Simpan Supabase read-only dan backup final selama recovery window yang disepakati, kemudian hentikan project setelah observasi/reconciliation selesai.

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

Test menggunakan PostgreSQL in-memory (PGlite), bukan mock query: baseline, FK relations/hints/inner filters, pagination/count, parameter safety, numeric/JSON shapes, RLS, ledger idempotency, stock rollback, payment late-failure/retry, dan invitation sekali pakai. Project Neon/Auth, SMTP, provider callback, live schema drift, dan data production tetap memerlukan integration/smoke test langsung dengan credential developer.
