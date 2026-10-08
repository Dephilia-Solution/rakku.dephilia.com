# Dokumentasi Sistem Rakku POS

> **Nama internal:** `rakku`
> **Stack aktif:** Next.js 14/16 (App Router) · Neon Postgres + Drizzle · Neon Managed Better Auth · Tailwind CSS · pnpm + Turborepo
> **Cakupan implementasi:** fitur sampai migration 031 (v6.1 M1-M4)
> **Author:** Alif Dhimas
> **Audit source terakhir:** 7 Oktober 2026
>
> Dokumen ini menjelaskan implementasi yang ada di repository, termasuk keterbatasan dan risiko yang belum diperbaiki. Dokumen PRD/PROMPT adalah riwayat perencanaan dan bukan sumber kebenaran runtime.

> **Pembaruan migrasi Neon:** runtime database dan Superadmin Auth telah diganti di source. Konfigurasi, baseline, script, otorisasi, transaksi atomik, dan langkah deployment terkini ada di [NEON_MIGRATION.md](NEON_MIGRATION.md). Penjelasan Supabase, service role, migration `001`–`031`, dan alur best-effort di bagian lama dokumen ini adalah referensi audit sebelum migrasi; gunakan panduan Neon untuk setup/deployment baru. Pemindahan database produksi masih memerlukan koneksi source/target dan verifikasi langsung.

---

## Daftar Isi

