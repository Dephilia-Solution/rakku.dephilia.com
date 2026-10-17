# Rakku - POS Multi-Tenant untuk Bisnis F&B

**Rakku** adalah sistem **Point of Sale (POS), inventory, billing, dan settlement** multi-tenant untuk bisnis F&B. Sistem memakai **Next.js App Router** (14 untuk Owner/POS/Landing, 16 untuk Superadmin), **Neon Postgres + Drizzle**, **Neon Managed Better Auth**, pnpm workspace, dan Turborepo.

Runtime Neon sudah berjalan pada **database baru**, tanpa impor data Supabase lama. Empat migration, runtime role, data referensi, satu tenant DEMO, dan aktivasi Superadmin sudah selesai. Deployment development Vercel telah lolos smoke test login; status domain production dijelaskan di bawah.

---

## Arsitektur: Monorepo 4 App

Proyek ini adalah monorepo pnpm workspace + Turborepo yang berisi **4 aplikasi Next.js independen**, masing-masing dapat dideploy sebagai project terpisah:

| App | Localhost | Development (Vercel) | Production (Dephilia) |
|-----|-----------|----------------------|-----------------------|
| `apps/owner` | `http://localhost:3000` | `https://rakku.vercel.app` | `https://app.rakku.dephilia.com` |
| `apps/pos` | `http://localhost:3001` | `https://pos-rakku.vercel.app` | `https://pos.rakku.dephilia.com` |
| `apps/superadmin` | `http://localhost:3002` | `https://superadmin-rakku.vercel.app` | `https://admin.rakku.dephilia.com` |
| `apps/landing` | `http://localhost:3003` | URL Vercel belum dikonfirmasi | `https://rakku.dephilia.com` |

Owner mengelola merchant, master data, laporan, langganan, saldo, dan withdrawal. POS menangani kasir, inventory, QRIS, menu QR publik, dan PWA. Superadmin mengelola platform; Landing menyajikan halaman marketing.

**Status terakhir rollout (8 Oktober 2026):** login Owner/POS serta route Auth dan guard anonim Superadmin lulus pada URL development Vercel. Superadmin production masih mengembalikan 404 pada `/activate` dan `/api/auth/get-session`, sehingga aktivasi memakai URL Vercel. Domain production Owner/POS/Landing sudah ditetapkan, tetapi belum memiliki hasil smoke test dalam catatan ini.

Klasifikasi development/production ini adalah keputusan deployment Rakku. URL `*.vercel.app` tetap dapat memakai environment Vercel **Production** dan build Next.js `NODE_ENV=production`. Database/Auth lokal dan deployment yang diverifikasi saat rollout masih menunjuk resource Neon yang sama; isolasi branch/database development-production belum diterapkan.

### Package bersama (`packages/`)

| Package | Isi |
|---------|-----|
| `@rakku/shared-types` | Seluruh TypeScript interfaces (common, tenant, owner, inventory, billing) |
| `@rakku/demo` | Sandbox cafe browser-memory, fixture, adapter bisnis, simulator, dan shell Owner/POS publik |
| `@rakku/db` | SQL berparameter melalui Drizzle/Postgres, transaksi, RLS, baseline dan invitation Superadmin |
| `@rakku/auth-utils` | JWT wrapper, hash/verify PIN, audit log |
| `@rakku/ui` | Komponen UI (Badge, Tabs, Toast, PageHeader, dll) + Tailwind preset |
| `@rakku/pricing` | Seed default pricing tiers & sinkronisasi harga |
| `@rakku/plans` | Resolusi plan, limit & feature gate freemium |
| `@rakku/inventory` | Deduksi stok berdasarkan resep saat order selesai |
| `@rakku/payments` | Intent QRIS order dan finalisasi pembayaran |
| `@rakku/ledger` | Saldo merchant dan transaksi ledger |
| `@rakku/emails` | Template dan notifikasi email billing idempotent |
| `@rakku/echo-client` | Kirim email via Echo API |
| `@rakku/silos-client` | Upload/hapus gambar via Silos |
| `@rakku/vessel-client` | Integrasi pembayaran QRIS Vessel |

---

## Memulai

### Coba demo publik

Buka **`/demo` pada aplikasi Owner** (lokal: `http://localhost:3000/demo`) untuk memilih Demo Owner atau Demo Kasir. Route mengikuti aplikasi asli, misalnya `/demo/owner/outlets`, `/demo/pos/products`, `/demo/pos/register`. Komponen/layout asli digunakan dengan sandbox cafe yang sama selama soft navigation; perubahan hanya di memori dan reset pada logout/reset/refresh. CTA Coba Demo tersedia di landing serta login Owner/POS.

