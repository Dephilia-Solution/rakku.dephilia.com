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
| **Panel Superadmin** | Kelola semua perusahaan, outlet, menu, role, user, access matrix |
| **Audit Log** | Catatan semua percobaan login (sukses/gagal) |
| **Rate Limiting** | Lockout otomatis pada PIN (5x) dan password company (10x) |

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
│   │   │   ├── page.tsx              # Redirect: / → /login or /dashboard
│   │   │   ├── login/page.tsx        # Login Owner (email + password)
│   │   │   ├── register/page.tsx      # Daftar Owner baru
│   │   │   ├── check-email/page.tsx  # Prompt verifikasi email
│   │   │   ├── onboarding/page.tsx   # Wizard: buat company + outlet
│   │   │   ├── dashboard/            # Protected dashboard (sidebar layout)
│   │   │   │   ├── page.tsx          # Overview
│   │   │   │   ├── outlets/          # CRUD outlet
│   │   │   │   ├── employees/        # CRUD karyawan + role + access
│   │   │   │   └── settings/         # Edit profil company
│   │   │   └── api/auth/owner/       # Auth API (login, register, verify-email, session, logout)
│   │   │       ├── onboarding/        # Onboarding API
│   │   │       └── owner/            # CRUD outlets, employees, roles, menus, settings
│   │   ├── middleware.ts              # Protect /dashboard, /onboarding; public: /login, /register
│   │   ├── .env.local                # OWNER_JWT_SECRET, SMTP, NEXT_PUBLIC_POS_URL
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   ├── pos/                           # → pos.rakku.com (POS Kasir)
│   │   ├── src/app/
│   │   │   ├── page.tsx              # Redirect: / → /login
│   │   │   ├── login/                # 4-step login: company → outlet → user → PIN
│   │   │   │   ├── page.tsx          # Step 1: kode company + password
│   │   │   │   ├── select-outlet/    # Step 2: pilih outlet
│   │   │   │   ├── select-user/      # Step 3: pilih akun
│   │   │   │   └── enter-pin/        # Step 4: input PIN
│   │   │   ├── (dashboard)/          # Protected routes (sidebar layout)
│   │   │   │   ├── register/         # POS Register (kasir)
│   │   │   │   ├── orders/           # Daftar pesanan + invoice
│   │   │   │   ├── reports/          # Laporan penjualan
│   │   │   │   ├── products/         # CRUD produk
│   │   │   │   ├── categories/       # CRUD kategori
│   │   │   │   ├── pricing-tiers/   # CRUD tier harga
│   │   │   │   ├── taxes/            # CRUD pajak
│   │   │   │   └── discounts/        # CRUD diskon
│   │   │   └── api/auth/tenant/      # Auth API
│   │   │       ├── admin/            # CRUD: products, categories, orders, dll.
│   │   │       └── reports/           # Reports API + send-email
│   │   ├── middleware.ts              # Protect all /dashboard routes
│   │   ├── .env.local                # POS_JWT_SECRET, NEXT_PUBLIC_TAX_RATE
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   ├── sw.ts                      # PWA Service Worker
│   │   ├── manifest.ts                # PWA Web App Manifest
│   │   └── package.json
│   │
│   └── superadmin/                   # → superadmin.rakku.com
│       ├── src/app/
│       │   ├── page.tsx              # Redirect: / → /companies
│       │   ├── login/page.tsx        # Login (Supabase Auth)
│       │   ├── (protected)/           # Protected routes (sidebar layout)
│       │   │   ├── companies/        # CRUD companies
│       │   │   ├── outlets/          # CRUD outlets per company
│       │   │   ├── menus/            # CRUD menu sistem
│       │   │   ├── roles/            # CRUD role per company
│       │   │   ├── access-matrix/    # Role × menu access
│       │   │   ├── users/            # CRUD user per company
│       │   │   └── audit-logs/       # Log autentikasi
│       │   └── api/superadmin/       # Superadmin API (companies, outlets, dll.)
│       ├── middleware.ts              # Protect all /companies, /outlets, dll.
│       ├── .env.local
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       └── package.json
│
├── packages/                          # Shared code
│   ├── shared-types/                  # @rakku/shared-types — semua TypeScript interfaces
│   ├── supabase-clients/             # @rakku/supabase-clients — factory Supabase client
│   ├── auth-utils/                   # @rakku/auth-utils — JWT + PIN + audit-log
│   ├── ui/                           # @rakku/ui — Badge, Toast, EmptyState, QtyControl
│   └── pricing/                      # @rakku/pricing — default tiers + seeding
│
├── supabase/
│   ├── migrations/                   # 14 file migrasi (001–014)
│   │   ├── 001_init.sql
│   │   ├── 002_multi_tenant.sql
│   │   ├── 003_rls_permissive.sql
│   │   ├── 004_m6_hardening.sql
│   │   ├── 006_pricing_draft.sql
│   │   ├── 007_july_features.sql
│   │   ├── 008_pricing_tier_split.sql
│   │   ├── 009_pricing_tier_admin.sql
│   │   ├── 010_seed_default_tiers.sql
│   │   ├── 011_flatten_paths.sql
│   │   ├── 012_pricing_per_tier.sql
│   │   ├── 013_tax_discount.sql
│   │   └── 014_owner_self_service.sql
│   └── seed.sql
│
├── scripts/
│   ├── seed.ts                       # Seed company RAKKU
│   ├── seed-full.ts                  # Seed company TOKOKO + Outlet Cabang
│   └── backfill-owners.ts           # Backfill existing companies ke ownership model
│
├── public/
│   └── images/
│       ├── rakku_logo.png
│       └── rakku_logotype.png
│
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml               # Workspace: apps/* + packages/*
├── package.json                      # Root scripts
├── tsconfig.base.json                # Base TS config dengan path alias @rakku/*
├── DOCS.md
└── PROMPT_RAKKU_V4_MONOREPO_SPLIT.md
```

> **Catatan:** Struktur di atas adalah kondisi setelah v4.0. Untuk struktur monolith lama (v3.0), lihat `PROMPT_RAKKU_V4_MONOREPO_SPLIT.md` Bagian 5. Rute aplikasi per app lihat Bagian 15.

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

> **Catatan:** Bagian ini mendokumentasikan struktur lama (monolith v3.0). Untuk routing saat ini di v4.0 monorepo, lihat **Bagian 15 — V4.0 Monorepo 3-App**.

### 8.1 Halaman Tenant (Auth)

| Rute | File | Deskripsi |
|------|------|-----------|
| `/login` | `(auth)/login/page.tsx` | Step 1: Input kode company + password |
| `/login/select-outlet` | `(auth)/login/select-outlet/page.tsx` | Step 2: Pilih outlet |
| `/login/select-user` | `(auth)/login/select-user/page.tsx` | Step 3: Pilih akun |
| `/login/enter-pin` | `(auth)/login/enter-pin/page.tsx` | Step 4: Input PIN 6 digit |

### 8.2 Halaman Dashboard (Tenant — Protected)

| Rute | File | Deskripsi |
|------|------|-----------|
| `/register` | `(dashboard)/register/page.tsx` | POS Register (kasir) |
| `/orders` | `(dashboard)/orders/page.tsx` | Daftar pesanan |
| `/orders/[id]/invoice` | `(dashboard)/orders/[id]/invoice/page.tsx` | Invoice print |
| `/reports` | `(dashboard)/reports/page.tsx` | Laporan penjualan |
| `/products` | `(dashboard)/products/page.tsx` | Manajemen produk |
| `/categories` | `(dashboard)/categories/page.tsx` | Manajemen kategori |
| `/pricing-tiers` | `(dashboard)/pricing-tiers/page.tsx` | Manajemen tier harga |
| `/taxes` | `(dashboard)/taxes/page.tsx` | Manajemen pajak |
| `/discounts` | `(dashboard)/discounts/page.tsx` | Manajemen diskon |

### 8.3 Halaman Superadmin

| Rute | File | Deskripsi |
|------|------|-----------|
| `/superadmin/login` | `superadmin/login/page.tsx` | Login superadmin (Supabase Auth) |
| `/superadmin/companies` | `superadmin/(protected)/companies/page.tsx` | CRUD perusahaan |
| `/superadmin/outlets` | `superadmin/(protected)/outlets/page.tsx` | CRUD outlet per company |
| `/superadmin/menus` | `superadmin/(protected)/menus/page.tsx` | CRUD menu sistem |
| `/superadmin/roles` | `superadmin/(protected)/roles/page.tsx` | CRUD role per company |
| `/superadmin/access-matrix` | `superadmin/(protected)/access-matrix/page.tsx` | Matrix role × menu |
| `/superadmin/users` | `superadmin/(protected)/users/page.tsx` | CRUD user per company |
| `/superadmin/audit-logs` | `superadmin/(protected)/audit-logs/page.tsx` | Log autentikasi |

### 8.4 API Routes

#### Auth Tenant — `/api/auth/tenant/`

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/company` | POST | Verify kode + password company |
| `/outlet` | GET | List outlet aktif |
| `/outlet` | POST | Pilih outlet |
| `/accounts` | GET | List akun untuk outlet |
| `/verify-pin` | POST | Verify PIN + buat session |
| `/session` | GET | Baca session saat ini |
| `/logout` | POST | Hapus session cookie |

