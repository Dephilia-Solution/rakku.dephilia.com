# Rakku — POS Multi-Tenant untuk Bisnis F&B

**Rakku** adalah sistem **Point of Sale (POS)** multi-tenant untuk bisnis F&B yang dibangun dengan **Next.js 14 (App Router)** dan **Supabase** (PostgreSQL + Storage). Sistem ini mendukung banyak perusahaan (tenant) yang terisolasi penuh, masing-masing dengan outlet, produk, karyawan, dan role-based access control (RBAC) sendiri.

---

## Arsitektur: Monorepo 3 App

Proyek ini adalah monorepo pnpm workspace + Turborepo yang berisi **3 aplikasi Next.js independen**, masing-masing deploy ke domain sendiri:

| App | Domain | Port Dev | Fungsi |
|-----|--------|----------|--------|
| `apps/owner` | `rakku.com` | 3000 | Dashboard Owner (daftar, login, onboarding, kelola outlet/karyawan/produk/laporan) |
| `apps/pos` | `pos.rakku.com` | 3001 | POS Kasir (login 4-step, register, pesanan, laporan) + **PWA** |
| `apps/superadmin` | `superadmin.rakku.com` | 3002 | Panel Superadmin (kelola semua tenant, RBAC, audit log) |

### Package bersama (`packages/`)

| Package | Isi |
|---------|-----|
| `@rakku/shared-types` | Seluruh TypeScript interfaces (common, tenant, owner) |
| `@rakku/supabase-clients` | Factory Supabase client (admin / browser / server) |
| `@rakku/auth-utils` | JWT wrapper, hash/verify PIN, audit log |
| `@rakku/ui` | Komponen UI (Badge, Tabs, Toast, PageHeader, dll) + Tailwind preset |
| `@rakku/pricing` | Seed default pricing tiers & sinkronisasi harga |

---

## Memulai

**Persyaratan:** Node.js 18+, pnpm 11+ (`corepack enable`), project Supabase (free tier).

```bash
# 1. Install dependency (otomatis link packages/*)
pnpm install

# 2. Buat .env.local di setiap app dengan env var berikut
#    NEXT_PUBLIC_SUPABASE_URL
#    NEXT_PUBLIC_SUPABASE_ANON_KEY
#    SMTP_HOST
#    SMTP_PORT
#    EMAIL
#    APP_PASSWORD
#    apps/owner/.env.local
#    apps/pos/.env.local
#    apps/superadmin/.env.local

# 3. Jalankan migrasi Supabase 001 → 021 + seed
pnpm seed            # company RAKKU (code: RAKKU / password: rakku123)
pnpm seed:full       # company TOKOKO + Outlet Cabang
pnpm backfill:owners # buat akun owner untuk company existing

# 4. Jalankan semua app paralel (Turborepo)
pnpm dev
# Owner → http://localhost:3000 | POS → http://localhost:3001 | Superadmin → http://localhost:3002
```

### Akun Testing

**Owner** (`apps/owner`): `budi@rakku.test` / `budi12345` (RAKKU) · `ali@rakku.test` / `ali12345` (TOKOKO)
**Kasir** (`apps/pos`, login 4-step): company `RAKKU` / `rakku123`, username `budi` / `siti` / `ahmad`, PIN `123456`

---

## Scripts Utama

| Script | Fungsi |
|--------|--------|
| `pnpm dev` | Jalankan semua app paralel |
| `pnpm dev:owner` / `dev:pos` / `dev:superadmin` | Jalankan satu app |
| `pnpm build` | Build semua app |
| `pnpm lint` | ESLint semua app |
| `pnpm seed` / `seed:full` | Seed data testing |
| `pnpm backfill:owners` | Backfill akun owner untuk company existing |

---

## Infrastruktur

- **Database**: satu project Supabase (PostgreSQL), migrasi di `supabase/migrations/` (001–021), RLS dinonaktifkan (isolasi via app-level filtering).
- **Auth**: custom JWT + bcrypt untuk owner & kasir; Supabase Auth untuk superadmin.
- **Email**: nodemailer (verifikasi owner), Resend (laporan via email).
- **PWA**: Serwist — hanya aktif di `apps/pos` (mode production).