1. [Ikhtisar Sistem](#1-ikhtisar-sistem)
2. [Tech Stack](#2-tech-stack)
3. [Struktur Proyek](#3-struktur-proyek)
4. [Konfigurasi](#4-konfigurasi)
5. [Arsitektur](#5-arsitektur)
6. [Autentikasi & Otorisasi](#6-autentikasi--otorisasi)
7. [Database (Supabase)](#7-database-supabase)
8. [Rute Aplikasi](#8-rute-aplikasi)
9. [Komponen Utama](#9-komponen-utama)
10. [Library, Packages & Utilities](#10-library-packages--utilities)
11. [Detail API Penting](#11-detail-api-penting)
12. [Panduan Development](#12-panduan-development)
13. [PWA (Progressive Web App)](#13-pwa-progressive-web-app)
14. [Alur Lengkap (End-to-End)](#14-alur-lengkap-end-to-end)
15. [Riwayat Versi](#15-riwayat-versi)
16. [Catatan Teknis & Known Issues](#16-catatan-teknis--known-issues)

---

## 1. Ikhtisar Sistem

**Rakku** (Rakku POS) adalah sistem **Point of Sale (POS), inventory, billing, dan settlement** multi-tenant untuk bisnis F&B (kedai, cafe, restoran kecil). Sistem memakai satu database Supabase untuk banyak company dan outlet. Isolasi tenant dimaksudkan melalui filter di layer aplikasi, bukan dijamin oleh RLS; audit source menemukan beberapa endpoint yang belum menerapkan autentikasi atau scoping secara lengkap. Lihat §16.6 sebelum mengaktifkan sistem di produksi.

### 1.1 Empat Aplikasi

Monorepo berisi 4 aplikasi Next.js independen, masing-masing deploy terpisah:

| App | Package | Port Dev | Fungsi |
|-----|---------|----------|--------|
| `apps/owner` | `@rakku/owner` | 3000 | Dashboard Owner: daftar/login, onboarding, kelola outlet, karyawan & role, produk & resep, meja, pesanan, laporan penjualan + laba rugi, pajak & diskon, pengaturan + QR menu |
| `apps/pos` | `@rakku/pos` | 3001 | POS Kasir (PWA): login 4-step, register/kasir, pesanan & draft, laporan, produk, bahan baku, pembelian, pengeluaran, meja, menu QR publik |
| `apps/superadmin` | `@rakku/superadmin` | 3002 | Panel Superadmin: tenant, outlet, plan, langganan, saldo, withdrawal, rekonsiliasi, analytics, RBAC, dan audit log |
| `apps/landing` | `@rakku/landing` | 3003 | Landing page marketing tanpa backend; CTA membaca URL Owner dan POS dari environment |

### 1.2 Fitur Utama

| Fitur | App | Deskripsi |
|-------|-----|-----------|
| **POS Register** | pos | Grid produk, kategori, modifier/add-on, pencarian, tier harga, pajak & diskon otomatis |
| **Multi-Tenant** | owner, pos, superadmin | Banyak perusahaan dalam satu database; scoping dilakukan di aplikasi dan belum konsisten di seluruh endpoint |
| **RBAC Dinamis** | owner, pos, superadmin | Role & menu access matrix per perusahaan; pada POS saat ini terutama mengatur visibilitas navigasi, belum menjadi otorisasi API lengkap |
| **Pricing Tiers** | owner, pos | Harga berbeda per tier (Dine In, Take Away, Gojek, dll) |
| **Manajemen Produk** | owner, pos | CRUD produk per outlet, gambar (Silos), modifier, tier pricing, resep |
| **Manajemen Order** | owner, pos | Order completed, draft/pay-later (24 jam), split bill, invoice print 58mm |
| **Pajak & Diskon** | owner, pos | Pajak multi-tipe (persentase/fixed), diskon produk & order berperiode |
| **Bahan Baku & Resep** | owner, pos | Ingredients per outlet + BOM per produk (resep) |
| **Potong Stok Otomatis** | pos | Deduksi stok best-effort saat order selesai; belum transaksional dan idempotensi belum aman terhadap concurrency |
| **Stock Opname** | pos | Penyesuaian stok manual + catatan selisih (`stock_movements`) |
| **Pembelian / Restock** | pos | Pencatatan pembelian, tambah stok, update `cost_per_unit` (last cost) |
| **Pengeluaran Operasional** | pos | CRUD pengeluaran dengan kategori preset + custom |
| **Laporan Laba Rugi** | owner | Omzet, HPP (dari resep), pengeluaran, laba kotor & bersih |
| **Alert Stok Menipis** | pos | Badge di navigasi jika `stock_quantity <= min_stock_alert` |
| **Menu QR (view-only)** | pos, owner | Halaman menu publik per outlet + QR code di pengaturan owner |
| **Manajemen Meja** | owner, pos | CRUD meja, generate massal, status available/occupied |
| **Owner Self-Service** | owner | Daftar mandiri, verifikasi email, onboarding company + outlet |
| **Lupa Kata Sandi Owner** | owner | Reset via email (token SHA-256, berlaku 1 jam) |
| **Panel Superadmin** | superadmin | Kelola semua perusahaan, outlet, menu, role, user, access matrix |
| **Audit Log** | superadmin | Catatan semua percobaan login (sukses/gagal) |
| **Rate Limiting** | pos | Lockout PIN (5x) dan password company (10x) |
| **Email Transaksional** | owner, pos | Verifikasi owner, reset sandi, laporan penjualan via Echo API |
| **PWA (POS)** | pos | Installable, offline fallback, service worker (Serwist) |
| **Mobile-First Nav** | owner, pos | Sidebar desktop, bottom nav + more sheet di mobile |
| **Landing Page** | landing | Marketing statis dengan mockup POS, resep, laba |
| **Paket & Limit (v6 M1)** | owner, pos | Plan Free/Pro/Business + enforcement limit di server (outlet, karyawan, produk, bahan, transaksi) |
| **Pembayaran QRIS Pelanggan & Saldo (v6.1)** | pos, owner, superadmin | QRIS dinamis via Vessel + saldo merchant (ledger) + withdrawal manual + rekonsiliasi/analytics. **M1-M4 tersedia di source** |

---

## 2. Tech Stack

### 2.1 Aplikasi

| Layer | Teknologi | Keterangan |
|-------|-----------|------------|
| **Framework** | Next.js 14.2.35 | App Router, Server Components |
| **Bahasa** | TypeScript 5.x | Strict mode, path alias `@/*` dan `@rakku/*` |
| **Database** | Supabase (PostgreSQL) | Service role untuk banyak operasi backend; RLS core dinonaktifkan dan policy tabel lain umumnya permisif |
| **Auth (Tenant)** | Custom (JWT + bcrypt) | 4-step login: Company → Outlet → Akun → PIN |
| **Auth (Owner)** | Custom (JWT + bcrypt) | Email + password, verifikasi email, reset sandi |
| **Auth (Superadmin)** | Supabase Auth | Email/password terintegrasi Supabase |
| **State** | Zustand 5.x | Cart store POS, sidebar store |
| **Styling** | Tailwind CSS 3.x | Preset bersama `rakkuPreset` dari `@rakku/ui` |
| **Icons** | lucide-react | Icon set konsisten |
| **Animasi** | framer-motion 11.x | Sidebar, landing page, transisi |
| **Drag & Drop** | @dnd-kit | Urutkan kategori & pricing tier |
| **QR Code** | qrcode.react 4.x | QR menu di owner settings |
| **Image Processing** | sharp 0.35.x | Kompresi WebP 800px sebelum upload |
| **PWA** | Serwist 9.x | Service worker (hanya `apps/pos`, production) |
| **JWT** | jose 6.x (via `@rakku/auth-utils`) | Sign/verify JWT HS256 |
| **Hashing** | bcryptjs 3.x | Password owner/company & PIN karyawan |
| **Monorepo** | pnpm workspace + Turborepo | 4 app + 13 package internal |

### 2.2 Layanan Eksternal

| Layanan | Dipakai untuk | Env |
|---------|---------------|-----|
| **Supabase** | PostgreSQL, Supabase Auth (superadmin) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Echo** (`echo.dephilia.com`) | Email transaksional (verifikasi, reset sandi, laporan) | `ECHO_API_URL`, `ECHO_API_KEY`, `ECHO_FROM` |
| **Silos** (`silos.dephilia.com`) | Upload/hapus file gambar | `SILOS_API_URL`, `SILOS_API_KEY` |
| **CDN Dephilia** (`cdn.dephilia.com`) | URL publik gambar (produk, logo email) | — (dari response Silos) |
| **Vessel** (`vessel.surn.me`) | QRIS langganan dan QRIS dinamis pelanggan | `VESSEL_API_URL`, `VESSEL_API_KEY` (server-only, owner dan POS) |

> **Catatan:** `SMTP_*`, `EMAIL`, `APP_PASSWORD` masih ada di `.env.local` beberapa app tetapi **sudah tidak dipakai kode** (legacy dari era nodemailer). Email sekarang 100% lewat `@rakku/echo-client`.

---

## 3. Struktur Proyek

```
rakku/                                 # Monorepo root (pnpm workspace + Turborepo)
├── apps/
│   ├── owner/                         # @rakku/owner — port 3000
│   │   ├── src/app/
│   │   │   ├── (dashboard)/          # Route group protected (ResponsiveNav + DashboardContent)
│   │   │   │   ├── page.tsx          # / → redirect /dashboard | /onboarding | /login
│   │   │   │   ├── dashboard/        # Overview bisnis
│   │   │   │   ├── outlets/          # CRUD outlet
│   │   │   │   ├── employees/        # CRUD karyawan + tab Role & Akses
│   │   │   │   ├── orders/           # Daftar pesanan + [id]/invoice (print)
│   │   │   │   ├── reports/          # Tab Penjualan + Laba Rugi, kirim email
│   │   │   │   ├── products/         # List + add + [id]/edit (ProductForm + resep)
│   │   │   │   ├── tax-discounts/    # Pajak / Diskon Produk / Diskon Order
│   │   │   │   ├── tables/           # CRUD meja
│   │   │   │   └── settings/         # Profil company, ganti password, Menu QR
│   │   │   ├── login/ register/ check-email/ onboarding/
│   │   │   ├── forgot-password/ reset-password/
│   │   │   └── api/
│   │   │       ├── auth/owner/       # login, register, logout, session, verify-email,
│   │   │       │                      # resend-verification, forgot-password, reset-password
│   │   │       ├── onboarding/       # suggest kode/slug + buat company + outlet + seed tiers
│   │   │       └── owner/            # outlets, employees, roles, menus, products, categories,
│   │   │                              # pricing-tiers, product-tier-prices, modifiers, ingredients,
│   │   │                              # recipes, orders, taxes, discounts, tables, menu-qr,
│   │   │                              # settings, reports/profit-loss, reports/send-email
│   │   ├── src/components/           # auth, layout, owner, charges, products, reports, ui
│   │   ├── src/hooks/                # useMediaQuery, useModalHistory, useNavMode, useSwipe
│   │   ├── src/lib/                  # auth, store, supabase, format
│   │   ├── middleware.ts
│   │   ├── vercel.json
│   │   └── .env.local
│   │
│   ├── pos/                           # @rakku/pos — port 3001 + PWA
│   │   ├── src/app/
│   │   │   ├── (auth)/login/         # 4-step: login → select-outlet → select-user → enter-pin
│   │   │   ├── (dashboard)/          # register, orders(+invoice), reports, products(+add/edit),
│   │   │   │                          # tax-discounts, ingredients(+add/edit), purchases(+add),
│   │   │   │                          # expenses, tables
│   │   │   ├── (public)/menu/[slug]/ # Menu QR publik (view-only)
│   │   │   ├── ~offline/             # Fallback offline PWA
│   │   │   ├── sw.ts                 # Service worker (Serwist)
│   │   │   ├── manifest.ts           # Web app manifest
│   │   │   └── api/
│   │   │       ├── auth/tenant/      # company, outlet, accounts, verify-pin, session,
│   │   │       │                      # switch-user, logout
│   │   │       ├── admin/            # products(+upload/image), categories, modifiers,
│   │   │       │                      # modifier-tier-prices, pricing-tiers, product-tier-prices,
│   │   │       │                      # pricing-options, recipes, taxes(+active), discounts(+active),
│   │   │       │                      # orders(+draft+split), ingredients(+[id]/adjust),
│   │   │       │                      # purchases, expenses, tables(+generate)
│   │   │       ├── public/menu/[slug] # API menu publik
│   │   │       └── reports/send-email
│   │   ├── src/components/           # layout, register, products, charges, inventory, reports, ui
│   │   ├── src/hooks/                # useNavMode, useDraftCount, useLowStockCount, dll
│   │   ├── src/lib/                  # auth, inventory/stock, store, supabase, format
│   │   ├── middleware.ts
│   │   ├── next.config.mjs           # withSerwist + downlevel ES2017
│   │   ├── vercel.json
│   │   └── .env.local
│   │
│   ├── superadmin/                    # @rakku/superadmin — port 3002
│   │   ├── src/app/
│   │   │   ├── login/                # Login Supabase Auth
│   │   │   ├── (protected)/          # companies, outlets, menus, roles, access-matrix,
│   │   │   │                          # users, audit-logs
│   │   │   └── api/superadmin/       # companies, outlets, menus, roles, users,
│   │   │                              # access-matrix, audit-logs, plans, subscriptions, auth/logout
│   │   ├── middleware.ts
│   │   ├── vercel.json
│   │   └── .env.local
│   │
│   └── landing/                       # @rakku/landing — port 3003 (statis)
│       ├── src/app/                  # / (single-page marketing)
│       ├── src/components/           # header, hero, features, workflow, inventory-story,
│       │                              # audience, faq, final-cta, footer, motion, dll
│       ├── next.config.mjs           # images.unoptimized
│       └── vercel.json
│
├── packages/                          # Shared code (@rakku/* — workspace:*, source-only)
│   ├── shared-types/                  # common.ts, tenant.ts, owner.ts, inventory.ts
│   ├── supabase-clients/             # createAdminClient, createBrowserClient, createServerClient
│   ├── auth-utils/                   # jwt.ts, pin.ts, audit-log.ts
│   ├── ui/                           # Badge, Tabs, Toast, SlideOver, PageHeader, dll + tailwind.preset
│   ├── plans/                        # getCompanyPlan, checkLimit, checkFeature, getUsageSummary (v6)
│   ├── ledger/                       # creditBalance, holdBalance, releaseBalance, adjustBalance, getBalance (v6.1)
│   ├── emails/                       # renderRakkuEmail + sendBillingEmail (idempotent, v6.1)
│   ├── inventory/                    # deductStockForOrder (dipindah dari apps/pos, v6.1 M2)
│   ├── payments/                     # createQrisIntent, processOrderPayment (QRIS order idempotent, v6.1 M2)
│   ├── vessel-client/                # createQrisPayment, getPaymentStatus, syncPaymentStatus → Vessel API
│   ├── pricing/                      # DEFAULT_TIERS, seedDefaultTiers, syncProductTierPrices
│   ├── echo-client/                  # sendEmail() → Echo API
│   └── silos-client/                 # uploadFile(), deleteFile(), getFile() → Silos API
│
├── supabase/
│   ├── migrations/                   # 30 file migrasi (001-031, tanpa 005)
│   └── seed.sql                      # Seed statis kategori/produk/modifier sample
│
├── scripts/
│   ├── seed.ts                       # Seed company RAKKU
│   ├── seed-full.ts                  # Seed TOKOKO + Outlet Cabang (STOCKO)
│   ├── seed-build.ts                 # Seed tenant BUILD COFFEE lengkap (inventory, meja, QR)
│   ├── seed-build-images.ts          # Download foto Wikimedia → sharp → upload Silos
│   ├── backfill-owners.ts            # Backfill akun owner untuk company existing
│   ├── remove-supabase-bucket.ts     # Hapus bucket product-images (storage pindah ke Silos)
│   └── generate-favicons.mjs         # Generate favicon per app
│
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml               # Workspace: apps/* + packages/*
├── package.json                      # Root scripts (dev, build, lint, seed, dll)
├── tsconfig.base.json                # Base TS config + path alias @rakku/*
├── .env.local                        # Env root (script seeding; tidak dibaca Next.js)
├── DOCS.md                           # Dokumen ini
├── README.md                         # Quick start
└── PANDUAN.md                        # Manual pengguna (owner & kasir)
```

### 3.1 Port Development

| App | Port | Perintah |
|-----|------|----------|
| owner | 3000 | `pnpm dev:owner` |
| pos | 3001 | `pnpm dev:pos` |
| superadmin | 3002 | `pnpm dev:superadmin` |
| landing | 3003 | `pnpm dev:landing` |
| semua | — | `pnpm dev` (Turborepo parallel) |

---

## 4. Konfigurasi

### 4.1 Environment Variables

Setiap app punya `.env.local` sendiri di direktori app. Next.js **hanya** membaca `.env.local` di root app yang dijalankan; file `.env.local` di root monorepo hanya dipakai script seeding (`scripts/*.ts`) dan tidak dibaca oleh app.

**`apps/owner/.env.local`**
```env
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
OWNER_JWT_SECRET=<random-secret-min-32-chars>
NEXT_PUBLIC_POS_URL=http://localhost:3001
NEXT_PUBLIC_OWNER_URL=http://localhost:3000
SILOS_API_URL=https://silos.dephilia.com
SILOS_API_KEY=<silos-api-key>
ECHO_API_URL=https://echo.dephilia.com
ECHO_API_KEY=<echo-api-key>
ECHO_FROM=rakku@notify.dephilia.com
VESSEL_API_URL=https://vessel.surn.me
VESSEL_API_KEY=<vessel-api-key-sandbox>   # server-only, jangan pernah ke client
CRON_SECRET=<random-secret>                # proteksi /api/cron/billing (Vercel Cron)
# Legacy (tidak dipakai kode):
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL=<email>
APP_PASSWORD=<app-password>
```

**`apps/pos/.env.local`**
```env
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
POS_JWT_SECRET=<random-secret-min-32-chars>
NEXT_PUBLIC_OWNER_URL=http://localhost:3000
SILOS_API_URL=https://silos.dephilia.com
SILOS_API_KEY=<silos-api-key>
ECHO_API_URL=https://echo.dephilia.com
ECHO_API_KEY=<echo-api-key>
ECHO_FROM=rakku@notify.dephilia.com
VESSEL_API_URL=https://vessel.surn.me
VESSEL_API_KEY=<vessel-api-key-sandbox>   # server-only (QRIS dinamis pelanggan)
# Legacy (tidak dipakai kode):
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL=<email>
APP_PASSWORD=<app-password>
```

**`apps/superadmin/.env.local`**
```env
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
# Opsional (link "Ke Owner"): NEXT_PUBLIC_OWNER_URL=http://localhost:3000
```

**`apps/landing/.env.local`**
```env
NEXT_PUBLIC_OWNER_URL=http://localhost:3000
NEXT_PUBLIC_POS_URL=http://localhost:3001
```

Landing tidak memiliki backend, tetapi CTA membaca kedua variabel tersebut. Tanpa nilainya, link dapat terbentuk sebagai `undefined/register` atau `undefined/login`.

**`.env.local` root** — dipakai script seeding/upload:
```env
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_TAX_RATE / NEXT_PUBLIC_STORE_NAME / NEXT_PUBLIC_STORE_ADDRESS
TENANT_JWT_SECRET / NEXT_PUBLIC_APP_URL
SILOS_API_URL / SILOS_API_KEY
SMTP_HOST / SMTP_PORT / EMAIL / APP_PASSWORD   # legacy
```

**Matriks variabel:**

| Variabel | Owner | POS | Superadmin | Landing | Fungsi |
|----------|-------|-----|------------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Ya | Ya | Ya | - | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ya | Ya | Ya | - | Anon key untuk browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya | Ya | Ya | - | Service role key; server-only dan bypass RLS |
| `OWNER_JWT_SECRET` | Ya | - | - | - | JWT `owner_session` |
| `POS_JWT_SECRET` | - | Ya | - | - | JWT `session` dan `pending_login` |
| `NEXT_PUBLIC_POS_URL` | Ya | - | - | Ya | URL POS, QR menu, dan CTA Landing |
| `NEXT_PUBLIC_OWNER_URL` | Ya | Ya | Opsional | Ya | URL Owner untuk callback/link/CTA |
| `SILOS_API_URL` / `SILOS_API_KEY` | Ya | Ya | - | - | Upload/hapus gambar |
| `ECHO_API_URL` / `ECHO_API_KEY` / `ECHO_FROM` | Ya | Ya | - | - | Email transaksional |
| `VESSEL_API_URL` / `VESSEL_API_KEY` | Ya | Ya | - | - | QRIS langganan dan QRIS order; server-only |
| `CRON_SECRET` | Ya | - | - | - | Bearer token `/api/cron/billing` |
| `SMTP_*` / `EMAIL` / `APP_PASSWORD` | Legacy | Legacy | - | - | Tidak dibaca source saat ini |

**Produksi:** repository hanya mencatat URL publik Owner (`https://rakku.vercel.app`) dan POS (`https://pos-rakku.vercel.app`) melalui `.env.production` Owner/POS/Superadmin. Tidak ada `.env.production` Landing dan tidak ada URL Superadmin/Landing yang dapat dikonfirmasi dari repo. Semua secret wajib disimpan di **Vercel Project Settings**, tidak di git.

### 4.2 `next.config.mjs` per App

**`apps/owner`**
- `redirects()` (non-permanent): `/pricing-tiers` → `/products`; `/taxes` → `/tax-discounts?tab=pajak`; `/discounts` → `/tax-discounts?tab=produk`.
- `images.remotePatterns`: `https://*.supabase.co`, `https://cdn.dephilia.com`.
- `transpilePackages`: `@rakku/shared-types`, `@rakku/supabase-clients`, `@rakku/auth-utils`, `@rakku/ui`, `@rakku/pricing`.

**`apps/pos`**
- Dibungkus `withSerwistInit` (lihat §13) + plugin webpack `DownlevelSerwistSW` yang menurunkan sintaks bundle service worker/chunk ke **ES2017** untuk Android WebView lama (browserslist: Android ≥ 8, Chrome ≥ 62).
- Redirect sama seperti owner, plus `/categories` → `/products`.
- `images.remotePatterns` sama (Supabase + CDN Dephilia).
- `transpilePackages`: semua `@rakku/*` + `@serwist/next` + `serwist`.

**`apps/superadmin`**
- `images.remotePatterns`: `https://*.supabase.co`.
- `transpilePackages`: `@rakku/shared-types`, `@rakku/supabase-clients`, `@rakku/ui`.

**`apps/landing`**
- `images.unoptimized: true`; `transpilePackages: ["@rakku/ui"]`.
- URL Owner/POS dibaca dari `NEXT_PUBLIC_OWNER_URL` dan `NEXT_PUBLIC_POS_URL` di `src/components/site.ts`; tidak ada fallback.

### 4.3 `tailwind.config.ts`

Semua app memakai preset bersama `rakkuPreset` dari `@rakku/ui/tailwind.preset`:

- **Warna:** `primary` (green scale), `forest` (`#2E7D32` + dark/light), `neutral`, `danger`, `warning`, `success`.
- **Font:** `display`, `body` (DM Sans), `mono` (JetBrains Mono).
- **Animasi:** `slide-up`, `fade-in`, `bounce-in`.
- **Radius:** `card` 12px, `modal` 16px.

`apps/landing` menambah theme sendiri: green scale `950–300`, `lime`, `paper`, `ink`, `muted`, `ivory`, `maxWidth.shell` 1200px, shadow khusus card/preview/CTA.

### 4.4 `tsconfig.json`

- `strict: true`, `moduleResolution: "bundler"`, `jsx: "preserve"`, target ES2022.
- Path alias: `@/*` → `./src/*` dan `@rakku/*` → `../../packages/*/src`.
- Base config bersama di `tsconfig.base.json`; tiap package punya script `typecheck` (`tsc --noEmit`).

### 4.5 `middleware.ts` per App

> Catatan: middleware selalu melewati `/api*`. Halaman dashboard juga memakai guard di server layout, tetapi API harus mengautentikasi dan mengotorisasi request sendiri. Audit menemukan beberapa route POS yang belum melakukannya; lihat §16.6.

**`apps/owner`**
- Bypass: `/_next*`, `/api*`, `/favicon*`, `/`.
- `/login` & `/register`: jika `owner_session` valid → redirect `/dashboard` (punya company) atau `/onboarding`.
- `/onboarding`: wajib session; jika company sudah ada → `/dashboard`.
- Daftar protected di middleware: `/dashboard`, `/outlets`, `/employees`, `/settings`, `/reports`, `/orders`, `/pricing-tiers`, `/taxes`, `/discounts`.
- **Tidak** tercantum di middleware (dilindungi layout `(dashboard)`): `/products`, `/tax-discounts`, `/tables`.
- Public: `/forgot-password`, `/reset-password`, `/check-email`.

**`apps/pos`**
- Bypass: `/_next*`, `/api*`, `/favicon*`, `/`.
- Public auth: `/login`, `/login/select-outlet`, `/login/select-user`, `/login/enter-pin`.
- Protected di middleware: `/register`, `/orders`, `/reports`, `/products`, `/tax-discounts`.
- **Tidak** tercantum di middleware (dilindungi layout `(dashboard)`): `/ingredients`, `/purchases`, `/expenses`, `/tables`; `/menu/[slug]` memang publik.

**`apps/superadmin`**
- Memakai `@supabase/ssr` `createServerClient` untuk refresh cookie Supabase Auth.
- Bypass: `/_next*`, `/api*`, `/favicon*`, `/`.
- `/login`: jika sudah login → `/companies`.
- Protected: `/companies`, `/outlets`, `/menus`, `/roles`, `/access-matrix`, `/users`, `/audit-logs`.

**`apps/landing`** — tidak ada middleware.

**Matcher pattern (owner/pos/superadmin):**
```
/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)
```

### 4.6 `vercel.json`

Semua app deploy sebagai project Vercel terpisah dengan pola sama:

```json
{
  "buildCommand": "pnpm --filter @rakku/<app> build",
  "installCommand": "PNPM_ONLY_BUILT_DEPENDENCIES=esbuild,unrs-resolver pnpm install",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

---

## 5. Arsitektur

### 5.1 Multi-Tenancy

- **Company** = tenant (mis. `RAKKU`, `TOKOKO`, `BUILD`); **Outlet** = cabang dalam company.
- Model data memakai `company_id` dan, untuk data operasional, `outlet_id`.
- Isolasi **dimaksudkan** melalui filtering di query/API, bukan RLS. Migration 003 mematikan RLS pada tabel core dan banyak operasi memakai service role.
- Owner memiliki helper `verifyOutletBelongsToCompany()`. Implementasi POS belum konsisten: beberapa route tidak memverifikasi session, menerima ID tenant dari body, atau tidak mengecek kepemilikan resource.
- **Ownership:** tabel `companies.owner_id` → `owners.id` (migration 014) menghubungkan tenant ke akun owner self-service.

### 5.2 RBAC (Role-Based Access Control)

- **Superadmin** mengelola semua company/outlet/menu/role/user/access matrix menggunakan Supabase Auth. Saat ini setiap user Supabase Auth yang valid diperlakukan sebagai superadmin; belum ada claim/allowlist/role platform.
- **Role** didefinisikan per company (default seed: Owner, Kepala Cabang, Admin, Kasir).
- **Menu** = modul sistem di tabel `menus`; menu aktif saat ini: `register`, `orders`, `reports`, `products`, `tax-discounts`, `ingredients`, `tables`, `expenses`, `purchases`.
- **Access matrix** = `role_menu_access` (role x menu). UI POS memakai `can_view` untuk navigasi; API belum menegakkan `can_create`, `can_edit`, atau `can_delete`.
- Sidebar POS dirender dari `getAllowedMenus(roleId)`. Onboarding baru membuat role **Owner** dengan semua menu yang ada dan **Kasir** dengan `register`, `orders`, `reports`, serta `tax-discounts`; akses dapat diubah lewat panel "Kelola Role & Akses". Script BUILD memakai access map sendiri dan masih menyebut slug legacy `taxes` (§16.4).

### 5.3 Pola Server vs Client

| Konteks | Pola |
|---------|------|
| Halaman dashboard | Server Component: verifikasi session → fetch data via admin Supabase client (`queries.server.ts` / `queries.owner.ts`) → kirim props ke client component |
| Aksi tulis (CRUD) | Client component → `fetch` ke API route app sendiri → route handler → admin client. Verifikasi session/scoping bergantung pada implementasi tiap route dan belum seragam |
| Browser Supabase client | Hanya dipakai untuk hal spesifik (mis. superadmin auth); operasi data selalu lewat API route |
| Cache | POS register memuat katalog saat server render; data dinamis (draft count, low stock) dipoll client tiap 30 detik |

### 5.4 Alur Data Order

```
Register (cart store)
   │  items + modifier + tier + pajak/diskon + meja + customer
   ▼
POST /api/admin/orders  ── atau ──  POST /api/admin/orders/draft (pay-later, reserved_until 24 jam)
   │
   ├─ insert orders (+ order_items, snapshot nama & harga)
   ├─ hitung discount_amount, taxes/discounts (jsonb)
   ├─ jika status = completed → deductStockForOrder() (best-effort, non-transaksional)
   └─ jika table_id ada → set dining_tables.status = 'occupied' (best-effort)
   ▼
InvoiceReceipt (print 58mm) / Invoice page
```

- **Draft:** `PATCH /api/admin/orders/draft` mengganti `order_items`; saat `status=completed`, deduksi stok dan occupancy dijalankan. Cek idempotensi berbasis query tidak dilindungi unique constraint sehingga masih race-prone.
- **Split bill:** `POST /api/admin/orders/split` hanya mencatat `split_payments` (tidak menyentuh stok).
- **Switch user / shift:** semua event auth dicatat di `auth_audit_logs`.

Payload order standar masih membawa `companyId`, `outletId`, `cashierId`, harga, pajak, diskon, dan total dari client. Endpoint belum menghitung ulang seluruh nilai dari data server dan belum selalu mengikat ID tenant ke session. Ini adalah risiko integritas dan cross-tenant (§16.6).

### 5.5 Alur Inventory

```
Pembelian (purchases) ──► stock_quantity += qty, cost_per_unit = unit_cost (last cost)
                                 │
Penjualan (order completed) ──► deductStockForOrder(): Σ recipe.quantity_used × qty
                                 │  → stock_quantity -= total, catat stock_movements 'sale_deduction'
                                 │
Stock Opname (adjust) ─────────► set stok absolut, catat selisih 'adjustment'
                                 │
Semua pergerakan tercatat di stock_movements (purchase / sale_deduction / adjustment / waste)
```

- Stok **boleh minus** saat penjualan (checkout tidak diblokir).
- Produk tanpa resep tidak memotong stok.
- Badge "stok menipis" muncul bila `min_stock_alert > 0` dan `stock_quantity <= min_stock_alert` (poll 30 detik).

### 5.6 Email Transaksional (Echo)

- Package `@rakku/echo-client` → `sendEmail({ to, subject, html, from? })` → `POST {ECHO_API_URL}/api/send` dengan `Authorization: Bearer {ECHO_API_KEY}`.
- `from` default `ECHO_FROM` (mis. `rakku@notify.dephilia.com`).
- Template email: package `@rakku/emails` → `renderRakkuEmail()` (eyebrow, title, paragraf, CTA, note) dengan logo **absolut** ke `cdn.dephilia.com` (bukan URL app, agar bisa dimuat klien email).
- Pengiriman yang dipakai saat ini: verifikasi email owner, kirim ulang verifikasi, reset kata sandi owner, laporan penjualan (owner & POS).
- Kegagalan kirim **tidak** boleh di-swallow: route mengembalikan error ke UI (kecuali kebijakan khusus).

### 5.7 Gambar & Silos

- Upload gambar produk (owner & POS): validasi JPG/PNG/WebP ≤ 2 MB → kompres `sharp` ke WebP maks 800px → `uploadFile()` ke Silos → simpan `products.image_url` + `products.image_silo_id`.
- Hapus gambar: `deleteFile(image_silo_id)` + null-kan kolom (POS: `DELETE /api/admin/products/image`).
- URL publik file dari Silos berupa `https://cdn.dephilia.com/...` (sudah di-allow di `next.config`).
- Bucket Supabase `product-images` sudah dihapus (migration 023 + `scripts/remove-supabase-bucket.ts`).
- Logo email juga di-host di Silos/CDN agar tidak bergantung pada URL app.

### 5.8 Freemium & Limit Paket (v6.0 — M1 + M2 + M3 + M4)

Rakku beralih ke model **freemium 3 paket** (Free / Pro / Business). Status implementasi: **M1** (fondasi plan & limit), **M2** (gating UI, trial, grace transaksi), **M3** (billing QRIS via Vessel sandbox), dan **M4** (notifikasi email, cron harian, landing pricing, monitoring superadmin) selesai. Go-live Vessel production = M5 (`PROMPT_RAKKU_V6_FREEMIUM_SUBSCRIPTION.md`).

**Paket & limit:**

| Limit | Free | Pro | Business |
|-------|------|-----|----------|
| Harga | Rp0 | Rp99rb/bln · Rp990rb/thn | Rp249rb/bln · Rp2,49jt/thn |
| Outlet | 1 | 3 | unlimited |
| Karyawan | 2 | 15 | unlimited |
| Produk | 30 | 500 | unlimited |
| Bahan baku | 10 | unlimited | unlimited |
| Transaksi/bulan | 500 | 5.000 | unlimited |
| Riwayat laporan | 30 hari | 12 bulan | unlimited |
| Email report/bulan | 5 | 100 | unlimited |
| Storage gambar | 50 MB | 1 GB | 5 GB |

**Feature keys (Pro/Business):** `multi_outlet`, `custom_roles`, `profit_loss`, `email_reports`, `inventory_advanced`, `remove_qr_branding`; Business menambah `audit_log`, `priority_support`.

**Enforcement (server-side, package `@rakku/plans`):**

| Endpoint | Cek |
|----------|-----|
| `POST /api/owner/outlets` | `max_outlets` |
| `POST /api/owner/employees` | `max_employees` |
| `POST /api/owner/products` | `max_products` |
| `POST /api/owner/roles` | fitur `custom_roles` |
| `GET /api/owner/reports/profit-loss` | fitur `profit_loss` |
| `POST /api/owner/reports/send-email` | fitur `email_reports` |
| `POST /api/admin/ingredients` | `max_ingredients` |
| `POST /api/admin/orders` + draft → completed | `max_transactions_month` + grace |
| `POST /api/admin/purchases`, `POST /api/admin/ingredients/[id]/adjust` | fitur `inventory_advanced` |

**Perilaku limit transaksi (soft + grace):** peringatan di 80%, grace **tambahan 10% ATAU 3 hari** (mana yang lebih dulu habis, dihitung dari order yang membuat kuota penuh), lalu blokir dengan CTA upgrade. Hanya order `status=completed` yang dihitung, reset per bulan kalender. POS menampilkan banner kuota (`LimitBanner`) dan owner menampilkan banner serupa + ringkasan kuota di `/subscription`.

**Error standar:**
```json
{
  "error": "Paket Free hanya mendukung 1 outlet. Upgrade untuk menambah outlet.",
  "code": "PLAN_LIMIT",
  "feature": "outlets",
  "current": 1,
  "max": 1,
  "upgrade_url": "/subscription"
}
```

**Status langganan (`companies.subscription_status`):** `trial` / `active` / `grace` (7 hari setelah expiry) / `expired` (efektif Free) / `cancelled`. Resolusi efektif plan dilakukan `getCompanyPlan()` — trial kedaluwarsa otomatis turun ke Free.

**Trial:** company baru dari onboarding otomatis mendapat **Pro 14 hari** (`status=trial`, `trial_ends_at`); setelah habis efektif Free tanpa menghapus data. Banner countdown muncul di dashboard owner.

**Gating UI (M2):**

| Lokasi | Perilaku saat fitur tidak tersedia |
|--------|-------------------------------------|
| Owner nav | Menu **Langganan** (`/subscription`) berisi paket aktif, usage meter, tabel paket, riwayat (placeholder) |
| Owner `PlanBanner` | Banner trial countdown, limit ≥80%, status grace/expired |
| Owner Laporan | Tab **Laba Rugi** disembunyikan + panel terkunci; tombol **Kirim Email** diganti ikon gembok |
| Owner Karyawan | Tombol Tambah/Edit/Hapus Role + toggle access matrix memicu `UpgradeModal` |
| Owner Outlet/Produk | Error `PLAN_LIMIT` dari API memicu `UpgradeModal` |
| POS nav | Menu `/purchases` diberi ikon gembok di sidebar/rail/bottom nav → `UpgradeModal` |
| POS Bahan Baku | Tombol Stock Opname memicu `UpgradeModal`; badge stok menipis disembunyikan |
| POS Register | Order yang melewati kuota menampilkan `UpgradeModal` (bukan toast generik) |
| POS banner | `LimitBanner` menampilkan kuota transaksi (80%, grace, blokir) |

Komponen: `apps/owner/src/components/billing/{PlanProvider,PlanBanner,UpgradeModal,SubscriptionClient}.tsx` dan `apps/pos/src/components/billing/{PlanProvider,LimitBanner,UpgradeModal}.tsx`. Provider diisi dari layout `(dashboard)` masing-masing app via `getUsageSummary()`.

**Billing QRIS via Vessel (M3):**

1. Owner memilih paket + siklus di `/subscription` → `POST /api/owner/subscription/checkout` membuat invoice (`RK-YYYYMM-<code>-<stamp>`) dan memanggil `createQrisPayment` Vessel (`tenant_id` = company_id, `callback_url` = `<owner>/api/webhooks/vessel`).
2. Halaman `/subscription/checkout/[invoiceId]` menampilkan QR (`qrcode.react`), nominal, countdown, polling status tiap 5 detik + tombol "Saya sudah bayar".
3. Status sukses di-aktivasi lewat `processInvoice()`: **selalu re-verify** ke Vessel (`getPaymentStatus`) — payload webhook tidak dipercaya langsung. Aktivasi idempotent (atomic claim `status=pending`), membuat baris `subscriptions` + update `companies.plan_id/plan_expires_at/status`.
4. `POST /api/webhooks/vessel` menerima callback Vessel → cari invoice → `processInvoice()` (aman dipanggil bersamaan dengan polling).
5. Invoice pending yang lewat `expired_at` ditandai `expired`; renewal = checkout baru (QRIS one-time). Perpanjangan plan yang sama mulai dari `plan_expires_at` yang masih berlaku.

Tabel: `subscriptions` (riwayat periode) dan `subscription_invoices` (tagihan + `provider_transaction_id` UNIQUE). Package: `@rakku/vessel-client` (`createQrisPayment`, `getPaymentStatus`, `syncPaymentStatus`).

**Notifikasi & cron harian (M4):**

- Semua email billing memakai `sendBillingEmail()` (package `@rakku/emails`) dengan **klaim idempotent** di tabel `notification_logs` (UNIQUE company/type/period) — satu email per event per periode.
- Event: trial dimulai (onboarding), trial H-3, trial berakhir, limit 80%, limit 100%, pembayaran berhasil (aktivasi), renewal H-7/H-3/H-1, grace, langganan berakhir.
- `GET/POST /api/cron/billing` (dilindungi `CRON_SECRET`, dipanggil Vercel Cron `0 1 * * *`): sync invoice pending ke Vessel, expire trial/langganan, kirim reminder, dan peringatan kuota. Mode uji aman: `?dry=1` (tanpa kirim email).
- Email memakai template `renderRakkuEmail()` (logo CDN) via `@rakku/echo-client`.

**Analytics & go-live (M5, sebagian):**

- Superadmin `/subscriptions` menampilkan analytics konversi: trial → bayar, limit → upgrade, pendapatan 30 hari, dan distribusi paket per company.
- Checklist go-live Vessel produksi:
  1. Rotasi `VESSEL_API_KEY` sandbox → key produksi (update `VESSEL_API_URL` bila host berbeda).
  2. Set env produksi owner: `NEXT_PUBLIC_OWNER_URL` (domain asli, bukan localhost), `CRON_SECRET`, `ECHO_*`, `SILOS_*`.
  3. Uji transaksi QRIS nominal kecil di produksi; pastikan `callback_url` terjangkau dan aktivasi + email berjalan.
  4. Pastikan Vercel Cron aktif (`crons` di `apps/owner/vercel.json`) dan `CRON_SECRET` sama.
  5. Pantau `/subscriptions` superadmin (invoice pending, konversi, revenue).
- **Diputuskan ditunda** (bukan bagian rilis ini): add-on outlet tambahan, promo/voucher, dan analytics lanjutan.

**Onboarding:** company baru awalnya mengikuti default plan database lalu, jika plan Pro tersedia, langsung diubah menjadi trial Pro 14 hari. Role default `Owner` dan `Kasir` dibuat agar dapat langsung operasional; role tambahan hanya tersedia ketika feature `custom_roles` aktif.

### 5.9 Pembayaran Pelanggan, Saldo & Withdrawal (v6.1 — M1–M4 selesai)

> Spesifikasi lengkap + milestone: `PROMPT_RAKKU_V6.1_QRIS_SALDO_WITHDRAWAL.md`.

**Status:** **M1 (ledger & saldo)**, **M2 (QRIS dinamis di POS)**, **M3 (withdrawal manual)**, dan **M4 (rekonsiliasi & analytics)** sudah diimplementasi.

- M1: migration 028, package `@rakku/ledger`, halaman owner `/balance`, halaman superadmin `/balances` + koreksi saldo (adjustment).
- M2: migration 029, packages `@rakku/inventory` + `@rakku/payments`, endpoint POS QRIS (create/poll/retry/cancel), webhook diperluas, cron sync, UI QRIS di PaymentModal, badge "Menunggu".
- M3: migration 030, rekening bank + pengajuan pencairan (hold saldo), antrian superadmin (proses/selesai/tolak + bukti), notifikasi email via `@rakku/emails`.
- M4: migration 031 (`settlement_reports`), halaman superadmin `/reconciliation` (saldo sistem vs posisi kas vs settlement, selisih/gap) dan `/analytics` (volume QRIS, MDR, saldo, pencairan, grafik 14 hari); bullet QRIS di landing.

**Konsep:** pelanggan membayar via **QRIS dinamis milik Rakku** (Vessel/DOKU). Uang masuk ke akun Rakku, merchant mendapat **saldo** yang bisa dicairkan (withdrawal) ke rekening bank.

**Alur QRIS dinamis (POS):**
1. Kasir pilih QRIS → "QRIS Dinamis (Rakku)" → order dibuat `pending_payment`/`unpaid` + `payment_intents` + QR dari Vessel (`expired_in_minutes: 15`).
2. QR + countdown tampil di kasir; status dicek via webhook **dan** polling tiap 4 detik (selalu re-verify ke Vessel).
3. Sukses → intent diklaim, lalu order diselesaikan, stok dipotong, meja diubah, dan saldo dikredit. Claim intent atomic, tetapi seluruh rangkaian belum satu transaksi; kegagalan setelah claim dapat meninggalkan state parsial.
4. Expired → order tetap pending; kasir bisa buat QR baru (retry) atau batalkan.
5. **QRIS manual lama tetap ada** (uang langsung ke QRIS merchant, tidak masuk ledger); dinamis otomatis nonaktif untuk split bill / pembayaran draft.

**Fee & saldo:**
- MDR **pass-through 0,7%**: `saldo masuk = gross − round(gross × 0.007)`; Rakku tidak mengambil margin.
- Ledger `balance_transactions` = sumber kebenaran (append-only, idempotent UNIQUE `reference_type+reference_id+type`); `merchant_balances` = cache saldo.
- Semua mutasi lewat RPC `apply_balance_transaction` (atomic, `FOR UPDATE`, tolak saldo negatif) — **hanya service_role** yang boleh execute.
- Refund QRIS belum tersedia di API Vessel → koreksi lewat `adjustment` manual superadmin.

**Withdrawal (manual dulu):**
- Owner ajukan dari halaman `/balance` (rekening bank + nominal) → saldo di-hold (`available → pending`).
- Superadmin memproses transfer manual lalu menandai **completed** (referensi + bukti) atau **rejected** (saldo kembali).
- Default: minimum Rp50.000, biaya Rp0, maks 1 pengajuan pending per company, maks Rp10 juta/hari (konstanta, mudah diubah).
- Notifikasi email: pengajuan diterima, selesai, ditolak. Pembayaran pelanggan tidak memicu email.

**Risiko utama:** menampung & mencairkan dana merchant menyentuh area regulasi PJP (Bank Indonesia) — perlu review legal; MDR dibebankan ke akun Rakku (ditutup pass-through); likuiditas float harus dipantau.

---

## 6. Autentikasi & Otorisasi

### 6.1 Tenant Login (POS) — 4 Langkah

| Step | Halaman | Endpoint | Yang terjadi |
|------|---------|----------|--------------|
| 1 | `/login` | `POST /api/auth/tenant/company` | Verifikasi `companies.code` + password (bcrypt). Gagal 10x → lock 15 menit. Sukses → set cookie `pending_login` (10 menit, JWT berisi company_id/name). Log `company_login`. |
| 2 | `/login/select-outlet` | `GET/POST /api/auth/tenant/outlet` | List outlet aktif; pilih → re-sign `pending_login` + outlet. Log `outlet_select`. |
| 3 | `/login/select-user` | `GET /api/auth/tenant/accounts` | List user aktif untuk outlet (semua outlet atau via `user_outlets`). Log `account_select`. |
| 4 | `/login/enter-pin` | `POST /api/auth/tenant/verify-pin` | Verifikasi PIN 6 digit (bcrypt). Gagal 5x → lock 15 menit. Sukses → set cookie `session`, hapus `pending_login`, log `pin_verify` + `shift_start`, redirect ke menu pertama yang diizinkan role. |

- **Switch user:** `POST /api/auth/tenant/switch-user` → log `switch_user`, hapus session, buat `pending_login` baru, redirect ke step 3.
- **Logout:** `POST /api/auth/tenant/logout` → log `shift_end`, hapus cookie.
- **Session payload (`TenantSession`):** user_id, company_id, outlet_id, role_id, nama user/company/outlet.

### 6.2 Owner Auth

**Registrasi & verifikasi email**
1. `POST /api/auth/owner/register` — buat baris `owners` (bcrypt), buat JWT verifikasi (1 jam, `OWNER_JWT_SECRET`), kirim email verifikasi via Echo, redirect UI ke `/check-email`.
2. `GET /api/auth/owner/verify-email?token=...` — verifikasi JWT, isi `email_verified_at`, set session, redirect ke `/onboarding` (atau `/login?error=...`).
3. `POST /api/auth/owner/resend-verification` — kirim ulang untuk akun yang belum terverifikasi.
4. Login menolak akun belum verifikasi dengan `{ need_verify: true }`.

**Login**
- `POST /api/auth/owner/login` — cek `is_active` + `email_verified_at` + bcrypt; update `last_login_at`; set cookie `owner_session` (24 jam, atau 30 hari dengan "remember"); redirect `/` (punya company) atau `/onboarding`.

**Lupa kata sandi (migration 016 + fix 024)**
1. `POST /api/auth/owner/forgot-password` — cari owner by email.
   - Tidak terdaftar → `404 { error: "Tidak ada akun dengan email ini." }`.
   - Terdaftar → generate token 32 byte (hex), simpan **hash SHA-256** + `reset_token_expires_at` (1 jam) di baris owner, kirim email berisi link `/reset-password?token=<plain>` via Echo.
   - Gagal simpan token → `500`; gagal kirim email → `502`. Response sukses hanya jika email benar-benar terkirim.
2. `POST /api/auth/owner/reset-password` — hash token yang dikirim, cari owner dengan `reset_token_hash` cocok & belum kadaluarsa → update `password_hash` (bcrypt) → clear token. Token sekali pakai.

> Token plain hanya ada di email; DB hanya menyimpan hash. Berlaku 1 jam.

### 6.3 Superadmin Auth

- Login via **Supabase Auth** (`signInWithPassword`) di `/login`.
- Middleware `@supabase/ssr` me-refresh cookie; `(protected)/layout.tsx` + setiap API route memanggil `supabase.auth.getUser()` (helper lokal `requireSuperadmin`).
- Logout: `POST /api/superadmin/auth/logout` → `signOut` + hapus cookie.
- Tidak ada pemeriksaan claim, role platform, tabel allowlist, atau domain email. Dengan konfigurasi saat ini, setiap user Supabase Auth yang berhasil login mendapat akses superadmin.

### 6.4 Cookie & JWT

| Cookie | App | Isi | TTL | Secret |
|--------|-----|-----|-----|--------|
| `pending_login` | pos | company_id, company_name, outlet_id, outlet_name | 10 menit | `POS_JWT_SECRET` |
| `session` | pos | user/company/outlet/role + nama | Tidak memiliki `exp`; cookie berlaku selama sesi browser | `POS_JWT_SECRET` |
| `owner_session` | owner | owner_id, email, name, company_id/name/slug | 24 jam (30 hari remember) | `OWNER_JWT_SECRET` |
| Supabase Auth cookies | superadmin | dikelola `@supabase/ssr` | — | Supabase |

- Cookie custom menggunakan HttpOnly dan SameSite=Lax, tetapi belum menambahkan atribut `Secure`.
- `@rakku/auth-utils` menyediakan `signJwt`/`verifyJwt` (jose HS256) untuk semua app.
- `OWNER_JWT_SECRET` dan `POS_JWT_SECRET` memiliki fallback development hard-coded. Deployment harus menyediakan secret sendiri; source belum fail-fast jika variabel tidak ada.
- Session POS tidak melakukan revalidasi status user/company, perubahan role, assignment outlet, atau revocation setiap request.

### 6.5 Rate Limiting

| Aksi | Batas | Efek |
|------|-------|------|
| Password company (step 1 POS) | 10x gagal | `companies.login_locked_until` = +15 menit |
| PIN karyawan (step 4 POS) | 5x gagal | `users.locked_until` = +15 menit |
| Sisa percobaan | — | Ditampilkan di pesan error |

### 6.6 Audit Log

- `auth_audit_logs` diisi via `logAuthEvent()` (`@rakku/auth-utils`) dengan IP + user agent.
- Event: `company_login`, `outlet_select`, `account_select`, `pin_verify`, `shift_start`, `shift_end`, `switch_user`.
- Failure reason: `company_not_found`, `wrong_password`, `account_locked`, `user_not_found`, `user_inactive`, `pin_locked`, `wrong_pin`, dll.
- Viewer: `/audit-logs` di superadmin (filter company, event, sukses, rentang tanggal).

---

## 7. Database (Supabase)

Satu project Supabase dipakai semua app. Repository memiliki **30 file migrasi** di `supabase/migrations/` (`001`-`031`, nomor `005` tidak ada). Schema deployed tidak boleh diasumsikan sama dengan rangkaian migrasi karena ada riwayat repair/manual change; lihat §16.1 dan §16.7.

### 7.1 Entity Relationship Diagram

```
OWNERS     ||--o{ COMPANIES : memiliki
COMPANIES  ||--o{ OUTLETS : has
COMPANIES  ||--o{ ROLES : defines
COMPANIES  ||--o{ USERS : employs
COMPANIES  ||--o{ INGREDIENTS : has
OUTLETS    ||--o{ CATEGORIES : has
OUTLETS    ||--o{ PRODUCTS : has
OUTLETS    ||--o{ ORDERS : records
OUTLETS    ||--o{ DINING_TABLES : has
OUTLETS    ||--o{ USER_OUTLETS : assigned via
USERS      ||--o{ USER_OUTLETS : assigned via
USERS      ||--o{ ORDERS : creates
ROLES      ||--o{ USERS : assigned to
ROLES      ||--o{ ROLE_MENU_ACCESS : grants
MENUS      ||--o{ ROLE_MENU_ACCESS : granted via
CATEGORIES ||--o{ PRODUCTS : groups
PRODUCTS   ||--o{ MODIFIERS : has
PRODUCTS   ||--o{ PRODUCT_RECIPES : uses
INGREDIENTS||--o{ PRODUCT_RECIPES : used in
INGREDIENTS||--o{ STOCK_MOVEMENTS : tracks
INGREDIENTS||--o{ INGREDIENT_PURCHASE_ITEMS : bought as
PRODUCTS   ||--o{ ORDER_ITEMS : sold as
ORDERS     ||--o{ ORDER_ITEMS : contains
ORDERS     ||--o{ SPLIT_PAYMENTS : has
DINING_TABLES ||--o{ ORDERS : seated at
PRODUCTS   ||--o{ PRICING_OPTIONS : has
PRODUCTS   ||--o{ PRODUCT_DISCOUNTS : has
PRODUCTS   ||--o{ PRODUCT_TIER_PRICES : priced via
PRICING_TIERS ||--o{ PRODUCT_TIER_PRICES : prices
PRICING_TIERS ||--o{ MODIFIER_TIER_PRICES : prices
MODIFIERS  ||--o{ MODIFIER_TIER_PRICES : priced via
INGREDIENT_PURCHASES ||--o{ INGREDIENT_PURCHASE_ITEMS : contains
```

### 7.2 Daftar Tabel Lengkap

#### Core (migration 001, multi-tenant 002, pricing 006–012)

**`categories`** — Kategori produk

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| name | text | |
| sort_order | int | |
| company_id / outlet_id | uuid FK | Scope tenant (002) |
| created_at | timestamptz | |

**`products`** — Produk

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| name | text | |
| price | numeric(10,2) | Base price, nullable sejak 012 |
| category_id | uuid FK→categories | |
| image_url | text | URL publik CDN Dephilia (Silos) |
| image_silo_id | text | ID file Silos untuk hapus (022) |
| is_active | boolean | |
| description | text | |
| company_id / outlet_id | uuid FK | Scope tenant |
| created_at / updated_at | timestamptz | |

**`modifiers`** — Add-on produk

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| product_id | uuid FK→products | |
| name | text | |
| price_delta | numeric(10,2) | Nullable sejak 012 (per-tier) |
| group_name | text | Grup modifier |

**`orders`** — Pesanan

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| order_number | serial UNIQUE | Nomor urut |
| order_type | text | dine_in, take_away, delivery, gojek, grab, shopee |
| payment_method | text | cash, qris, card, later |
| subtotal / total_price | numeric | |
| tax_rate / tax_amount | numeric | Legacy (digantikan `taxes` jsonb) |
| discount_amount | numeric | Default 0 |
| taxes / discounts | jsonb | Array `AppliedTax` / `AppliedDiscount` |
| customer_name | text | Wajib (teks bebas) |
| cashier_name | text | Snapshot nama kasir |
| status | text | draft, pending_payment, completed, cancelled |
| payment_status | text | unpaid, partial, paid, refunded |
| note | text | |
| reserved_until | timestamptz | Expiry draft (24 jam) |
| pricing_option_id | uuid FK→pricing_options | |
| pricing_tier_id | uuid FK→pricing_tiers | |
| split_bill | boolean | |
| source | text | Default `'pos'` (021) |
| table_id | uuid FK→dining_tables | (021) |
| company_id / outlet_id / cashier_id | uuid FK | Scope tenant |
| created_at | timestamptz | |

**`order_items`** — Item pesanan

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| order_id | uuid FK→orders (cascade) | |
| product_id | uuid FK→products | |
| product_name | text | Snapshot |
| unit_price | numeric | |
| quantity | int | |
| modifier_label | text | Mis. "Oat Milk +5000" |
| note | text | |
| subtotal | numeric | |

#### Tenant & RBAC (migration 002)

**`companies`** — Perusahaan (tenant)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| code | text UNIQUE | Kode login kasir |
| name | text | |
| password_hash | text | bcrypt (dipakai step 1 POS) |
| logo_url | text | |
| status | text | active, suspended |
| owner_id | uuid FK→owners | Pemilik (014) |
| slug | text UNIQUE | (014) |
| plan_id | uuid FK→plans | Paket aktif (025) |
| subscription_status | text | trial/active/grace/expired/cancelled (025) |
| trial_ends_at | timestamptz | Trial Pro 14 hari (025) |
| plan_expires_at | timestamptz | Akhir periode berbayar (025) |
| billing_cycle | text | monthly/yearly (025) |
| failed_login_attempts | int | Rate limit (004) |
| login_locked_until / last_login_attempt | timestamptz | (004) |
| created_at | timestamptz | |

**`outlets`** — Cabang

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id | uuid FK→companies | |
| name | text | UNIQUE per company |
| address | text | |
| status | text | active, inactive |
| qr_menu_slug | text | Slug menu QR, partial UNIQUE (021) |
| created_at | timestamptz | |

**`menus`** — Modul sistem

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| slug | text UNIQUE | register, orders, reports, products, tax-discounts, ingredients, tables, expenses, purchases |
| name | text | |
| icon | text | Nama icon lucide-react |
| path | text | Route path |
| sort_order | int | |

**`roles`** — Peran per company

| Kolom | Tipe |
|-------|------|
| id | uuid PK |
| company_id | uuid FK→companies |
| name | text UNIQUE per company |

**`role_menu_access`** — Matrix akses role × menu

| Kolom | Tipe |
|-------|------|
| role_id | uuid FK→roles (PK) |
| menu_id | uuid FK→menus (PK) |
| can_view | boolean |
| can_create / can_edit / can_delete | boolean (disiapkan) |

**`users`** — Akun karyawan (login PIN)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id / role_id | uuid FK | |
| name / username | text | username UNIQUE per company |
| pin_hash | text | bcrypt PIN 6 digit |
| avatar_url | text | |
| all_outlets | boolean | true = akses semua outlet |
| status | text | active, inactive |
| failed_pin_attempts / locked_until | int / timestamptz | Lockout |
| created_at | timestamptz | |

**`user_outlets`** — Assignment user → outlet (PK gabungan user_id + outlet_id).

#### Owner (migration 014, 016/024)

**`owners`** — Akun pemilik bisnis (login email + password)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| email | text UNIQUE | |
| phone | text | |
| name | text | |
| password_hash | text | bcrypt |
| email_verified_at | timestamptz | Null = belum verifikasi |
| is_active | boolean | |
| last_login_at | timestamptz | |
| reset_token_hash | text | SHA-256 token reset (016/024) |
| reset_token_expires_at | timestamptz | Berlaku 1 jam |
| created_at | timestamptz | |

#### Billing & Langganan (migration 025)

**`plans`** — Paket langganan freemium

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| slug | text UNIQUE | `free` / `pro` / `business` |
| name / description | text | |
| price_monthly / price_yearly | numeric(12,2) | 0 / 99000 / 249000 dan 0 / 990000 / 2490000 |
| max_outlets / max_employees / max_products / max_ingredients | int | -1 = unlimited |
| max_transactions_month | int | -1 = unlimited |
| report_history_days / email_reports_month / storage_mb | int | -1 = unlimited |
| features | jsonb | `{ profit_loss: true, inventory_advanced: true, ... }` |
| is_active / sort_order | boolean / int | |
| created_at / updated_at | timestamptz | |

> RLS `plans` aktif untuk role `authenticated`, tetapi ini hanya autentikasi, bukan otorisasi superadmin. Owner/POS memakai service role dan melewati RLS.

**`subscriptions`** (migration 026) — Riwayat periode langganan: id, company_id FK cascade, plan_id FK restrict, status (`active`/`expired`/`cancelled`), started_at, current_period_start/end, cancelled_at, created_at.

**`subscription_invoices`** (migration 026) — Tagihan QRIS: id, company_id FK, plan_id FK, billing_cycle (`monthly`/`yearly`), invoice_number UNIQUE, amount, provider (`vessel`), provider_transaction_id UNIQUE, qr_string, status (`pending`/`success`/`expired`/`failed`/`cancelled`), expired_at, paid_at, raw_payload jsonb, timestamps. Index: company_id, status; trigger updated_at; RLS authenticated-only.

**`notification_logs`** (migration 027) — Log email notifikasi billing: id, company_id FK cascade, type (mis. `trial_h3`, `limit_80`, `payment_success`), period, sent_at. UNIQUE (company_id, type, period) → idempotency; RLS authenticated-only.

#### v6.1 - Pembayaran Pelanggan, Saldo, Withdrawal, dan Settlement

**Sudah diimplementasi (migration 028):**

| Tabel | Isi |
|-------|-----|
| `merchant_balances` | Cache saldo per company: `available_balance`, `pending_balance`, `total_credited`, `total_fees`, `total_withdrawn` |
| `balance_transactions` | Ledger append-only: type (`sale_credit`/`withdrawal_hold`/`withdrawal`/`withdrawal_refund`/`withdrawal_fee`/`adjustment`/`refund`), amount, pending_delta, fee_amount, balance_after, reference + UNIQUE untuk idempotensi |

RPC `apply_balance_transaction(...)` (SECURITY DEFINER, execute hanya `service_role`) — atomic lock + idempotent + tolak saldo negatif.

**Sudah diimplementasi (migration 029):**

| Tabel | Isi |
|-------|-----|
| `payment_intents` | QRIS dinamis per order: provider_transaction_id UNIQUE, invoice_number UNIQUE, amount, qr_string, status, expired_at, paid_at |
| `orders.payment_channel` | Kolom baru: `dynamic_qris` / `manual_qris` / NULL (cash/kartu) |

**Sudah diimplementasi (migration 030):**

| Tabel | Isi |
|-------|-----|
| `merchant_bank_accounts` | Rekening payout: bank_name, account_number, account_holder, is_default, status |
| `withdrawals` | Pengajuan pencairan: amount, fee, net_amount, snapshot rekening, status (`requested`/`processing`/`completed`/`rejected`/`failed`), reject_reason, transfer_proof_url, reference_number, processed_by/at |

**Sudah diimplementasi (migration 031):**

| Tabel | Isi |
|-------|-----|
| `settlement_reports` | Catatan rekonsiliasi: provider, period_start/end, gross_amount, mdr_amount, net_amount, expected_net (dari ledger), difference, note, created_by |

#### Pricing (migration 006–012)

**`pricing_options`** — Opsi harga per produk (mis. Gojek Regular/Express): id, product_id, name, price, is_active, company_id, outlet_id, sort_order, timestamps.

**`pricing_tiers`** — Tier harga per outlet: id, company_id, outlet_id, name, slug, is_active, sort_order, created_at. UNIQUE (company, outlet, slug).

**`product_tier_prices`** — Harga produk per tier: id, product_id FK, tier_id FK, price. UNIQUE (product, tier).

**`modifier_tier_prices`** — Delta modifier per tier: id, modifier_id FK cascade, tier_id FK cascade, price_delta (default 0). UNIQUE (modifier, tier).

#### Pembayaran & Pajak (migration 007, 013)

**`split_payments`** — Pembayaran terpisah: id, order_id FK cascade, amount, payment_method (cash/qris/card), status (unpaid/paid), customer_name, items jsonb (`SplitPaymentItem[]`), created_at.

**`taxes`** — Pajak per outlet: id, company_id, outlet_id, name, type (`percentage`/`fixed`), value, is_active, sort_order, created_at.

**`product_discounts`** — Diskon per produk berperiode: id, company_id, outlet_id, product_id, name, type, value, start_date, end_date, is_active, created_at.

**`order_discounts`** — Diskon tingkat order berperiode: id, company_id, outlet_id, name, type, value, start_date, end_date, is_active, created_at.

#### Inventory & Operasional (migration 017–020)

**`ingredients`** — Bahan baku per outlet

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id / outlet_id | uuid FK | |
| name | text | |
| unit | text | gram, ml, pcs, kg, liter |
| stock_quantity | numeric(12,2) | Boleh minus |
| min_stock_alert | numeric(12,2) | Ambang badge "menipis" |
| cost_per_unit | numeric(12,2) | Last cost dari pembelian |
| is_active | boolean | |
| created_at / updated_at | timestamptz | |

**`product_recipes`** — BOM produk: id, product_id FK cascade, ingredient_id FK, quantity_used, created_at. UNIQUE (product, ingredient). Tanpa kolom tenant (scoping via products/ingredients).

**`stock_movements`** — Audit trail stok: id, company_id, outlet_id, ingredient_id FK, type (`purchase`/`sale_deduction`/`adjustment`/`waste`), quantity_change (+/−), reference_id (order/purchase id, nullable), note, created_by FK users, created_at.

**`ingredient_purchases`** — Header pembelian: id, company_id, outlet_id, supplier_name, total_amount, purchase_date, note, created_by, created_at.

**`ingredient_purchase_items`** — Detail pembelian: id, purchase_id FK cascade, ingredient_id FK, quantity, unit_cost, subtotal.

**`expenses`** — Pengeluaran operasional: id, company_id, outlet_id, category (text bebas/preset), amount, description, expense_date, created_by, created_at.

#### Meja & QR (migration 021)

**`dining_tables`** — Meja per outlet: id, company_id, outlet_id, name (mis. "Meja 1"), status (`available`/`occupied`), created_at.

#### Audit (migration 004)

**`auth_audit_logs`** — Log percobaan auth: id, company_id (nullable), outlet_id, user_id, event_type, success, ip_address, user_agent, failure_reason, metadata jsonb, created_at.

### 7.3 Indexes

```sql
-- Core
idx_products_category_id, idx_products_is_active
idx_orders_created_at, idx_order_items_order_id
-- Tenant
idx_categories_outlet, idx_products_outlet, idx_orders_outlet, idx_orders_company
idx_users_company, idx_roles_company, idx_companies_owner_id, idx_companies_slug
idx_owners_email, idx_owners_reset_token_hash (partial)
-- Billing & limit (025–026)
idx_companies_plan_id, idx_orders_company_status_created
idx_subscriptions_company, idx_subscriptions_status
idx_subscription_invoices_company, idx_subscription_invoices_status
idx_notification_logs_company
-- Pricing & pajak
idx_orders_pricing_tier
-- Audit
idx_audit_logs_company, idx_audit_logs_outlet, idx_audit_logs_user,
idx_audit_logs_event_type, idx_audit_logs_success, idx_audit_logs_created_at,
idx_audit_logs_company_created
-- Inventory
idx_ingredients_company_outlet, idx_product_recipes_product, idx_product_recipes_ingredient
idx_stock_movements_company_outlet, idx_stock_movements_ingredient, idx_stock_movements_reference
idx_ingredient_purchases_company_outlet, idx_ingredient_purchases_date
idx_ingredient_purchase_items_purchase
idx_expenses_company_outlet, idx_expenses_date
-- Meja & QR
idx_outlets_qr_menu_slug (partial UNIQUE), idx_dining_tables_company_outlet, idx_orders_table_id
```

### 7.4 RLS & Keamanan

- Migration 003 **menonaktifkan RLS** pada tabel core (categories, products, modifiers, orders, order_items) — isolasi dilakukan di layer aplikasi.
- Sejumlah tabel baru mengaktifkan policy permisif untuk `authenticated`, sementara operasi Owner/POS umumnya memakai **service role key** yang bypass RLS.
- Policy `TO authenticated`/`USING (true)` tidak memisahkan user atau tenant. Supabase Auth saat ini hanya dipakai langsung oleh Superadmin.
- Karena itu, keamanan bergantung pada autentikasi route dan scoping query. Keduanya belum konsisten di seluruh POS API (§16.6).

### 7.5 Daftar Migrasi

| # | File | Isi |
|---|------|-----|
| 001 | `001_init.sql` | Schema awal: categories, products, modifiers, orders, order_items + bucket `product-images` |
| 002 | `002_multi_tenant.sql` | companies, outlets, menus, roles, role_menu_access, users, user_outlets + kolom tenant |
| 003 | `003_rls_permissive.sql` | Nonaktifkan RLS tabel core |
| 004 | `004_m6_hardening.sql` | Rate limit company + `auth_audit_logs` |
| 006 | `006_pricing_draft.sql` | `pricing_options`, status/payment_status draft, reserved_until |
| 007 | `007_july_features.sql` | `split_payments`, `pricing_tiers`, `product_tier_prices`, cashier_name, split_bill |
| 008 | `008_pricing_tier_split.sql` | `orders.pricing_tier_id` |
| 009 | `009_pricing_tier_admin.sql` | Menu `pricing-tiers` |
| 010 | `010_seed_default_tiers.sql` | Backfill tier Dine In / Take Away |
| 011 | `011_flatten_paths.sql` | Flatten path menu (hapus prefix `/admin`) |
| 012 | `012_pricing_per_tier.sql` | `modifier_tier_prices`, price nullable |
| 013 | `013_tax_discount.sql` | `taxes`, `product_discounts`, `order_discounts` + kolom jsonb orders |
| 014 | `014_owner_self_service.sql` | Tabel `owners`, `companies.owner_id` + `slug` |
| 015 | `015_menu_consolidation.sql` | Gabung menu taxes+discounts → `tax-discounts`, rename menu ke Bahasa Indonesia |
| 016 | `016_owner_password_reset.sql` | Kolom reset token di `owners` |
| 017 | `017_ingredients_and_recipes.sql` | `ingredients`, `product_recipes`, menu `ingredients` |
| 018 | `018_stock_movements.sql` | `stock_movements` |
| 019 | `019_ingredient_purchases.sql` | `ingredient_purchases` + items, menu `purchases` |
| 020 | `020_expenses.sql` | `expenses`, menu `expenses` |
| 021 | `021_qr_menu_and_tables.sql` | `outlets.qr_menu_slug`, `orders.source/table_id`, `dining_tables`, menu `tables` |
| 022 | `022_silos_image_id.sql` | `products.image_silo_id` |
| 023 | `023_remove_product_images_bucket.sql` | Hapus policy bucket Supabase (storage pindah ke Silos) |
| 024 | `024_owner_reset_token_fix.sql` | Ulang DDL 016 secara idempotent (`ADD COLUMN IF NOT EXISTS`) |
| 025 | `025_plans_and_limits.sql` | Tabel `plans` + kolom langganan `companies` + backfill semua company ke Free + RLS plans (v6 M1) |
| 026 | `026_subscriptions_and_invoices.sql` | Tabel `subscriptions` + `subscription_invoices` (QRIS Vessel) + RLS (v6 M3) |
| 027 | `027_notification_logs.sql` | Tabel `notification_logs` untuk idempotency email billing (v6 M4) |
| 028 | `028_merchant_balances.sql` | `merchant_balances` + `balance_transactions` + RPC `apply_balance_transaction` (v6.1 M1) |
| 029 | `029_order_payment_intents.sql` | `payment_intents` + `orders.payment_channel` (QRIS dinamis, v6.1 M2) |
| 030 | `030_withdrawals.sql` | `merchant_bank_accounts` + `withdrawals` (pencairan manual, v6.1 M3) |
| 031 | `031_settlement_reports.sql` | `settlement_reports` (rekonsiliasi settlement, v6.1 M4) |

> Migrasi 005 tidak ada (nomor dilewati). Catatan status migrasi remote ada di §16.

---

## 8. Rute Aplikasi

### 8.1 `apps/owner` — Owner Dashboard

#### Halaman Auth & Onboarding (public / semi-public)

| Rute | File | Deskripsi |
|------|------|-----------|
| `/login` | `app/login/page.tsx` | Login owner (email + password, remember me) |
| `/register` | `app/register/page.tsx` | Daftar owner + kirim email verifikasi |
| `/forgot-password` | `app/forgot-password/page.tsx` | Minta link reset; pesan error jika email tidak terdaftar |
| `/reset-password` | `app/reset-password/page.tsx` | Form password baru dari `?token=...` |
| `/check-email` | `app/check-email/page.tsx` | Prompt verifikasi + kirim ulang |
| `/onboarding` | `app/onboarding/page.tsx` | Wizard 2 langkah: company + outlet pertama |

#### Halaman Dashboard (protected, route group `(dashboard)/`)

| Rute | File | Deskripsi |
|------|------|-----------|
| `/` | `(dashboard)/page.tsx` | Redirect pintar: `/dashboard` / `/onboarding` / `/login` |
| `/dashboard` | `(dashboard)/dashboard/page.tsx` | Overview: total outlet, karyawan, penjualan + panel terbaru |
| `/outlets` | `(dashboard)/outlets/page.tsx` | CRUD outlet (tidak bisa hapus outlet terakhir) |
| `/employees` | `(dashboard)/employees/page.tsx` | CRUD karyawan + tab Role & Akses (matrix menu) |
| `/orders` | `(dashboard)/orders/page.tsx` + `OrdersClient.tsx` | Daftar pesanan: filter outlet/waktu, search, expand item, pagination |
| `/orders/[id]/invoice` | `(dashboard)/orders/[id]/invoice/` | Invoice/receipt 58mm + print |
| `/reports` | `(dashboard)/reports/page.tsx` | Tab **Penjualan** + **Laba Rugi**, filter periode/outlet, kirim email |
| `/products` | `(dashboard)/products/page.tsx` + `OwnerProductsClient.tsx` | List produk per outlet + manager kategori/tier |
| `/products/add` | `(dashboard)/products/add/page.tsx` | Form produk baru (gambar, tier, modifier, resep) |
| `/products/[id]/edit` | `(dashboard)/products/[id]/edit/page.tsx` | Form edit produk |
| `/tax-discounts` | `(dashboard)/tax-discounts/page.tsx` | Tab Pajak / Diskon Produk / Diskon Order |
| `/tables` | `(dashboard)/tables/page.tsx` | CRUD meja + status tersedia/terisi |
| `/subscription` | `(dashboard)/subscription/page.tsx` | Paket aktif, usage meter, pilihan paket + riwayat invoice (M2/M3) |
| `/subscription/checkout/[invoiceId]` | `(dashboard)/subscription/checkout/[invoiceId]/page.tsx` | Halaman bayar QRIS + countdown + polling status (M3) |
| `/settings` | `(dashboard)/settings/page.tsx` | Profil company, ganti password company, **Menu QR per outlet** |
| `/balance` | `(dashboard)/balance/page.tsx` | Saldo tersedia/pending, ledger, rekening bank, dan pengajuan withdrawal |

#### Fitur Kunci (Owner)

- **Onboarding:** nama bisnis → saran kode/slug otomatis → password company → outlet pertama; server membuat company + outlet + seed tier default (Dine In, Take Away).
- **Employees & Role:** buat role, toggle akses menu per role (`role_menu_access`); PIN karyawan 6 digit (bcrypt), reset PIN, aktif/nonaktif, akses semua outlet atau per outlet.
- **Products:** harga per tier, modifier per tier, gambar via Silos, **resep bahan baku** (RecipeManagerSlideOver — add mode antri lokal, edit mode langsung simpan).
- **Reports:** tab Laba Rugi memakai `/api/owner/reports/profit-loss` (omzet − HPP − pengeluaran); tombol kirim email mengirim laporan penjualan via Echo.
- **Settings:** password company dipakai kasir di step 1 POS; QR menu per outlet (`QRCodeSVG`) mengarah ke `NEXT_PUBLIC_POS_URL/menu/<slug>`.
- **Langganan (M2):** halaman `/subscription` menampilkan paket aktif, usage meter (outlet/karyawan/produk/bahan/transaksi), dan tabel paket; banner trial/limit muncul di dashboard.

#### API — `apps/owner/src/app/api/`

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/auth/owner/login` | POST | Login owner |
| `/api/auth/owner/register` | POST | Daftar + email verifikasi |
| `/api/auth/owner/verify-email` | GET | Verifikasi email via token |
| `/api/auth/owner/resend-verification` | POST | Kirim ulang verifikasi |
| `/api/auth/owner/forgot-password` | POST | Kirim link reset (404 jika email tak terdaftar) |
| `/api/auth/owner/reset-password` | POST | Ganti password via token |
| `/api/auth/owner/session` | GET | Baca session owner |
| `/api/auth/owner/logout` | POST | Hapus cookie owner |
| `/api/onboarding/company` | GET/POST | Suggest kode/slug; buat company + outlet + tier |
| `/api/owner/outlets` (+ `[id]`) | GET/POST/PATCH/DELETE | CRUD outlet |
| `/api/owner/employees` (+ `[id]`) | GET/POST/PATCH/DELETE | CRUD karyawan + reset PIN |
| `/api/owner/roles` | GET/POST | List / buat role |
| `/api/owner/roles/[id]` | PATCH/DELETE | Ubah / hapus role |
| `/api/owner/roles/[id]/access` | GET/POST | Baca / toggle akses menu per role |
| `/api/owner/menus` | GET | List menu sistem |
| `/api/owner/products` (+ `/upload`) | GET/POST/PATCH/DELETE | CRUD produk + upload gambar |
| `/api/owner/categories` | GET/POST/PATCH/PUT/DELETE | CRUD + reorder kategori |
| `/api/owner/pricing-tiers` (+ `[id]`) | GET/PUT/POST/PATCH/DELETE | CRUD tier |
| `/api/owner/product-tier-prices` | GET/POST | Harga produk per tier |
| `/api/owner/modifiers` | GET/POST/PATCH/DELETE | CRUD modifier + tier delta |
| `/api/owner/ingredients` | GET | List bahan untuk resep (per outlet) |
| `/api/owner/recipes` | GET/POST/DELETE | Resep produk |
| `/api/owner/orders` | GET | List pesanan company |
| `/api/owner/taxes` (+ `[id]`) | GET/POST/PATCH/DELETE | CRUD pajak |
| `/api/owner/discounts` (+ `[id]`) | GET/POST/PATCH/DELETE | CRUD diskon |
| `/api/owner/tables` | GET/POST/PATCH/DELETE | CRUD meja |
| `/api/owner/menu-qr` | GET | Slug + URL menu QR per outlet |
| `/api/owner/settings` | GET/PUT | Profil company / ganti password |
| `/api/owner/subscription` | GET | Plan aktif + usage + daftar paket (M2) |
| `/api/owner/subscription/checkout` | POST | Buat invoice + QRIS Vessel (M3) |
| `/api/owner/subscription/invoices` | GET | Riwayat invoice company |
| `/api/owner/subscription/invoices/[id]` | GET | Status invoice (sync + aktivasi bila sukses) |
| `/api/owner/subscription/invoices/[id]/sync` | POST | Cek status manual ke Vessel |
| `/api/owner/balance` | GET | Ringkasan saldo merchant |
| `/api/owner/balance/transactions` | GET | Riwayat ledger merchant |
| `/api/owner/bank-accounts` (+ `[id]`) | GET/POST/PATCH/DELETE | CRUD rekening withdrawal |
| `/api/owner/withdrawals` | GET/POST | Riwayat dan pengajuan withdrawal |
| `/api/webhooks/vessel` | POST | Callback Vessel → re-verify + aktivasi (tanpa session) |
| `/api/cron/billing` | GET/POST | Job harian: sync invoice, expire trial/langganan, reminder + warning kuota (`CRON_SECRET`, `?dry=1` untuk uji) |
| `/api/owner/reports/profit-loss` | GET | Laba rugi (omzet, HPP, laba kotor, pengeluaran, laba bersih) |
| `/api/owner/reports/send-email` | POST | Kirim laporan penjualan via Echo |

### 8.2 `apps/pos` — POS Kasir + PWA

#### Halaman Auth (route group `(auth)/login/`)

| Rute | Deskripsi |
|------|-----------|
| `/login` | Step 1: kode company + password |
| `/login/select-outlet` | Step 2: pilih outlet |
| `/login/select-user` | Step 3: pilih akun |
| `/login/enter-pin` | Step 4: PIN 6 digit |

#### Halaman Dashboard (protected, route group `(dashboard)/`)

| Rute | Deskripsi |
|------|-----------|
| `/register` | POS Register (kasir) + draft + payment + split bill |
| `/orders` + `/orders/[id]/invoice` | Daftar pesanan + invoice print |
| `/reports` | Laporan penjualan + kirim email |
| `/products` (+ `/add`, `/[id]/edit`) | CRUD produk (gambar, tier, modifier, resep) |
| `/tax-discounts` | Pajak / Diskon Produk / Diskon Order |
| `/ingredients` (+ `/add`, `/[id]/edit`) | Bahan baku + **Stock Opname** (modal) |
| `/purchases` (+ `/add`) | Riwayat & pencatatan pembelian/restock |
| `/expenses` | Pengeluaran operasional |
| `/tables` | Manajemen meja + generate massal |

#### Halaman Publik

| Rute | Deskripsi |
|------|-----------|
| `/menu/[slug]` | Menu digital view-only per outlet (QR), tanpa auth |
| `/~offline` | Fallback offline PWA |

> Setiap halaman `(dashboard)/` memiliki `loading.tsx` (skeleton) dan memakai layout `(dashboard)` yang memverifikasi session.

#### Fitur Kunci (POS)

- **Register:** grid produk + kategori, modifier modal (satu pilihan per group + custom), catatan item; cart dengan tier harga, pajak/diskon, meja, nama customer; draft (pay-later 24 jam); payment Tunai/QRIS/Kartu + saran nominal + kembalian; split bill; receipt print.
- **Ingredients:** CRUD, badge "Menipis", toggle aktif, **Stock Opname** (set stok fisik + catatan → `stock_movements` `adjustment`).
- **Purchases:** form multi-item (bahan, qty, unit cost) → tambah stok + update `cost_per_unit` (last cost) + `stock_movements` `purchase`.
- **Expenses:** CRUD dengan kategori preset + custom, ringkasan total.
- **Tables:** CRUD + toggle status + generate "Meja N".
- **Menu QR publik:** server-render kategori + produk aktif (nama, harga, deskripsi, gambar) tanpa data sensitif.
- **Paket & limit (M2):** banner kuota transaksi (`LimitBanner`), menu Pembelian terkunci untuk Free (ikon gembok + `UpgradeModal`), tombol Stock Opname terkunci, badge stok menipis hanya muncul di Pro.

#### API — `apps/pos/src/app/api/`

**Auth Tenant (`/api/auth/tenant/`)**

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/company` | POST | Verifikasi kode + password company |
| `/outlet` | GET/POST | List / pilih outlet |
| `/accounts` | GET | List akun untuk outlet |
| `/verify-pin` | POST | Verifikasi PIN + buat session |
| `/session` | GET | Baca session |
| `/switch-user` | POST | Ganti user |
| `/logout` | POST | Hapus session |

**Admin (`/api/admin/`)**

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/products` | GET/POST/PATCH/PUT/DELETE | CRUD produk + seed tier price otomatis |
| `/products/upload` | POST | Upload gambar (sharp → Silos) |
| `/products/image` | DELETE | Hapus gambar (Silos) + null-kan kolom |
| `/categories` | POST/PATCH/PUT/DELETE | CRUD + reorder kategori |
| `/modifiers` | GET/POST/PATCH/DELETE | CRUD modifier + tier delta |
| `/modifier-tier-prices` | POST | Replace delta modifier per tier |
| `/pricing-tiers` | GET/POST/PATCH/PUT/DELETE | CRUD tier + auto harga produk |
| `/product-tier-prices` | POST | Replace harga produk per tier |
| `/pricing-options` | GET/POST/PATCH/DELETE | CRUD opsi harga |
| `/recipes` | GET/POST/DELETE | Resep per produk |
| `/taxes` (+ `/active`) | GET/POST/PATCH/DELETE | CRUD pajak + pajak aktif |
| `/discounts` (+ `/active`) | GET/POST/PATCH/DELETE | CRUD diskon + diskon aktif |
| `/orders` | POST | Buat order completed (+ deduksi stok + occupancy) |
| `/orders/draft` | GET/POST/PATCH/DELETE | Draft order pay-later |
| `/orders/split` | POST | Split payment |
| `/orders/qris` | POST | Buat order `pending_payment` + QRIS dinamis Vessel (v6.1 M2) |
| `/orders/qris/[id]` | GET | Polling status QR + finalisasi (stok/meja/saldo) |
| `/orders/qris/[id]/retry` | POST | Buat QR baru untuk order pending |
| `/orders/qris/[id]/cancel` | POST | Batalkan order pending |
| `/ingredients` | GET/POST/PATCH/DELETE | CRUD bahan baku |
| `/ingredients/[id]/adjust` | POST | Stock opname (set absolut + catat selisih) |
| `/purchases` | GET/POST | List / simpan pembelian (stok + last cost + movement) |
| `/expenses` | GET/POST/PATCH/DELETE | CRUD pengeluaran |
| `/tables` | GET/POST/PATCH/DELETE | CRUD meja + toggle status |
| `/tables/generate` | POST | Generate N meja |
| `/subscription` | GET | Ringkasan plan + usage (untuk banner & gating UI, M2) |

**Publik & Laporan**

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/public/menu/[slug]` | GET | Menu publik per slug (tanpa auth) |
| `/api/reports/send-email` | POST | Kirim laporan penjualan via Echo |

### 8.3 `apps/superadmin` — Panel Superadmin

| Rute | Deskripsi |
|------|-----------|
| `/login` | Login Supabase Auth |
| `/companies` | CRUD perusahaan (reset password company + **assign paket/langganan**) |
| `/plans` | CRUD paket langganan + limit + fitur (v6 M1) |
| `/subscriptions` | Monitoring invoice QRIS, status langganan & ringkasan pendapatan (v6 M4) |
| `/analytics` | Analytics pembayaran QRIS: volume, MDR, saldo, pencairan + grafik 14 hari (v6.1 M4) |
| `/reconciliation` | Rekonsiliasi saldo sistem vs posisi kas vs settlement Vessel (v6.1 M4) |
| `/outlets` | CRUD outlet per company |
| `/menus` | CRUD menu sistem |
| `/roles` | CRUD role per company |
| `/access-matrix` | Matrix role × menu |
| `/users` | CRUD user + reset PIN + assignment outlet |
| `/audit-logs` | Viewer `auth_audit_logs` |

API: `/api/superadmin/{companies,outlets,menus,roles,users,access-matrix,audit-logs,plans,subscriptions,balances,withdrawals,reconciliation,payments-analytics,auth/logout}` dengan method GET/POST/PUT/DELETE sesuai resource. Semua route memverifikasi `supabase.auth.getUser()`.

### 8.4 `apps/landing` — Landing Page

Single page marketing (`src/app/page.tsx` → `LandingPage`), urutan section:

`Header → Hero (+ mockup POS animasi) → SignalStrip → Problem → Features (#kasir, #resep, #laba) → Workflow → InventoryStory (#stok) → Audience (#untuk-siapa, #outlet) → Pricing (#harga) → FAQ → FinalCta → Footer`

- Tanpa API dan auth. CTA membaca `NEXT_PUBLIC_OWNER_URL` serta `NEXT_PUBLIC_POS_URL`; kedua env wajib disediakan karena tidak ada fallback.
- Animasi memakai framer-motion (`MotionProvider` + `MotionConfig reducedMotion="user"`).

### 8.5 v6.1 — Rute & API

**Sudah diimplementasi (M1):**
- Owner: halaman `/balance` (saldo + ledger) + API `GET /api/owner/balance`, `GET /api/owner/balance/transactions`.
- Superadmin: halaman `/balances` (float + saldo per company + ledger) + API `GET /api/superadmin/balances`, `POST /api/superadmin/balances/[companyId]/adjust` (koreksi saldo, wajib catatan).

**Sudah diimplementasi (M2):**
- POS: `POST /api/admin/orders/qris` (order `pending_payment` + QR dinamis), `GET /api/admin/orders/qris/[id]` (polling + finalisasi), `POST .../[id]/retry`, `POST .../[id]/cancel`; PaymentModal pilihan **QRIS Dinamis / QRIS Manual** dengan QR + countdown + polling; badge "Menunggu" di daftar pesanan.
- Webhook `/api/webhooks/vessel` diperluas: `payment_intents` (order) **atau** `subscription_invoices`.
- Cron `/api/cron/billing` ikut menyinkronkan payment intent pending (`intentsSynced`, `ordersFinalized`).

**Sudah diimplementasi (M3):**
- Owner: `/api/owner/bank-accounts` (+`[id]`) CRUD rekening; `/api/owner/withdrawals` (GET riwayat, POST pengajuan + hold saldo + email); halaman `/balance` menampilkan rekening, form Tarik Dana, dan riwayat pencairan.
- Superadmin: `/api/superadmin/withdrawals` (antrian + ringkasan) dan `POST .../[id]/{process,complete,reject}` (complete mencatat referensi/bukti, reject mengembalikan saldo; keduanya kirim email); halaman `/withdrawals` + nav.

**Sudah diimplementasi (M4):**
- Superadmin: `/api/superadmin/reconciliation` (GET ringkasan saldo sistem vs posisi kas vs settlement + `gap`; POST catat settlement dan hitung `expected_net`/`difference`) dan `/api/superadmin/payments-analytics` (volume QRIS, MDR, saldo, pencairan, seri 14 hari).
- Halaman superadmin `/reconciliation` (form catat settlement + tabel selisih) dan `/analytics` (kartu + grafik batang 14 hari) + nav.

---

## 9. Komponen Utama

### 9.1 Shared UI — `packages/ui/src/`

| Komponen | Fungsi |
|----------|--------|
| `Badge` | Label status/warna |
| `EmptyState` | Placeholder daftar kosong |
| `QtyControl` | Stepper +/− untuk qty |
| `Toast` / `ToastContainer` / `showToast` | Notifikasi global |
| `PageHeader` | Header halaman (judul, back, aksi) |
| `SlideOver` | Panel samping untuk form |
| `Tabs` | Tab horizontal |
| `FormField` + `fieldInputClass` / `fieldSelectClass` | Wrapper form + class input konsisten |
| `Toggle` | Switch on/off |
| `rakkuPreset` | Tailwind preset bersama |

### 9.2 Owner — `apps/owner/src/components/`

| Folder | Isi |
|--------|-----|
| `auth/` | `AuthShell` (layout split-screen login/register/reset) |
| `layout/` | `nav-config.ts` (menu owner), `ResponsiveNav`, `BottomNav`, `MoreMenuSheet`, `DashboardContent` |
| `owner/` | `OwnerSidebar` (collapsible, framer-motion) |
| `charges/` | `TaxFormSlideOver`, `DiscountFormSlideOver` |
| `products/` | `ProductForm`, `CategoryManagerSlideOver`, `TierManagerSlideOver`, `RecipeManagerSlideOver` |
| `reports/` | `ProfitLossClient`, `EmailReportModal` |
| `billing/` | `PlanProvider`, `PlanBanner`, `UpgradeModal`, `SubscriptionClient`, `CheckoutClient` (v6 M2/M3) |
| `ui/` | `ConfirmDialog` |

### 9.3 POS — `apps/pos/src/components/`

| Folder | Isi |
|--------|-----|
| `layout/` | `ResponsiveNav`, `AppSidebar`, `SideRail`, `BottomNav`, `MobileBottomNav`, `MoreMenuSheet`, `Sidebar` (legacy), `DashboardContent`, `DevServiceWorkerCleanup` |
| `register/` | `RegisterView`, `ProductGrid`, `ProductCard`, `CategoryTabs`, `OrderSidebar`, `PaymentModal`, `SplitBillSheet`, `SplitBillPanel`, `DraftOrdersPanel`, `ItemDetailModal`, `PricingOptionSelector`, `MobileCartBar`, `InvoiceReceipt` |
| `products/` | `ProductForm`, `CategoryManagerSlideOver`, `TierManagerSlideOver`, `RecipeManagerSlideOver` |
| `charges/` | `TaxFormSlideOver`, `DiscountFormSlideOver` |
| `inventory/` | `IngredientForm` |
| `reports/` | `EmailReportModal` |
| `billing/` | `PlanProvider`, `LimitBanner`, `UpgradeModal` (v6 M2) |
| `ui/` | `ConfirmDialog` |

### 9.4 Superadmin — `apps/superadmin/src/components/`

Komponen halaman berada langsung di route (`companies`, `outlets`, `menus`, `roles`, `access-matrix`, `users`, `audit-logs`) + layout sidebar statis di `(protected)/layout.tsx`.

### 9.5 Landing — `apps/landing/src/components/`

`index.tsx` (komposisi `LandingPage`), `header`, `mobile-menu`, `hero`, `hero-product-menu`, `signal-strip`, `problem`, `features`, `feature-previews`, `workflow`, `inventory-story`, `recipe-board`, `audience`, `pricing`, `faq`, `final-cta`, `footer`, `motion`, `scroll-reveal`, `primitives`, `icons`, `site.ts`.

### 9.6 Hooks

| App | Hook | Fungsi |
|-----|------|--------|
| owner & pos | `useNavMode` | Mode nav: `bottom` / `rail` / `sidebar` |
| owner & pos | `useMediaQuery` (+ `useIsMobile`/`useIsTablet`/`useIsDesktop`) | Media query |
| owner & pos | `useModalHistory` | Tombol back menutup modal |
| owner & pos | `useSwipe` | Handler swipe sentuh |
| pos | `useDraftCount` | Poll jumlah draft tiap 30 detik |
| pos | `useLowStockCount` | Poll bahan stok menipis tiap 30 detik |

---

## 10. Library, Packages & Utilities

### 10.1 Shared Packages (`packages/`)

| Package | Ekspor utama | Dipakai oleh |
|---------|--------------|--------------|
| `@rakku/shared-types` | Semua interface domain: `common.ts` (produk, order, pricing, tax/discount, cart), `tenant.ts` (`TenantSession`, `PendingLogin`), `owner.ts` (`Owner`, `OwnerSession`, `OwnerWithCompany`), `inventory.ts` (`Ingredient`, `ProductRecipe`, `StockMovement`, `Expense`, `IngredientPurchase`, `DiningTable`, `PublicMenu`, dll) | owner, pos, superadmin |
| `@rakku/supabase-clients` | `createAdminClient` (service role), `createBrowserClient`, `createServerClient` | owner, pos, superadmin |
| `@rakku/auth-utils` | `signJwt`, `verifyJwt`, `hashPin`, `verifyPin`, `isLocked`, `computeLockedUntil`, `getLockoutConfig`, `getRemainingAttempts`, `logAuthEvent`, `getClientIp`, `FailureReasons`, `AuthEventType` | owner, pos |
| `@rakku/ui` | Komponen UI + `rakkuPreset` | semua app |
| `@rakku/pricing` | `DEFAULT_TIERS`, `seedDefaultTiers()`, `syncProductTierPrices()` | pos, superadmin (lihat §16) |
| `@rakku/plans` | `getCompanyPlan()`, `checkLimit()`, `checkFeature()`, `getUsageSummary()`, `countMonthlyTransactions()`, `hasFeature()`, `PLAN_FEATURES` | owner, pos |
| `@rakku/ledger` | `creditBalance()`, `holdBalance()`, `releaseBalance()`, `settleWithdrawal()`, `adjustBalance()`, `getBalance()`, `listBalanceTransactions()`, `applyBalanceTransaction()` | owner, superadmin, pos (via payments) |
| `@rakku/emails` | `renderRakkuEmail()` (template branded) + `sendBillingEmail()` (idempotent via `notification_logs`) | owner, superadmin |
| `@rakku/inventory` | `deductStockForOrder()` (best-effort; cek idempotensi query-level, belum concurrency-safe) | pos, owner (via payments) |
| `@rakku/payments` | `createQrisIntent()`, `processOrderPayment()`, `expirePendingIntents()`, `generateOrderInvoiceNumber()` | pos, owner |
| `@rakku/vessel-client` | `createQrisPayment()`, `getPaymentStatus()`, `syncPaymentStatus()` | owner |
| `@rakku/echo-client` | `sendEmail(params)` + tipe `EchoEmailLog`, `EchoSendParams` | owner, pos |
| `@rakku/silos-client` | `uploadFile()`, `deleteFile()`, `getFile()` + tipe `SilosFile` | owner, pos, script seeding |

Semua package **source-only** (`main`/`types` → `./src/index.ts`, tanpa build step) dan di-transpile oleh Next.js via `transpilePackages`.

### 10.2 Auth Library per App

| File | Fungsi |
|------|--------|
| `apps/owner/src/lib/auth/owner-session.ts` | Sign/verify `owner_session`, cookie helpers, `getOwnerSessionFromCookies()` |
| `apps/owner/src/lib/auth/reset-token.ts` | Generate token reset (32 byte hex), `hashResetToken()` SHA-256, TTL 1 jam |
| `apps/pos/src/lib/auth/company.ts` | `verifyCompanyLogin` (bcrypt + lockout + audit), `getActiveOutlets`, `getAccountsForOutlet` |
| `apps/pos/src/lib/auth/pending-login.ts` | JWT `pending_login` (10 menit) |
| `apps/pos/src/lib/auth/tenant-session.ts` | JWT `session`, `getTenantSessionFromCookies()` |
| `apps/pos/src/lib/auth/menus.ts` | `getAllowedMenus(roleId)`, `getAllMenus()` |
| `apps/superadmin/src/lib/auth/superadmin.ts` | `requireSuperadmin()` (Supabase Auth) |

### 10.3 Supabase Queries per App

| File | Isi |
|------|-----|
| `apps/owner/src/lib/supabase/queries.owner.ts` | Slug/code generator, owner CRUD + reset token, onboarding, outlet, employee, role, menu queries |
| `apps/owner/src/lib/supabase/queries.data.ts` | Query data tenant (orders, pricing, taxes, discounts, products, categories, modifiers, ingredients, recipes) + `verifyOutletBelongsToCompany()` |
| `apps/pos/src/lib/supabase/queries.server.ts` | Query server (admin client) tenant-scoped: produk, kategori, modifier, tier, order, ringkasan penjualan, pajak/diskon, draft, ingredients, recipes, expenses, tables, purchases, `getPublicMenuBySlug()` |
| `apps/pos/src/lib/supabase/queries.client.ts` | Wrapper `fetch` ke `/api/admin/*` untuk operasi client |
| `apps/pos/src/lib/supabase/storage.ts` | `uploadProductImage()`, `deleteProductImage()` |

### 10.4 Cart Store — `apps/pos/src/lib/store/cartStore.ts`

Zustand store untuk register:

- State: items (dengan modifier & note), order type, customer, meja, pricing tier, peta harga tier produk/modifier, split payments, pajak & diskon aktif.
- Hook `useCartTotals`: subtotal → diskon order → pajak.
- Aksi: `fetchActiveTaxesAndDiscounts`, `saveAsDraft`, `clear`, grouping item per kategori/produk.
- Store lain: `sidebarStore` (owner & pos) untuk state collapse sidebar.

### 10.5 Helper & Utility

| File | Fungsi |
|------|--------|
| `apps/pos/src/lib/inventory/stock.ts` | Wrapper legacy untuk deduksi stok; implementasi shared ada di `@rakku/inventory` |
| `packages/emails` | `renderRakkuEmail()` (template branded) + `sendBillingEmail()` (idempotent) |
| `apps/owner/src/lib/format.ts` | `formatCurrency` (IDR), `formatDate` (id-ID) |
| `apps/pos/src/lib/format.ts` | `formatCurrency` (IDR), `formatDate` (id-ID) |
| `packages/shared-types/src/inventory.ts` | Tipe inventory & operasional |

---

## 11. Detail API Penting

Daftar endpoint lengkap ada di §8. Bagian ini menjelaskan konvensi dan contoh request/response untuk endpoint yang paling sering dipakai.

### 11.1 Konvensi Umum

- **Auth:** API route membaca cookie session sendiri (`getOwnerSessionFromCookies()` / `getTenantSessionFromCookies()` / Supabase Auth). Middleware melewati semua `/api*`.
- **Error format:** `{ "error": "pesan ramah" }` + HTTP status (`400`, `401`, `403`, `404`, `409`, `423`, `500`, `502`).
- **Sukses:** `{ "message": "..." }` atau objek data (`{ owner }`, `{ redirect }`, `{ success: true }`, dst).
- **Tenant scoping yang diharapkan:** ambil `company_id`, `outlet_id`, dan user dari session, lalu verifikasi semua resource terhadap scope tersebut.
- **Perilaku aktual:** belum semua POS API mengikuti konvensi itu. Categories, products, modifiers, pricing-options, draft order, dan split payment memiliki handler service-role tanpa guard lengkap; beberapa endpoint lain hanya mengecek ada session tanpa memverifikasi kepemilikan ID resource.
- **Validasi finansial:** endpoint order standar menerima harga/total dan ID tenant dari client serta belum menghitung ulang keseluruhan cart di server.

### 11.2 Auth Tenant (POS)

```
POST /api/auth/tenant/company
{ "code": "RAKKU", "password": "rakku123" }
→ 200 { message } + Set-Cookie: pending_login=... (10 menit)
→ 401 { error: "Kode atau password salah", remaining_attempts?: n }
→ 423 { error: "Terkunci hingga ..." }

POST /api/auth/tenant/verify-pin
{ "user_id": "...", "pin": "123456" }
→ 200 { redirect: "/register" } + Set-Cookie: session=...
→ 401 { error, remaining_attempts }
→ 423 { error: "Akun terkunci hingga ..." }
```

### 11.3 Buat Order (POS)

```
POST /api/admin/orders
{
  "order_type": "dine_in",
  "payment_method": "cash",
  "customer_name": "Budi",
  "items": [{ "product_id": "...", "quantity": 2, "unit_price": 25000, "modifier_label": "Oat Milk +5000", "note": "" }],
  "pricing_tier_id": "...",
  "table_id": "...",            // opsional
  "discount_amount": 0,
  "taxes": [...], "discounts": [...],
  "split_payments": [...]        // opsional
}
→ 200 { order }  (status completed)
   • best-effort: deductStockForOrder() + set meja occupied
```

**Draft:** `POST /api/admin/orders/draft` (reserved 24 jam) → `PATCH` untuk update/complete (deduksi stok best-effort dengan cek duplikasi non-transaksional) → `DELETE` untuk hapus.

### 11.4 Inventory (POS)

```
POST /api/admin/purchases
{
  "supplier_name": "Supplier Kopi",
  "purchase_date": "2026-09-10T00:00:00Z",
  "note": "...",
  "items": [{ "ingredient_id": "...", "quantity": 5000, "unit_cost": 120 }]
}
→ 200 { success: true, id, total_amount }
   • stock_quantity += quantity; cost_per_unit = unit_cost (last cost)
   • insert stock_movements type 'purchase'

POST /api/admin/ingredients/[id]/adjust
{ "stock_quantity": 4200, "note": "Hasil opname" }
→ 200 { success: true, quantity_change }
   • set stok absolut (>= 0), catat 'adjustment'
```

### 11.5 Laporan Laba Rugi (Owner)

```
GET /api/owner/reports/profit-loss?date_range=week&outlet_id=...
→ 200 {
  "totalRevenue": 0, "totalHpp": 0, "grossProfit": 0,
  "totalExpenses": 0, "netProfit": 0, "totalTransactions": 0
}
```
`date_range`: `today | yesterday | week | all` (default `all`). HPP = Σ `cost_per_unit × quantity_used × qty terjual`.

### 11.6 Lupa Kata Sandi (Owner)

```
POST /api/auth/owner/forgot-password
{ "email": "owner@contoh.com" }
→ 404 { error: "Tidak ada akun dengan email ini." }
→ 200 { message: "Link reset telah dikirim ke <email>..." }   // hanya jika email benar-benar terkirim
→ 500 / 502 bila gagal simpan token / gagal kirim

POST /api/auth/owner/reset-password
{ "token": "<dari email>", "password": "<min 8 karakter>" }
→ 200 { message: "Kata sandi berhasil diperbarui" }
→ 400 { error: "Token tidak valid atau sudah kadaluarsa" }
```

### 11.7 Menu QR Publik (POS)

```
GET /api/public/menu/[slug]
→ 200 { outlet: {...}, categories: [{ name, products: [{ name, price, description, image_url }] }] }
→ 404 { error } bila slug tidak dikenal
```
Tanpa auth; hanya produk `is_active`; tidak mengekspos cost/stok/resep.

---

## 12. Panduan Development

### 12.1 Prasyarat

- Node.js 18+ dan **pnpm 11+** (`corepack enable` atau `npm i -g pnpm`) — wajib untuk workspace + Turborepo.
- Project Supabase (free tier) + **Supabase CLI** untuk `db push` (opsional, bisa juga SQL Editor).
- Akun **Echo** (`ECHO_API_URL`, `ECHO_API_KEY`, `ECHO_FROM`) untuk email transaksional.
- Akun **Silos** (`SILOS_API_URL`, `SILOS_API_KEY`) untuk upload gambar.
- `SMTP_*`/Gmail App Password/Resend **tidak lagi diperlukan** (legacy).

### 12.2 Langkah Setup

```bash
# 1. Clone & install (otomatis link packages/*)
git clone <repo-url>
cd rakku
pnpm install

# 2. Buat .env.local per app (lihat §4.1)
#    apps/owner/.env.local      → OWNER_JWT_SECRET, NEXT_PUBLIC_OWNER_URL, NEXT_PUBLIC_POS_URL,
#                                  SILOS_*, ECHO_*
#    apps/pos/.env.local        → POS_JWT_SECRET, SILOS_*, ECHO_*
#    apps/superadmin/.env.local → Supabase keys saja
#    apps/landing/.env.local    → NEXT_PUBLIC_OWNER_URL, NEXT_PUBLIC_POS_URL
#    Semua app butuh NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY
#    kecuali Landing, yang hanya membutuhkan kedua URL publik di atas

# 3. Migrasi database (001 → 031, tanpa 005)
supabase link --project-ref <project-ref>
supabase db push          # atau copy-paste file migrasi via Supabase SQL Editor

# 4. Seed data (opsional, pilih sesuai kebutuhan)
pnpm seed              # company RAKKU
pnpm seed:full         # company TOKOKO + Outlet Cabang
pnpm tsx scripts/seed-build.ts          # tenant BUILD COFFEE lengkap (inventory, meja, QR)
pnpm tsx scripts/seed-build-images.ts   # foto produk BUILD → Silos
pnpm backfill:owners   # akun owner untuk company existing (setelah migration 014)

# 5. Jalankan dev server
pnpm dev
# Owner → http://localhost:3000 | POS → http://localhost:3001
# Superadmin → http://localhost:3002 | Landing → http://localhost:3003
```

### 12.3 Migrasi

- File: `supabase/migrations/*.sql`, dijalankan berurutan; **tidak ada nomor 005**.
- Cara yang dipakai sekarang: Supabase CLI (`supabase link` + `supabase db push`). Alternatif: SQL Editor. (Runner lama `scripts/run-migration.*` & `migration-004.ts` sudah dihapus saat cleanup.)
- Cek status: `supabase migration list --linked`.
- **Catatan drift:** migration history pernah direpair tanpa menjalankan DDL. Selain itu, source menggunakan `split_payments.items` dan `modifiers.group_name`, tetapi tidak ada DDL tracked yang menambahkan kedua kolom tersebut. Bandingkan schema nyata dengan migration chain sebelum provisioning atau deploy.

### 12.4 Scripts

| Script | Fungsi |
|--------|--------|
| `pnpm dev` | Jalankan semua app paralel (Turborepo) |
| `pnpm dev:owner` / `dev:pos` / `dev:superadmin` / `dev:landing` | Jalankan satu app |
| `pnpm build` / `build:owner` / `build:pos` / `build:superadmin` / `build:landing` | Build |
| `pnpm lint` | ESLint semua app |
| `pnpm seed` | Seed company RAKKU |
| `pnpm seed:full` | Seed company TOKOKO + Outlet Cabang (STOCKO) |
| `pnpm backfill:owners` | Backfill akun owner untuk company existing |
| `pnpm tsx scripts/seed-build.ts` | Seed tenant BUILD COFFEE (produk, resep, meja, QR) |
| `pnpm tsx scripts/seed-build-images.ts [--force]` | Unduh foto Wikimedia → sharp → Silos |
| `pnpm tsx scripts/remove-supabase-bucket.ts` | Hapus bucket `product-images` |
| `pnpm tsx scripts/generate-favicons.mjs <app>` | Generate favicon per app |

Package juga punya script `typecheck` (`tsc --noEmit`).

Repository belum menyediakan root script `test`, unit test, integration test, maupun konfigurasi Playwright/Cypress. `pnpm lint` dan `pnpm build` adalah verifikasi statis/build, bukan pengganti test otorisasi, transaksi, atau concurrency.

### 12.5 Akun Testing

**Owner (login di `apps/owner`):**

| Email | Password | Company |
|-------|----------|---------|
| `budi@rakku.test` | `budi12345` | RAKKU |
| `ali@rakku.test` | `ali12345` | TOKOKO |
| `owner@build.test` | `build12345` | BUILD |

**Kasir (login 4-step di `apps/pos`):**

| Kode Company | Password | Username | PIN |
|--------------|----------|----------|-----|
| `RAKKU` | `rakku123` | budi / siti / ahmad | `123456` |
| `TOKOKO` | `tokoko123` | ali / rina / joko | `123456` |
| `BUILD` | `build123` | admin + 3 kasir | `123456` |

**Superadmin:** user dibuat melalui Supabase Auth lalu login di `apps/superadmin/login`. Jangan aktifkan self-signup publik karena source belum membedakan user biasa dan superadmin.

> Menu inventory (Bahan Baku, Pembelian, Pengeluaran, Meja) tidak otomatis muncul untuk role mana pun — Owner harus memberi akses via **Karyawan → tab Role & Akses**.

### 12.6 Build & Deploy

```bash
pnpm build                                  # semua app
pnpm --filter @rakku/owner start            # port 3000
pnpm --filter @rakku/pos start              # port 3001
pnpm --filter @rakku/superadmin start       # port 3002
pnpm --filter @rakku/landing start          # port 3003
```

- Tiap app = project Vercel terpisah (lihat `apps/<app>/vercel.json`), deploy independen.
- Set env var sesuai §4.1 di masing-masing project Vercel (termasuk `ECHO_*` dan `SILOS_*`).
- PWA (Serwist) hanya aktif di `apps/pos` saat `NODE_ENV=production`.
- Pastikan `NEXT_PUBLIC_OWNER_URL` dan `NEXT_PUBLIC_POS_URL` menunjuk domain produksi (bukan localhost) agar link email & QR menu benar.
- Set kedua URL tersebut juga di project Landing. Repository tidak memiliki `.env.production` untuk Landing.
- `apps/owner` memiliki **Vercel Cron** harian (`/api/cron/billing`, 01:00 UTC) — set `CRON_SECRET` di Vercel; Vercel otomatis mengirim header `Authorization: Bearer $CRON_SECRET`.
- Domain kustom tidak didefinisikan oleh `vercel.json`. Source hanya mencatat default Owner `https://rakku.vercel.app` dan POS `https://pos-rakku.vercel.app`; URL Landing/Superadmin harus dikonfirmasi di Vercel.

---

## 13. PWA (Progressive Web App)

PWA hanya diterapkan di **`apps/pos`** (kasir), bukan di owner/superadmin/landing. Implementasi memakai **Serwist** 9.x (fork Workbox) untuk Next.js App Router, aktif hanya saat production.

### 13.1 Caching Strategy

| Tipe request | Strategi |
|--------------|----------|
| Navigasi halaman | NetworkFirst (fallback cache) |
| Aset statis (`_next/static`) | CacheFirst |
| Gambar | StaleWhileRevalidate |
| API Supabase | NetworkFirst |
| Fallback | Halaman `/~offline` |

Service worker juga dapat menyimpan response navigasi dashboard terautentikasi. Belum ada pembersihan runtime cache saat logout; perilaku pada perangkat kasir bersama harus diuji sebelum produksi.

### 13.2 File Terkait

| File | Fungsi |
|------|--------|
| `apps/pos/src/app/sw.ts` | Sumber service worker (precache manifest + runtime caching) |
| `apps/pos/src/app/manifest.ts` | Web app manifest (standalone, portrait, theme `#2E7D32`, shortcut `/register` & `/orders`, ikon maskable) |
| `apps/pos/src/app/~offline/page.tsx` | Halaman fallback offline |
| `apps/pos/src/components/layout/DevServiceWorkerCleanup.tsx` | Unregister SW + clear cache saat development |
| `apps/pos/scripts/generate-pwa-icons.mjs` | Generate `public/icons/*` dari `rakku_logo.png` (sharp) |
| `apps/pos/public/sw.js` | Output build SW (gitignored) |
| `apps/pos/next.config.mjs` | `withSerwistInit` + downlevel ES2017 untuk Android WebView lama |

### 13.3 Testing

1. `pnpm --filter @rakku/pos build && pnpm --filter @rakku/pos start` (production).
2. Buka DevTools → Application → Service Workers: pastikan SW aktif.
3. Mode offline (Network → Offline) → navigasi halaman yang pernah dibuka harus tetap tampil; halaman lain fallback ke `/~offline`.
4. Cek manifest + install prompt (desktop/mobile).

---

## 14. Alur Lengkap (End-to-End)

### 14.1 Alur Kasir (POS)

```
/login (kode company + password)
  → /login/select-outlet
  → /login/select-user
  → /login/enter-pin
  → redirect ke menu pertama yang diizinkan role (fallback /register)

/register: pilih tier → tambah produk/modifier → (opsional) draft, meja, split bill
  → PaymentModal (Tunai/QRIS/Kartu + kembalian)
  → POST /api/admin/orders (completed)
      → order_items tersimpan
      → deductStockForOrder() (best-effort; belum transaksional/concurrency-safe)
      → meja jadi occupied (best-effort)
  → InvoiceReceipt → print 58mm / selesai → cart reset
```

Operasional harian lain di POS: `/ingredients` (opname), `/purchases` (restock), `/expenses`, `/tables`, `/reports` (kirim email).

### 14.2 Alur Owner

**Daftar & onboarding:**
```
/register → email verifikasi (Echo) → /check-email
→ klik link → /api/auth/owner/verify-email → session + /onboarding
→ Step 1: company (kode/slug auto) + password
→ Step 2: outlet pertama
→ server: company + outlet + seed tier default
→ /dashboard
```

**Lupa kata sandi:**
```
/forgot-password → POST forgot-password
   • email tidak terdaftar → tampil "Tidak ada akun dengan email ini."
   • email terdaftar → token hash disimpan + email terkirim → panel sukses
→ buka link → /reset-password?token=... → POST reset-password
→ password baru tersimpan, token dihapus → /login
```

**Kelola bisnis:** outlet, karyawan + role & akses menu, produk + resep + gambar, pajak/diskon, meja, QR menu, laporan penjualan + laba rugi, pengaturan company.

### 14.3 Siklus Inventory

```
1. Owner/Kasir membuat bahan baku (/ingredients) + resep di produk (ProductForm)
2. Pembelian (/purchases/add) → stok bertambah + cost_per_unit (last cost) + movement 'purchase'
3. Penjualan di kasir → movement 'sale_deduction' (stok boleh minus)
4. Stock Opname (/ingredients → modal) → set stok fisik + movement 'adjustment'
5. Badge "stok menipis" muncul di nav (poll 30 detik)
6. Owner melihat HPP & laba di /reports → tab Laba Rugi
```

### 14.4 Menu QR & Meja

```
Owner /settings → Menu QR per outlet (slug dibuat lazily via GET /api/owner/menu-qr)
→ QR mengarah ke {NEXT_PUBLIC_POS_URL}/menu/{slug} (publik, view-only)
Kasir /tables → generate/CRUD meja → pilih meja di OrderSidebar saat checkout
→ order completed → meja occupied → kasir toggle kembali available
```

### 14.5 Superadmin

```
/login (Supabase Auth) → /companies
→ kelola company/outlet/menu/role/user + access matrix
→ pantau auth_audit_logs
→ reset password company (dipakai login kasir) & PIN user via form edit
```

---

## 15. Riwayat Versi

| Versi | Fokus | Ringkasan |
|-------|-------|-----------|
| **v1.0** | Fondasi POS | Schema awal (categories/products/modifiers/orders/order_items), register, order, invoice, PWA |
| **v2.0** | Multi-tenant & RBAC | companies/outlets/roles/users/menus/role_menu_access, login 4-step, audit log, rate limiting |
| **v3.0** | Self-service Owner | Tabel `owners`, register + verifikasi email, onboarding company/outlet, dashboard owner |
| **v4.0** | Monorepo | Pisah 3 app (owner/pos/superadmin), shared packages, menu consolidation (tax-discounts), tier pricing per outlet |
| **v5.0 M1–M2** | Inventory | `ingredients`, `product_recipes`, `stock_movements`, potong stok otomatis best-effort |
| **v5.0 M3–M4** | Operasional & Laba | `expenses`, laporan laba rugi (omzet − HPP − pengeluaran) di owner |
| **v5.0 M5** | Stok lanjutan | `ingredient_purchases` (+items), stock opname, alert stok menipis |
| **v5.0 M6** | QR & Meja | `outlets.qr_menu_slug`, `dining_tables`, menu publik, meja di checkout |
| **v5.1** | Storage & Email | Pindah storage ke **Silos/CDN**, email ke **Echo**, migrasi 022/023, logo email publik |
| **v5.2** | Reset Sandi & Landing | Fix lupa sandi owner (migration 024 + API 404/500/502), app **landing** 4-app, dokumentasi ini |
| **v6.0 (M1)** | Freemium: plan & limit | Tabel `plans` + enforcement limit di server (`@rakku/plans`), backfill company existing ke Free, superadmin `/plans` + assign paket, role default saat onboarding |
| **v6.0 (M2)** | Gating, UI & trial | Halaman `/subscription` + usage meter, `PlanProvider`/`UpgradeModal`/`LimitBanner` (owner & POS), menu Pro terkunci (Pembelian, Laba Rugi, email report, role custom, opname), trial Pro 14 hari, grace transaksi 10% ATAU 3 hari |
| **v6.0 (M3)** | Billing QRIS (Vessel) | `@rakku/vessel-client`, migration `subscriptions`/`subscription_invoices`, checkout QR + polling, webhook re-verify, aktivasi idempotent, riwayat invoice |
| **v6.0 (M4)** | Notifikasi & monitoring | Email billing idempotent (`notification_logs`), cron harian `/api/cron/billing` (Vercel Cron), section Pricing + FAQ billing di landing, halaman `/subscriptions` superadmin + ringkasan pendapatan |
| **v6.0 (M5, sebagian)** | Persiapan go-live | Analytics konversi (trial→bayar, limit→upgrade, revenue 30 hari, distribusi paket) di `/subscriptions`; checklist produksi Vessel. Add-on outlet & voucher ditunda |
| **v6.1 (M1–M4 selesai)** | Saldo, QRIS dinamis, withdrawal & rekonsiliasi | M1: ledger/saldo (028). M2: QRIS dinamis POS (029). M3: rekening + pencairan manual (030). M4: `settlement_reports` (031), halaman `/reconciliation` & `/analytics` superadmin, bullet QRIS landing |

---

## 16. Catatan Teknis & Known Issues

### 16.1 Drift Migrasi di Project Remote

- Migration `014`, `015`, dan `016` tercatat **applied** di `supabase_migrations.schema_migrations` tetapi kolom `statements` kosong (di-mark via `migration repair`, bukan `db push`).
- Dampak yang terverifikasi: DDL `016` (kolom reset token) **tidak pernah dieksekusi** → fitur lupa sandi selalu gagal diam-diam. Sudah diperbaiki oleh migration `024` (idempotent) yang di-push ulang.
- `015_menu_consolidation` juga tampak belum dieksekusi di remote (menu masih `taxes`/"Tax & Disc.", belum ada `tax-discounts`). Perlu dijalankan ulang secara manual/idempotent bila ingin konsisten dengan kode.
- Sebelum menambah migrasi baru, cek `supabase migration list --linked` dan bandingkan dengan kolom tabel nyata (`information_schema.columns`).

### 16.2 Gap Middleware

Middleware bukan satu-satunya guard halaman karena layout `(dashboard)` juga memverifikasi session, tetapi daftar protected di middleware belum lengkap. Middleware melewati seluruh `/api*`; keamanan API bergantung pada guard di masing-masing route dan saat ini belum konsisten (§16.6).

- **Owner:** `/products`, `/tax-discounts`, `/tables` tidak ada di daftar middleware (dilindungi layout).
- **POS:** `/ingredients`, `/purchases`, `/expenses`, `/tables` tidak ada di daftar middleware (dilindungi layout).
- **Owner middleware** masih memuat path usang `/pricing-tiers`, `/taxes`, `/discounts` (sudah di-redirect oleh `next.config`).

### 16.3 Bug Redirect Setelah Login POS

`apps/pos/src/app/api/auth/tenant/verify-pin/route.ts:191` memetakan slug menu `products` ke `/admin/products` — route tersebut **tidak ada** (rute aktual `/products`). Kasir dengan menu pertama "Produk" akan mendarat di 404 setelah login. Menu lain memakai `/${slug}` yang benar.

### 16.4 Kode Legacy yang Masih Terekspos

- `pricing_options` dan API `/api/admin/pricing-options` masih ada, tetapi UI aktif memakai pricing tiers. `PricingOptionSelector.tsx` tidak ditemukan dipakai oleh komponen lain.
- POS memiliki dua endpoint logout; UI memakai `/api/auth/tenant/logout`, sedangkan `/api/auth/logout` tampak tidak memiliki caller.
- `getSalesSummary()` dan stub `getClientIp()` tidak ditemukan memiliki caller.
- `scripts/seed-build.ts` masih memberi akses pajak dengan slug `taxes`, sedangkan menu aktif hasil migration 015 adalah `tax-discounts`. Setelah seed BUILD, periksa dan aktifkan akses **Pajak & Diskon** secara manual bila tidak muncul.
- Script migrasi lama (`scripts/run-migration.*`, `scripts/migration-004.ts`) masih ada lokal tetapi di-ignore. Script tersebut bukan workflow migrasi utama.

### 16.5 Schema Drift terhadap Source

- Source menulis dan membaca `split_payments.items`, sedangkan migration `007_july_features.sql` tidak membuat kolom tersebut.
- Source menulis dan membaca `modifiers.group_name`, tetapi tidak ada migration tracked yang menambah kolom itu.
- Export database lokal menunjukkan kolom tersebut pernah ada di schema aktual, sehingga kemungkinan dibuat manual atau berasal dari riwayat yang tidak tercatat.
- Fresh database yang hanya menjalankan migration `001`-`031` perlu dianggap belum terverifikasi kompatibel sampai dilakukan schema diff dan smoke test.

### 16.6 Status Keamanan dan Integritas

Status ini berdasarkan audit source statis, bukan penetration test. Temuan berikut harus diselesaikan sebelum klaim production-ready.

**Kritis**

- Sejumlah POS API memakai `createAdminClient()` tanpa validasi tenant session, termasuk mutasi categories, products, modifiers, pricing-options, draft orders, dan split payments. Karena service role bypass RLS dan middleware melewati `/api`, route tersebut berpotensi dipanggil tanpa autentikasi.
- Superadmin hanya memeriksa `supabase.auth.getUser()`. Tidak ada role/claim/allowlist superadmin; setiap akun Supabase Auth yang valid memperoleh akses platform-wide. Sejumlah policy database juga memberi akses luas kepada role `authenticated`.

**Tinggi**

- Endpoint order standar menerima `companyId`, `outletId`, `cashierId`, harga, pajak, diskon, dan total dari request. Nilai tenant tidak seluruhnya diturunkan dari session dan total tidak dihitung ulang penuh di server.
- RBAC POS terutama menyembunyikan/menampilkan menu. Direct page access dan API belum menegakkan `can_view`, `can_create`, `can_edit`, atau `can_delete` secara konsisten.
- Sejumlah endpoint yang sudah meminta session tetap menerima product/modifier/ingredient ID tanpa membuktikan resource milik company/outlet session.
- Verifikasi PIN memastikan user berada di company yang benar, tetapi belum memvalidasi assignment user ke outlet terpilih.
- JWT session POS tidak memiliki expiry dan tidak melakukan revocation/revalidation terhadap user nonaktif, company suspended, perubahan role, atau assignment outlet.
- Finalisasi QRIS mengklaim intent terlebih dahulu, lalu menyelesaikan order, stok, meja, dan ledger secara terpisah. Kegagalan di tengah dapat menghasilkan pembayaran sukses dengan state order/saldo yang belum lengkap.
- Deduksi inventory memakai pola check-read-write-insert tanpa transaksi/unique constraint per order. Proses paralel berisiko double deduction atau lost update.

**Menengah**

- JWT Owner/POS memakai fallback secret development jika env tidak diisi dan cookie custom belum memakai `Secure`.
- Forgot-password dan resend-verification Owner membedakan akun ada/tidak ada, sehingga memungkinkan account enumeration; belum ditemukan rate limiting untuk flow Owner.
- Pesan sisa percobaan password company memakai helper batas PIN 5 kali, sedangkan lockout company sebenarnya 10 kali.
- Service worker POS dapat menyimpan response navigasi terautentikasi dan belum membersihkan cache saat logout.

Prioritas perbaikan: tutup semua route service-role tanpa auth, turunkan scope tenant dari session, tambahkan otorisasi server-side, batasi identitas superadmin, beri expiry/revocation session, buat finalisasi payment/inventory transaksional, lalu tambah test cross-tenant dan concurrency.

### 16.7 Environment dan Deployment

- `SMTP_HOST`, `SMTP_PORT`, `EMAIL`, dan `APP_PASSWORD` mungkin masih ada di env lokal lama tetapi tidak dibaca source; email aktif memakai Echo.
- `NEXT_PUBLIC_OWNER_URL` dipakai Superadmin, POS, package emails, webhook callback, dan link auth. `NEXT_PUBLIC_POS_URL` dipakai Owner untuk link POS/menu QR. Landing membutuhkan keduanya tanpa fallback.
- Repository hanya merekam default Owner `https://rakku.vercel.app` dan POS `https://pos-rakku.vercel.app`. Domain Landing, Superadmin, dan domain kustom tidak tercatat.
- `VESSEL_API_KEY` harus tersedia hanya di server Owner/POS. Callback dengan URL localhost tidak dapat dijangkau provider; polling dan cron menjadi fallback development.
- `OWNER_JWT_SECRET`, `POS_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `ECHO_API_KEY`, `SILOS_API_KEY`, `VESSEL_API_KEY`, dan `CRON_SECRET` tidak boleh masuk repository.

### 16.8 v6.1 - Operasional dan Regulasi

- Source menyediakan ledger/saldo, koreksi superadmin, QRIS dinamis POS, withdrawal manual, rekonsiliasi settlement, dan analytics. Default withdrawal: minimum Rp50.000, biaya Rp0, satu pengajuan pending per company, maksimum Rp10 juta/hari.
- Menampung dan mencairkan dana merchant menyentuh area regulasi PJP Bank Indonesia dan memerlukan review legal serta kesepakatan yang sesuai dengan provider.
- MDR 0,7% menggunakan model pass-through: saldo merchant = gross - pembulatan MDR.
- Refund QRIS belum tersedia melalui integrasi Vessel; koreksi dilakukan sebagai adjustment manual dan dicatat di ledger.
- Uang di rekening Rakku harus cukup menutup total kewajiban saldo merchant. Rekonsiliasi dan monitoring float wajib dijalankan secara operasional.
- Disbursement otomatis belum tersedia; withdrawal diselesaikan manual oleh superadmin dengan referensi dan bukti transfer.

### 16.9 Cakupan Pengujian

Tidak ditemukan unit test, integration test, E2E test, atau root script `test`. Area tanpa regression coverage meliputi tenant isolation, RBAC, session expiry/revocation, webhook, payment retry, ledger idempotency, concurrent stock deduction, migration reproducibility, billing cron, dan withdrawal state transitions.