#### Admin — `/api/admin/`

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/products` | POST | Create produk |
| `/products` | PATCH | Update produk |
| `/products` | PUT | Toggle active |
| `/products/upload` | POST | Upload gambar produk |
| `/categories` | POST | Create kategori |
| `/categories` | PATCH | Update kategori |
| `/categories` | DELETE | Hapus kategori |
| `/modifiers` | GET | List modifier per produk |
| `/modifiers` | POST | Create modifier |
| `/modifiers` | DELETE | Hapus modifier |
| `/orders` | POST | Create order |
| `/orders/draft` | GET/POST/PATCH/DELETE | Draft order |
| `/orders/split` | POST | Split payment |
| `/pricing-options` | — | CRUD pricing options |
| `/pricing-tiers` | — | CRUD pricing tiers |
| `/product-tier-prices` | — | CRUD product tier prices |
| `/modifier-tier-prices` | — | CRUD modifier tier prices |
| `/taxes` | — | CRUD pajak |
| `/taxes/active` | GET | List pajak aktif |
| `/discounts` | — | CRUD diskon |
| `/discounts/active` | GET | List diskon aktif |

#### Superadmin — `/api/superadmin/`

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/companies` | GET/POST/PUT | CRUD companies |
| `/outlets` | GET/POST/PUT | CRUD outlets |
| `/menus` | GET/POST/PUT/DELETE | CRUD menus |
| `/roles` | GET/POST/PUT/DELETE | CRUD roles |
| `/users` | GET/POST/PUT | CRUD users |
| `/access-matrix` | GET/POST | Toggle access matrix |
| `/audit-logs` | GET | View audit logs |

