# Dokumentasi Sistem Rakku POS

> **Nama internal:** `rakku`  
> **Stack:** Next.js 14 (App Router) · Supabase (PostgreSQL + Storage) · Tailwind CSS · pnpm + Turborepo  
> **Versi:** 4.0 (monorepo)
> **Author:** Alif Dhimas

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
10. [Library & Utilities](#10-library--utilities)
11. [API Endpoints](#11-api-endpoints)
12. [Panduan Development](#12-panduan-development)
13. [PWA (Progressive Web App)](#13-pwa-progressive-web-app)
14. [V3.0 — Self-Service Owner & Dashboard](#14-v30--self-service-owner--dashboard)
15. [V4.0 — Monorepo 3-App](#15-v40--monorepo-3-app)
16. [Alur Lengkap (End-to-End)](#16-alur-lengkap-end-to-end)

---

## 1. Ikhtisar Sistem

**Rakku** (Rakku POS) adalah sistem **Point of Sale (POS)** multi-tenant untuk bisnis F&B yang dibangun dengan Next.js 14 App Router dan Supabase. Sistem ini mendukung banyak perusahaan (tenant), masing-masing dengan outlet, produk, dan role-based access control (RBAC) sendiri.

### Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| **POS Register** | Antarmuka kasir dengan grid produk, kategori, modifier/add-on, pencarian |
| **Multi-Tenant** | Banyak perusahaan dengan data terisolasi sepenuhnya |
| **RBAC Dinamis** | Role & menu access matrix yang dikonfigurasi per perusahaan |
| **Pricing Tiers** | Harga berbeda per tier (Dine In, Take Away, Gojek, dll) |
| **Manajemen Produk** | CRUD produk per outlet dengan gambar, modifier, tier pricing |
| **Manajemen Order** | Order completed, draft/pay-later (24 jam, badge count), split bill |
| **Pajak & Diskon** | Tab konsolidasi: pajak multi-tipe (persentase/fixed), diskon produk & order berperiode |
| **Laporan** | Ringkasan penjualan (total transaksi, pendapatan, item terlaris) dengan filter waktu & outlet, kirim via email |
| **Invoice & Print** | Receipt setelah pembayaran, halaman dedicated invoice |
| **Owner Self-Service** | Owner daftar mandiri (email+password), verifikasi email, onboarding company+outlet |
| **Owner Dashboard** | Owner kelola sendiri: outlet, karyawan + role & akses menu, pesanan, laporan, pricing tiers, pajak, diskon, pengaturan |
| **Panel Superadmin** | Kelola semua perusahaan, outlet, menu, role, user, access matrix |
| **Audit Log** | Catatan semua percobaan login (sukses/gagal) |
| **Rate Limiting** | Lockout otomatis pada PIN (5x) dan password company (10x) |
| **PWA (POS)** | Installable di desktop/mobile, offline fallback, service worker (Serwist) |
| **Mobile-First Nav** | Responsive nav: rail sidebar (desktop) + bottom nav + more sheet (mobile) |

---

## 2. Tech Stack

| Layer | Teknologi | Keterangan |
|-------|-----------|------------|
| **Framework** | Next.js 14.2.35 | App Router, Server Components, Server Actions |
| **Database** | Supabase (PostgreSQL) | Service role key untuk operasi backend |
| **Auth (Tenant)** | Custom (JWT + bcrypt) | 4-step login: Company → Outlet → Akun → PIN |
| **Auth (Superadmin)** | Supabase Auth | Email/password terintegrasi Supabase |
| **State Management** | Zustand 5.x | Cart store, perhitungan total, diskon/pajak |
| **Styling** | Tailwind CSS 3.x | Custom color palette, font, animasi |
| **Icons** | lucide-react | Icon set konsisten |
| **Email** | nodemailer | Kirim email verifikasi (owner) & laporan (pos) |
| **Image Processing** | sharp 0.35.x | Resize/optimasi gambar produk |
| **JWT** | @rakku/auth-utils | Sign/verify JWT (via jose 6.x) — package shared |
| **Hashing** | bcryptjs 3.x | Hash password company & PIN user |
| **Type Safety** | TypeScript 5.x | Strict mode, path alias `@/*` |

---

## 3. Struktur Proyek

```
rakku/                                 # Monorepo root (pnpm workspace + Turborepo)
├── apps/
│   ├── owner/                         # → rakku.com (Owner Dashboard)
│   │   ├── src/app/
│   │   │   ├── (dashboard)/          # Route group protected (sidebar layout)
│   │   │   │   ├── page.tsx          # / → redirect ke /login atau /dashboard
│   │   │   │   ├── dashboard/        # Overview bisnis
│   │   │   │   ├── outlets/          # CRUD outlet milik Owner
│   │   │   │   ├── employees/        # CRUD karyawan + panel Kelola Role & akses menu
│   │   │   │   ├── orders/           # Daftar pesanan + invoice (Owner view)
│   │   │   │   ├── reports/          # Laporan penjualan + kirim email
│   │   │   │   ├── products/         # CRUD produk + kategori (slide-over) + tier pricing (slide-over)
│   │   │   │   │   ├── add/          # Form tambah produk
│   │   │   │   │   ├── [id]/edit/    # Form edit produk
│   │   │   │   │   └── page.tsx      # List produk
│   │   │   │   ├── tax-discounts/    # Pajak & Diskon (tab pajak, diskon produk, diskon order)
│   │   │   │   └── settings/         # Edit profil company + ganti password
│   │   │   ├── login/page.tsx        # Login Owner (email + password)
│   │   │   ├── register/page.tsx     # Daftar Owner baru
│   │   │   ├── check-email/page.tsx  # Prompt verifikasi email
│   │   │   ├── onboarding/page.tsx   # Wizard: buat company + outlet
│   │   │   └── api/
│   │   │       ├── auth/owner/       # login, register, verify-email, resend-verification, session, logout
│   │   │       ├── onboarding/       # GET/POST company (suggest kode/slug + buat company+outlet+seed)
│   │   │       └── owner/            # CRUD: outlets, employees, roles (+access), menus, orders, products,
│   │   │                              #        categories, modifiers, product-tier-prices, taxes, discounts,
│   │   │                              #        settings, reports/send-email
│   │   ├── src/components/
│   │   │   ├── owner/OwnerSidebar.tsx
│   │   │   ├── charges/              # TaxFormSlideOver, DiscountFormSlideOver
│   │   │   ├── products/             # ProductForm, CategoryManagerSlideOver, TierManagerSlideOver
│   │   │   ├── layout/               # ResponsiveNav, BottomNav, MoreMenuSheet
│   │   │   ├── reports/EmailReportModal.tsx
│   │   │   └── ui/ConfirmDialog.tsx
│   │   ├── src/hooks/                # useMediaQuery, useModalHistory, useNavMode, useSwipe
│   │   ├── src/lib/
│   │   │   ├── auth/owner-session.ts
│   │   │   ├── email.ts              # nodemailer untuk verifikasi email
│   │   │   ├── format.ts
│   │   │   └── supabase/             # queries.data, queries.owner
│   │   ├── middleware.ts             # Protect (dashboard)/* & /onboarding; public: /login, /register, /check-email
│   │   ├── .env.local               # OWNER_JWT_SECRET, SMTP, NEXT_PUBLIC_POS_URL
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   ├── pos/                           # → pos.rakku.com (POS Kasir) + PWA
│   │   ├── src/app/
│   │   │   ├── page.tsx              # Redirect: / → /login
│   │   │   ├── (auth)/login/         # 4-step login: company → outlet → user → PIN
│   │   │   │   ├── page.tsx          # Step 1: kode company + password
│   │   │   │   ├── select-outlet/    # Step 2: pilih outlet
│   │   │   │   ├── select-user/      # Step 3: pilih akun
│   │   │   │   └── enter-pin/        # Step 4: input PIN
│   │   │   ├── (dashboard)/          # Protected routes (sidebar layout)
│   │   │   │   ├── register/         # POS Register (kasir)
│   │   │   │   ├── orders/           # Daftar pesanan + [id]/invoice
│   │   │   │   ├── reports/          # Laporan penjualan + kirim email
│   │   │   │   ├── products/         # List produk (CRUD via halaman dedicated)
│   │   │   │   │   ├── add/          # Form tambah produk
│   │   │   │   │   └── [id]/edit/    # Form edit produk
│   │   │   │   └── tax-discounts/    # Pajak & Diskon (tab pajak, diskon produk, diskon order)
│   │   │   ├── sw.ts                 # PWA Service Worker (Serwist)
│   │   │   ├── manifest.ts           # PWA Web App Manifest
│   │   │   └── ~offline/page.tsx    # Halaman fallback offline
│   │   │   └── api/
│   │   │       ├── auth/tenant/      # company, outlet, accounts, verify-pin, session, switch-user, logout
│   │   │       ├── admin/            # CRUD: products, categories, modifiers, orders (+draft+split),
│   │   │       │                      #        pricing-options, pricing-tiers, product/modifier-tier-prices,
│   │   │       │                      #        taxes (+active), discounts (+active), products/upload
│   │   │       └── reports/          # send-email (Resend)
│   │   ├── src/components/
│   │   │   ├── register/             # RegisterView, ProductGrid, ProductCard, CategoryTabs, OrderSidebar,
│   │   │   │                          # MobileCartBar, PaymentModal, DraftOrdersPanel, InvoiceReceipt,
│   │   │   │                          # ItemDetailModal, SplitBillPanel, PricingOptionSelector
│   │   │   ├── charges/              # TaxFormSlideOver, DiscountFormSlideOver
│   │   │   ├── products/             # ProductForm, CategoryManagerSlideOver, TierManagerSlideOver
│   │   │   ├── layout/               # AppSidebar (240px labeled), BottomNav, MoreMenuSheet, ResponsiveNav, SideRail, Sidebar
│   │   │   ├── reports/EmailReportModal.tsx
│   │   │   └── ui/ConfirmDialog.tsx
│   │   ├── src/hooks/                # useMediaQuery, useModalHistory, useNavMode, useSwipe, useDraftCount
│   │   ├── src/lib/
│   │   │   ├── auth/                 # tenant-session, pending-login, pin, company, menus
│   │   │   ├── store/cartStore.ts    # Zustand
│   │   │   ├── email.ts
│   │   │   ├── dummy-data.ts
│   │   │   └── supabase/             # queries.client, queries.server, storage
│   │   ├── middleware.ts             # Protect (dashboard)/* ; public: (auth)/*, api/auth
│   │   ├── .env.local               # POS_JWT_SECRET, NEXT_PUBLIC_TAX_RATE, RESEND_API_KEY
│   │   ├── next.config.mjs           # withSerwist
│   │   ├── tailwind.config.ts
│   │   ├── vercel.json
│   │   └── package.json
│   │
│   └── superadmin/                   # → superadmin.rakku.com
│       ├── src/app/
│       │   ├── login/page.tsx        # Login (Supabase Auth)
│       │   ├── (protected)/          # Protected routes (sidebar layout)
│       │   │   ├── companies/        # CRUD companies
│       │   │   ├── outlets/          # CRUD outlets per company
│       │   │   ├── menus/            # CRUD menu sistem
│       │   │   ├── roles/            # CRUD role per company
│       │   │   ├── access-matrix/    # Role × menu access
│       │   │   ├── users/            # CRUD user per company
│       │   │   └── audit-logs/      # Log autentikasi
│       │   └── api/superadmin/       # companies, outlets, menus, roles, users, access-matrix, audit-logs, auth/logout
│       ├── src/lib/
│       │   ├── auth/                 # superadmin.ts, menus.ts
│       │   └── supabase/queries.superadmin.ts
│       ├── middleware.ts             # Protect (protected)/* ; public: /login, /api/superadmin/auth
│       ├── .env.local
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       ├── vercel.json
│       └── package.json
│
├── packages/                          # Shared code (@rakku/* — workspace:*)
│   ├── shared-types/                  # TypeScript interfaces: common.ts, tenant.ts, owner.ts
│   ├── supabase-clients/             # createAdminClient, createClient (browser), createClient (server)
│   ├── auth-utils/                   # jwt.ts (signJwt/verifyJwt), pin.ts (hashPin/verifyPin), audit-log.ts
│   ├── ui/                           # Badge, EmptyState, QtyControl, Toast, PageHeader, SlideOver, Tabs, FormField, Toggle + tailwind.preset.ts
│   └── pricing/                      # DEFAULT_TIERS, seedDefaultTiers, syncProductTierPrices
│
├── supabase/
│   ├── migrations/                   # 14 file migrasi (001–015, tanpa 005)
│   │   ├── 001_init.sql              # Schema awal (tabel core)
│   │   ├── 002_multi_tenant.sql      # Multi-tenant & RBAC
│   │   ├── 003_rls_permissive.sql    # Non-aktifkan RLS
│   │   ├── 004_m6_hardening.sql      # Rate limiting, audit log
│   │   ├── 006_pricing_draft.sql     # Pricing options, draft orders
│   │   ├── 007_july_features.sql     # Split bill, pricing tiers, cashier_name
│   │   ├── 008_pricing_tier_split.sql
│   │   ├── 009_pricing_tier_admin.sql
│   │   ├── 010_seed_default_tiers.sql
│   │   ├── 011_flatten_paths.sql
│   │   ├── 012_pricing_per_tier.sql  # Modifier tier prices
│   │   ├── 013_tax_discount.sql      # Pajak & diskon dinamis
│   │   ├── 014_owner_self_service.sql # Tabel owners + alter companies (owner_id, slug)
│   │   └── 015_menu_consolidation.sql # Gabung taxes+discounts → tax-discounts, hapus pricing-tiers, rename ke ID
│   └── seed.sql
│
├── scripts/
│   ├── seed.ts                       # Seed company RAKKU
│   ├── seed-full.ts                 # Seed company TOKOKO + Outlet Cabang
│   ├── backfill-owners.ts           # Backfill existing companies ke ownership model
│   ├── migration-004.ts             # Runner khusus migrasi 004
│   ├── run-migration.ts             # Runner migrasi umum (tsx)
│   ├── run-migration.js             # Versi JS runner
│   ├── generate-pwa-icons.mjs       # Generate ikon PWA dari rakku_logo.png (sharp)
│   └── generate-favicons.mjs        # Generate favicon
│
├── public/                           # Asset root (ikon PWA & gambar global)
│   ├── icons/                        # icon-192, 512, maskable, apple-touch, favicon
│   ├── images/                       # rakku_logo.png, rakku_logotype.png, login.jpg, signup.jpg
│   └── sw.js                         # SW build output (gitignored)
│
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml               # Workspace: apps/* + packages/*
├── package.json                      # Root scripts (dev, build, lint, dev:*, seed, backfill:owners)
├── tsconfig.base.json                # Base TS config dengan path alias @rakku/*
├── DOCS.md
├── PRD.md
├── PROMPT_RAKKU_V3_PRODUCTION_READY.md
└── PROMPT_RAKKU_V4_MONOREPO_SPLIT.md
```

> **Catatan:** Struktur di atas adalah kondisi v4.0 terkini. Untuk struktur monolith lama (v3.0), lihat `PROMPT_RAKKU_V4_MONOREPO_SPLIT.md` Bagian 5. Daftar rute per app lihat Bagian 8.

---

## 4. Konfigurasi

### 4.1 `.env.local`

Di v4.0, setiap app punya `.env.local` sendiri di direktori app-nya (`apps/owner/.env.local`, `apps/pos/.env.local`, `apps/superadmin/.env.local`). Tidak ada `.env.local` di root.

**`apps/owner/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
OWNER_JWT_SECRET=<random-secret-key>
NEXT_PUBLIC_POS_URL=https://pos.rakku.com
NEXT_PUBLIC_OWNER_URL=https://rakku.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL=<your-email@gmail.com>
APP_PASSWORD=<gmail-app-password>
```

**`apps/pos/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
POS_JWT_SECRET=<random-secret-key>
NEXT_PUBLIC_TAX_RATE=11
NEXT_PUBLIC_STORE_NAME=<store-name>
NEXT_PUBLIC_STORE_ADDRESS=<store-address>
```

**`apps/superadmin/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
```

| Variabel | Owner | POS | Superadmin | Fungsi |
|----------|-------|-----|------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ | Anon key untuk browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ | Service role key (bypass RLS) |
| `OWNER_JWT_SECRET` | ✅ | ❌ | ❌ | JWT sign/verify owner_session |
| `POS_JWT_SECRET` | ❌ | ✅ | ❌ | JWT sign/verify session + pending_login |
| `NEXT_PUBLIC_POS_URL` | ✅ | ❌ | ❌ | URL POS untuk link "Buka POS Kasir" |
| `NEXT_PUBLIC_OWNER_URL` | ✅ | ❌ | ❌ | URL owner untuk link di superadmin |
| `NEXT_PUBLIC_TAX_RATE` | ❌ | ✅ | ❌ | Default persentase pajak |
| `SMTP_*` | ✅ | ❌ | ❌ | nodemailer untuk email verifikasi owner |

### 4.2 `next.config.mjs`

```js
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};
```

Hanya mengizinkan gambar dari Supabase Storage.

**Redirect route lama (owner & pos)** — setelah UI revamp (migration 015), rute lama di-redirect ke halaman baru agar link lama tidak patah:

| Sumber | Tujuan |
|--------|--------|
| `/categories` (pos) | `/products` |
| `/pricing-tiers` | `/products` |
| `/taxes` | `/tax-discounts?tab=pajak` |
| `/discounts` | `/tax-discounts?tab=produk` |

**Khusus `apps/pos`:** `next.config.mjs` dibungkus `withSerwist` (lihat Bagian 13.4) + webpack plugin "DownlevelSerwistSW" yang menurunkan sintaks JS bundle ke **ES2017** agar service worker tetap jalan di Android WebView lama (Android 8+ / Chrome 62+ — sesuai `browserslist` di `package.json`).

### 4.3 `tailwind.config.ts`

**Custom Colors:**
- `primary`: Green scale (50–900)
- `forest`: DEFAULT `#2E7D32`, dark `#1B5E20`, light `#4CAF50`
- `neutral`: Gray scale (50, 100, 200, 400, 600, 900)
- `danger`: `#ef4444`
- `warning`: `#f59e0b`
- `success`: `#10b981`

**Custom Fonts:**
- `display`: Plus Jakarta Sans
- `body`: DM Sans
- `mono`: JetBrains Mono

**Custom Animasi:**
- `slide-up`: Geser dari bawah (0.3s)
- `fade-in`: Muncul perlahan (0.2s)
- `bounce-in`: Muncul dengan pantulan (0.4s)

**Custom Border Radius:**
- `card`: 12px
- `modal`: 16px

### 4.4 `tsconfig.json`

- `strict: true`
- `moduleResolution: "bundler"`
- `jsx: "preserve"`
- Path alias: `@/*` → `./src/*`
- Exclude `node_modules` dan `scripts`

### 4.5 `middleware.ts`

Di v4.0, setiap app punya `middleware.ts` sendiri. Tidak ada lagi satu middleware untuk semua route.

**`apps/pos/middleware.ts`** — proteksi tenant session:
- Publik: `/_next`, `/api/auth`, `/favicon`, `/images`
- Proteksi: semua route `/dashboard/*` (register, orders, reports, products, dll.) → redirect ke `/login` jika session invalid

**`apps/owner/middleware.ts`** — proteksi owner session:
- Publik: `/_next`, `/api`, `/favicon`, `/`; `/login` & `/register` (di-redirect ke `/dashboard` atau `/onboarding` jika sudah login)
- `/onboarding` → wajib login; di-redirect ke `/dashboard` jika company sudah ada
- Proteksi: `/dashboard`, `/outlets`, `/employees`, `/settings`, `/reports`, `/orders` (dan sub-path) → redirect ke `/login` jika belum auth, ke `/onboarding` jika belum punya company

> **Catatan:** `ownerDashboardPaths` di middleware masih memuat path usang (`/pricing-tiers`, `/taxes`, `/discounts`) dan belum mencantumkan `/products` & `/tax-discounts`. Hal ini tidak berdampak karena guard utama semua halaman `(dashboard)` ada di **`(dashboard)/layout.tsx`** (Server Component) yang me-redirect ke `/login` jika session tidak ada dan ke `/onboarding` jika owner belum punya company.

**`apps/superadmin/middleware.ts`** — proteksi superadmin session:
- Publik: `/_next`, `/api`, `/favicon`, `/login`
- Proteksi: `/companies`, `/outlets`, `/menus`, `/roles`, `/access-matrix`, `/users`, `/audit-logs` → redirect ke `/login` jika belum auth

**Matcher pattern (sama untuk semua):**
```
/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)
```

---

## 5. Arsitektur

### 5.1 Multi-Tenancy

- **Company** = tenant (misal "KOPIKITA", "TOKOKO")
- **Outlet** = cabang dalam company (misal "Outlet Utama", "Outlet Cabang")
- Semua data di-scope ke `company_id` + `outlet_id`
- Isolasi data dijamin oleh **app-level filtering** di setiap query (bukan RLS)
- RLS dinonaktifkan pada tabel produk & orders (migration `003_rls_permissive.sql`)

### 5.2 RBAC (Role-Based Access Control)

- **Superadmin**: Kelola semua company, outlet, menu, role, user
- **Role**: Didefinisikan per company (Owner, Kepala Cabang, Admin, Kasir)
- **Menu**: Modul sistem (register, orders, reports, products, tax-discounts) — dikonsolidasi di migration 015
- **Access Matrix**: Tabel `role_menu_access` — role × menu dengan toggle `can_view`
- **Sidebar (POS)**: 100% dinamis — query `getAllowedMenus(roleId)` → render menu

### 5.3 Pola Server vs Client

**Server Components:**
- Fetch data dari Supabase langsung (via `createAdminClient`)
- Layout halaman, guard auth
- `page.tsx` di route `(dashboard)/`

**Client Components:**
- Interaktivitas (form, modal, cart, drag)
- State management (Zustand)
- `"use client"` directive — komponen register, admin, dll.

### 5.4 Alur Data Order

```
RegisterView (client)
  → addProduct() → cartStore (Zustand)
  → PaymentModal → createOrder() → POST /api/admin/orders
  → Supabase insert orders + order_items + split_payments
  → Reset cart
```

---

## 6. Autentikasi & Otorisasi

### 6.1 Alur 4-Step Tenant Login

```
┌──────────────────────────────────────────────────┐
│ Step 1: Input Kode Company + Password            │
│ → POST /api/auth/tenant/company                  │
│ → Set cookie: pending_login { company_id }       │
└──────────────────┬───────────────────────────────┘
                   │ valid
┌──────────────────▼───────────────────────────────┐
│ Step 2: Pilih Outlet                             │
│ → GET /api/auth/tenant/outlet                    │
│ → POST /api/auth/tenant/outlet                   │
│ → Update cookie: { company_id, outlet_id }       │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│ Step 3: Pilih Akun                               │
│ → GET /api/auth/tenant/accounts?outlet_id=...    │
│ Filter: user active + (all_outlets OR user_outlet)│
│ → Update cookie: { ..., user_id }                │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│ Step 4: Input PIN 6 Digit                        │
│ → POST /api/auth/tenant/verify-pin               │
│ → Cek locked_until & pin_hash (bcrypt)           │
│ → Salah: increment failed_pin_attempts           │
│ → 5x gagal: lock 15 menit                        │
│ → Benar: reset counter, set session cookie       │
│   session = { user_id, company_id, outlet_id,    │
│               role_id, user_name, company_name,  │
│               outlet_name }                      │
│ → Hapus pending_login cookie                     │
│ → Redirect ke menu pertama yang diizinkan        │
└──────────────────────────────────────────────────┘
```

### 6.2 Cookie

| Cookie | Tipe | Expiry | Isi |
|--------|------|--------|-----|
| `pending_login` | JWT (signed) | 10 menit | `{ company_id, company_name, outlet_id?, outlet_name? }` |
| `session` | JWT (signed) | 12 jam | `{ user_id, company_id, outlet_id, role_id, user_name, company_name, outlet_name }` |
| `owner_session` | JWT (signed) | 24 jam | `{ owner_id, email, name, company_id?, company_name?, company_slug? }` — v3 Owner |

### 6.3 Superadmin Auth

Menggunakan **Supabase Auth** (email/password) — terpisah dari alur tenant.

### 6.4 Keamanan

| Mekanisme | Detail |
|-----------|--------|
| **PIN Hashing** | bcrypt, 10 salt rounds |
| **Company Password** | bcrypt, 10 salt rounds |
| **PIN Lockout** | 5 gagal → lock 15 menit |
| **Company Lockout** | 10 gagal → lock 15 menit |
| **Session Expiry** | 12 jam (1 shift) |
| **Idle Timeout** | 30 menit (dengan auto-refresh setiap 5 menit) |
| **Audit Log** | Semua percobaan login tercatat: IP, user agent, timestamp |

---

## 7. Database (Supabase)

### 7.1 Entity Relationship Diagram

```
COMPANIES ||--o{ OUTLETS : has
COMPANIES ||--o{ ROLES : defines
COMPANIES ||--o{ USERS : employs
OUTLETS   ||--o{ CATEGORIES : has
OUTLETS   ||--o{ PRODUCTS : has
OUTLETS   ||--o{ ORDERS : records
OUTLETS   ||--o{ USER_OUTLETS : assigned via
USERS     ||--o{ USER_OUTLETS : assigned via
USERS     ||--o{ ORDERS : creates
ROLES     ||--o{ USERS : assigned to
ROLES     ||--o{ ROLE_MENU_ACCESS : grants
MENUS     ||--o{ ROLE_MENU_ACCESS : granted via
CATEGORIES ||--o{ PRODUCTS : groups
PRODUCTS  ||--o{ MODIFIERS : has
PRODUCTS  ||--o{ ORDER_ITEMS : sold as
ORDERS    ||--o{ ORDER_ITEMS : contains
ORDERS    ||--o{ SPLIT_PAYMENTS : has
PRODUCTS  ||--o{ PRICING_OPTIONS : has
PRODUCTS  ||--o{ PRODUCT_DISCOUNTS : has
PRODUCTS  ||--o{ PRODUCT_TIER_PRICES : priced via
TIERS     ||--o{ PRODUCT_TIER_PRICES : prices
TIERS     ||--o{ MODIFIER_TIER_PRICES : prices
MODIFIERS ||--o{ MODIFIER_TIER_PRICES : priced via
```

### 7.2 Daftar Tabel Lengkap

#### Core Tables (v1)

**`categories`** — Kategori produk
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| name | text | Nama kategori |
| sort_order | int | Urutan tampilan |
| company_id | uuid FK→companies | Scope tenant (ditambahkan migration 002) |
| outlet_id | uuid FK→outlets | Scope outlet (ditambahkan migration 002) |
| created_at | timestamptz | |

**`products`** — Produk
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| name | text | Nama produk |
| price | numeric(10,2) | Base price (nullable sejak migration 012) |
| category_id | uuid FK→categories | |
| image_url | text | URL gambar di Supabase Storage |
| is_active | boolean | Status aktif |
| description | text | |
| company_id | uuid FK→companies | Scope tenant |
| outlet_id | uuid FK→outlets | Scope outlet |
| created_at / updated_at | timestamptz | |

**`modifiers`** — Add-on / modifier produk
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| product_id | uuid FK→products | |
| name | text | Nama modifier |
| price_delta | numeric(10,2) | Tambahan harga (nullable sejak migration 012) |
| group_name | text | Grup modifier (contoh: "Susu", "Topping") |

**`orders`** — Pesanan
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| order_number | serial | Nomor urut unik |
| order_type | text | dine_in, take_away, delivery, gojek, grab, shopee |
| payment_method | text | cash, qris, card, later |
| subtotal | numeric | |
| tax_rate | numeric | Legacy (digantikan taxes jsonb) |
| tax_amount | numeric | Legacy |
| total_price | numeric | |
| customer_name | text | Wajib diisi |
| cashier_name | text | Nama kasir (F-03) |
| status | text | draft, pending_payment, completed, cancelled |
| payment_status | text | unpaid, partial, paid, refunded |
| note | text | |
| reserved_until | timestamptz | Expiry draft (24 jam) |
| pricing_tier_id | uuid FK→pricing_tiers | |
| split_bill | boolean | |
| discount_amount | numeric | |
| taxes | jsonb | Array AppliedTax |
| discounts | jsonb | Array AppliedDiscount |
| company_id / outlet_id / cashier_id | uuid FK | Scope tenant |
| created_at | timestamptz | |

**`order_items`** — Item pesanan
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| order_id | uuid FK→orders | |
| product_id | uuid FK→products | |
| product_name | text | Snapshot nama produk |
| unit_price | numeric | Harga per unit |
| quantity | int | |
| modifier_label | text | Label modifier (contoh: "Oat Milk +5000") |
| note | text | Catatan item |
| subtotal | numeric | |

#### Tenant Tables (migration 002)

**`companies`** — Perusahaan (tenant)
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| code | text UNIQUE | Kode login (contoh: "KOPIKITA") |
| name | text | Nama perusahaan |
| password_hash | text | bcrypt |
| logo_url | text | |
| status | text | active, suspended |
| failed_login_attempts | int | Rate limiting (M6) |
| login_locked_until | timestamptz | Lockout expiry (M6) |
| last_login_attempt | timestamptz | (M6) |
| created_at | timestamptz | |

**`outlets`** — Cabang
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id | uuid FK→companies | |
| name | text | UNIQUE per company |
| address | text | |
| status | text | active, inactive |
| created_at | timestamptz | |

**`menus`** — Modul sistem
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| slug | text UNIQUE | register, orders, reports, products, tax-discounts |
| name | text | |
| icon | text | Nama icon lucide-react |
| path | text | Route path |
| sort_order | int | |

**`roles`** — Peran dalam company
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id | uuid FK→companies | |
| name | text | UNIQUE per company (Owner, Kepala Cabang, Admin, Kasir) |

**`role_menu_access`** — Matrix akses role × menu
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| role_id | uuid FK→roles | PK |
| menu_id | uuid FK→menus | PK |
| can_view | boolean | |
| can_create / can_edit / can_delete | boolean | Untuk fase depan |

**`users`** — Akun karyawan
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id | uuid FK→companies | |
| role_id | uuid FK→roles | |
| name | text | |
| username | text | UNIQUE per company |
| pin_hash | text | bcrypt dari PIN 6 digit |
| avatar_url | text | |
| all_outlets | boolean | true untuk Owner |
| status | text | active, inactive |
| failed_pin_attempts | int | |
| locked_until | timestamptz | |
| created_at | timestamptz | |

**`user_outlets`** — Assignment user ke outlet
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| user_id | uuid FK→users | PK |
| outlet_id | uuid FK→outlets | PK |

#### Pricing Tables (migration 006–012)

**`pricing_options`** — Opsi harga tambahan per produk
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| product_id | uuid FK→products | |
| name | text | (contoh: "Gojek Regular", "Gojek Express") |
| price | numeric | |
| is_active | boolean | |
| company_id / outlet_id | uuid FK | |
| sort_order | int | |
| created_at | timestamptz | |

**`pricing_tiers`** — Tier harga (Dine In, Take Away, dll)
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id / outlet_id | uuid FK | |
| name | text | |
| slug | text | |
| is_active | boolean | |
| sort_order | int | |

**`product_tier_prices`** — Harga produk per tier
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| product_id | uuid FK→products | |
| tier_id | uuid FK→pricing_tiers | |
| price | numeric | |

**`modifier_tier_prices`** — Delta harga modifier per tier
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| modifier_id | uuid FK→modifiers | |
| tier_id | uuid FK→pricing_tiers | |
| price_delta | numeric | |

#### Split Payment (migration 007)

**`split_payments`** — Pembayaran terpisah per orang
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| order_id | uuid FK→orders | |
| amount | numeric | |
| payment_method | text | |
| status | text | unpaid, paid |
| customer_name | text | |
| items | jsonb | Array SplitPaymentItem |
| created_at | timestamptz | |

#### Tax & Discount (migration 013)

**`taxes`** — Pajak per outlet
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id / outlet_id | uuid FK | |
| name | text | |
| type | text | percentage, fixed |
| value | numeric | |
| is_active | boolean | |
| sort_order | int | |
| created_at | timestamptz | |

**`product_discounts`** — Diskon per produk (berperiode)
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id / outlet_id | uuid FK | |
| product_id | uuid FK→products | |
| name | text | |
| type | text | percentage, fixed |
| value | numeric | |
| start_date / end_date | timestamptz | |
| is_active | boolean | |
| created_at | timestamptz | |

**`order_discounts`** — Diskon per order (berperiode)
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id / outlet_id | uuid FK | |
| name | text | |
| type | text | percentage, fixed |
| value | numeric | |
| start_date / end_date | timestamptz | |
| is_active | boolean | |
| created_at | timestamptz | |

#### Audit & Security (migration 004)

**`auth_audit_logs`** — Log percobaan auth
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id | uuid FK | Bisa null (gagal di step company) |
| outlet_id | uuid FK | |
| user_id | uuid FK | |
| event_type | text | company_login, outlet_select, pin_verify, dll |
| success | boolean | |
| ip_address | text | |
| user_agent | text | |
| failure_reason | text | company_not_found, wrong_password, account_locked, dll |
| metadata | jsonb | |
| created_at | timestamptz | |

### 7.3 Indexes

```sql
idx_products_category_id, idx_products_is_active
idx_orders_created_at, idx_order_items_order_id
idx_categories_outlet, idx_products_outlet
idx_orders_outlet, idx_orders_company
idx_users_company, idx_roles_company
```

---

## 8. Rute Aplikasi

> Bagian ini mendokumentasikan rute per app di v4.0 monorepo. Setiap app deploy ke domain sendiri (`rakku.com`, `pos.rakku.com`, `superadmin.rakku.com`).

### 8.1 apps/owner — Owner Dashboard (`rakku.com`)

#### Halaman Auth (public)

| Rute | File | Deskripsi |
|------|------|-----------|
| `/login` | `app/login/page.tsx` | Login Owner (email + password) |
| `/register` | `app/register/page.tsx` | Daftar Owner baru + kirim email verifikasi |
| `/check-email` | `app/check-email/page.tsx` | Prompt verifikasi + form kirim ulang |
| `/onboarding` | `app/onboarding/page.tsx` | Wizard buat company + outlet pertama (perlu login, belum punya company) |

#### Halaman Dashboard (protected, route group `(dashboard)/`)

| Rute | File | Deskripsi |
|------|------|-----------|
| `/` | `app/(dashboard)/page.tsx` | Redirect → `/login` / `/onboarding` / `/dashboard` |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | Overview bisnis |
| `/outlets` | `app/(dashboard)/outlets/page.tsx` | CRUD outlet milik Owner |
| `/employees` | `app/(dashboard)/employees/page.tsx` | CRUD karyawan + panel Kelola Role & akses menu |
| `/orders` | `app/(dashboard)/orders/page.tsx` + `OrdersClient.tsx` | Daftar pesanan |
| `/orders/[id]/invoice` | `app/(dashboard)/orders/[id]/invoice/page.tsx` + `InvoicePageClient.tsx` | Invoice print |
| `/reports` | `app/(dashboard)/reports/page.tsx` + `ReportsClient.tsx` | Laporan penjualan + email |
| `/products` | `app/(dashboard)/products/page.tsx` + `OwnerProductsClient.tsx` | List produk (CRUD via halaman add/edit) |
| `/products/add` | `app/(dashboard)/products/add/page.tsx` + `ProductForm` | Form tambah produk |
| `/products/[id]/edit` | `app/(dashboard)/products/[id]/edit/page.tsx` + `ProductForm` | Form edit produk |
| `/tax-discounts` | `app/(dashboard)/tax-discounts/page.tsx` | Pajak & Diskon dengan tab (pajak, diskon produk, diskon order) |
| `/settings` | `app/(dashboard)/settings/page.tsx` | Edit profil company + ganti password |

#### Fitur per Halaman (Owner)

**`/login` — Login Owner**  
Form email + password. Field dilindungi dari input kosong; saat sukses set cookie `owner_session` (24 jam) lalu redirect pintar: ke `/onboarding` jika owner belum punya company, atau `/dashboard` jika sudah.

**`/register` — Daftar Owner**  
Form Nama Lengkap, Email, Password (min. 8 karakter). Submit → `POST /api/auth/owner/register` → buat akun di tabel `owners` + kirim **email verifikasi** (nodemailer SMTP) → redirect ke `/check-email`. UI dua kolom di desktop (form + gambar), mobile satu kolom.

**`/check-email` — Verifikasi Email**  
Prompt "cek email Anda" + form "kirim ulang link verifikasi" (`/api/auth/owner/resend-verification`). Token verifikasi berlaku 1 jam; setelah klik link di email, owner diarahkan ke `/login`.

**`/onboarding` — Wizard Buat Perusahaan (2 langkah)**  
Perlu login, owner yang belum punya company.
- **Step 1 — Data Bisnis:** nama perusahaan, kode company (auto-suggest dari nama via `/api/onboarding/company?name=...`, debounce 400 ms, bisa diubah), password company (min. 6 karakter) + show/hide.
- **Step 2 — Outlet Pertama:** nama outlet (wajib), alamat (opsional).
- Submit → `POST /api/onboarding/company` → buat company + outlet + **seed default pricing tiers** (Dine In, Take Away) → update `owner_session` → toast sukses → redirect `/dashboard`.
- UI: brand header, progress indicator 2 langkah (lingkaran + garis), kartu form dengan animasi.

**`/dashboard` — Overview Bisnis** (Server Component, Server-rendered)
- Sapaan "Halo, {nama}" + ringkasan harian.
- **3 kartu statistik yang bisa diklik** (link ke halaman terkait):
  1. *Total Outlet* (+ jumlah aktif) → `/outlets`
  2. *Total Karyawan* (+ jumlah aktif) → `/employees`
  3. *Total Penjualan* (Rp) (+ jumlah transaksi completed) → ringkasan dari table `orders` (total_price + status; status filter)
- 2 panel "pin-list": **Outlet Terbaru** (max 3, berisi nama + jumlah karyawan + badge aktif/nonaktif) dan **Karyawan Terbaru** (max 3, avatar inisial + nama + role + status), masing-masing dengan link "Kelola..." → halaman terkait.

**`/outlets` — Kelola Outlet** (Client)
- **Desktop (sm+):** tablenya — kolom Nama, Alamat, Karyawan (jumlah), Status (Aktif/Nonaktif), Aksi.
- **Mobile:** kartu per outlet (nama, jumlah karyawan, alamat ikon map, badge status) + tombol Edit / Nonaktifkan-Aktifkan / Hapus (ikon).
- **Aksi:** tambah (modal "Tambah Outlet"), edit (modal "Ubah Outlet" — nama + alamat), toggle status (ikon ✕/✓ atau tombol), hapus (modal konfirmasi "Hapus Outlet?" dengan peringatan data terkait ikut terhapus). **Tidak bisa menghapus outlet terakhir** — API menolak (agar selalu ada minimal 1 outlet aktif).
- Modal ditampilkan **via `createPortal` ke document.body**, sebagai bottom-sheet di mobile (rounded top, slide-up) dan centered modal di desktop; body scroll di-lock saat modal terbuka; loading state skeleton.

**`/employees` — Kelola Karyawan + Role & Akses** (2 tab via `Tabs` dari @rakku/ui)
- **Tab 1 "Karyawan"** (badge count = jumlah karyawan):
  - Tabel (desktop) / kartu (mobile): Nama (@username), Role, Outlet ("Semua Outlet" badge atau daftar outlet), Status, Aksi.
  - **Tambah/Edit Karyawan** (modal): Nama, Username (auto-lowercase, dipakai step "pilih akun" di POS), PIN 6 digit (diisi saat tambah; pada edit PIN diganti lewat reset terpisah), pilih Role (dropdown), **Akses Outlet** (checkbox "Semua Outlet" atau pilih per outlet).
  - Aksi: **Reset PIN** (modal input PIN baru 6 digit), toggle aktif/nonaktif, hapus (konfirmasi).
  - Jika belum ada role, tombol "Tambah Karyawan" memunculkan toast info dan **otomatis pindah ke tab Role**.
- **Tab 2 "Role & Akses"** (count = jumlah role):
  - Tabel role: Nama Role, jumlah menu (n menu), aksi Edit/Hapus (hapus gagal jika role masih dipakai karyawan).
  - Klik satu row → panel **"Atur Akses Menu"**: checkbox "Pilih Semua" (toggle semua sekaligus) + grid per menu (Kasir/register, Pesanan/orders, Laporan/reports, Produk, Pajak & Diskon) dengan deskripsi singkat; perubahan **optimistic** → `POST /api/owner/roles/{id}/access`.
  - tombol "Tambah Role" di header saat tab role aktif.

**`/orders` — Daftar Pesanan** (client, `OrdersClient.tsx`)
- Header: judul + dropdown pilih **Outlet (Semua / per outlet)** + filter pill **Semua / Hari ini / 7 Hari**.
- **3 kartu statistik:** Total Transaksi, Total Pendapatan, Rata-rata (berdasarkan filter aktif & hasil pencarian).
- **Cari** nomor order di input (filter `#<nomor>`).
- Tabel desktop (Order #, Waktu, Outlet, Tipe, Items, Kasir, Pembayaran, Total, aksi) / kartu mobile; **baris bisa di-expand** untuk melihat detail item (produk + modifier label + catatan xqty + subtotal, jalur dengan border kiri).
- Tombol **Printer** tiap baris → `/orders/{id}/invoice`.
- **Pagination**: pilih "Show" (10/20/50/100) + tombol halaman (page range dengan elipsis "…" untuk menyembunyikan halaman jauh dari page aktif).
- Jenis pembayaran ditampilkan sebagai label (Tunai/QRIS/Kartu).

**`/orders/[id]/invoice` — Invoice Print**  
Halaman invoice lengkap (kepala toko/company dari session, nomor, waktu, daftar item, subtotal, pajak, diskon, total, nama kasir, nama customer) + tombol **Print** (window.print) / cetak.

**`/reports` — Laporan Penjualan** (ReportsClient.tsx)
- Filter **rentang waktu**: Hari ini / Kemarin / 7 Hari / Semua + dropdown **Outlet** (Semua / spesifik).
- **3 kartu**: Total Transaksi, Total Pendapatan (format Rupiah), Item Terlaris (nama + jumlah).
- **Kirim Email** → modal `EmailReportModal` → `POST /api/owner/reports/send-email` (merangkum laporan rentang dipilih, kirim via nodemailer ke alamat tujuan).

**`/products` — List Produk** (OwnerProductsClient.tsx, outlet-scoped)
- **Pilih Outlet** di header (URL query `?outlet=` — state di URL, `router.replace`).
- Aksi header: tombol **Kategori** (buka `CategoryManagerSlideOver`), **Tier** (buka `TierManagerSlideOver`), **Tambah Produk** → `/products/add?outlet=...`.
- **Cari** name (case-insensitive) + filter dropdown **kategori**.
- Kolom harga menampilkan rentang dari tier prices: jika semua tier sama → satu harga, jika beda → `Rp min - Rp max`; "-" jika belum ada tier price.
- Tabel (desktop): Produk (gambar + nama), Kategori, Harga, Status, Aksi (toggle aktif ✕/✓, edit, hapus dengan ConfirmDialog). Mobile: kartu.
- Empty state bila belum ada produk / outlet.

**`/products/add` & `/products/[id]/edit` — Form Produk** (ProductForm.tsx)
- Layout grid 12: kolom kiri Media & Info (gambar upload via `/api/owner/products/upload` + sharp, nama, kategori, deskripsi, status aktif) — kolom kanan **Harga per Tier** (input tier pricing), **Modifier** (daftar & tambah modifier/kelompok), dsb.
- Aksi header ("Batal" + "Simpan Produk"); di mode mobile/bottom-nav tombol pindah ke **bottom action bar fixed**.

**`/tax-discounts` — Pajak & Diskon** (TaxDiscountsClient.tsx, 3 tab)
- Dropdown **Outlet** + 3 tab (`pajak`, `produk`, `order`):
  1. **Pajak**: list pajak (nama, tipe % / fixed, nilai, sort), toggle aktif (`Toggle`), edit/hapus → `TaxFormSlideOver`.
  2. **Diskon Produk**: diskon per produk (nama, tipe, nilai, periode start-end, aktif) → `DiscountFormSlideOver`; menampilkan nama produk terkait.
  3. **Diskon Order**: diskon tingkat order (nama, tipe, nilai, periode, aktif).
- Toggle status langsung di baris (optimistic), edit/delete dengan form slide-over + `ConfirmDialog`.

**`/settings` — Pengaturan** (SettingsClient)
- **Profil Perusahaan**: edit nama company (`PUT /api/owner/settings`), tampilan kode company (tidak bisa diubah), status company (dot hijau + badge status).
- **Password Perusahaan**: ganti password company (minimal 6 karakter, show/hide) — password ini dipakai kasir di langkah 1 login POS.
- **Info**, footer: perusahaan terdaftar sejak tanggal, slug.

#### API — `apps/owner/src/app/api/`

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/auth/owner/register` | POST | Daftar Owner baru + kirim email verifikasi |
| `/api/auth/owner/verify-email` | GET | Verifikasi email via token |
| `/api/auth/owner/resend-verification` | POST | Kirim ulang email verifikasi |
| `/api/auth/owner/login` | POST | Login Owner → set `owner_session` |
| `/api/auth/owner/logout` | POST | Hapus cookie Owner |
| `/api/auth/owner/session` | GET | Baca session Owner |
| `/api/onboarding/company` | GET/POST | Suggest kode/slug + buat company + outlet + seed tiers |
| `/api/owner/outlets` | GET/POST | List / tambah outlet |
| `/api/owner/outlets/[id]` | PATCH/DELETE | Edit / hapus outlet |
| `/api/owner/employees` | GET/POST | List / tambah karyawan |
| `/api/owner/employees/[id]` | PATCH/DELETE | Edit / hapus karyawan |
| `/api/owner/roles` | GET/POST | List / buat role |
| `/api/owner/roles/[id]` | GET/PATCH/DELETE | Detail / ubah / hapus role |
| `/api/owner/roles/[id]/access` | GET/POST | List / toggle akses menu per role |
| `/api/owner/menus` | GET | List semua menu sistem |
| `/api/owner/orders` | GET | List pesanan per company |
| `/api/owner/products` | GET/POST/PATCH/DELETE | CRUD produk per outlet |
| `/api/owner/products/upload` | POST | Upload gambar produk (sharp) |
| `/api/owner/categories` | GET/POST/PATCH/DELETE | CRUD kategori per outlet |
| `/api/owner/modifiers` | GET/POST/DELETE | CRUD modifier |
| `/api/owner/product-tier-prices` | GET/POST | Baca / simpan tier price per produk |
| `/api/owner/pricing-tiers` | GET/POST | List / buat tier |
| `/api/owner/pricing-tiers/[id]` | PATCH/DELETE | Edit / hapus tier |
| `/api/owner/taxes` | GET/POST | List / buat pajak |
| `/api/owner/taxes/[id]` | PATCH/DELETE | Edit / hapus pajak |
| `/api/owner/discounts` | GET/POST | List / buat diskon |
| `/api/owner/discounts/[id]` | PATCH/DELETE | Edit / hapus diskon |
| `/api/owner/settings` | GET/PUT | Baca / update profil company |
| `/api/owner/reports/send-email` | POST | Kirim laporan via email |

### 8.2 apps/pos — POS Kasir (`pos.rakku.com`) + PWA

#### Halaman Auth (public, route group `(auth)/login/`)

| Rute | File | Deskripsi |
|------|------|-----------|
| `/login` | `(auth)/login/page.tsx` | Step 1: kode company + password |
| `/login/select-outlet` | `(auth)/login/select-outlet/page.tsx` | Step 2: pilih outlet |
| `/login/select-user` | `(auth)/login/select-user/page.tsx` | Step 3: pilih akun |
| `/login/enter-pin` | `(auth)/login/enter-pin/page.tsx` | Step 4: input PIN 6 digit |

#### Halaman Dashboard (protected, route group `(dashboard)/`)

| Rute | File | Deskripsi |
|------|------|-----------|
| `/register` | `(dashboard)/register/page.tsx` | POS Register (kasir) |
| `/orders` | `(dashboard)/orders/page.tsx` + `OrdersClient.tsx` | Daftar pesanan |
| `/orders/[id]/invoice` | `(dashboard)/orders/[id]/invoice/page.tsx` + `InvoicePageClient.tsx` | Invoice print |
| `/reports` | `(dashboard)/reports/page.tsx` + `ReportsClient.tsx` | Laporan penjualan + email |
| `/products` | `(dashboard)/products/page.tsx` + `AdminProductsClient.tsx` | List produk (search, filter, toggle, delete) |
| `/products/add` | `(dashboard)/products/add/page.tsx` + `ProductForm` | Form tambah produk |
| `/products/[id]/edit` | `(dashboard)/products/[id]/edit/page.tsx` + `ProductForm` | Form edit produk |
| `/tax-discounts` | `(dashboard)/tax-discounts/page.tsx` | Pajak & Diskon dengan tab (pajak, diskon produk, diskon order) |

> Setiap halaman `(dashboard)/` punya `loading.tsx` (skeleton) + `error.tsx` boundary.

#### Fitur per Halaman (POS)

**Login 4-Step (route group `(auth)/login/`)**
- **Step 1 `/login`** — input **Kode Perusahaan** (auto-uppercase) + **Password** → `POST /api/auth/tenant/company` (rate limit: 10x gagal → lock 15 menit, sisa percobaan ditampilkan di pesan error) → set cookie `pending_login` (10 menit).
- **Step 2 `/login/select-outlet`** — daftar outlet aktif untuk company (`GET /api/auth/tenant/outlet`), pilih → simpan ke `pending_login`.
- **Step 3 `/login/select-user`** — daftar akun karyawan untuk outlet terpilih (`GET /api/auth/tenant/accounts?outlet_id=`); hanya user `active` yang (a) `all_outlets = true`, atau (b) ter-assign ke outlet via `user_outlets`.
- **Step 4 `/login/enter-pin`** — input **PIN 6 digit** (numeric, masked) → `POST /api/auth/tenant/verify-pin` (bcrypt verify; 5x gagal → lock 15 menit; pesan sisa percobaan). Berhasil → set cookie `session` (12 jam, berisi user_id/company_id/outlet_id/role_id/nama) → hapus `pending_login` → log audit `pin_verify` + `shift_start` → **redirect ke menu pertama yang diizinkan role** (dari `role_menu_access`).

> **⚠️ Known issue:** redirect ini memetakan slug `products` ke path lama `/admin/products` (tidak ada route `admin/products` lagi di v4 UI revamp — rute aktual `/products`). Kasir dengan menu pertama "Produk" bisa mendarat di 404 setelah login; sebaiknya path dipetakan ke `/products`.

**`/register` — POS Register (Kasir)** (RegisterView.tsx — halaman terbesar POS)
- **Kiri:** search produk (nama / nama kategori) + **tab kategori** horizontal scrollable + **grid produk** (gambar, nama, harga — harga mengikuti tier aktif).
- **Klik produk** → jika punya modifier, buka **modifier modal** (pilih add-on per group — satu pilihan per group, + tombol "custom modifier" tambahan nama & harga bebas, + catatan item) lalu add ke cart; tanpa modifier → langsung add.
- **Kanan / drawer mobile (`OrderSidebar`):** *Current Order* — daftar item **dikelompokkan per kategori & per produk** (variant modifier digabung), qty control (+/−), input "Nama Customer (wajib)", catatan order, tombol **Simpan Draft** (→ draft order / pay-later, `reserved_until` 24 jam), tombol **Buka Draft** (badge jumlah draft), **clear cart**, tombol **Bayar**.
- **Mobile:** floating **cart bar** hijau di bawah (total + jumlah item + tombol Detail) → membuka cart sebagai drawer.
- **Pilih tier harga** (Dine In / Take Away / dll.) → semua harga item & modifier di-recalc otomatis (via cart store + tier price maps).
- **PaymentModal:** pilih metode **Tunai / QRIS / Kartu**; saran nominal cepat (uang pas + pembulatan pecahan 10k–500k + denominasi relevan, max 6 saran); input nominal tunai dengan perhitungan **kembalian** otomatis (tombol bayar aktif hanya jika nominal cukup); opsi **Split Bill** (buka SplitBillPanel: tambah pembayaran per orang, pilih metode, alokasi item per orang); wajib nama customer; setelah sukses → **InvoiceReceipt** (receipt + tombol print), cart di-reset, draft terkait ditandai selesai jika checkout dari draft.
- **DraftOrdersPanel:** daftar draft order tersimpan (customer, total, waktu, items), tombol **Restore** (isi ulang cart, keep pricing tier) & **Hapus**.
- Item di cart bisa di-edit ulang modifier/note-nya (`ItemDetailModal` / modal modifier mode edit).

**`/orders` — Daftar Pesanan** (mirip Owner: filter outlet & waktu, search nomor order, expand detail item, pagination, tombol print invoice) — data diambil dari server components via `getOrders()`.

**`/orders/[id]/invoice`** — halaman invoice + print (sama seperti Owner).

**`/reports` — Laporan Penjualan** — filter rentang (Hari ini/Kemarin/7 Hari/Semua), kartu Total Transaksi / Total Pendapatan / Item Terlaris, daftar detail transaksi, **Kirim Email** (`/api/reports/send-email` via Resend).

**`/products` — List Produk** (AdminProductsClient.tsx — data awal via Server Component `getActiveProducts()` dll.)
- Aksi header: **Kategori** (`CategoryManagerSlideOver`), **Tier** (`TierManagerSlideOver`), **Tambah Produk**.
- Search nama, filter kategori, kolom harga rentang tier, toggle aktif, hapus (ConfirmDialog), **pagination** (10/20/50/100).

**`/products/add` & `/products/[id]/edit` — Form Produk** — sama dengan Owner (grid 12, upload gambar, tier pricing, modifier, kategori; bottom action bar di mobile).

**`/tax-discounts` — Pajak & Diskon** — 3 tab (Pajak / Diskon Produk / Diskon Order), dropdown outlet, toggle aktif langsung, form slide-over, hapus dengan konfirmasi. Endpoint `/api/admin/taxes` & `/api/admin/discounts` (+ `/active` untuk yang aktif — dipakai register page).

#### API — `apps/pos/src/app/api/`

**Auth Tenant — `/api/auth/tenant/`**

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/company` | POST | Verify kode + password company |
| `/outlet` | GET/POST | List outlet aktif / pilih outlet |
| `/accounts` | GET | List akun untuk outlet |
| `/verify-pin` | POST | Verify PIN + buat session |
| `/session` | GET | Baca session saat ini |
| `/switch-user` | POST | Ganti user (lock + clear session) |
| `/logout` | POST | Hapus session cookie |

**Admin — `/api/admin/`**

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/products` | POST/PATCH/PUT | Create / update / toggle produk |
| `/products/upload` | POST | Upload gambar produk |
| `/categories` | POST/PATCH/DELETE | CRUD kategori |
| `/modifiers` | GET/POST/DELETE | CRUD modifier |
| `/orders` | POST | Create order |
| `/orders/draft` | GET/POST/PATCH/DELETE | Draft order (pay-later) |
| `/orders/split` | POST | Split payment |
| `/pricing-options` | — | CRUD pricing options |
| `/pricing-tiers` | — | CRUD pricing tiers |
| `/product-tier-prices` | — | CRUD product tier prices |
| `/modifier-tier-prices` | — | CRUD modifier tier prices |
| `/taxes` | — | CRUD pajak |
| `/taxes/active` | GET | List pajak aktif |
| `/discounts` | — | CRUD diskon |
| `/discounts/active` | GET | List diskon aktif |

**Reports — `/api/reports/`**

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/send-email` | POST | Kirim laporan via email (Resend) |

### 8.3 apps/superadmin — Panel Superadmin (`superadmin.rakku.com`)

#### Halaman (protected, route group `(protected)/`)

| Rute | File | Deskripsi |
|------|------|-----------|
| `/login` | `app/login/page.tsx` | Login superadmin (Supabase Auth) |
| `/companies` | `(protected)/companies/page.tsx` | CRUD perusahaan |
| `/outlets` | `(protected)/outlets/page.tsx` | CRUD outlet per company |
| `/menus` | `(protected)/menus/page.tsx` | CRUD menu sistem |
| `/roles` | `(protected)/roles/page.tsx` | CRUD role per company |
| `/access-matrix` | `(protected)/access-matrix/page.tsx` | Matrix role × menu |
| `/users` | `(protected)/users/page.tsx` | CRUD user per company |
| `/audit-logs` | `(protected)/audit-logs/page.tsx` | Log autentikasi |

#### Fitur per Halaman (Superadmin)

Semua halaman di bawah di-render sebagai client component dengan data dari `/api/superadmin/*`, dilindungi `(protected)/layout.tsx` (guard `supabase.auth.getUser()` → redirect `/login`). Sidebar statis kiri 224px (logo Rakku Admin, nav 7 menu, link "Ke POS" → `NEXT_PUBLIC_OWNER_URL`, tombol Logout POST `/api/superadmin/auth/logout`).

- **`/login`** — Login via **Supabase Auth** (email/password); setelah login redirect ke `/companies`.
- **`/companies`** — CRUD perusahaan: search, form modal tambah/edit (kode, nama, password), toggle status, delete (konfirmasi). Row dropdown company sebagai context filter untuk halaman turunan.
- **`/outlets`** — CRUD outlet per company (filter dropdown company): nama, alamat, status.
- **`/menus`** — CRUD menu sistem (slug, nama, icon, path, sort_order) — menu akhir: Kasir, Pesanan, Laporan, Produk, Pajak & Diskon.
- **`/roles`** — CRUD role per company (nama role; kode di-scope company).
- **`/access-matrix`** — Matrix **role × menu**: grid checkbox per (role, menu) → `POST /api/superadmin/access-matrix` (toggle `can_view`).
- **`/users`** — CRUD user per company (nama, username, role, PIN, status, all_outlets).
- **`/audit-logs`** — Tabel log autentikasi (event_type, success, IP, user agent, failure reason, timestamp) — read-only.

#### API — `apps/superadmin/src/app/api/superadmin/`

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/auth/logout` | POST | Logout superadmin |
| `/companies` | GET/POST/PUT | CRUD companies |
| `/outlets` | GET/POST/PUT | CRUD outlets |
| `/menus` | GET/POST/PUT/DELETE | CRUD menus |
| `/roles` | GET/POST/PUT/DELETE | CRUD roles |
| `/users` | GET/POST/PUT | CRUD users |
| `/access-matrix` | GET/POST | Toggle access matrix |
| `/audit-logs` | GET | View audit logs |

---

## 9. Komponen Utama

> Di v4.0, komponen **tidak lagi shared di root `components/`**. Setiap app punya `src/components/` sendiri. Komponen UI generik (Badge, Toast, EmptyState, QtyControl, Tabs, dll.) ada di package `@rakku/ui`.

### 9.1 Shared UI Package (`packages/ui/src/`)

| Komponen | File | Deskripsi |
|----------|------|-----------|
| **Badge** | `Badge.tsx` | Status badge (active/inactive/warning) |
| **EmptyState** | `EmptyState.tsx` | Placeholder konten kosong |
| **QtyControl** | `QtyControl.tsx` | Increment/decrement quantity |
| **Toast** | `Toast.tsx` | Notifikasi toast (success/error/info) + `ToastContainer` |
| **Tabs** | `Tabs.tsx` | Tab bar (`Tabs`, `active`, `onChange`). Opsional label dengan **count badge pill hijau** (dipakai di halaman Karyawan & Pajak/Diskon) |
| **PageHeader** | `PageHeader.tsx` | Header halaman konsisten (title, subtitle, tombol back `backAs`, `actions`) |
| **SlideOver** | `SlideOver.tsx` | Panel slide-over kanan (dipakai form kategori/tier/pajak/diskon) |
| **FormField** | `FormField.tsx` | Wrapper field form + `fieldInputClass` / `fieldSelectClass` |
| **Toggle** | `Toggle.tsx` | Switch aktif/nonaktif |
| **rakkuPreset** | `tailwind.preset.ts` | Tailwind preset dibagikan ke semua app |

### 9.2 Layout (per app)

**apps/pos — `src/components/layout/`**

| Komponen | Deskripsi |
|----------|-----------|
| **AppSidebar** | Rail icon 64px — menu dinamis dari role_menu_access, badge **jumlah draft order** (warna forest), switch-user, logout |
| **ResponsiveNav** | Wrapper responsive — AppSidebar (desktop) + BottomNav/MobileBottomNav (mobile) + MoreMenuSheet |
| **BottomNav / MobileBottomNav** | Bottom navigation mobile dengan badge draft order |
| **MoreMenuSheet** | Sheet "More" untuk menu tambahan di mobile |
| **SideRail / Sidebar** | Variant navigasi (legacy/alternatif) |

**apps/owner — `src/components/layout/`**

| Komponen | Deskripsi |
|----------|-----------|
| **ResponsiveNav** | Wrapper responsive — OwnerSidebar (desktop) + BottomNav + MoreMenuSheet (mobile) |
| **BottomNav** | Bottom navigation mobile |
| **MoreMenuSheet** | Sheet "More" untuk menu tambahan |

**apps/superadmin** — sidebar dirender langsung di `(protected)/layout.tsx` (tidak pakai komponen terpisah).

### 9.3 Register (POS) — `apps/pos/src/components/register/`

| Komponen | Deskripsi |
|----------|-----------|
| **RegisterView** | Main POS — search, kategori, grid produk, modifier modal, draft panel, payment |
| **ProductGrid** | Grid produk responsive |
| **ProductCard** | Card produk (gambar, nama, harga) |
| **CategoryTabs** | Tab kategori horizontal (scrollable) |
| **OrderSidebar** | Cart sidebar — grouped by category, qty control, edit item, draft, payment button |
| **MobileCartBar** | Floating cart bar mobile + badge |
| **PaymentModal** | Alur bayar — cash/QRIS/card, nominal saran, split bill, customer name, invoice |
| **DraftOrdersPanel** | Panel daftar & restore draft order |
| **InvoiceReceipt** | Receipt post-payment dengan print |
| **ItemDetailModal** | Breakdown detail item per add-on |
| **SplitBillPanel** | Konfigurasi split pembayaran |
| **PricingOptionSelector** | Pilih opsi harga tambahan |

### 9.4 Admin Components (slide-over & form)

#### apps/owner — `src/components/charges/` & `src/components/products/`

Komponen slide-over untuk manajemen data kecil:
- **TaxFormSlideOver** — Buat/edit pajak (percentage/fixed)
- **DiscountFormSlideOver** — Buat/edit diskon (produk & order)
- **CategoryManagerSlideOver** — Buat/edit kategori produk
- **TierManagerSlideOver** — Buat/edit pricing tiers
- **ProductForm** — Form utama tambah/edit produk (layout grid 12, upload gambar, modifier, tier pricing)

**Mode mobile (bottom-nav):** `ProductForm` (owner & pos) mendeteksi mode navigasi via `useNavMode()`. Saat mode `bottom`, header form dibuat **fixed/sticky di atas** dan tombol aksi (Batal + Simpan) dipindah ke **bottom action bar fixed** di atas bottom nav (`--nav-bottom-safe`) — tombol full-width agar mudah dipencet di HP.

#### apps/pos — `src/components/charges/` & `src/components/products/`

Sama seperti Owner, dengan endpoint `/api/admin/*`.

### 9.5 Owner Sidebar — `apps/owner/src/components/owner/OwnerSidebar.tsx`

Sidebar statis (bukan dari DB) untuk dashboard Owner. Menu (dari `nav-config.ts`):
Dashboard, Laporan, Pesanan, Outlet, Karyawan, Produk, Pajak & Diskon, Pengaturan, + link eksternal "Login Kasir" ke `NEXT_PUBLIC_POS_URL`.

Di mobile, menu dibagi: 4 menu utama (Dashboard, Laporan, Pesanan, Produk) di **bottom nav**, sisanya + link "Login Kasir" di sheet **Lainnya** (`ownerOverflowItems`).

### 9.6 Hooks (per app — identik di owner & pos)

| Hook | File | Deskripsi |
|------|------|-----------|
| **useMediaQuery** | `src/hooks/useMediaQuery.ts` | Breakpoints: `isMobile`, `isTablet`, `isDesktop` |
| **useSwipe** | `src/hooks/useSwipe.ts` | Deteksi gesture swipe touch |
| **useNavMode** | `src/hooks/useNavMode.ts` | Mode navigasi aktif (rail/bottom/more) |
| **useModalHistory** | `src/hooks/useModalHistory.ts` | Back-button trap untuk modal/sheet |
| **useDraftCount** (pos) | `apps/pos/src/hooks/useDraftCount.ts` | Fetch jumlah draft order dari `/api/admin/orders/draft` (awal mount + polling tiap 30 detik). Dipakai untuk badge draft di AppSidebar / BottomNav / MobileBottomNav / SideRail — menggantikan badge jumlah item cart |

---

## 10. Library & Utilities

> Di v4.0, library auth/utils/supabase **dipecah**: shared code di `packages/*`, sisanya per-app di `apps/<app>/src/lib/`.

### 10.1 Shared Packages (`packages/`)

**`@rakku/auth-utils`** (`packages/auth-utils/src/`)
| File | Fungsi Utama |
|------|-------------|
| `jwt.ts` | `signJwt()`, `verifyJwt()` — generic JWT wrapper (jose 6.x). Dipakai owner (`OWNER_JWT_SECRET`) & pos (`POS_JWT_SECRET`). |
| `pin.ts` | `hashPin()`, `verifyPin()`, `isLocked()`, `computeLockedUntil()`, `getRemainingAttempts()` — 5 attempts, 15 menit lockout |
| `audit-log.ts` | `logAuthEvent()` + `FailureReasons` constants |
| `index.ts` | Re-export semua |

**`@rakku/supabase-clients`** (`packages/supabase-clients/src/`)
| File | Client | Key | Use Case |
|------|--------|-----|----------|
| `admin.ts` | `createAdminClient()` (supabase-js) | Service Role | Semua query backend (bypass RLS) |
| `client.ts` | `createClient()` (browser, `@supabase/ssr`) | Anon Key | Browser-side (upload gambar) |
| `server.ts` | `createClient()` (server, `@supabase/ssr`) | Anon Key | Server Component (superadmin pages) |

**`@rakku/shared-types`** (`packages/shared-types/src/`)
| File | Isi |
|------|-----|
| `common.ts` | `Category`, `Product`, `Modifier`, `CartItem`, `Order`, `OrderItem`, `PricingTier`, `Tax`, `ProductDiscount`, `OrderDiscount`, `AppliedTax`, `AppliedDiscount`, `SplitPayment`, dll. |
| `tenant.ts` | `TenantSession`, `PendingLogin`, `Menu`, `Role`, `User`, `Company`, `Outlet` |
| `owner.ts` | `OwnerSession`, `Owner` |

**`@rakku/pricing`** (`packages/pricing/src/`)
| Export | Fungsi |
|--------|--------|
| `DEFAULT_TIERS` | Dine In, Take Away |
| `seedDefaultTiers()` | Seed tier default untuk outlet baru |
| `syncProductTierPrices()` | Sync harga produk saat tier berubah |

**`@rakku/ui`** — lihat Bagian 9.1.

### 10.2 Auth Library per App

**`apps/pos/src/lib/auth/`**
| File | Fungsi Utama |
|------|-------------|
| `tenant-session.ts` | `signSession()`, `verifySession()`, `getTenantSessionFromCookies()`, `setSessionCookie()`, `clearSessionCookie()` |
| `pending-login.ts` | Sama seperti session, expiry 10 menit untuk flow login multi-step |
| `pin.ts` | Re-export dari `@rakku/auth-utils` |
| `company.ts` | `verifyCompanyLogin()` dengan rate limiting (10 attempts, 15 menit), `getActiveOutlets()`, `getAccountsForOutlet()` |
| `menus.ts` | `getAllowedMenus(roleId)` — query role_menu_access JOIN menus, `getAllMenus()` |

**`apps/owner/src/lib/auth/owner-session.ts`**
- `signOwnerSession()`, `verifyOwnerSession()`, `getOwnerSessionFromCookies()`, `setOwnerSessionCookie()`, `clearOwnerSessionCookie()` — JWT 24 jam, cookie `owner_session`, secret `OWNER_JWT_SECRET`.

**`apps/superadmin/src/lib/auth/`**
| File | Fungsi |
|------|--------|
| `superadmin.ts` | `requireSuperadmin()` — guard route superadmin via Supabase Auth |
| `menus.ts` | Helper menu superadmin |

### 10.3 Supabase Queries per App

**`apps/pos/src/lib/supabase/`**
| File | Tipe | Key Wrappers |
|------|------|---------------|
| `queries.server.ts` | Server (Service Role) | `getActiveProducts()`, `getCategories()`, `getOrders()`, `getSalesSummary()`, `getPricingTiers()`, `getActiveTaxes()`, dll. Semua filter `company_id` + `outlet_id` dari session. |
| `queries.client.ts` | Client (fetch) | `createOrder()`, `createCategory()`, `updateProduct()`, dll via fetch ke `/api/admin/*` |
| `storage.ts` | Browser (Anon) | `uploadProductImage()`, `deleteProductImage()` ke bucket `product-images` |

**`apps/owner/src/lib/supabase/`**
| File | Isi |
|------|-----|
| `queries.owner.ts` | `createOwner()`, `verifyOwnerLogin()`, `createCompanyWithOnboarding()`, `getOwnerOutlets()`, `createOutlet()`, `updateOutlet()`, `toggleOutletStatus()`, `deleteOutlet()`, `getOwnerEmployees()`, `createEmployee()`, `updateEmployee()`, `toggleEmployeeStatus()`, `resetEmployeePin()`, `deleteEmployee()`, `getCompanyRoles()`, `generateCompanyCode()`, `generateSlug()` |
| `queries.data.ts` | Query baca untuk dashboard owner (orders, products, reports, taxes, discounts) |

**`apps/superadmin/src/lib/supabase/queries.superadmin.ts`**
- `getCompanies()`, `createCompany()`, `getOutlets()`, `getRoles()`, `getUsers()`, `setRoleMenuAccess()`, dll.

### 10.4 Cart Store (`apps/pos/src/lib/store/cartStore.ts`)

State management dengan **Zustand**. State utama:

```typescript
interface CartState {
  items: CartItem[];
  orderType: OrderType;
  customerName: string;
  note: string;
  draftOrderId: string | null;
  pricingTierId: string | null;
  pricingTiers: PricingTier[];
  productTierPriceMap: Record<string, Record<string, number>>;
  modifierTierDeltaMap: Record<string, Record<string, number>>;
  splitPayments: SplitPayment[];
  activeTaxes: Tax[];
  activeProductDiscounts: ProductDiscount[];
  activeOrderDiscounts: OrderDiscount[];
}
```

**Key actions:**
- `addProduct()` — Tambah item dengan logic merge (sama product + modifier → merge quantity)
- `restoreDraftItem()` — Restore item dari draft
- `updateItemModifiers()` — Edit modifier item yang sudah di cart
- `setPricingTier()` — Ganti tier → recalculate semua harga
- `fetchActiveTaxesAndDiscounts()` — Fetch pajak & diskon aktif
- `clear()` — Reset cart

**Selectors (hooks):**
- `useCartGroupedArray()` — Cart items grouped by category, sorted
- `useCartGroupedByProduct()` — Cart items grouped by category → product → variants
- `useCartTotals()` — Kalkulasi subtotal, diskon, pajak, total

### 10.5 Type Definitions

Semua interface TypeScript sekarang di package `@rakku/shared-types` (lihat 10.1), bukan di `src/types/index.ts`.

---

## 11. API Endpoints Detail

### 11.1 Auth Flow Detail

#### `POST /api/auth/tenant/company`
**Request:**
```json
{ "code": "KOPIKITA", "password": "rakku123" }
```
**Response (200):**
```json
{ "company": { "id": "...", "code": "KOPIKITA", "name": "Rakku" } }
```
**Error (401):**
```json
{ "error": "Password salah. Sisa percobaan: 8" }
```

#### `POST /api/auth/tenant/outlet`
**Request:**
```json
{ "outletId": "uuid-here" }
```
**Response (200):**
```json
{ "outlet": { "id": "...", "name": "Outlet Utama" } }
```

#### `POST /api/auth/tenant/verify-pin`
**Request:**
```json
{ "pin": "123456" }
```
**Response (200):**
```json
{ "redirect": "/register" }
```
**Error (401):**
```json
{ "error": "PIN salah. Sisa percobaan: 4" }
```
**Error (423):**
```json
{ "error": "Akun terkunci 15 menit karena 5 kali percobaan gagal" }
```

### 11.2 Admin — Create Order

#### `POST /api/admin/orders`
**Request:**
```json
{
  "orderType": "dine_in",
  "paymentMethod": "cash",
  "items": [
    {
      "product": { "id": "...", "name": "Kopi Susu", "price": 25000 },
      "quantity": 2,
      "unit_price": 30000,
      "subtotal": 60000,
      "modifier_label": "Oat Milk +5000",
      "modifiers": [{ "id": "...", "name": "Oat Milk", "price_delta": 5000 }],
      "note": null
    }
  ],
  "subtotal": 60000,
  "total": 66000,
  "taxes": [{ "name": "PPN", "type": "percentage", "value": 10, "amount": 6000 }],
  "discounts": [],
  "customerName": "Budi",
  "pricingTierId": null,
  "splitPayments": []
}
```
**Response (201):**
```json
{ "id": "uuid-order", "order_number": 42, ... }
```

---

## 12. Panduan Development

### 12.1 Persiapan Lingkungan

**Persyaratan:**
- Node.js 18+
- **pnpm** 11+ (`corepack enable` atau `npm i -g pnpm`) — wajib (workspace + Turborepo)
- Project Supabase (free tier)
- Akun Gmail dengan App Password (untuk email verifikasi Owner)
- Akun Resend (untuk laporan POS via email)

**Langkah-langkah:**

```bash
# 1. Clone repository
git clone <repo-url>
cd rakku

# 2. Install dependencies (pnpm workspace — otomatis link packages/*)
pnpm install

# 3. Buat .env.local di tiap app
#    apps/owner/.env.local      → OWNER_JWT_SECRET, SMTP, NEXT_PUBLIC_POS_URL, NEXT_PUBLIC_OWNER_URL
#    apps/pos/.env.local        → POS_JWT_SECRET, NEXT_PUBLIC_TAX_RATE, RESEND_API_KEY
#    apps/superadmin/.env.local → (hanya Supabase keys)
#    Semua butuh NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY

# 4. Jalankan migrasi Supabase (berurutan 001 → 014, tanpa 005)
#    Bisa via Supabase Dashboard → SQL Editor, atau via runner:
pnpm tsx scripts/run-migration.ts <migration-file>

# 5. Seed data awal
pnpm seed            # company RAKKU
pnpm seed:full       # company TOKOKO + Outlet Cabang
pnpm backfill:owners # backfill akun owner untuk company existing (wajib setelah migration 014)

# 6. Jalankan dev server (semua app paralel via Turborepo)
pnpm dev
# Owner → localhost:3000 | POS → localhost:3001 | Superadmin → localhost:3002
```

### 12.2 Scripts (root `package.json`)

| Script | Perintah | Fungsi |
|--------|----------|--------|
| `dev` | `pnpm dev` | Jalankan semua app paralel (Turborepo) |
| `dev:owner` | `pnpm dev:owner` | Hanya Owner app (port 3000) |
| `dev:pos` | `pnpm dev:pos` | Hanya POS app (port 3001) |
| `dev:superadmin` | `pnpm dev:superadmin` | Hanya Superadmin app (port 3002) |
| `build` | `pnpm build` | Build semua app (Turborepo) |
| `build:owner` | `pnpm build:owner` | Build Owner saja |
| `build:pos` | `pnpm build:pos` | Build POS saja |
| `build:superadmin` | `pnpm build:superadmin` | Build Superadmin saja |
| `lint` | `pnpm lint` | ESLint check semua app |
| `seed` | `pnpm seed` | Seed company RAKKU + data awal |
| `seed:full` | `pnpm seed:full` | Seed company TOKOKO + Outlet Cabang |
| `backfill:owners` | `pnpm backfill:owners` | Backfill akun owner untuk company existing |

> Script per-app (`dev`, `build`, `start`, `lint`) juga tersedia di `apps/<app>/package.json`.

### 12.3 Seed Data

**`scripts/seed.ts`** — Company default:
- Company: **RAKKU** (code: `RAKKU`, password: `rakku123`)
- Outlet: **Outlet Utama**
- Roles: Owner, Kepala Cabang, Admin, Kasir
- Users: budi (Owner), siti (Admin), ahmad (Kasir) — PIN: `123456`
- Backfill data existing dengan company_id + outlet_id

**`scripts/seed-full.ts`** — Company kedua:
- Company: **TOKOKO** (code: `TOKOKO`, password: `tokoko123`)
- Outlet: **Toko Utama**
- Users: ali (Owner), rina (Admin), joko (Kasir)
- RAKKU **Outlet Cabang** + 2 user (rudi, dewi)
- Kategori & produk berbeda per outlet (validasi isolasi data)

**`scripts/backfill-owners.ts`** — Buat akun owner testing untuk company existing (RAKKU → `budi@rakku.test`, TOKOKO → `ali@rakku.test`). Jalankan setelah migration 014.

### 12.4 Migrasi

14 file migrasi di `supabase/migrations/` (tidak ada 005). Dijalankan berurutan via Supabase SQL Editor atau runner `scripts/run-migration.ts`:

```
001_init.sql              → Schema awal (tabel core)
002_multi_tenant.sql      → Multi-tenant & RBAC
003_rls_permissive.sql    → Non-aktifkan RLS
004_m6_hardening.sql      → Rate limiting, audit log
006_pricing_draft.sql     → Pricing options, draft orders
007_july_features.sql     → Split bill, pricing tiers, cashier_name
008_pricing_tier_split.sql  → pricing_tier_id di orders
009_pricing_tier_admin.sql  → Menu pricing-tiers
010_seed_default_tiers.sql  → Seed Dine In & Take Away
011_flatten_paths.sql       → Update path menu
012_pricing_per_tier.sql    → Modifier tier prices
013_tax_discount.sql        → Pajak & diskon dinamis
014_owner_self_service.sql  → V3 — tabel owners + alter companies (owner_id, slug)
015_menu_consolidation.sql  → V4 UI — gabung menu taxes+discounts → "Pajak & Diskon"
                              (/tax-discounts), hapus pricing-tiers, rename nama menu
                              ke Bahasa Indonesia
```

### 12.5 Akun Default untuk Testing

**Owner (login di `apps/owner` / `rakku.com`):**

| Email | Password | Company |
|-------|----------|---------|
| `budi@rakku.test` | `budi12345` | RAKKU |
| `ali@rakku.test` | `ali12345` | TOKOKO |

**Kasir (login 4-step di `apps/pos` / `pos.rakku.com`):**

| Kode Company | Password | Username | PIN |
|-------------|----------|----------|-----|
| `RAKKU` | `rakku123` | budi / siti / ahmad | `123456` |
| `TOKOKO` | `tokoko123` | ali / rina / joko | `123456` |

**Superadmin:** Login via `/login` di `apps/superadmin` menggunakan Supabase Auth credentials.

### 12.6 Build & Deploy

```bash
# Production build (semua app)
pnpm build

# Start production per app
pnpm --filter @rakku/owner start       # port 3000
pnpm --filter @rakku/pos start         # port 3001
pnpm --filter @rakku/superadmin start  # port 3002
```

**Deployment:**
- Tiap app deploy independen (Vercel project terpisah) ke domain masing-masing.
- Setiap `apps/<app>/vercel.json` mengatur routing/caching untuk app tersebut.
- Set semua environment variable (lihat Bagian 4.1) di Vercel project settings.
- PWA (Service Worker Serwist) hanya aktif di `apps/pos` saat `NODE_ENV=production`.

---

## 13. PWA (Progressive Web App)

### 13.1 Ikhtisar

Rakku adalah **Progressive Web App** — dapat di-install di desktop & mobile seperti aplikasi native, berjalan standalone, dan tetap usable saat koneksi terputus (offline fallback). PWA diimplementasi dengan **Serwist** (fork Workbox yang aktif维护) untuk Next.js App Router.

| Aspek | Detail |
|-------|--------|
| **Library** | `@serwist/next` 9.x + `serwist` 9.x (dev) |
| **Service Worker** | `src/app/sw.ts` → di-compile ke `public/sw.js` saat build |
| **Manifest** | `src/app/manifest.ts` (Next.js Metadata file convention) → `/manifest.webmanifest` |
| **Offline Page** | `src/app/~offline/page.tsx` (Server Component, static) |
| **Ikon** | `public/icons/` (192, 512, maskable, apple-touch) — di-generate dari `rakku_logo.png` |
| **Scope offline** | App shell + cache aset statis (CSS/JS/gambar) + fallback offline. POS tetap butuh online untuk sync data ke Supabase. |

### 13.2 Caching Strategy

| Resource | Strategy | Cache Name | Expiry |
|----------|----------|------------|--------|
| Navigasi (halaman) | **Network First** | `pages` | — |
| JS / CSS / Font | **Cache First** | `static-resources` | 30 hari, 100 entry |
| Images (incl. Supabase) | **Stale While Revalidate** | `images` | 30 hari, 60 entry |
| Supabase API | **Network First** | `supabase-api` | 5 menit, 50 entry |
| Lainnya | `defaultCache` (Serwist) | — | — |
| Dokument gagal → fallback | `/~offline` | — | — |

**Catatan:** Service worker **dinonaktifkan di development** (`disable: process.env.NODE_ENV === "development"`) untuk menghindari konflik caching saat coding. SW hanya aktif saat `npm run build` + `npm start`.

### 13.3 File Terkait PWA

> **Di v4.0, semua file PWA ada di dalam `apps/pos/`** (bukan di root project).

```
apps/pos/
├── src/app/
│   ├── manifest.ts              # Web app manifest (MetadataRoute.Manifest)
│   ├── sw.ts                    # Service worker source (compiled by Serwist)
│   └── ~offline/page.tsx        # Halaman fallback offline
└── public/
    ├── sw.js                    # SW build output (gitignored, auto-generated)
    └── icons/
        ├── icon-192.png         # Ikon 192x192
        ├── icon-512.png         # Ikon 512x512
        ├── icon-192-maskable.png# Maskable 192 (Android adaptive)
        ├── icon-512-maskable.png# Maskable 512 (Android adaptive)
        ├── apple-touch-icon.png # Apple touch icon 180x180
        └── favicon-32.png       # Favicon 32x32

apps/pos/scripts/generate-pwa-icons.mjs  # Generate ikon dari rakku_logo.png (sharp) — di dalam app
scripts/generate-pwa-icons.mjs           # Mirror di root scripts/
```

### 13.4 Konfigurasi

**`apps/pos/next.config.mjs`** — di-wrap dengan `withSerwist`:
```js
const withSerwist = withSerwistInit({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});
export default withSerwist(nextConfig);
```

**`apps/pos/tsconfig.json`** — tambahan untuk typing SW:
- `lib`: tambah `"webworker"`
- `types`: tambah `"@serwist/next/typings"`
- `exclude`: tambah `"public/sw.js"`

**`apps/pos/.gitignore`** — tambahan:
```
public/sw*
public/swe-worker*
```

### 13.5 Manifest Detail

| Field | Nilai |
|-------|-------|
| `name` | Rakku POS |
| `short_name` | Rakku POS |
| `start_url` | `/?source=pwa` |
| `display` | standalone |
| `orientation` | portrait-primary |
| `theme_color` | `#2E7D32` (forest green) |
| `background_color` | `#ffffff` |
| `lang` | id |
| `shortcuts` | Kasir (`/register`), Pesanan (`/orders`) |
| `icons` | 192, 512, 192-maskable, 512-maskable |

### 13.6 Generate Ulang Ikon

Ikon PWA di-generate dari `apps/pos/public/images/rakku_logo.png` menggunakan `sharp`:

```bash
node apps/pos/scripts/generate-pwa-icons.mjs
# atau dari root:
node scripts/generate-pwa-icons.mjs
```

Script ini menghasilkan semua ikon di `apps/pos/public/icons/`. Jalankan ulang jika logo berubah.

### 13.7 Testing PWA

1. **Build & start production** (SW tidak aktif di dev):
   ```bash
   pnpm --filter @rakku/pos build
   pnpm --filter @rakku/pos start   # http://localhost:3001
   ```
2. Buka `localhost:3001` di Chrome → DevTools → **Application** tab
   - Service Workers: pasti SW terdaftar dengan status "activated"
   - Manifest: pasti semua field terisi, ikon tampil
3. **Test offline**: DevTools → Network → "Offline" → reload → halaman `/~offline` tampil
4. **Test install**: Chrome address bar → ikon install → app terbuka standalone
5. **Lighthouse**: jalankan audit PWA untuk verifikasi installability

---

## 14. V3.0 — Self-Service Owner & Dashboard

> **✅ STATUS: FASE 1 & 2 SUDAH DIIMPLEMENTASI**
>
> Bagian ini mendokumentasikan implementasi v3.0 yang sudah aktif: **Owner Self-Service** (Fase 1 — Fondasi Ownership & Fase 2 — Onboarding & Self-Service Company/Outlet). Fitur subscription/billing, landing page marketing, dan production hardening (Fase 3–5) **belum diimplementasi** — lihat `PROMPT_RAKKU_V3_PRODUCTION_READY.md` untuk rencana fase sisanya.
>
> Bagian 1–13 menggambarkan kondisi sistem v2.1 yang tetap aktif (POS Register, kasir, superadmin). Lapisan Owner di atasnya tidak mengganggu mesin POS existing.
>
> **⚠️ PENTING — v4.0 memindahkan semua rute `/owner/*` di v3.0 menjadi rute root di `apps/owner`** (lihat Bagian 15 & 8.1). Rute di tabel 14.5 di bawah adalah **sejarah v3.0** dan sudah tidak valid di v4.0. Mapping-nya: `/owner/masuk` → `/login`, `/owner/daftar` → `/register`, `/owner/cek-email` → `/check-email`, `/owner/onboarding` → `/onboarding`, `/owner` → `/dashboard`, dst.

### 14.1 Ikhtisar

v3.0 mengubah Rakku dari *internal tool* (superadmin melakukan semuanya) menjadi *SaaS self-service* dengan onboarding mandiri.

### 14.2 Ownership Hierarchy Baru

```
PLATFORM → Superadmin (mengawasi seluruh platform)
  └── TENANT (Company) → Owner (pemilik bisnis, daftar sendiri)
        └── Karyawan → Kasir (login 4-step, dikelola oleh Owner)
```

### 14.3 Dua Auth Flow

| | Owner (BARU) | Kasir (existing) |
|---|---|---|
| Login | Email + password (Custom JWT) | 4-step: company → outlet → user → PIN |
| Cookie | `owner_session` (24 jam) | `session` (12 jam) |
| Secret | `TENANT_JWT_SECRET` (sama) | `TENANT_JWT_SECRET` |
| Library | `src/lib/auth/owner-session.ts` | `src/lib/auth/tenant-session.ts` |
| UI Login | `/owner/masuk` | `/login` |
| UI Signup | `/owner/daftar` | (tidak ada — dibuat Owner) |

### 14.4 Tabel Baru (Migration 014)

**`owners`** — Akun pemilik bisnis (self-service)
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| email | text UNIQUE | Email login Owner |
| phone | text | No. HP (opsional) |
| name | text | Nama lengkap |
| password_hash | text | bcrypt |
| email_verified_at | timestamptz | |
| is_active | boolean | |
| last_login_at | timestamptz | |
| created_at | timestamptz | |

**`companies`** — kolom tambahan:
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| owner_id | uuid FK→owners | Relasi kepemilikan (baru) |
| slug | text UNIQUE | Slug untuk URL/branding (baru) |

> Catatan: Tabel `employee_invitations`, `plans`, `subscriptions`, `entity_audit_logs` **belum dibuat** — dikesampingkan sesuai keputusan development (karyawan dibuat langsung oleh Owner, tanpa sistem undangan; subscription ditunda ke fase belakangan).

### 14.5 Rute Baru v3 (/owner/....)

| Rute | File | Deskripsi |
|------|------|-----------|
| `/owner/daftar` | `owner/daftar/page.tsx` | Signup Owner baru |
| `/owner/masuk` | `owner/masuk/page.tsx` | Login Owner |
| `/owner/cek-email` | `owner/cek-email/page.tsx` | Prompt verifikasi email setelah daftar |
| `/owner/onboarding` | `owner/onboarding/page.tsx` | Wizard buat company + outlet pertama |
| `/owner` | `owner/(dashboard)/page.tsx` | Dashboard Owner (ringkasan bisnis) |
| `/owner/outlets` | `owner/(dashboard)/outlets/page.tsx` | CRUD outlet milik sendiri |
| `/owner/employees` | `owner/(dashboard)/employees/page.tsx` | CRUD karyawan + kelola role & akses menu |
| `/owner/settings` | `owner/(dashboard)/settings/page.tsx` | Pengaturan perusahaan |

Route group `(dashboard)` memisahkan layout (dengan sidebar) dari auth pages (daftar, masuk, onboarding) yang tidak pakai sidebar.

### 14.6 API Routes Baru

#### Auth Owner — `/api/auth/owner/`
| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/register` | POST | Daftar Owner baru (name, email, password) → kirim email verifikasi |
| `/verify-email` | GET | Verifikasi email via token (link dari email) |
| `/resend-verification` | POST | Kirim ulang email verifikasi |
| `/login` | POST | Login Owner (cek email_verified_at) → set `owner_session` |
| `/logout` | POST | Hapus cookie Owner |
| `/session` | GET | Baca session Owner saat ini |

#### Onboarding — `/api/onboarding/`
| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/company` | GET | Suggest kode & slug dari nama company |
| `/company` | POST | Buat company + outlet + seed roles/tiers → update `owner_session` |

#### Owner Dashboard — `/api/owner/`
| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/outlets` | GET | List outlet milik Owner |
| `/outlets` | POST | Tambah outlet baru |
| `/outlets/[id]` | PATCH | Edit outlet / toggle status aktif-nonaktif |
| `/outlets/[id]` | DELETE | Hapus outlet (tidak bisa hapus outlet terakhir) |
| `/employees` | GET | List karyawan + roles + outlets (untuk form) |
| `/employees` | POST | Tambah karyawan (name, username, PIN, role, outlets) |
| `/employees/[id]` | PATCH | Edit / toggle status / reset PIN |
| `/employees/[id]` | DELETE | Hapus karyawan |
| `/settings` | GET | Baca profil company |
| `/settings` | PUT | Update profil / ganti password company |
| `/roles` | GET | List roles + menu access map (untuk matriks Kelola Role) |
| `/roles` | POST | Buat role baru |
| `/roles/[id]` | PATCH | Ubah nama role |
| `/roles/[id]` | DELETE | Hapus role (tidak bisa jika masih dipakai) |
| `/roles/[id]/access` | GET | List menu IDs yang diizinkan untuk role |
| `/roles/[id]/access` | POST | Toggle akses menu untuk role (body: menuId, canView) |
| `/menus` | GET | List semua menu sistem (untuk matriks akses) |

### 14.7 Scripts Baru

| Script | Perintah | Fungsi |
|--------|----------|--------|
| `backfill:owners` | `npx tsx scripts/backfill-owners.ts` | Backfill company existing (RAKKU → budi@rakku.test, TOKOKO → ali@rakku.test) ke model ownership |

### 14.8 Alur Owner Baru (end-to-end)

1. **Daftar** (`/owner/daftar`) — input nama, email, password → simpan ke `owners`, kirim email verifikasi → redirect ke `/owner/cek-email` (Owner harus klik link verifikasi di email sebelum bisa login)
2. **Verifikasi Email** — Owner klik link di email → `GET /api/auth/owner/verify-email?token=...` → set `email_verified_at` → redirect ke `/owner/masuk`
3. **Login** (`/owner/masuk`) — input email + password → cek `email_verified_at` → set `owner_session` cookie (24 jam) → redirect ke onboarding (jika belum punya company) atau dashboard
4. **Onboarding** (`/owner/onboarding`) — 2-step wizard (wajib jika baru daftar):
   - Step 1: nama company, kode (auto-suggest dari nama, bisa diubah), password company
   - Step 2: nama outlet pertama, alamat (opsional)
   - Submit → buat company + outlet + seed default pricing tiers (Dine In, Take Away) + update `owner_session` cookie → redirect ke `/owner`
5. **Dashboard** (`/owner`) — ringkasan: total outlet, total karyawan, total penjualan, quick links
6. **Kelola Outlet** (`/owner/outlets`) — CRUD: list, tambah, edit, toggle aktif/nonaktif, hapus (tidak bisa hapus outlet terakhir). Outlet baru otomatis dapat seed pricing tiers.
7. **Kelola Karyawan** (`/owner/employees`) — CRUD: list, tambah (name, username, PIN 6 digit, role, pilih outlet), edit, toggle aktif/nonaktif, reset PIN, hapus. Dilengkapi panel **Kelola Role** untuk membuat/mengubah/menghapus role & mengatur akses menu per role (register, orders, reports, products, dll). Tidak ada sistem undangan — Owner kasih tahu PIN secara manual.
8. **Pengaturan** (`/owner/settings`) — edit nama company, ganti password company

### 14.9 Library & Komponen Baru

| File | Fungsi |
|------|--------|
| `src/lib/auth/owner-session.ts` | `signOwnerSession()`, `verifyOwnerSession()`, `getOwnerSessionFromCookies()`, `setOwnerSessionCookie()`, `clearOwnerSessionCookie()` — JWT 24 jam, cookie `owner_session` |
| `src/lib/supabase/queries.owner.ts` | Semua CRUD queries untuk Owner: `createOwner()`, `verifyOwnerLogin()`, `createCompanyWithOnboarding()`, `getOwnerOutlets()`, `createOutlet()`, `updateOutlet()`, `toggleOutletStatus()`, `deleteOutlet()`, `getOwnerEmployees()`, `createEmployee()`, `updateEmployee()`, `toggleEmployeeStatus()`, `resetEmployeePin()`, `deleteEmployee()`, `getCompanyRoles()`, `generateCompanyCode()`, `generateSlug()` |
| `src/components/owner/OwnerSidebar.tsx` | Sidebar dinamis untuk dashboard Owner (Dashboard, Outlet, Karyawan, Pengaturan, Logout, link ke POS Kasir) |
| `src/app/owner/(dashboard)/layout.tsx` | Server layout — guard owner login + company exists, render sidebar |
| `src/app/owner/cek-email/page.tsx` | Halaman prompt verifikasi email + form kirim ulang |
| `src/app/api/owner/roles/route.ts` | CRUD role + get menu access list untuk matriks Kelola Role |
| `src/app/api/owner/roles/[id]/access/route.ts` | Toggle akses menu per role |

### 14.10 Catatan Penting

- **Semua API owner menggunakan service role key** — policy sama seperti v2.1 (bypass RLS). RLS tetap dimatikan.
- **Owner auth menggunakan Custom JWT** (bukan Supabase Auth) — konsisten dengan auth kasir existing. Menggunakan library `jose` + `bcryptjs` yang sudah terinstall.
- **Cookie name** Owner terpisah: `owner_session` vs `session` (kasir) vs `pending_login` (kasir login flow).
- **Seed logic** di `/api/onboarding/company` membuat company + outlet + default pricing tiers (Dine In, Take Away). Role & access matrix **tidak di-seed** saat onboarding — Owner harus membuat role sendiri melalui panel "Kelola Role" di halaman Karyawan. Ini deviasi dari `scripts/seed.ts` yang men-seed 4 role default untuk data testing.
- **Middleware** diperluas untuk route group baru: `/owner/daftar` & `/owner/masuk` (public, redirect jika sudah login), `/owner/onboarding` (perlu login, belum punya company), `/owner` & sub-rutes (perlu login + company sudah ada).
- **Tidak ada sistem undangan karyawan** — Owner membuat karyawan langsung dengan PIN, dan kasih tahu PIN secara manual. `employee_invitations` table sengaja tidak dibuat. Owner juga bisa mengelola role & akses menu karyawan dari panel "Kelola Role" di halaman Karyawan.
- **Email verification required** — Owner baru harus verifikasi email (klik link dari email) sebelum bisa login. Token verifikasi berlaku 1 jam. Link dikirim via `nodemailer` SMTP (bukan Resend yang dipakai untuk laporan).
- **Subscription/billing belum diimplementasi** — `plans` & `subscriptions` table belum dibuat. Semua company default status `active` (tanpa trial/limit).
- **Route `/`** sekarang redirect ke `/owner/masuk` (sebelumnya ke `/login`).
- **Backfill** — jalankan `npx tsx scripts/backfill-owners.ts` setelah migration 014 untuk membuat akun owner testing untuk RAKKU & TOKOKO.

### 14.11 Akun Testing Owner

| Email | Password | Company |
|-------|----------|---------|
| `budi@rakku.test` | `budi12345` | RAKKU |
| `ali@rakku.test` | `ali12345` | TOKOKO |

*(Akun ini di-generate oleh `scripts/backfill-owners.ts` untuk data existing. Owner baru mendaftar via `/owner/daftar`.)*

---

## 15. V4.0 — Monorepo 3-App

> **STATUS: IMPLEMENTASI SELESAI**
>
> v4.0 memecah rakku dari satu Next.js app menjadi **monorepo pnpm + Turborepo** dengan 3 Next.js app independen, masing-masing deploy ke domain sendiri.

### 15.1 Ikhtisar

| Aspek | v3.0 | v4.0 |
|---|---|---|
| Jumlah app | 1 (monolit) | 3 (owner, pos, superadmin) |
| Domain | 1 domain, path-based | 3 domain terpisah |
| Deploy | 1 deployment | 3 deployment independen |
| Secret | `TENANT_JWT_SECRET` (shared) | `POS_JWT_SECRET` + `OWNER_JWT_SECRET` (terpisah) |
| Tooling | npm | pnpm workspace + Turborepo |

### 15.2 Pemetaan Domain

| Domain | App | Port Dev |
|---|---|---|
| `rakku.com` | `apps/owner` | 3000 |
| `pos.rakku.com` | `apps/pos` | 3001 |
| `superadmin.rakku.com` | `apps/superadmin` | 3002 |

### 15.3 Struktur Proyek

```
rakku/
├── apps/
│   ├── owner/          # Dashboard Owner (daftar, masuk, onboarding, outlets, employees, settings)
│   ├── pos/            # POS Kasir (login 4-step, register, orders, reports, products, dll) + PWA
│   └── superadmin/     # Panel Superadmin (companies, outlets, menus, roles, users, audit-logs)
├── packages/
│   ├── shared-types/   # @rakku/shared-types — semua TypeScript interfaces
│   ├── supabase-clients/ # @rakku/supabase-clients — factory Supabase client (admin, browser, server)
│   ├── auth-utils/     # @rakku/auth-utils — JWT wrapper, PIN hash/verify, audit-log
│   ├── ui/             # @rakku/ui — Badge, Toast, EmptyState, QtyControl + Tailwind preset
│   └── pricing/        # @rakku/pricing — seed default pricing tiers
├── supabase/migrations/ # Tetap satu folder untuk satu project Supabase
├── scripts/            # seed.ts, seed-full.ts, backfill-owners.ts
├── turbo.json
├── pnpm-workspace.yaml
└── DOCS.md
```

### 15.4 Environment Variables per App

| Variabel | `apps/owner` | `apps/pos` | `apps/superadmin` |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ |
| `OWNER_JWT_SECRET` | ✅ | ❌ | ❌ |
| `POS_JWT_SECRET` | ❌ | ✅ | ❌ |
| `NEXT_PUBLIC_POS_URL` | ✅ | ❌ | ❌ |
| `NEXT_PUBLIC_TAX_RATE` | ❌ | ✅ | ❌ |
| `RESEND_API_KEY` | ❌ | ✅ | ❌ |
| SMTP (nodemailer) | ✅ | ❌ | ❌ |

### 15.5 Cara Menjalankan

```bash
# Semua app sekaligus (parallel)
pnpm dev

# Per app
pnpm dev:owner       # localhost:3000
pnpm dev:pos         # localhost:3001
pnpm dev:superadmin  # localhost:3002

# Build
pnpm build           # semua app
pnpm build:pos       # hanya POS

# Scripts
pnpm seed            # seed company RAKKU
pnpm seed:full       # seed company TOKOKO
pnpm backfill:owners # backfill owner untuk company existing
```

### 15.6 Packages

| Package | Isi | Dipakai oleh |
|---|---|---|
| `@rakku/shared-types` | Semua TypeScript interfaces (dipecah per domain: common, tenant, owner) | Semua app |
| `@rakku/supabase-clients` | Factory Supabase client: `createAdminClient()`, `createClient()` (browser), `createClient()` (server) | Semua app |
| `@rakku/auth-utils` | `signJwt`/`verifyJwt` (generic), `hashPin`/`verifyPin`, `logAuthEvent`, `FailureReasons` | owner, pos |
| `@rakku/ui` | `Badge`, `Toast`, `EmptyState`, `QtyControl` + `rakkuPreset` (Tailwind) | Semua app |
| `@rakku/pricing` | `DEFAULT_TIERS`, `seedDefaultTiers()`, `syncProductTierPrices()` | owner, pos, superadmin |

### 15.7 Perubahan Secret JWT

| Secret Lama | Secret Baru | App |
|---|---|---|
| `TENANT_JWT_SECRET` | `POS_JWT_SECRET` | `apps/pos` (untuk `session` + `pending_login` cookie) |
| `TENANT_JWT_SECRET` | `OWNER_JWT_SECRET` | `apps/owner` (untuk `owner_session` cookie + email verification token) |

### 15.8 PWA

PWA (Serwist) hanya aktif di `apps/pos`. File terkait:
- `apps/pos/src/app/sw.ts` — Service worker
- `apps/pos/src/app/manifest.ts` — Web app manifest
- `apps/pos/src/app/~offline/page.tsx` — Halaman offline fallback
- `apps/pos/public/icons/` — Ikon PWA

### 15.9 Catatan Penting

- **Tidak ada komunikasi antar app** — Owner dan kasir memang tidak berhubungan. Link "Buka POS Kasir" di OwnerSidebar menggunakan `<a href={NEXT_PUBLIC_POS_URL}>` biasa.
- **Tidak ada shared cookie domain** — Tiap app punya cookie sendiri di domain masing-masing.
- **Supabase tetap satu project** — Ketiga app berbagi satu project Supabase, migrations tetap di root.
- **RLS masih mati** — Migrasi v4.0 murni soal kerapian struktur, bukan hardening keamanan.
- **Skema database tidak berubah** — Semua migrations 001-015 tetap utuh.
- **Akun testing existing tetap valid** — `budi@rakku.test`/`budi12345`, `ali@rakku.test`/`ali12345`, company RAKKU/TOKOKO.

---

## 16. Alur Lengkap (End-to-End)

> Ringkasan alur utama sistem per pengguna. Detail endpoint/komponen dirujuk ke Bagian 8 & 9.

### 16.1 Alur Kasir (apps/pos) — dari login sampai invoice

```
Login (4-step)                    # /login → /login/select-outlet → /login/select-user → /login/enter-pin
 1. Kode company + password       # POST /api/auth/tenant/company (rate limit 10x, audit log)
 2. Pilih outlet                  # GET/POST /api/auth/tenant/outlet (hanya outlet aktif)
 3. Pilih akun karyawan           # GET /api/auth/tenant/accounts?outlet_id=... (all_outlets atau user_outlets)
 4. PIN 6 digit                   # POST /api/auth/tenant/verify-pin (5x gagal → lock 15 menit)
 5. Sukses                        # set cookie `session` (12 jam) → redirect ke menu pertama role

POS Register (/register)
 1. Pilih tier harga (Dine In / Take Away / ...)  → semua harga item & modifier ikut tier
 2. Cari / pilih produk di grid  → jika ada modifier: pilih add-on per group (+custom modifier, note)
 3. Item masuk cart (dikelompokkan per kategori; qty bisa diubah/edited modifiers)
 4. Isi nama customer (wajib)
 5. [Opsional] Simpan Draft (pay-later, expire 24 jam) — ditandai badge di nav
 6. Bayar → pilih metode Tunai / QRIS / Kartu (+ saran nominal & kembalian otomatis)
 7. [Opsional] Split Bill → konfigurasi pembayaran per orang (metode + alokasi item)
 8. Submit → POST /api/admin/orders → insert orders + order_items + split_payments
 9. Tampil InvoiceReceipt → print / selesai → cart di-reset (draft terkait jadi selesai)
```

**Alur draft (pay-later):**
```
Cart → "Simpan Draft" (POST /api/admin/orders/draft, status=draft, reserved_until=+24 jam)
  → draft muncul di DraftOrdersPanel (badge jumlah draft di nav — useDraftCount, polling 30 dtk)
  → "Restore" → cart diisi ulang (keep pricing tier) → lanjut bayar → order jadi completed
  → "Hapus" (DELETE /api/admin/orders/draft?id=...) bila tidak jadi
```

### 16.2 Alur Owner (apps/owner) — daftar mandiri sampai kelola bisnis

```
Daftar (/register)                        # name, email, password (min 8) → POST /api/auth/owner/register
  → kirim email verifikasi → /check-email (bisa "kirim ulang link", token 1 jam)
  → klik link email → verify-email → set email_verified_at → /login
Login (/login)                            # email+password (harus sudah verifikasi) → cookie owner_session (24 jam)
  → /onboarding (belum punya company) atau /dashboard (sudah punya)
Onboarding (/onboarding) 2 step           # Step 1: company (nama, kode auto-suggest, password)
                                          # Step 2: outlet pertama (nama, alamat)
  → POST /api/onboarding/company → buat company + outlet + seed default tier (Dine In, Take Away)
  → /dashboard
Kelola bisnis
  1. Outlet        → /outlets      (tambah/edit/toggle/hapus; tidak bisa hapus outlet terakhir)
  2. Karyawan      → /employees    (tambah user + PIN + role + akses outlet; reset PIN; toggle; hapus)
  3. Role & Akses  → /employees (tab Role & Akses) — buat role, atur menu per role (register/orders/reports/products/tax-discounts)
  4. Produk        → /products     (list per outlet; kelola kategori & tier via slide-over; form add/edit: gambar, harga per tier, modifier)
  5. Pajak & Diskon→ /tax-discounts(3 tab: pajak / diskon produk / diskon order — tipe % atau fixed, periode, toggle aktif)
  6. Pesanan       → /orders       (filter outlet & waktu, cari nomor, expand item, print invoice)
  7. Laporan       → /reports      (rentang hari ini/kemarin/7 hari/semua + kirim email)
  8. Pengaturan    → /settings     (nama company + password company untuk kasir)
```

### 16.3 Alur Superadmin (apps/superadmin)

```
Login (/login)            # Supabase Auth (email/password) — terpisah dari tenant
Guard layout (protected)  # getUser() → redirect /login bila tidak ada
Kelola platform
  1. Companies  → CRUD tenant (kode, nama, password, status)
  2. Outlets    → CRUD outlet per company
  3. Menus      → CRUD menu sistem (5 menu: Kasir, Pesanan, Laporan, Produk, Pajak & Diskon)
  4. Roles      → CRUD role per company
  5. Access     → matrix role × menu (toggle can_view)
  6. Users      → CRUD user per company (nama, username, role, PIN, status)
  7. Audit Logs → lihat semua percobaan login (event, IP, user agent, alasan gagal)
```

### 16.4 Alur Data Order (backend)

```
RegisterView (client)
  → addProduct() / restoreDraftItem()  → cartStore (Zustand): kalkulasi subtotal, diskon, pajak, total
  → PaymentModal → createOrder()       → POST /api/admin/orders
  → (split) splitPayments[]            → POST /api/admin/orders/split (atau bagian dari payload)
  → Supabase: insert orders + order_items + split_payments (service role, bypass RLS)
  → clear() cart
```

### 16.5 Ringkasan Siklus Auth & Session

| Entitas | Cookie | Umur | Flow |
|---------|--------|------|------|
| Kasir (POS) | `pending_login` | 10 menit | step 1–3 login (company → outlet → akun) |
| Kasir (POS) | `session` | 12 jam | step 4 berhasil (verify-pin); switch-user / logout menghapus |
| Owner | `owner_session` | 24 jam | login owner; onboarding update isi (company_id) |
| Superadmin | Supabase Auth session | sesuai Supabase | login di apps/superadmin |

Semua percobaan login (kasir & owner) dicatat di `auth_audit_logs` via `logAuthEvent()` dengan IP + user agent + failure reason.
