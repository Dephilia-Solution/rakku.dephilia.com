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
16. [V4.1 — Native Printer (Capacitor)](#16-v41--native-printer-capacitor)

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
| **Manajemen Order** | Order completed, draft/pay-later, split bill |
| **Pajak & Diskon** | Pajak multi-tipe (persentase/fixed), diskon produk & order |
| **Laporan** | Summary penjualan dengan grafik, kirim via email |
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
│   │   │   │   ├── pricing-tiers/   # CRUD tier harga
│   │   │   │   ├── taxes/            # CRUD pajak
│   │   │   │   ├── discounts/        # CRUD diskon
│   │   │   │   └── settings/         # Edit profil company + ganti password
│   │   │   ├── login/page.tsx        # Login Owner (email + password)
│   │   │   ├── register/page.tsx     # Daftar Owner baru
│   │   │   ├── check-email/page.tsx  # Prompt verifikasi email
│   │   │   ├── onboarding/page.tsx   # Wizard: buat company + outlet
│   │   │   └── api/
│   │   │       ├── auth/owner/       # login, register, verify-email, resend-verification, session, logout
│   │   │       ├── onboarding/       # GET/POST company (suggest kode/slug + buat company+outlet+seed)
│   │   │       └── owner/            # CRUD: outlets, employees, roles (+access), menus, orders, products,
│   │   │                              #        pricing-tiers, taxes, discounts, settings, reports/send-email
│   │   ├── src/components/
│   │   │   ├── owner/OwnerSidebar.tsx
│   │   │   ├── admin/                # DiscountManager, PricingTierManager, TaxManager
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
│   │   │   │   ├── products/         # CRUD produk + upload gambar
│   │   │   │   ├── categories/       # CRUD kategori
│   │   │   │   ├── pricing-tiers/   # CRUD tier harga
│   │   │   │   ├── taxes/            # CRUD pajak
│   │   │   │   └── discounts/        # CRUD diskon
│   │   │   ├── sw.ts                 # PWA Service Worker (Serwist)
│   │   │   ├── manifest.ts           # PWA Web App Manifest
│   │   │   └── ~offline/page.tsx    # Halaman fallback offline
│   │   │   └── api/
│   │   │       ├── auth/tenant/      # company, outlet, accounts, verify-pin, session, switch-user, logout
│   │   │       ├── admin/            # CRUD: products, categories, modifiers, orders (+draft+split),
│   │   │       │                      #        pricing-options, pricing-tiers, product/modifier-tier-prices,
│   │   │       │                      #        taxes (+active), discounts (+active)
│   │   │       └── reports/          # send-email (Resend)
│   │   ├── src/components/
│   │   │   ├── register/             # RegisterView, ProductGrid, ProductCard, CategoryTabs, OrderSidebar,
│   │   │   │                          # MobileCartBar, PaymentModal, DraftOrdersPanel, InvoiceReceipt,
│   │   │   │                          # ItemDetailModal, SplitBillPanel, PricingOptionSelector
│   │   │   ├── admin/                # DiscountManager, PricingOptionsManager, PricingTierManager, TaxManager
│   │   │   ├── layout/               # AppSidebar (rail), BottomNav, MobileBottomNav, MoreMenuSheet, ResponsiveNav, SideRail, Sidebar
│   │   │   ├── reports/EmailReportModal.tsx
│   │   │   └── ui/ConfirmDialog.tsx
│   │   ├── src/hooks/                # useMediaQuery, useModalHistory, useNavMode, useSwipe
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
│   ├── ui/                           # Badge, EmptyState, QtyControl, Toast + tailwind.preset.ts
│   └── pricing/                      # DEFAULT_TIERS, seedDefaultTiers, syncProductTierPrices
│
├── supabase/
│   ├── migrations/                   # 13 file migrasi (001–014, tanpa 005)
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
│   │   └── 014_owner_self_service.sql # Tabel owners + alter companies (owner_id, slug)
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
- Publik: `/_next`, `/api/auth`, `/favicon`, `/login`, `/register`, `/check-email`
- Proteksi: `/dashboard/*`, `/onboarding` → redirect ke `/login` jika belum auth

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
- **Menu**: Modul sistem (register, orders, reports, products, taxes, discounts)
- **Access Matrix**: Tabel `role_menu_access` — role × menu dengan toggle `can_view`
- **Sidebar**: 100% dinamis — query `getAllowedMenus(roleId)` → render menu

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
| slug | text UNIQUE | register, orders, reports, products, taxes, discounts, pricing-tiers |
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
| `/pricing-tiers` | `app/(dashboard)/pricing-tiers/page.tsx` + `PricingTiersClient.tsx` | CRUD tier harga |
| `/taxes` | `app/(dashboard)/taxes/page.tsx` + `TaxesClient.tsx` | CRUD pajak |
| `/discounts` | `app/(dashboard)/discounts/page.tsx` + `DiscountsClient.tsx` | CRUD diskon |
| `/settings` | `app/(dashboard)/settings/page.tsx` | Edit profil company + ganti password |

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
| `/api/owner/products` | GET | List produk per company |
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
| `/products` | `(dashboard)/products/page.tsx` + `AdminProductsClient.tsx` | Manajemen produk + upload gambar |
| `/categories` | `(dashboard)/categories/page.tsx` + `AdminCategoriesClient.tsx` | Manajemen kategori |
| `/pricing-tiers` | `(dashboard)/pricing-tiers/page.tsx` + `PricingTiersClient.tsx` | Manajemen tier harga |
| `/taxes` | `(dashboard)/taxes/page.tsx` + `TaxesClient.tsx` | Manajemen pajak |
| `/discounts` | `(dashboard)/discounts/page.tsx` + `DiscountsClient.tsx` | Manajemen diskon |

> Setiap halaman `(dashboard)/` punya `loading.tsx` (skeleton) + `error.tsx` boundary.

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

> Di v4.0, komponen **tidak lagi shared di root `components/`**. Setiap app punya `src/components/` sendiri. Komponen UI generik (Badge, Toast, EmptyState, QtyControl) ada di package `@rakku/ui`.

### 9.1 Shared UI Package (`packages/ui/src/`)

| Komponen | File | Deskripsi |
|----------|------|-----------|
| **Badge** | `Badge.tsx` | Status badge (active/inactive/warning) |
| **EmptyState** | `EmptyState.tsx` | Placeholder konten kosong |
| **QtyControl** | `QtyControl.tsx` | Increment/decrement quantity |
| **Toast** | `Toast.tsx` | Notifikasi toast (success/error/info) + `ToastContainer` |
| **rakkuPreset** | `tailwind.preset.ts` | Tailwind preset dibagikan ke semua app |

### 9.2 Layout (per app)

**apps/pos — `src/components/layout/`**

| Komponen | Deskripsi |
|----------|-----------|
| **AppSidebar** | Rail icon 64px — menu dinamis dari role_menu_access, badge cart, switch-user, logout |
| **ResponsiveNav** | Wrapper responsive — AppSidebar (desktop) + BottomNav/MobileBottomNav (mobile) + MoreMenuSheet |
| **BottomNav / MobileBottomNav** | Bottom navigation mobile dengan badge cart |
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

### 9.4 Admin (per app) — `src/components/admin/`

| Komponen | Dipakai di | Deskripsi |
|----------|-----------|-----------|
| **PricingTierManager** | pos, owner | CRUD pricing tiers |
| **TaxManager** | pos, owner | CRUD pajak (percentage/fixed) |
| **DiscountManager** | pos, owner | CRUD diskon (produk & order) |
| **PricingOptionsManager** | pos | CRUD pricing options per produk |

> `apps/owner` juga punya `src/components/reports/EmailReportModal.tsx`. `apps/pos` punya `src/components/reports/EmailReportModal.tsx` sendiri.

### 9.5 Owner Sidebar — `apps/owner/src/components/owner/OwnerSidebar.tsx`

Sidebar statis (bukan dari DB) untuk dashboard Owner. Menu:
Dashboard, Laporan, Pesanan, Outlet, Karyawan, Pricing Tiers, Tax, Diskon, Pengaturan, + link eksternal "Login Kasir" ke `NEXT_PUBLIC_POS_URL`.

### 9.6 Hooks (per app — identik di owner & pos)

| Hook | File | Deskripsi |
|------|------|-----------|
| **useMediaQuery** | `src/hooks/useMediaQuery.ts` | Breakpoints: `isMobile`, `isTablet`, `isDesktop` |
| **useSwipe** | `src/hooks/useSwipe.ts` | Deteksi gesture swipe touch |
| **useNavMode** | `src/hooks/useNavMode.ts` | Mode navigasi aktif (rail/bottom/more) |
| **useModalHistory** | `src/hooks/useModalHistory.ts` | Back-button trap untuk modal/sheet |

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

13 file migrasi di `supabase/migrations/` (tidak ada 005). Dijalankan berurutan via Supabase SQL Editor atau runner `scripts/run-migration.ts`:

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
- **Skema database tidak berubah** — Semua migrations 001-014 tetap utuh.
- **Akun testing existing tetap valid** — `budi@rakku.test`/`budi12345`, `ali@rakku.test`/`ali12345`, company RAKKU/TOKOKO.

---

## 16. V4.1 — Native Printer (Capacitor)

> **Mulai:** v4.1 — menambah **native Android shell (Capacitor)** yang membungkus WebView berisi `apps/pos` yang sama persis (live URL, bukan rewrite), ditambah plugin Bluetooth Classic SPP untuk connect ke printer thermal mobile. Kode React/Next.js yang sama tetap jalan di browser biasa (`pos.rakku.com`) DAN di dalam shell native Android. Web PWA existing **tidak berubah perilaku**.
>
> **Prinsip:** satu codebase, dua target. Deteksi platform via `Capacitor.isNativePlatform()` (runtime check), bukan build-time flag. Android 8 (API 26) adalah target uji wajib di setiap fase.
>
> **Roadmap 6 fase** (detail di `PROMPT_RAKKU_POS_NATIVE_PRINTER.md` Bagian 7):
> - Fase 1 — Setup Capacitor Shell ✅
> - Fase 2 — Plugin Bluetooth SPP + Bridge Layer ⬜
> - Fase 3 — ESC/POS Builder ⬜
> - Fase 4 — Halaman `/settings/printer` ⬜
> - Fase 5 — Integrasi ke `InvoiceReceipt.tsx` ⬜
> - Fase 6 — Build Release & Distribusi Internal ⬜

### 16.1 Fase 1 — Setup Capacitor Shell

**Status:** ✅ Selesai (kode). ⬜ Test emulator Android 8 manual.

**Tujuan:** `apps/pos` bisa di-build jadi APK Android native (via Capacitor 7) tanpa mengubah kode web. Login kasir 4-step & register/checkout tetap normal. Print masih pakai `window.open()` lama (belum ada perubahan).

#### Keputusan Konfigurasi

| Item | Nilai | Catatan |
|---|---|---|
| Capacitor versi | `^7.0.0` (terpasang 7.6.7) | Dukungan Android terbaik |
| `appId` | `com.rakku.pos` | Reverse-domain |
| `appName` | `Rakku POS` | |
| `webDir` | `public` | Asset web di-copy ke `android/app/src/main/assets/public/` |
| `server.url` | `https://pos-rakku.vercel.app` | **Live URL mode** — bukan static export. Backend Next.js (Server Actions, API routes, auth cookie) tetap berjalan dari server |
| `server.cleartext` | `false` | HTTPS only. `true` hanya untuk dev lokal |
| `minSdkVersion` | `26` (Android 8.0) | Target uji wajib. Default Cap 7 adalah 23, dinaikkan ke 26 untuk samakan dengan `browserslist: ["Android >= 8"]` |
| `compileSdk`/`targetSdk` | `35` (default Cap 7) | Tidak diubah |

**Plugin Bluetooth SPP belum dipasang di Fase 1** — itu Fase 2. `AndroidManifest.xml` saat ini hanya punya permission `INTERNET` (default Capacitor).

#### File Dibuat/Diubah

| Path | Status | Keterangan |
|---|---|---|
| `apps/pos/package.json` | MODIFIED | +`@capacitor/core@^7`, `@capacitor/android@^7` (deps); +`@capacitor/cli@^7` (dev); +scripts `cap:sync`, `cap:open`, `cap:run:android` |
| `apps/pos/capacitor.config.ts` | NEW | Config Capacitor (appId, appName, webDir, server.url, server.cleartext) |
| `apps/pos/android/**` | NEW | Project Android native generated `npx cap add android` (Cap 7.6.7) — berisi Gradle, `AndroidManifest.xml`, `MainActivity`, resource ikon |
| `apps/pos/android/variables.gradle` | MODIFIED | `minSdkVersion = 26` (dari default 23) |
| `apps/pos/.gitignore` | MODIFIED | +ignore artifact build Gradle, `local.properties`, `.idea/`, `*.keystore`, `*.jks`. Folder `android/` source-nya **di-commit**, hanya artifact & keystore yang di-ignore |
| `DOCS.md` | MODIFIED | +Bagian 16 + sub-bagian 16.1 |

#### Verifikasi Kode (otomatis, sudah dijalankan)

- [x] `pnpm install` sukses — 62 package ditambah, Capacitor CLI 7.6.7 terpasang
- [x] `npx cap add android` sukses — folder `android/` ter-generate
- [x] `npx cap sync android` sukses — web assets ter-copy ke `android/app/src/main/assets/public/`
- [x] `pnpm --filter @rakku/pos lint` → ✔ No ESLint warnings or errors
- [x] `pnpm --filter @rakku/pos build` → ✓ Compiled successfully, 42 route ter-generate identik v4.0, plugin `DownlevelSerwistSW` tetap jalan (down-level 3 asset ke es2017 untuk WebView Android lawas)

#### Verifikasi Emulator (manual, belum dijalankan)

- [ ] `npx cap open android` → Android Studio → build APK debug
- [ ] Install & jalankan di **emulator Android 8 (API 26)** — target wajib:
  - [ ] App terbuka **tanpa force-close**
  - [ ] Login kasir 4-step berhasil (company → outlet → user → PIN)
  - [ ] Cookie `session`/`pending_login` persist setelah login (must-test utama — cookie `SameSite=Lax; HttpOnly` tanpa `Secure` eksplisit, seharusnya aman untuk HTTPS live URL)
  - [ ] Register/checkout normal
  - [ ] Print masih pakai `window.open()` lama (belum ada perubahan)
- [ ] Pembanding: jalankan juga di emulator Android 12+ — baseline OK
- [ ] Browser biasa ke `pos-rakku.vercel.app` tetap berperilaku identik v4.0

> **Risiko utama Fase 1:** cookie session di WebView. Jika session tidak persist setelah login di WebView Capacitor, investigasi di level cookie-setting existing (`apps/pos/src/lib/auth/tenant-session.ts` — flag `SameSite`/`Secure`), **bukan** workaround di sisi Capacitor.

#### Cara Build & Test APK

```bash
# dari apps/pos
pnpm --filter @rakku/pos build          # build web (sekali, untuk copy asset)
npx cap sync android                     # sync web assets + plugin ke android/
npx cap open android                     # buka Android Studio → Build > Build APK
# atau CLI langsung:
npx cap run android                      # build + install ke device/emulator aktif
```

#### Override `server.url` untuk Dev Lokal

Config utama commit ke production (`https://pos-rakku.vercel.app`). Untuk testing terhadap `pnpm dev:pos` lokal di emulator Android:

1. Edit `apps/pos/capacitor.config.ts` **sementara** (jangan commit):
   ```ts
   server: {
     url: "http://10.0.2.2:3001",   // 10.0.2.2 = alias host loopback dari Android emulator
     cleartext: true,               // wajib true untuk HTTP cleartext
   },
   ```
2. `npx cap sync android` → `npx cap run android`
3. Setelah test, **revert** config ke production sebelum commit.

`10.0.2.2` adalah alias khusus Android emulator ke `localhost` mesin host — bukan IP sungguhan.

### 16.2 Fase 2 — Plugin Bluetooth SPP + Bridge Layer

**Status:** ✅ Kode selesai. ⬜ Test printer fisik & Android 8 manual (besok).

**Tujuan:** Install plugin Bluetooth Classic SPP, tambah permission Android, buat bridge layer JS→native (`bluetooth-bridge.ts`) yang wrap API plugin dengan guard `isNative()` supaya web browser tidak crash.

#### Plugin Terpilih: `capacitor-thermal-printer@^0.2.5`

**Alasan pemilihan** (vs alternatif yang diriset):

| Plugin | Maintained | Cap 7 | SPP? | ESC/POS builder | Verdict |
|---|---|---|---|---|---|
| `cordova-plugin-bluetooth-serial` 0.4.7 | ❌ 2017 | ❌ Cordova | ✅ Classic | ❌ raw write only | Terlalu lama, butuh adapter |
| `capacitor-bluetooth-serial` 0.0.4 | ❌ 2020 | ❌ Cap 3 | ✅ Classic | ❌ tidak ada `write` | Tidak lengkap, tidak maintained |
| `@capacitor-community/bluetooth-le` | ✅ | ✅ | ❌ BLE only | ❌ | Bukan SPP — tidak cocok |
| **`capacitor-thermal-printer` 0.2.5** | ✅ Feb 2025 | ✅ peerDep ^7 | ✅ Classic (RTPrinter SDK Rongta, connect by MAC) | ✅ chainable built-in | **PILIHAN** |

**Repo:** https://github.com/Malik12tree/capacitor-thermal-printer (31 stars, 12 forks, 54 commits, MIT)

**API native yang dipakai** (dari `src/definitions.ts` plugin):
- Connectivity: `startScan()`, `stopScan()`, `connect({address})` → `BluetoothDevice | null`, `disconnect()`, `isConnected()`
- Listeners: `discoverDevices` (real-time saat scan), `discoveryFinish`, `connected`, `disconnected`
- Content: `text(str)`, `raw(bytes)`, `image(data)`, `qr(data)`, `barcode(type, data)`
- Formatting: `align(left|center|right)`, `bold()`, `underline()`, `doubleWidth/Height()`, `font(A|B)`, `clearFormatting()`
- Actions: `cutPaper(half?)`, `feedCutPaper(half?)`, `beep()`, `openDrawer()`, `selfTest()`
- Print: `begin()` (reset queue), `write()` (kirim ke printer)

**Catatan penting soal SPP:**
- Plugin pakai **RTPrinter SDK Rongta Technology** (proprietary, dibundle `.so` native di APK) — implisit Classic SPP karena printer Rongta = SPP, `connect` by MAC address, Android scan filter "only printers discovered" (behavior Classic discovery).
- Plugin **tidak punya `listPairedDevices()`** — hanya `startScan()` (discover device baru + in-range). Workaround: "Cari printer" di halaman settings pakai `startScan()` + tampilkan hasil `discoverDevices`. Auto-reconnect dari MAC tersimpan di `localStorage`.
- **Printer compatibility must-test**: plugin dioptimalkan untuk printer Rongta. Printer existing (kelas EPPOS/Xprinter/Goojprt) kemungkinan compatible (semua support ESC/POS standard), tapi **must-test fisik**. Fallback kalau tidak: kirim raw ESC/POS bytes via `.raw(bytes)` (bypass RTPrinter encoder).

#### Permission Android

`apps/pos/android/app/src/main/AndroidManifest.xml` ditambah manual (plugin hanya declare `BLUETOOTH_CONNECT`, sisanya manual karena plugin tidak lengkap):

```xml
<!-- Bluetooth Classic SPP — for thermal printer connection -->
<!-- Android <= 11 (API <= 30) -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<!-- Android 12+ (API 31+) — runtime permission required -->
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<!-- Bluetooth discovery still requires location on some Android versions -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
```

`BLUETOOTH_SCAN` pakai `neverForLocation` karena app tidak pakai lokasi dari scan Bluetooth — hanya untuk connect printer. `ACCESS_FINE_LOCATION` dibatasi `maxSdkVersion=30` karena Android 12+ sudah tidak wajib untuk Bluetooth.

> **Runtime permission Android 12+** (API 31+) akan di-handle di Fase 4 (halaman settings) via dialog native — saat pengguna pertama kali tekan "Cari printer", app request izin `BLUETOOTH_CONNECT` + `BLUETOOTH_SCAN` sebelum `startScan()`.

#### File Dibuat/Diubah

| Path | Status | Keterangan |
|---|---|---|
| `apps/pos/package.json` | MODIFIED | +`capacitor-thermal-printer@^0.2.5` ke dependencies |
| `apps/pos/src/lib/printer/types.ts` | NEW | `PrinterDevice`, `ConnectionStatus`, `Unsubscribe`, `PrinterNotAvailableError`, `PaperWidth`, storage key constants |
| `apps/pos/src/lib/printer/capacitor-platform.ts` | NEW | `isNative()` + `getPlatform()` — wrap `Capacitor.isNativePlatform()` + `Capacitor.getPlatform()`. Satu-satunya tempat pengecekan native vs web |
| `apps/pos/src/lib/printer/bluetooth-bridge.ts` | NEW | Wrapper di atas `CapacitorThermalPrinter`: scan, connect, disconnect, isConnected, write(bytes), writeText(str), onConnectionChange, autoReconnect, getSavedDevice, saveDevice, clearSavedDevice. Semua guard `isNative()` di awal |
| `apps/pos/android/app/src/main/AndroidManifest.xml` | MODIFIED | +permission Bluetooth (BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_CONNECT, BLUETOOTH_SCAN, ACCESS_FINE_LOCATION) |
| `pnpm-lock.yaml` | MODIFIED | lockfile update |
| `DOCS.md` | MODIFIED | +Bagian 16.2 lengkap |

#### API `bluetooth-bridge.ts` (Fungsi Exposed)

Semua fungsi selain `getSavedDevice`/`saveDevice`/`clearSavedDevice`/`onConnectionChange` melempar `PrinterNotAvailableError` jika dipanggil di web browser — UI wajib tangani dengan sembunyikan fitur, bukan crash.

| Fungsi | Return | Keterangan |
|---|---|---|
| `scanDevices(onDevices)` | `Promise<Unsubscribe>` | Mulai `startScan()`, callback real-time per device ditemukan. Return unsubscribe untuk stop scan + listener |
| `stopScan()` | `Promise<void>` | Stop scan manual |
| `connect(address)` | `Promise<PrinterDevice \| null>` | Connect ke MAC. Simpan device ke localStorage. Return null kalau gagal |
| `disconnect()` | `Promise<void>` | Putus koneksi |
| `isConnected()` | `Promise<boolean>` | Cek status koneksi |
| `write(bytes: Uint8Array)` | `Promise<void>` | Kirim raw bytes via `.raw(bytes).write()` — untuk ESC/POS command |
| `writeText(text)` | `Promise<void>` | Kirim teks via `.text(str).write()` — convenience untuk test print |
| `onConnectionChange(onConnected, onDisconnected)` | `Unsubscribe` | Listener `connected` + `disconnected` dari plugin. Return unsubscribe |
| `autoReconnect()` | `Promise<boolean>` | Baca MAC dari localStorage, connect ulang kalau ada. Dipanggil saat halaman register/orders dibuka |
| `getSavedDevice()` | `PrinterDevice \| null` | Baca dari localStorage key `rakku_pos_printer_device` |
| `saveDevice(device)` | `void` | Simpan ke localStorage |
| `clearSavedDevice()` | `void` | Hapus dari localStorage |

**Storage keys** (di `types.ts`):
- `rakku_pos_printer_device` — `{ name, address }` printer default
- `rakku_pos_printer_paper_width` — lebar kertas (58 | 80), dipakai Fase 3

#### Verifikasi Kode (otomatis, sudah dijalankan)

- [x] `pnpm install` sukses — plugin `capacitor-thermal-printer@0.2.5` terpasang
- [x] `npx cap sync android` sukses — plugin terdeteksi ("Found 1 Capacitor plugin for android: capacitor-thermal-printer@0.2.5") + ter-copy ke `android/`
- [x] `pnpm --filter @rakku/pos lint` → ✔ No ESLint warnings or errors
- [x] `pnpm --filter @rakku/pos build` → ✓ Compiled successfully, 42 route identik v4.0, `DownlevelSerwistSW` tetap jalan. Tidak ada file yang import `lib/printer/*` saat ini → tree-shaking pasti tidak masuk web bundle.

#### Verifikasi Printer Fisik (manual, besok)

> **Wajib device fisik** — emulator Android tidak mengemulasikan Bluetooth Classic SPP.

- [ ] Build APK debug: `cd apps/pos && npx cap sync android && npx cap run android` (colok device fisik Android, pastikan USB debugging aktif)
- [ ] Buka app Rakku POS di device → login 4-step normal
- [ ] **Test dari console sementara** (atau halaman debug Fase 4 nanti): panggil `scanDevices()` → verifikasi printer thermal existing muncul di `discoverDevices`
- [ ] `connect(mac)` → `isConnected()` return true
- [ ] `write(new Uint8Array([0x1B, 0x40]))` (ESC @ — init printer) → printer tidak error
- [ ] `write(new TextEncoder().encode("Test print\n\n"))` atau `writeText("Test print\n\n")` → printer mencetak teks
- [ ] `disconnect()` → `isConnected()` return false
- [ ] **Risk check 1 (SPP verification)**: konfirmasi Android pakai Classic SPP (bukan BLE) — printer thermal mobile murah = SPP, harus connect. Kalau gagal connect → cek Logcat tag `Bluetooth` untuk tahu apakah plugin pakai BLE atau SPP
- [ ] **Risk check 2 (printer compatibility)**: kalau printer existing tidak terdeteksi di scan → cek apakah printer sudah paired di Android Settings Bluetooth. Kalau sudah paired tapi tidak muncul → plugin mungkin filter terlalu ketat → pertimbangkan `.raw()` fallback atau custom plugin

#### Yang TIDAK Dibuat di Fase 2 (fokus tugas utama)

- ❌ `escpos-builder.ts` — itu Fase 3
- ❌ `printer-store.ts` (Zustand) — itu Fase 4
- ❌ Halaman `/settings/printer` + runtime permission dialog — itu Fase 4
- ❌ Integrasi `InvoiceReceipt.tsx` — itu Fase 5
- ❌ Tidak sentuh komponen/route/API/logic bisnis existing — bridge layer belum diimport di mana pun

### 16.3 Fase 3 — ESC/POS Builder

**Status:** ✅ Kode selesai. ⬜ Test cetak struk contoh ke printer fisik (besok, paralel Fase 1+2).

**Tujuan:** Generate raw ESC/POS command bytes (`Uint8Array`) dari data struk — bukan string biasa, karena printer thermal butuh command bytes untuk formatting (bold, align, cut kertas). Builder mandiri, tidak bergantung pada chainable API plugin — hanya butuh `bridge.write(bytes)`. Output layout match `InvoiceReceipt.tsx` supaya struk native & web render identik.

#### File Dibuat/Diubah

| Path | Status | Keterangan |
|---|---|---|
| `apps/pos/src/lib/printer/types.ts` | MODIFIED | +`ReceiptItem` interface, +`ReceiptData` interface (match `InvoiceReceiptProps` minus `onClose`), import `AppliedTax`/`AppliedDiscount` dari `@rakku/shared-types` |
| `apps/pos/src/lib/printer/escpos-builder.ts` | NEW | Generator raw ESC/POS bytes: internal `EscPosBuffer` class + `buildTestReceipt()` + `buildOrderReceipt(data)` + `getPaperWidth()`/`getCharWidth()` helper |
| `DOCS.md` | MODIFIED | +Bagian 16.3 lengkap |

#### ESC/POS Commands yang Dipakai

| Command | Bytes | Fungsi |
|---|---|---|
| Initialize | `ESC @` (0x1B 0x40) | Reset printer ke state default |
| Align | `ESC a n` (0x1B 0x61) | n=0 left, 1 center, 2 right |
| Bold | `ESC E n` (0x1B 0x45) | n=1 on, 0 off |
| Double height | `ESC ! n` (0x1B 0x21) | n=0x10 on, 0x00 off (untuk baris Total) |
| Text | `TextEncoder` UTF-8 | Encode string ke bytes |
| Line feed | `LF` (0x0A) | Newline × n |
| Divider | `-` × charWidth | Garis pemisah, 32 chars (58mm) / 48 chars (80mm) |
| Cut paper | `GS V m` (0x1D 0x56) | m=0 full cut, 1 half cut. No-op aman kalau printer tidak support auto-cutter |

> **Catatan encoding:** `TextEncoder` UTF-8. Mayoritas printer thermal support UTF-8. Kalau printer setting code page berbeda → teks garble saat test fisik → solusi: tambah command `ESC t n` (set code page) di awal `buildTestReceipt`. Must-test fisik besok.
>
> **Catatan auto-cutter:** banyak printer mobile murah (kelas EPPOS/Xprinter/Goojprt) tidak punya auto-cutter. `GS V m` = no-op aman, kasir potong manual. `feedAndCut()` sebelum cut kirim 3 line feed supaya kertas keluar dari printer.

#### Paper Width Config

| Lebar | Char width (font A) | Default | Storage key |
|---|---|---|---|
| 58mm | 32 chars | ✅ | `rakku_pos_printer_paper_width` |
| 80mm | 48 chars | | |

`getPaperWidth()` baca dari localStorage, default 58. `getCharWidth()` return 32 atau 48. Dipakai untuk `divider()` dan `twoColumns()`.

#### Layout Struk (match `InvoiceReceipt.tsx`)

`buildOrderReceipt(data)` generate urutan:

1. **Header** (center, bold): "RAKKU" + "Invoice #N"
2. **Divider**
3. **Info** (left, two-column): Tanggal, Customer, Kasir (kalau ada), Tipe, Pembayaran
4. **Divider**
5. **Items** (per item):
   - `product_name` (bold) + newline
   - `qty x price  subtotal` (two-column) + newline
   - `Catatan: note` (kalau ada) + newline
6. **Divider**
7. **Totals** (two-column): Subtotal, Discounts (-), Taxes, Uang Tunai, Kembalian
8. **Divider**
9. **Total** (bold, doubleHeight, two-column)
10. **Divider**
11. **Footer** (center): "Terima kasih atas kunjungan Anda"
12. **Feed + cut paper**

`buildTestReceipt()` generate struk contoh statis dengan layout sama (2 item dummy + PB1 11% + total) untuk verifikasi koneksi printer tanpa data order asli.

#### API `escpos-builder.ts` (Fungsi Exported)

| Fungsi | Return | Keterangan |
|---|---|---|
| `buildTestReceipt()` | `Uint8Array` | Struk contoh statis untuk test print |
| `buildOrderReceipt(data: ReceiptData)` | `Uint8Array` | Struk asli dari data order, layout match `InvoiceReceipt.tsx` |
| `getPaperWidth()` | `PaperWidth` (58 \| 80) | Baca dari localStorage, default 58 |
| `getCharWidth()` | `number` (32 \| 48) | Char per line sesuai paper width |

#### Verifikasi Kode (otomatis, sudah dijalankan)

- [x] `pnpm --filter @rakku/pos lint` → ✔ No ESLint warnings or errors (setelah hapus 3 unused vars: `padEnd`, `padStart`, `width`)
- [x] `pnpm --filter @rakku/pos build` → ✓ Compiled successfully, 42 route identik v4.0. Builder belum diimport UI mana pun → tidak masuk web bundle (tree-shaking).

#### Verifikasi Cetak Fisik (manual, besok)

- [ ] Build APK debug (colok device fisik, `npx cap sync android && npx cap run android`)
- [ ] Dari console sementara / halaman debug Fase 4 nanti:
  ```ts
  import { buildTestReceipt } from "@/lib/printer/escpos-builder";
  import { write } from "@/lib/printer/bluetooth-bridge";
  await write(buildTestReceipt());
  ```
- [ ] Verifikasi format cetak rapi: header center bold, divider garis, item two-column alignment, total bold double-height, cut paper
- [ ] **Risk check 1 (encoding)**: kalau teks non-ASCII garble (mis. "Rp" atau tanggal Indonesia) → tambah `ESC t n` command untuk set code page UTF-8 di awal builder. Catat di DOCS.
- [ ] **Risk check 2 (auto-cutter)**: kalau cut paper tidak jalan → printer tidak support auto-cutter (no-op aman, kasir potong manual). Catat di DOCS.
- [ ] **Risk check 3 (char width)**: kalau text kepotong di 58mm → coba switch ke 80mm via localStorage, atau adjust font. Catat di DOCS.

#### Yang TIDAK Dibuat di Fase 3 (fokus tugas utama)

- ❌ Halaman `/settings/printer` — Fase 4
- ❌ `printer-store.ts` (Zustand) — Fase 4
- ❌ Integrasi `InvoiceReceipt.tsx` / `InvoicePageClient.tsx` — Fase 5
- ❌ Tidak sentuh komponen/route/API/logic bisnis existing — builder belum diimport UI mana pun

### 16.4 Fase 4 — Halaman `/settings/printer`

**Status:** ✅ Kode selesai. ⬜ Test end-to-end di Android 8 + printer fisik (besok, paralel Fase 1-3).

**Tujuan:** Halaman baru `/settings/printer` untuk kasir kelola koneksi printer thermal: lihat status koneksi real-time, scan/pilih device Bluetooth, test print, atur lebar kertas, lihat diagnostik. Di web browser, tampilkan banner jelas bahwa fitur ini hanya untuk aplikasi Android — tanpa tombol yang akan error.

#### File Dibuat/Diubah

| Path | Status | Keterangan |
|---|---|---|
| `apps/pos/src/lib/printer/printer-store.ts` | NEW | Zustand store: `status` (connected/disconnected/scanning), `savedDevice`, `devices`, `paperWidth`, `logs` (max 10 entry). Actions: init, setStatus, setSavedDevice, setDevices, addDevice, clearDevices, setPaperWidth, addLog, clearLogs |
| `apps/pos/src/app/(dashboard)/settings/printer/page.tsx` | NEW | Server component shell — render `PrinterSettingsClient` (guard auth via layout `(dashboard)/layout.tsx` existing) |
| `apps/pos/src/app/(dashboard)/settings/printer/PrinterSettingsClient.tsx` | NEW | Client component — UI lengkap halaman printer settings (banner non-native, status badge, scan device list, connect/disconnect, test print, paper width toggle, diagnostik panel) |
| `apps/pos/src/app/(dashboard)/settings/printer/loading.tsx` | NEW | Skeleton loading state (match pola loading.tsx halaman dashboard lain) |
| `apps/pos/middleware.ts` | MODIFIED | `dashboardPaths` array +`"/settings"` (sebelumnya: register, orders, reports, products, categories, pricing-tiers, taxes, discounts) |
| `apps/pos/src/components/layout/AppSidebar.tsx` | MODIFIED | +link "Printer" (icon `Printer` lucide) di footer statis sebelum switch-user. Active state via `isActive("/settings/printer", pathname)` |
| `apps/pos/src/components/layout/SideRail.tsx` | MODIFIED | +link "Printer" (icon `Printer`) di footer statis sebelum switch-user |
| `apps/pos/src/components/layout/MoreMenuSheet.tsx` | MODIFIED | +link "Pengaturan Printer" (icon `Printer`) di section footer sebelum "Ganti User" |
| `DOCS.md` | MODIFIED | +Bagian 16.4 lengkap |

#### UI Halaman `PrinterSettingsClient.tsx`

**1. Banner kondisi non-native (web browser):**
- Cek `isNative()` di mount. Kalau `false` → tampilkan card amber dengan icon `Smartphone`, pesan: "Fitur ini hanya tersedia di aplikasi Android Rakku POS, bukan dari browser." + info platform terdeteksi.
- Tidak ada tombol scan/connect/test print yang bisa error — semua disembunyikan.

**2. Status koneksi (badge real-time):**
- "Terhubung" (hijau, icon `Wifi`) — kalau `status === 'connected'`
- "Mencari..." (kuning, icon `Loader2` spin) — kalau scanning
- "Terputus" (abu, icon `WifiOff`) — default

**3. Kartu printer default (kalau ada `savedDevice`):**
- Tampilkan nama + MAC address printer tersimpan di localStorage
- Tombol "Putus" (kalau connected) / "Sambungkan" (kalau disconnected)
- Tombol hapus (icon `Trash2`) — forget device dari memori

**4. Cari Printer Bluetooth:**
- Tombol "Cari Printer" → `scanDevices(callback)` dari bridge. Scan berjalan 12 detik lalu auto-stop.
- List device ditemukan (real-time via `discoverDevices` listener): nama + MAC + tombol "Hubungkan"
- Device yang sedang connected ditandai "Aktif" (icon `CheckCircle2` hijau)
- Empty state: instruksi pastikan printer paired di Android Settings Bluetooth
- Catatan: plugin `capacitor-thermal-printer` tidak punya `listPairedDevices()` — pakai `startScan()` (discover device in-range, termasuk yang sudah paired)

**5. Test Print:**
- Tombol "Test Print" → `buildTestReceipt()` + `write(bytes)`. Disabled kalau `status !== 'connected'`.
- Feedback state: idle / "Mengirim..." (spinner) / "Berhasil" (check, 3 detik) / "Gagal" (X, 5 detik + pesan error spesifik)
- Error message bedakan: "Printer belum terhubung" vs error kirim data

**6. Lebar Kertas:**
- Toggle 58mm / 80mm → `setPaperWidth(width)` (simpan ke localStorage `rakku_pos_printer_paper_width`)
- Default 58mm. Dipakai `escpos-builder.ts` untuk char width (32/48).

**7. Diagnostik:**
- Grid 2 kolom: Platform (`getPlatform()`), Status Koneksi
- Log koneksi terakhir (max 10 entry dari `printer-store`): timestamp + event tag `[connect]/[disconnect]/[error]/[scan]/[print]` + message. Color-coded: error=merah, connect=hijau, disconnect=amber.
- Tombol "Bersihkan log"

#### Navigasi (link ke halaman printer)

Menu DB-driven (`menus` + `role_menu_access`) **tidak diubah** — link printer ditambah sebagai **entry statis** di footer navigasi (sama seperti "Ganti User" & "Keluar" yang sudah ada), bukan menu yang butuh RBAC. Alasan: printer settings adalah konfigurasi device lokal, semua role kasir butuh akses, tidak perlu per-role toggle.

| Komponen | Posisi | Icon |
|---|---|---|
| `AppSidebar` (desktop rail) | Footer statis, sebelum "Ganti User" | `Printer` |
| `SideRail` (tablet) | Footer statis, sebelum "Ganti User" | `Printer` |
| `MoreMenuSheet` (mobile) | Section footer, sebelum "Ganti User" | `Printer` |

#### `printer-store.ts` (Zustand)

State management untuk halaman printer. Tidak shared ke seluruh app — lokal di halaman settings.

| State | Tipe | Keterangan |
|---|---|---|
| `status` | `ConnectionStatus` | connected/disconnected/scanning |
| `savedDevice` | `PrinterDevice \| null` | Dari localStorage, di-load saat `init()` |
| `devices` | `PrinterDevice[]` | Hasil scan terakhir |
| `paperWidth` | `PaperWidth` (58 \| 80) | Dari localStorage |
| `logs` | `LogEntry[]` (max 10) | `{ id, time, event, message }` |
| `initialized` | `boolean` | Guard `init()` hanya jalan sekali |

`init()` baca localStorage untuk `savedDevice` + `paperWidth`. Dipanggil di `useEffect` mount `PrinterSettingsClient`.

#### Verifikasi Kode (otomatis, sudah dijalankan)

- [x] `pnpm --filter @rakku/pos lint` → ✔ No ESLint warnings or errors (setelah hapus 4 unused: `RefreshCw`, `PrinterNotAvailableError`, `initialized`, `setDevices` + fix 1 exhaustive-deps warning)
- [x] `pnpm --filter @rakku/pos build` → ✓ Compiled successfully. **43 route** (sebelumnya 42, +1 `/settings/printer`). Route baru: `ƒ /settings/printer` 11.7 kB, First Load 103 kB. `DownlevelSerwistSW` tetap jalan.
- [x] Web PWA tidak ada regresi: banner non-native tampil di browser, tidak ada tombol error

#### Verifikasi End-to-End (manual, besok)

- [ ] Build APK debug (colok device fisik Android, `npx cap sync android && npx cap run android`)
- [ ] Buka halaman `/settings/printer` dari sidebar/bottom-nav (icon Printer)
- [ ] **Banner non-native tidak tampil** di shell native Android (harusnya tampil UI lengkap)
- [ ] **Scan printer**: tekan "Cari Printer" → printer thermal existing muncul di list (kalau sudah paired di Android Settings)
- [ ] **Connect**: pilih device → status berubah "Terhubung" (hijau) → device tersimpan sebagai default
- [ ] **Test print**: tekan "Test Print" → struk contoh tercetak rapi (header center, divider, item, total bold, cut paper)
- [ ] **Paper width**: toggle 80mm → test print ulang → layout lebih lebar
- [ ] **Disconnect**: tekan "Putus" → status "Terputus"
- [ ] **Reconnect**: buka halaman lagi / restart app → auto-reconnect ke printer tersimpan
- [ ] **Forget device**: tekan hapus → printer default dihapus dari memori
- [ ] **Diagnostik**: log koneksi terakhir tampil dengan timestamp + event tag
- [ ] **Web browser**: buka `pos-rakku.vercel.app/settings/printer` → banner amber "Fitur ini hanya tersedia di aplikasi Android" tampil, tidak ada tombol error
- [ ] **Runtime permission Android 12+**: saat pertama scan, dialog permintaan izin `BLUETOOTH_CONNECT` + `BLUETOOTH_SCAN` muncul. Kalau ditolak → tampilkan pesan jelas, tidak crash.

#### Yang TIDAK Dibuat di Fase 4 (fokus tugas utama)

- ❌ Integrasi `InvoiceReceipt.tsx` / `InvoicePageClient.tsx` — Fase 5
- ❌ Tidak sentuh logic bisnis (cart, pricing, tax/discount, RBAC, 4-step login, checkout)
- ❌ Tidak ubah `next.config.mjs` / Serwist
- ❌ Tidak ubah skema DB / menu RBAC (link printer = statis di footer nav, bukan menu DB)

### 16.5 Fase 5 — Integrasi ke Flow Checkout (`InvoiceReceipt.tsx`)

**Status:** ✅ Kode selesai. ⬜ Test transaksi asli + cetak struk ke printer fisik (besok, paralel Fase 1-4).

**Tujuan:** Tombol "Print" di `InvoiceReceipt.tsx` (post-payment) dan `InvoicePageClient.tsx` (halaman invoice dari DB) sekarang punya cabang native: kalau di shell Android + printer terhubung → cetak langsung ke printer thermal via Bluetooth SPP. Kalau di web browser → `window.open()` lama, **tidak ada perubahan perilaku**. Kalau native tapi printer belum terhubung → arahkan user ke `/settings/printer` dengan pesan jelas, tidak silent fail.

**Prinsip** (prompt Bagian 9): "perubahan ke `InvoiceReceipt.tsx` di Fase 5 hanya menambah cabang native print, alur pembayaran & perhitungan tidak boleh tersentuh." → Hanya `handlePrint` + UI feedback tombol yang diubah. Layout struk, perhitungan total, props, flow checkout — tidak berubah.

#### File Dibuat/Diubah

| Path | Status | Keterangan |
|---|---|---|
| `apps/pos/src/lib/printer/receipt-mappers.ts` | NEW | Helper `orderToReceiptData(order)` — mapping `OrderData` (DB shape: `order_items`, `total_price`, `created_at`, dst) → `ReceiptData` (builder shape). Pakai `formatDate` untuk `created_at`. Dipakai `InvoicePageClient.tsx` |
| `apps/pos/src/components/register/InvoiceReceipt.tsx` | MODIFIED | +import bridge/builder/types. `handlePrint` jadi async dengan cabang: web → `window.open()` lama; native → cek saved device + connected → `buildOrderReceipt()` + `write()`. +state `printState` (idle/sending/success/error) + UI tombol feedback (icon + warna + pesan error). Dipanggil di `PaymentModal.tsx:228` (post-payment) |
| `apps/pos/src/app/(dashboard)/orders/[id]/invoice/InvoicePageClient.tsx` | MODIFIED | Sama: +import bridge/builder/mapper. `handlePrint` cabang native/web. +state feedback. Dipanggil di `/orders/[id]/invoice` (invoice dari DB) |
| `DOCS.md` | MODIFIED | +Bagian 16.5 lengkap |

#### Alur `handlePrint` (cabang native)

```
tekan "Print"
  ├─ isNative() == false (web browser)
  │   → window.open() + write HTML + printWindow.print()   [TIDAK BERUBAH dari v4.0]
  │
  └─ isNative() == true (shell Android)
      ├─ getSavedDevice() == null
      │   → showToast("error", "Printer belum diatur. Buka Pengaturan Printer...")
      │   → return (tidak crash, user arahkan ke /settings/printer)
      │
      ├─ isConnected() == false
      │   → autoReconnect() (coba connect ulang dari MAC tersimpan)
      │   → kalau masih false → showToast("error", "Printer tidak terhubung. Buka Pengaturan Printer.")
      │   → return
      │
      └─ connected == true
          → buildOrderReceipt(receiptData) → Uint8Array (ESC/POS bytes)
          → write(bytes) via Bluetooth SPP
          → printState = "success" (3 detik) atau "error" (5 detik + pesan)
```

#### Mapping Data

**`InvoiceReceipt.tsx`** — props `InvoiceReceiptProps` sudah shape-compatible dengan `ReceiptData` (minus `onClose`). Construct `ReceiptData` inline dari props (orderNumber, customerName, items, subtotal, appliedTaxes, appliedDiscounts, total, dst). Tidak perlu mapper.

**`InvoicePageClient.tsx`** — props `OrderData` (DB shape) berbeda:
- `order_items` → `items` (field `product_name`, `quantity`, `unit_price`, `subtotal`, `modifier_label`, `note` — sama)
- `total_price` → `total`
- `created_at` → `createdAt` (via `formatDate()`)
- `taxes`/`discounts` null → `[]`
- `order_number` → `orderNumber`
- `cashAmount`/`change` — tidak ada di DB (tidak disimpan), skip

Pakai `orderToReceiptData(order)` dari `receipt-mappers.ts` untuk DRY.

#### UI Feedback Tombol Print (native)

| State | Icon | Warna tombol | Label | Durasi |
|---|---|---|---|---|
| idle | `Printer` | forest (hijau) | "Print" | — |
| sending | `Loader2` spin | forest, disabled | "Mencetak..." | saat kirim |
| success | `CheckCircle2` | success (hijau) | "Tercetak" | 3 detik → idle |
| error | `XCircle` | danger (merah) | "Gagal" | 5 detik → idle |

Kalau error, pesan error spesifik tampil di samping tombol (truncate dengan tooltip):
- "Printer belum diatur. Buka Pengaturan Printer..."
- "Printer \"{name}\" tidak terhubung. Buka Pengaturan Printer."
- Error kirim data dari plugin (mis. "Bluetooth device mati", "gagal kirim data")

Di web browser, tombol tetap "Print" biasa (tidak ada state feedback — `window.open()` sinkron, tidak perlu).

#### Verifikasi Kode (otomatis, sudah dijalankan)

- [x] `pnpm --filter @rakku/pos lint` → ✔ No ESLint warnings or errors
- [x] `pnpm --filter @rakku/pos build` → ✓ Compiled successfully. **43 route** (tidak ada route hilang). Bundle naik wajar karena bridge+builder sekarang di-import di komponen struk:
  - `/register` 116 → 123 kB (First Load) — `InvoiceReceipt.tsx` import bridge+builder
  - `/orders/[id]/invoice` 109 → 117 kB — `InvoicePageClient.tsx` import bridge+builder+mapper
  - `/settings/printer` 11.7 → 5.59 kB (code split lebih baik setelah shared chunk)
  - `DownlevelSerwistSW` tetap jalan
- [x] Web PWA tidak ada regresi: `isNative()` return false di browser → cabang `window.open()` lama yang jalan, tombol tetap "Print" biasa

#### Verifikasi Transaksi Asli (manual, besok)

- [ ] **Post-payment (InvoiceReceipt)**: buat transaksi asli di Register → bayar → modal invoice muncul → tekan "Print"
  - [ ] Di web browser → `window.open()` buka dialog print browser (tidak berubah)
  - [ ] Di shell native + printer connected → struk tercetak ke printer thermal, tombol berubah "Mencetak..." → "Tercetak"
  - [ ] Di shell native tanpa printer → toast "Printer belum diatur", tombol tidak crash
- [ ] **Invoice page (InvoicePageClient)**: buka `/orders/[id]/invoice` dari daftar orders → tekan "Print"
  - [ ] Sama: web → `window.open()`; native+connected → cetak thermal; native tanpa printer → toast arahkan ke settings
- [ ] **Verifikasi layout struk native** match web render: header "RAKKU", invoice #N, tanggal, customer, kasir, tipe, pembayaran, items, subtotal, diskon, pajak, total (bold), footer "Terima kasih"
- [ ] **Verifikasi tidak ada regresi checkout**: flow Register → add product → PaymentModal → bayar → invoice → close → cart reset. Perhitungan total/pajak/diskon tidak berubah.

#### Yang TIDAK Disentuh (fokus tugas utama)

- ❌ Layout struk (HTML/CSS render) — tidak berubah, hanya `handlePrint` yang tambah cabang
- ❌ Perhitungan total/subtotal/pajak/diskon — tidak tersentuh
- ❌ Props `InvoiceReceiptProps` / `OrderData` — tidak diubah, hanya dibaca
- ❌ Flow checkout (PaymentModal, cartStore, createOrder) — tidak berubah
- ❌ `next.config.mjs` / Serwist — tidak berubah
- ❌ Skema DB, RBAC, 4-step login — tidak berubah

### 16.6 Fase 6 — Build Release & Distribusi Internal

**Status:** ✅ Infrastruktur signing & dokumentasi selesai. ⬜ Generate keystore & build APK release (manual, di luar repo).

**Tujuan:** APK release signed siap distribusi ke device kasir Android 8 di lapangan. Signing keystore disimpan aman terpisah dari repo. Dokumentasi cara build, distribusi, dan update APK ke depan.

#### File Dibuat/Diubah

| Path | Status | Keterangan |
|---|---|---|
| `apps/pos/android/app/build.gradle` | MODIFIED | +signing config conditional (baca `keystore.properties` kalau ada). versionName "1.0" → "1.0.0". Debug build tetap jalan tanpa keystore. |
| `apps/pos/.gitignore` | MODIFIED | +`android/keystore.properties` (file signing config, jangan commit) |
| `DOCS.md` | MODIFIED | +Bagian 16.6 lengkap: cara generate keystore, build release, distribusi, update, known limitations |

#### Signing Keystore (manual — di luar repo)

> **Keystore TIDAK di-generate oleh agent** — ini tanggung jawab owner, disimpan aman terpisah dari repo. Kalau hilang, APK update tidak bisa ditandatangani dengan key yang sama (Play Store / Android akan tolak update). **Backup keystore ke tempat aman** (cloud storage terenkripsi, USB drive, dll).

**1. Generate keystore** (sekali saja, simpan aman):

```bash
# Jalankan di terminal (butuh JDK — sudah ada via Android Studio)
# Ganti path output ke lokasi aman, JANGAN di dalam folder repo
keytool -genkey -v -keystore rakku-pos-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias rakku-pos

# Isi prompt:
# Keystore password: <buat password kuat, catat aman>
# Key password: <sama atau beda, catat aman>
# First & Last Name: Rakku POS
# Organizational Unit: Development
# Organization: Rakku
# City: <kota>
# State: <provinsi>
# Country code: ID
```

Output: file `rakku-pos-release.jks` — **simpan di luar repo**, backup ke tempat aman.

**2. Buat `keystore.properties`** (di `apps/pos/android/`, gitignored):

```properties
# apps/pos/android/keystore.properties  (JANGAN commit — sudah di .gitignore)
storeFile=../rakku-pos-release.jks
storePassword=<password-keystore>
keyAlias=rakku-pos
keyPassword=<password-key>
```

`storeFile` path relatif dari `app/` (folder `app/build.gradle`). Contoh di atas: keystore ada di `apps/pos/android/rakku-pos-release.jks` → `storeFile=../rakku-pos-release.jks`. Atau pakai path absolut.

**3. Verifikasi**: `keystore.properties` terbaca saat build release — lihat DOCS "Cara Build APK Release" di bawah.

#### Cara Build APK Release

```bash
# 1. Build web assets (Next.js production build)
cd apps/pos
pnpm --filter @rakku/pos build

# 2. Sync web assets + plugin ke project Android
npx cap sync android

# 3. Build APK release (pilih salah satu):

#    a. Via Android Studio:
npx cap open android
#       → Build > Generate Signed Bundle / APK > APK > pilih keystore
#       → Build variant: release > Finish
#       → Output: android/app/build/outputs/apk/release/app-release.apk

#    b. Via CLI (Gradle):
cd android
./gradlew assembleRelease
#       → Output: app/build/outputs/apk/release/app-release.apk

# 4. Verifikasi APK signed:
#    (dari apps/pos/android)
"$LOCALAPPDATA/Android/Sdk/build-tools/<version>/apksigner" verify --verbose app/build/outputs/apk/release/app-release.apk
#    → "Verifies" + "Signed using v1 scheme: true" (v1 untuk Android < 7)
```

> **Catatan `minifyEnabled: false`** — R8/ProGuard tidak diaktifkan untuk release build saat ini. Plugin Capacitor & RTPrinter SDK native tidak butuh ProGuard rules khusus, tapi aktifkan nanti kalau APK size perlu dikecilkan (butuh test ekstra supaya tidak strip native code yang dipakai plugin).

#### Distribusi Internal (Manual APK Install)

**Belum lewat Play Store** — distribusi langsung ke device kasir:

1. Copy `app-release.apk` ke device kasir (USB, download link, Google Drive, dll)
2. Di device Android kasir: buka file manager → tap APK → "Install"
3. Kalau prompt "Install unknown apps" → allow dari file manager yang dipakai
4. Buka app "Rakku POS" dari launcher

**Update APK ke depan:**
1. Build APK release baru (versi baru — bump `versionCode` + `versionName` di `app/build.gradle`)
2. Distribusi ulang ke device kasir (copy + install)
3. Android akan tampilkan "Update" (bukan "Install") kalau `versionCode` lebih tinggi + signature sama
4. **Signature HARUS sama** — pakai keystore yang sama. Kalau ganti keystore, user harus uninstall dulu (data app hilang).

#### Versioning

```gradle
// apps/pos/android/app/build.gradle
versionCode 1       // increment setiap release (integer)
versionName "1.0.0" // display version (semantic)
```

- `versionCode` — integer naik monoton. Android pakai ini untuk tentukan APK lebih baru.
- `versionName` — string display ke user (mis. "1.0.0", "1.1.0", "2.0.0")
- Convention: major.minor.patch (mis. v4.1.0 → versionName "1.0.0" karena ini release native pertama, bukan follow web version)

#### Known Limitations v4.1

| Limitasi | Status | Rencana |
|---|---|---|
| **iOS tidak didukung** | Printer Bluetooth Classic SPP di iOS punya batasan MFi Program Apple yang jauh lebih ketat. | Pekerjaan terpisah kalau ada kebutuhan — kemungkinan pakai printer BLE atau Wi-Fi/LAN |
| **Distribusi belum lewat Play Store** | APK internal manual install. | Play Store publish proses terpisah (Play Console, review policy) |
| **Printer default per-device (localStorage)** | Bukan per-outlet di Supabase. Kalau satu outlet punya banyak device kasir yang perlu tahu printer default bersama, perlu migrasi ke tabel `outlet_settings`. | Dicatat sebagai kemungkinan masa depan |
| **Mode live URL (butuh internet)** | App native load UI dari `https://pos-rakku.vercel.app` — butuh koneksi internet. Serwist SW bantu caching asset, tapi backend Next.js tetap butuh server. | Kalau butuh offline-first penuh: eksplorasi Capacitor static bundle + API calls saja — pekerjaan terpisah |
| **Printer compatibility** | `escpos-builder.ts` dioptimalkan untuk printer existing (kelas EPPOS/Xprinter/Goojprt). Merek printer berbeda mungkin punya command ESC/POS sedikit berbeda (terutama cut kertas). | Penyesuaian kecil kalau ada printer baru, bukan redesign total. Fallback: `.raw(bytes)` untuk command manual |
| **`listPairedDevices()` tidak ada di plugin** | Plugin `capacitor-thermal-printer` hanya `startScan()` (discover in-range). Printer harus paired dulu di Android Settings. | Workaround: scan + tampilkan hasil. Kalau plugin ganti, `bluetooth-bridge.ts` satu-satunya file yang berubah |
| **Runtime permission Android 12+** | Saat pertama scan, app minta `BLUETOOTH_CONNECT` + `BLUETOOTH_SCAN`. Kalau ditolak → fitur printer tidak bisa dipakai. | User harus allow izin di Pengaturan Android kalau ditolak saat prompt |

#### Cara Test Bluetooth (ringkasan untuk QA lapangan)

1. **Pair printer** di Pengaturan Bluetooth Android (sebelum buka app)
2. Buka app Rakku POS → login 4-step
3. Sidebar/bottom-nav → icon Printer → halaman `/settings/printer`
4. Tekan "Cari Printer" → printer muncul di list
5. Pilih printer → "Hubungkan" → status "Terhubung"
6. Tes Print → struk contoh tercetak rapi
7. Buka Register → buat transaksi → bayar → Print → struk asli tercetak
8. Kalau gagal: cek Diagnostik panel (log koneksi terakhir), pastikan Bluetooth menyala & printer dalam jangkauan

#### Checklist Release Final

- [ ] Generate keystore (manual, simpan aman di luar repo)
- [ ] Buat `keystore.properties` (di `apps/pos/android/`, gitignored)
- [ ] `pnpm --filter @rakku/pos build` → web build sukses
- [ ] `npx cap sync android` → sync sukses
- [ ] `./gradlew assembleRelease` (di `apps/pos/android`) → APK release signed
- [ ] Verifikasi signed: `apksigner verify` → "Verifies"
- [ ] Install APK ke device Android 8 asli (kasir) → app terbuka tanpa force-close
- [ ] Login 4-step → cookie persist
- [ ] Pair printer Bluetooth di Android Settings
- [ ] Halaman `/settings/printer` → scan → connect → test print
- [ ] Transaksi asli: Register → bayar → Print → struk tercetak
- [ ] Verify web browser (`pos-rakku.vercel.app`) tetap identik v4.0 — tidak ada regresi
- [ ] Backup keystore ke tempat aman (cloud terenkripsi / USB)

#### Verifikasi Kode (otomatis, sudah dijalankan)

- [x] `app/build.gradle` — signing config conditional (debug tetap jalan tanpa keystore, release baca `keystore.properties` kalau ada)
- [x] `.gitignore` — `keystore.properties` + `*.keystore` + `*.jks` di-ignore
- [x] `npx cap sync android` — sync sukses (verifikasi di step E)