#### Reports — `/api/reports/`

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/send-email` | POST | Kirim laporan via email (Resend) |

---

## 9. Komponen Utama

### 9.1 Layout

| Komponen | File | Deskripsi |
|----------|------|-----------|
| **Sidebar** | `components/layout/Sidebar.tsx` | Sidebar kiri — menu dinamis dari role_menu_access, logo, logout |
| **MobileBottomNav** | `components/layout/MobileBottomNav.tsx` | Bottom navigation untuk mobile dengan badge cart |

### 9.2 Register (POS)

| Komponen | File | Deskripsi |
|----------|------|-----------|
| **RegisterView** | `components/register/RegisterView.tsx` (517 baris) | Main POS — search, kategori, grid produk, modifier modal, draft panel, payment |
| **ProductGrid** | `components/register/ProductGrid.tsx` | Grid produk responsive |
| **ProductCard** | `components/register/ProductCard.tsx` | Card produk (gambar, nama, harga) |
| **CategoryTabs** | `components/register/CategoryTabs.tsx` | Tab kategori horizontal (scrollable) |
| **OrderSidebar** | `components/register/OrderSidebar.tsx` (390 baris) | Cart sidebar — grouped by category, qty control, edit item, draft, payment button |
| **MobileCartBar** | `components/register/MobileCartBar.tsx` | Floating cart bar mobile + badge |
| **PaymentModal** | `components/register/PaymentModal.tsx` (457 baris) | Alur bayar — cash/QRIS/card, nominal saran, split bill, customer name, invoice |
| **DraftOrdersPanel** | `components/register/DraftOrdersPanel.tsx` | Panel daftar & restore draft order |
| **InvoiceReceipt** | `components/register/InvoiceReceipt.tsx` | Receipt post-payment dengan print |
| **ItemDetailModal** | `components/register/ItemDetailModal.tsx` | Breakdown detail item per add-on |
| **SplitBillPanel** | `components/register/SplitBillPanel.tsx` | Konfigurasi split pembayaran |
| **PricingOptionSelector** | `components/register/PricingOptionSelector.tsx` | Pilih opsi harga tambahan |

### 9.3 Admin

| Komponen | File | Deskripsi |
|----------|------|-----------|
| **PricingTierManager** | `components/admin/PricingTierManager.tsx` | CRUD pricing tiers |
| **TaxManager** | `components/admin/TaxManager.tsx` | CRUD pajak (percentage/fixed) |
| **DiscountManager** | `components/admin/DiscountManager.tsx` | CRUD diskon (produk & order) |
| **PricingOptionsManager** | `components/admin/PricingOptionsManager.tsx` | CRUD pricing options per produk |

### 9.4 Shared

| Komponen | File | Deskripsi |
|----------|------|-----------|
| **Badge** | `components/shared/Badge.tsx` | Status badge (active/inactive/warning) |
| **EmptyState** | `components/shared/EmptyState.tsx` | Placeholder konten kosong |
| **QtyControl** | `components/shared/QtyControl.tsx` | Increment/decrement quantity |
| **Toast** | `components/shared/Toast.tsx` | Notifikasi toast (success/error/info) |

### 9.5 Hooks

| Hook | File | Deskripsi |
|------|------|-----------|
| **useMediaQuery** | `hooks/useMediaQuery.ts` | Breakpoints: `isMobile`, `isTablet`, `isDesktop` |
| **useSwipe** | `hooks/useSwipe.ts` | Deteksi gesture swipe touch |

---

## 10. Library & Utilities

### 10.1 Auth Library (`src/lib/auth/`)

| File | Fungsi Utama |
|------|-------------|
| `tenant-session.ts` | `signSession()`, `verifySession()`, `getTenantSessionFromCookies()`, `clearSessionCookie()`, `setSessionCookie()` |
| `pending-login.ts` | Sama seperti session, tapi expiry 10 menit untuk flow login multi-step |
| `pin.ts` | `hashPin()`, `verifyPin()`, `isLocked()`, `computeLockedUntil()`, `getRemainingAttempts()` — 5 attempts, 15 menit lockout |
| `company.ts` | `verifyCompanyLogin()` dengan rate limiting (10 attempts, 15 menit), `getActiveOutlets()`, `getAccountsForOutlet()` |
| `menus.ts` | `getAllowedMenus(roleId)` — query role_menu_access JOIN menus, `getAllMenus()` |
| `superadmin.ts` | `requireSuperadmin()` — guard function untuk superadmin routes |
| `audit-log.ts` | `logAuthEvent()` — catat event auth ke `auth_audit_logs` + constants `FailureReasons` |

### 10.2 Supabase Library (`src/lib/supabase/`)

| File | Client | Key | Use Case |
|------|--------|-----|----------|
| `admin.ts` | `createClient()` (supabase-js) | Service Role | Semua query backend (bypass RLS) |
| `client.ts` | `createBrowserClient()` (ssr) | Anon Key | Browser-side (upload gambar) |
| `server.ts` | `createServerClient()` (ssr) | Anon Key | Server Component (superadmin pages) |
| `queries.server.ts` | Server query wrappers | Service Role | `getActiveProducts()`, `getCategories()`, `getOrders()`, `getSalesSummary()`, `getPricingTiers()`, `getActiveTaxes()`, dll. Semua filter `company_id` + `outlet_id` dari session. |
| `queries.client.ts` | Client API wrappers | — | `createOrder()`, `createCategory()`, `updateProduct()`, dll via fetch ke `/api/admin/*` |
| `queries.superadmin.ts` | Superadmin CRUD | — | `getCompanies()`, `createCompany()`, `getOutlets()`, `getRoles()`, `getUsers()`, `setRoleMenuAccess()`, dll |
| `storage.ts` | Upload/delete gambar | Anon Key | `uploadProductImage()`, `deleteProductImage()` ke bucket `product-images` |

### 10.3 Cart Store (`src/lib/store/cartStore.ts`)

State management dengan **Zustand** (528 baris). State utama:

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

### 10.4 Type Definitions (`src/types/index.ts`, 275 baris)

Semua interface TypeScript: `Category`, `Product`, `Modifier`, `CartItem`, `Order`, `OrderItem`, `PricingTier`, `ProductTierPrice`, `Tax`, `ProductDiscount`, `OrderDiscount`, `AppliedTax`, `AppliedDiscount`, `Company`, `Outlet`, `Menu`, `Role`, `User`, `TenantSession`, `PendingLogin`, `SplitPayment`, dll.

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
- NPM
- Project Supabase (free tier)
- Akun Resend (untuk fitur email)

**Langkah-langkah:**

```bash
# 1. Clone repository
git clone <repo-url>
cd rakku

# 2. Install dependencies
npm install

# 3. Copy .env.example ke .env.local (atau buat dari template)
# Isi dengan credentials Supabase + JWT secret + Resend

# 4. Jalankan migrasi Supabase
# Buka Supabase Dashboard → SQL Editor → jalankan migrasi berurutan:
# 001_init.sql → 002_multi_tenant.sql → ... → 013_tax_discount.sql

# 5. Seed data awal
npm run seed

# 6. Jalankan dev server
npm run dev
```

### 12.2 Scripts

| Script | Perintah | Fungsi |
|--------|----------|--------|
| `dev` | `npm run dev` | Jalankan development server (localhost:3000) |
| `build` | `npm run build` | Build production |
| `start` | `npm run start` | Jalankan production server |
| `lint` | `npm run lint` | ESLint check |
| `seed` | `npm run seed` | Seed company RAKKU + data awal |
| `seed:full` | `npx tsx scripts/seed-full.ts` | Seed company TOKOKO + Outlet Cabang |

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

### 12.4 Migrasi

Migrasi dijalankan secara manual via Supabase SQL Editor, berurutan:

```
001_init.sql           → Schema awal (tabel core)
002_multi_tenant.sql   → Multi-tenant & RBAC
003_rls_permissive.sql → Non-aktifkan RLS
004_m6_hardening.sql   → Rate limiting, audit log
006_pricing_draft.sql  → Pricing options, draft orders
007_july_features.sql  → Split bill, pricing tiers, cashier_name
008_pricing_tier_split.sql → pricing_tier_id di orders
009_pricing_tier_admin.sql  → Menu pricing-tiers
010_seed_default_tiers.sql  → Seed Dine In & Take Away
011_flatten_paths.sql       → Update path menu
012_pricing_per_tier.sql    → Modifier tier prices
013_tax_discount.sql        → Pajak & diskon dinamis
014_owner_self_service.sql  → V3 — tabel owners + alter companies (owner_id, slug)
```

### 12.5 Akun Default untuk Testing

| Aplikasi | Kode Company | Password | Username | PIN |
|----------|-------------|----------|----------|-----|
| RAKKU | `RAKKU` | `rakku123` | budi | `123456` |
| RAKKU | `RAKKU` | `rakku123` | siti | `123456` |
| RAKKU | `RAKKU` | `rakku123` | ahmad | `123456` |
| TOKOKO | `TOKOKO` | `tokoko123` | ali | `123456` |

**Superadmin:** Login via `/superadmin/login` menggunakan Supabase Auth credentials.

### 12.6 Build & Deploy

```bash
# Production build
npm run build

# Start
npm start
```

**Catatan untuk deployment:**
- Pastikan semua environment variable diisi di platform deployment
- Set `NEXT_PUBLIC_TAX_RATE` sesuai kebutuhan
- Untuk Vercel: set `RESEND_API_KEY` di Environment Variables
- Untuk platform lain yang tidak menggunakan Vercel, pastikan Node.js 18+ tersedia

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

```
src/app/
├── manifest.ts              # Web app manifest (MetadataRoute.Manifest)
├── sw.ts                    # Service worker source (compiled by Serwist)
├── ~offline/page.tsx        # Halaman fallback offline
└── layout.tsx               # Metadata + viewport (themeColor, manifest link, icons)

public/
├── sw.js                    # SW build output (gitignored, auto-generated)
└── icons/
    ├── icon-192.png         # Ikon 192x192
    ├── icon-512.png         # Ikon 512x512
    ├── icon-192-maskable.png# Maskable 192 (Android adaptive)
    ├── icon-512-maskable.png# Maskable 512 (Android adaptive)
    ├── apple-touch-icon.png # Apple touch icon 180x180
    └── favicon-32.png       # Favicon 32x32

scripts/
└── generate-pwa-icons.mjs   # Script generate ikon dari rakku_logo.png (sharp)
```

### 13.4 Konfigurasi

**`next.config.mjs`** — di-wrap dengan `withSerwist`:
```js
const withSerwist = withSerwistInit({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});
export default withSerwist(nextConfig);
```

**`tsconfig.json`** — tambahan untuk typing SW:
- `lib`: tambah `"webworker"`
- `types`: tambah `"@serwist/next/typings"`
- `exclude`: tambah `"public/sw.js"`

**`.gitignore`** — tambahan:
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

Ikon PWA di-generate dari `public/images/rakku_logo.png` menggunakan `sharp`:

```bash
node scripts/generate-pwa-icons.mjs
```

Script ini menghasilkan semua ikon di `public/icons/`. Jalankan ulang jika logo berubah.

### 13.7 Testing PWA

1. **Build & start production** (SW tidak aktif di dev):
   ```bash
   npm run build && npm start
   ```
2. Buka `localhost:3000` di Chrome → DevTools → **Application** tab
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