Demo publik ini terpisah dari tenant testing Neon `pnpm db:demo`. Data, PIN simulator, matriks fitur, arsitektur, dan pengujian dijelaskan di **[DEMO.md](DEMO.md)**.

### Setup aplikasi

**Persyaratan:** Node.js 24 direkomendasikan (verifikasi memakai 24.11.1), pnpm 11.10.0 sesuai `packageManager`, dan project Neon dengan Managed Better Auth untuk Superadmin.

```powershell
pnpm install
```

Salin `.env.example` root dan setiap app menjadi `.env.local`, lalu isi nilai sesuai [konfigurasi teknis](DOCS.md#4-konfigurasi):

- Root scripts: `DATABASE_URL` pooled dengan role `rakku_runtime`, `DATABASE_URL_UNPOOLED` direct dengan migration owner, serta konfigurasi invitation/email.
- Owner: `DATABASE_URL`, `OWNER_JWT_SECRET`, URL Owner/POS, `ECHO_*`, `SILOS_*`, `VESSEL_*`, `CRON_SECRET`.
- POS: `DATABASE_URL`, `POS_JWT_SECRET`, URL Owner/POS, `ECHO_*`, `SILOS_*`, `VESSEL_*`.
- Superadmin: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `SUPERADMIN_URL`, alias origin bila perlu, URL Owner, `ECHO_*`.
- Landing: URL Owner/POS; tidak membutuhkan database atau Auth secret.

Gunakan JWT/cookie secrets minimal 32 karakter. App tidak membaca `.env.local` root monorepo. File `.env.neon` privat menjadi referensi instalasi aktif, sedangkan scripts Neon database secara default membaca `.env.local` root. Untuk memilih file lain: `$env:NEON_ENV_FILE = '.env.neon'`. Invitation `admin:invite` tetap memuat `.env.local` root, dan `env:check` memakai daftar file fixed instalasi bersama.

**Hanya untuk database development baru yang kosong:** siapkan role `rakku_runtime` dan Managed Better Auth mengikuti [NEON_MIGRATION.md](NEON_MIGRATION.md), lalu jalankan:

```powershell
pnpm db:provision
pnpm db:migrate
pnpm db:seed
pnpm db:demo
pnpm admin:invite admin@example.com # kirim invitation aktivasi Superadmin
pnpm dev
```

`db:provision` memerlukan runtime URL dengan password hex 64 karakter; detailnya ada di panduan Neon. Instalasi aktif sudah menyelesaikan provisioning/migration/seed, sehingga developer yang memakai database tersebut cukup mengisi env dan menjalankan app. Legacy seeds `seed`, `seed:full`, dan `scripts/seed-build.ts` adalah pilihan dataset testing lain, bukan bagian setup DEMO aktif.

### Akun DEMO aktif

Database Neon yang aktif saat ini dimulai baru dengan satu tenant demo:

- **Owner:** `demo_owner@rakku.test` / `DemoOwner2026!`.
- **POS:** company `DEMO` / `DemoPOS2026!`, pilih Outlet Demo dan `kasir_demo`, PIN `123456`.
- **Superadmin:** invitation dikirim ke email admin yang ditentukan; buka link aktivasi lalu buat password baru.
- Demo dibuat oleh `pnpm db:demo`; seed ulang tidak mereset password, PIN, stok, atau trial existing.

Demo berisi Outlet Demo, Kopi Demo, Teh Demo, tier Dine In/Take Away, satu meja, ingredient/resep, dan opening stock beraudit. Trial Pro berlaku 14 hari sejak seed pertama. Kredensial ini adalah data testing, bukan akun merchant produksi. Akun BUILD/RAKKU/TOKOKO pada panduan atau scripts lama tidak otomatis tersedia di database baru.

---

## Scripts Utama

| Script | Fungsi |
|--------|--------|
| `pnpm dev` | Jalankan semua app paralel |
| `pnpm dev:owner` / `dev:pos` / `dev:superadmin` / `dev:landing` | Jalankan satu app |
| `pnpm build` | Build semua app |
| `pnpm lint` | ESLint semua app |
| `pnpm typecheck` / `typecheck:scripts` | Periksa app/package dan utilitas migrasi |
| `pnpm test:db` | Test SQL/RLS/invitation dan rollback transaksi pada PostgreSQL in-memory |
| `pnpm db:migrate` / `db:seed` | Terapkan migration Neon / seed plan dan menu pada instalasi baru |
| `pnpm db:provision` / `db:inspect` | Siapkan/verifikasi runtime role / periksa database dan Managed Auth |
| `pnpm db:demo` | Satu Owner/POS demo dengan catalog minimal |
| `pnpm env:check` | Audit keselarasan file env privat pada instalasi bersama saat ini; tidak mencetak credential |
| `pnpm db:smoke` / `smoke:http` | Driver/rollback/RLS Neon / login dan guard HTTP lokal |
| `pnpm auth:check` | Trusted origins Neon dengan credential akun sengaja tidak ada |
| `pnpm smoke:production --vercel-only` | Smoke deployment development Vercel; nama script berasal dari rollout awal |
| `pnpm smoke:production` | Default di atas ditambah custom domain Superadmin; bukan seluruh matriks production |
| `pnpm db:check` | Rekonsiliasi database aktif; bandingkan source hanya bila `SOURCE_DATABASE_URL` diisi |
| `pnpm db:copy --write-freeze-confirmed` | Opsional: copy source saat seluruh writers berhenti ke target kosong |
| `pnpm db:images` | Opsional: migrasikan gambar legacy pada source ke Silos sebelum copy |
| `pnpm admin:invite <email>` | Invitation Superadmin sekali pakai via Echo |
| `pnpm admin:status [email]` | Periksa membership dan invitation terakhir tanpa mencetak token |
| `pnpm seed` / `seed:full` | Seed data testing |
| `pnpm backfill:owners` | Backfill akun owner untuk company existing |

---

## Infrastruktur

- **Database**: Neon Postgres. Migration aktif ada di `packages/db/migrations/`; `supabase/migrations/` adalah riwayat schema lama untuk rekonsiliasi source.
- **Auth**: custom JWT + bcrypt untuk Owner/POS; Managed Better Auth + allowlist privat untuk Superadmin. Session POS berlaku 12 jam; status user/company/outlet diperiksa ulang dari database.
- **Email**: Echo API (`ECHO_API_URL` / `ECHO_API_KEY`) — verifikasi owner, reset sandi, laporan, notifikasi langganan.
- **Gambar**: Silos (`SILOS_API_URL` / `SILOS_API_KEY`) + CDN Dephilia.
- **Pembayaran**: Vessel untuk QRIS langganan dan QRIS dinamis pelanggan; ledger internal mencatat saldo merchant dan withdrawal manual.
- **Langganan**: Free/Pro/Business; cron harian `/api/cron/billing` dilindungi `CRON_SECRET`.
- **PWA**: Serwist — hanya aktif di `apps/pos` (mode production).

## Deployment dan URL

Setiap project Vercel memakai Root Directory `apps/<app>` dan konfigurasi `vercel.json` app terkait. Integrasi Neon pada satu project cukup untuk membuat resource; Owner/POS/Superadmin lain perlu `DATABASE_URL` runtime secara manual di **Vercel Project Settings**. Env integrasi ber-prefix tidak otomatis menjadi env yang dibaca Rakku.

Sesuaikan `NEXT_PUBLIC_OWNER_URL`, `NEXT_PUBLIC_POS_URL`, dan `SUPERADMIN_URL` dengan matriks environment. Untuk production, Owner adalah `https://app.rakku.dephilia.com`; callback Vessel berada di `<URL Owner>/api/webhooks/vessel`. Origin Superadmin juga harus terdaftar pada trusted domains Neon Auth. Perubahan env/URL build-time memerlukan redeploy.

File `.env.production` tracked saat ini berisi nilai publik, beberapa masih URL Vercel. Secret `.env.production.local` lokal tidak otomatis terkirim ke Vercel. Pembagian domain dalam dokumentasi tidak mengubah assignment domain, env cloud, atau resource database; langkah deployment lengkap ada di [DOCS.md](DOCS.md#12-panduan-development).

## Dokumentasi

- [DOCS.md](DOCS.md): referensi teknis, arsitektur, konfigurasi, database, route/API, deployment, dan risiko aktual.
- [PANDUAN.md](PANDUAN.md): panduan operasional lama dengan seed BUILD COFFEE; pembaruan ke DEMO ditunda ke tahap berikutnya.
- [NEON_MIGRATION.md](NEON_MIGRATION.md): konfigurasi dan prosedur migrasi runtime Neon yang aktif.
- Dokumen `PRD*` dan `PROMPT*` adalah artefak perencanaan historis, bukan sumber kebenaran implementasi.

## Verifikasi

```powershell
pnpm test:db
pnpm typecheck --concurrency=1
pnpm typecheck:scripts
pnpm lint --concurrency=1
$env:NODE_OPTIONS = '--max-old-space-size=1024'
pnpm build --concurrency=1
```

Pada rollout Neon, 13 tests PGlite, typecheck, lint, build empat app, rekonsiliasi Neon, serta smoke database/HTTP/Vercel lulus dalam cakupan yang dicatat di [NEON_MIGRATION.md](NEON_MIGRATION.md). Smoke login tidak membuat order/payment atau mengubah stok, tetapi menambah audit login seperti request normal. QRIS/provider callback nyata, reset/email verification Superadmin, dan business flows lengkap tetap perlu uji integrasi pada environment yang dituju.
