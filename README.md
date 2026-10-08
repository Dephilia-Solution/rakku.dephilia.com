# Rakku - POS Multi-Tenant untuk Bisnis F&B

**Rakku** adalah sistem **Point of Sale (POS), inventory, billing, dan settlement** multi-tenant untuk bisnis F&B. Sistem memakai **Next.js App Router** (14 untuk Owner/POS/Landing, 16 untuk Superadmin), **Neon Postgres + Drizzle**, **Neon Managed Better Auth**, pnpm workspace, dan Turborepo.

> Konfigurasi Neon, aktivasi Superadmin, rekonsiliasi database lama, cutover, dan rollback dijelaskan di [NEON_MIGRATION.md](NEON_MIGRATION.md). Pemindahan data dan smoke test project produksi harus dilakukan sebelum deployment dibuka untuk transaksi.

---

## Arsitektur: Monorepo 4 App

Proyek ini adalah monorepo pnpm workspace + Turborepo yang berisi **4 aplikasi Next.js independen**, masing-masing dapat dideploy sebagai project terpisah:

| App | URL produksi yang tercatat di repo | Port Dev | Fungsi |
|-----|-------------------------------------|----------|--------|
| `apps/owner` | `https://rakku.vercel.app` | 3000 | Registrasi/onboarding merchant, master data, laporan, langganan, saldo, dan withdrawal |
| `apps/pos` | `https://pos-rakku.vercel.app` | 3001 | POS kasir, order, QRIS, inventory, operasional outlet, menu QR publik, dan **PWA** |
| `apps/superadmin` | Belum dicatat | 3002 | Administrasi tenant, plan, saldo, withdrawal, analytics, dan rekonsiliasi |
| `apps/landing` | Belum dicatat | 3003 | Landing page marketing |

Domain kustom `rakku.com`, `pos.rakku.com`, dan `superadmin.rakku.com` tidak dapat dikonfirmasi dari source. Konfigurasi domain aktual berada di project Vercel masing-masing.

### Package bersama (`packages/`)

| Package | Isi |
|---------|-----|
| `@rakku/shared-types` | Seluruh TypeScript interfaces (common, tenant, owner, inventory, billing) |
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

**Persyaratan:** Node.js 24 direkomendasikan (dipakai untuk verifikasi), pnpm 11+, project Neon AWS dengan Managed Better Auth.

```bash
# 1. Install dependency (otomatis link packages/*)
pnpm install

# 2. Salin .env.example menjadi .env.local di root dan masing-masing app
#    DATABASE_URL pada Owner, POS, Superadmin (server-only)
#    apps/owner/.env.local      → OWNER_JWT_SECRET, NEXT_PUBLIC_OWNER_URL, NEXT_PUBLIC_POS_URL,
#                                  SILOS_*, ECHO_*, VESSEL_*, CRON_SECRET
#    apps/pos/.env.local        → POS_JWT_SECRET, NEXT_PUBLIC_OWNER_URL, SILOS_*, ECHO_*, VESSEL_*
#    apps/superadmin/.env.local → NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET, SUPERADMIN_URL, ECHO_*
#    apps/landing/.env.local    → NEXT_PUBLIC_OWNER_URL, NEXT_PUBLIC_POS_URL
#    Produksi: nilai publik ada di apps/<app>/.env.production (ter-commit);
#    semua secret wajib diisi di Vercel Project Settings masing-masing app.

# 3. Database development kosong: jalankan baseline Neon, lalu seed
pnpm db:migrate
pnpm db:seed
pnpm seed            # company RAKKU (code: RAKKU / password: rakku123)
pnpm seed:full       # company TOKOKO + Outlet Cabang
pnpm tsx scripts/seed-build.ts # company BUILD COFFEE lengkap
pnpm backfill:owners # buat akun owner untuk company existing
pnpm admin:invite admin@example.com # kirim invitation aktivasi Superadmin

# 4. Jalankan semua app paralel (Turborepo)
pnpm dev
# Owner → http://localhost:3000 | POS → http://localhost:3001 | Superadmin → http://localhost:3002 | Landing → http://localhost:3003
```

### Akun Development

Database Neon yang aktif saat ini dimulai baru dengan satu tenant demo:

- **Owner:** `demo_owner@rakku.test` / `DemoOwner2026!`.
- **POS:** company `DEMO` / `DemoPOS2026!`, pilih Outlet Demo dan `kasir_demo`, PIN `123456`.
- **Superadmin:** invitation dikirim ke email admin yang ditentukan; buka link aktivasi lalu buat password baru.
- Seed ulang demo: `pnpm db:demo` (idempotent).

Kredensial ini berasal dari script seed dan hanya untuk development:

- **Owner:** `budi@rakku.test` / `budi12345` (RAKKU), `ali@rakku.test` / `ali12345` (TOKOKO).
- **POS:** company `RAKKU` / `rakku123`, lalu pilih `budi`, `siti`, atau `ahmad` dengan PIN `123456`.
- **BUILD COFFEE:** lihat [PANDUAN.md](PANDUAN.md).

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
| `pnpm db:migrate` / `db:seed` | Baseline Neon dan data referensi untuk database development kosong |
| `pnpm db:provision` / `db:inspect` | Siapkan runtime role dan periksa database/Managed Auth |
| `pnpm db:demo` | Satu Owner/POS demo dengan catalog minimal |
| `pnpm env:check` / `db:smoke` / `smoke:http` / `auth:check` | Audit env dan smoke test driver, login, RLS, trusted domains |
| `pnpm db:copy --write-freeze-confirmed` | Salin data source dalam satu transaksi ke Neon kosong |
| `pnpm db:check` | Bandingkan isi database dan rekonsiliasi finansial |
| `pnpm db:images` | Pindahkan gambar legacy source ke Silos sebelum snapshot final |
| `pnpm admin:invite <email>` | Invitation Superadmin sekali pakai via Echo |
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

## Dokumentasi

- [DOCS.md](DOCS.md): referensi teknis, arsitektur, konfigurasi, database, route/API, deployment, dan risiko aktual.
- [PANDUAN.md](PANDUAN.md): panduan operasional untuk owner dan kasir menggunakan data seed BUILD COFFEE.
- [NEON_MIGRATION.md](NEON_MIGRATION.md): konfigurasi dan prosedur migrasi runtime Neon yang aktif.
- Dokumen `PRD*` dan `PROMPT*` adalah artefak perencanaan historis, bukan sumber kebenaran implementasi.

## Verifikasi

Jalankan `pnpm test:db`, `pnpm typecheck --concurrency=1`, `pnpm typecheck:scripts`, `pnpm lint --concurrency=1`, dan `pnpm build --concurrency=1`. Pada mesin dengan RAM terbatas, gunakan `NODE_OPTIONS=--max-old-space-size=1024`. Sebelum cutover produksi, lanjutkan dengan `pnpm db:check` dan smoke test Owner, POS, Superadmin, QRIS, ledger, dan tenant scoping pada project Neon.
