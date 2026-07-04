# Dokumentasi Sistem Stocko (Rakku POS)

> **Nama internal:** `rakku`  
> **Stack:** Next.js 14 (App Router) · Supabase (PostgreSQL + Storage) · Tailwind CSS  
> **Versi:** 2.1 (aktif) · 3.0 (direncanakan — belum diimplementasi, lihat Bagian 13)  
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

---

## 1. Ikhtisar Sistem

**Stocko** (Rakku POS) adalah sistem **Point of Sale (POS)** multi-tenant untuk bisnis F&B yang dibangun dengan Next.js 14 App Router dan Supabase. Sistem ini mendukung banyak perusahaan (tenant), masing-masing dengan outlet, produk, dan role-based access control (RBAC) sendiri.

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
| **Email** | Resend 6.x | Kirim laporan via email |
| **Image Processing** | sharp 0.35.x | Resize/optimasi gambar produk |
| **JWT** | jose 6.x | Sign/verify token session & pending login |
| **Hashing** | bcryptjs 3.x | Hash password company & PIN user |
| **Type Safety** | TypeScript 5.x | Strict mode, path alias `@/*` |

---

## 3. Struktur Proyek

```
stocko/
├── .env.local                        # Variabel lingkungan (jangan di-commit)
├── .eslintrc.json                    # ESLint: next/core-web-vitals + next/typescript
├── next.config.mjs                   # Next.js config (image remote: *.supabase.co)
├── postcss.config.mjs                # PostCSS: tailwindcss
├── tailwind.config.ts                # Tailwind: custom colors, fonts, animations
├── tsconfig.json                     # TypeScript: strict, @/* → ./src/*
├── middleware.ts                     # Route protection (tenant + superadmin)
├── package.json                      # Dependencies & scripts
├── PRD.md                            # Product Requirements Document
├── README.md                         # README default Next.js
├── DOCS.md                           # Dokumentasi ini
│
├── src/                              # ─── Sumber kode utama ───
│   ├── app/
│   │   ├── layout.tsx                # Root layout (html lang="id")
│   │   ├── page.tsx                  # Redirect ke /login
│   │   ├── error.tsx                 # Root error boundary
│   │   ├── globals.css               # Global CSS + Tailwind directives
│   │   │
│   │   ├── (auth)/                   # Tenant auth route group
│   │   │   └── login/
│   │   │       ├── page.tsx          # Step 1: kode company + password
│   │   │       ├── select-outlet/
│   │   │       │   └── page.tsx      # Step 2: pilih outlet
│   │   │       ├── select-user/
│   │   │       │   └── page.tsx      # Step 3: pilih akun
│   │   │       └── enter-pin/
│   │   │           └── page.tsx      # Step 4: input PIN 6 digit
│   │   │
│   │   ├── (dashboard)/              # Tenant dashboard (protected)
│   │   │   ├── layout.tsx            # Sidebar + MobileNav + Toast
│   │   │   ├── error.tsx             # Dashboard error boundary
│   │   │   ├── register/
│   │   │   │   ├── page.tsx          # POS Register (server → RegisterView)
│   │   │   │   └── loading.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx          # Daftar pesanan
│   │   │   │   ├── OrdersClient.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── [id]/invoice/
│   │   │   │       ├── page.tsx
│   │   │   │       └── InvoicePageClient.tsx
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx          # Laporan penjualan
│   │   │   │   ├── ReportsClient.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── products/
│   │   │   │   ├── page.tsx          # CRUD produk
│   │   │   │   ├── AdminProductsClient.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── categories/
│   │   │   │   ├── page.tsx          # CRUD kategori
│   │   │   │   ├── AdminCategoriesClient.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── pricing-tiers/
│   │   │   │   └── page.tsx          # CRUD pricing tiers
│   │   │   ├── taxes/
│   │   │   │   └── page.tsx          # CRUD pajak
│   │   │   ├── discounts/
│   │   │   │   └── page.tsx          # CRUD diskon
│   │   │
│   │   ├── superadmin/               # Panel superadmin
│   │   │   ├── login/
│   │   │   │   └── page.tsx          # Supabase Auth login
│   │   │   └── (protected)/
│   │   │       ├── layout.tsx        # Sidebar superadmin
│   │   │       ├── companies/page.tsx
│   │   │       ├── outlets/page.tsx
│   │   │       ├── menus/page.tsx
│   │   │       ├── roles/page.tsx
│   │   │       ├── access-matrix/page.tsx
│   │   │       ├── users/page.tsx
│   │   │       └── audit-logs/page.tsx
│   │   │
│   │   └── api/                      # API Routes
│   │       ├── auth/tenant/          # Auth endpoints
│   │       ├── admin/                # Admin CRUD endpoints
│   │       ├── superadmin/           # Superadmin CRUD endpoints
│   │       └── reports/              # Reports endpoints
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # Sidebar dinamis (role-based menu)
│   │   │   └── MobileBottomNav.tsx   # Bottom nav mobile
│   │   ├── register/                 # Komponen POS Register
│   │   │   ├── RegisterView.tsx      # Main register (517 lines)
│   │   │   ├── ProductGrid.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── CategoryTabs.tsx
│   │   │   ├── OrderSidebar.tsx      # Cart sidebar (390 lines)
│   │   │   ├── MobileCartBar.tsx
│   │   │   ├── PaymentModal.tsx      # Alur pembayaran (457 lines)
│   │   │   ├── PricingOptionSelector.tsx
│   │   │   ├── DraftOrdersPanel.tsx
│   │   │   ├── ItemDetailModal.tsx
│   │   │   ├── InvoiceReceipt.tsx
│   │   │   └── SplitBillPanel.tsx
│   │   ├── admin/
│   │   │   ├── PricingTierManager.tsx
│   │   │   ├── TaxManager.tsx
│   │   │   ├── DiscountManager.tsx
│   │   │   └── PricingOptionsManager.tsx
│   │   ├── reports/
│   │   │   └── EmailReportModal.tsx
│   │   └── shared/
│   │       ├── Badge.tsx
│   │       ├── EmptyState.tsx
│   │       ├── QtyControl.tsx
│   │       └── Toast.tsx
│   │
│   ├── hooks/
│   │   ├── useMediaQuery.ts          # Breakpoints (mobile, tablet, desktop)
│   │   └── useSwipe.ts               # Touch swipe gesture
│   │
│   ├── lib/
│   │   ├── auth/                     # Auth utilities
│   │   │   ├── tenant-session.ts     # JWT session (12 jam)
│   │   │   ├── pending-login.ts      # JWT pending (10 menit)
│   │   │   ├── pin.ts                # Hash/verify PIN + lockout
│   │   │   ├── company.ts            # Login company + rate limiting
│   │   │   ├── menus.ts              # getAllowedMenus(), getAllMenus()
│   │   │   ├── superadmin.ts         # requireSuperadmin() guard
│   │   │   └── audit-log.ts          # Pencatatan event auth
│   │   ├── supabase/                 # Supabase clients & queries
│   │   │   ├── admin.ts              # Service role key client
│   │   │   ├── client.ts             # Browser anon key client
│   │   │   ├── server.ts             # Server component client
│   │   │   ├── queries.server.ts     # Server queries (tenant-scoped)
│   │   │   ├── queries.client.ts     # Client-side API wrappers
│   │   │   ├── queries.superadmin.ts # Superadmin CRUD queries
│   │   │   └── storage.ts            # Upload/delete gambar produk
│   │   ├── store/
│   │   │   └── cartStore.ts          # Zustand cart store (528 lines)
│   │   ├── pricing/
│   │   │   └── tiers.ts              # Default tier seeding helpers
│   │   └── dummy-data.ts             # Sample data untuk development
│   │
│   └── types/
│       └── index.ts                  # Semua TypeScript interfaces (275 lines)
│
├── supabase/
│   ├── migrations/                   # 13 file migrasi berurutan
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
│   │   └── 013_tax_discount.sql
│   └── seed.sql                      # Seed data awal (kategori, produk, modifier)
│
├── scripts/                          # Script utilitas
│   ├── seed.ts                       # Seed company RAKKU + role + user
│   ├── seed-full.ts                  # Seed company TOKOKO + Outlet Cabang
│   ├── run-migration.ts              # Runner migrasi SQL via pgsql RPC
│   ├── run-migration.js              # Helper manual copy-paste SQL
│   └── migration-004.ts              # Programmatic M6 hardening
│
└── public/
    └── images/
        ├── rakku_logo.png            # Logo kotak (sidebar, login)
        └── rakku_logotype.png        # Logotype teks (halaman login)
```

---

## 4. Konfigurasi

### 4.1 `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
NEXT_PUBLIC_TAX_RATE=11
NEXT_PUBLIC_STORE_NAME=ABCD
NEXT_PUBLIC_STORE_ADDRESS=ASDAS
TENANT_JWT_SECRET=<random-secret-key>
RESEND_API_KEY=<resend-api-key>
RESEND_FROM_EMAIL=onboarding@resend.dev
```

| Variabel | Fungsi |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key untuk browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key untuk operasi backend (bypass RLS) |
| `NEXT_PUBLIC_TAX_RATE` | Default persentase pajak (legacy) |
| `TENANT_JWT_SECRET` | Secret key untuk sign/verify JWT session & pending login |
| `RESEND_API_KEY` | API key untuk kirim email laporan |
| `RESEND_FROM_EMAIL` | Email pengirim untuk Resend |

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

Middleware melindungi route berdasarkan kategori:

| Route | Proteksi |
|-------|----------|
| `/_next`, `/api`, `/favicon`, `/` | Publik (tanpa proteksi) |
| `/login`, `/login/*` | Tenant auth — diizinkan tanpa session |
| `/register`, `/orders`, `/reports`, `/products`, `/categories`, `/pricing-tiers` | **Tenant session** — redirect ke `/login` jika invalid |
| `/superadmin/login` | **Superadmin** — redirect ke `/superadmin/companies` jika sudah login |
| `/superadmin/*` (kecuali login) | **Superadmin** — redirect ke `/superadmin/login` jika belum auth |

**Matcher middleware:**
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
cd stocko

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

Stocko adalah **Progressive Web App** — dapat di-install di desktop & mobile seperti aplikasi native, berjalan standalone, dan tetap usable saat koneksi terputus (offline fallback). PWA diimplementasi dengan **Serwist** (fork Workbox yang aktif维护) untuk Next.js App Router.

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
| `name` | Rakku POS - Stocko |
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

> **⚠ STATUS: BELUM DIIMPLEMENTASI**
>
> Bagian ini adalah **spesifikasi/rencana** untuk v3.0. Dokumentasi ditulis lebih dulu sebagai brief, namun implementasi v3 **belum selesai** — semua route, API, dan komponen yang disebut di bawah ini **belum ada** (folder scaffolding kosong sudah dibersihkan). Lihat `PROMPT_STOCKO_V3_PRODUCTION_READY.md` untuk brief lengkap pengembangan v3.
>
> Bagian 1–12 menggambarkan kondisi **aktif** sistem saat ini (v2.1), ditambah Bagian 13 (PWA) yang sudah aktif.

### 14.1 Ikhtisar

v3.0 mengubah Stocko dari *internal tool* (superadmin melakukan semuanya) menjadi *SaaS self-service* dengan onboarding mandiri.

### 14.2 Ownership Hierarchy Baru

```
PLATFORM → Superadmin (mengawasi seluruh platform)
  └── TENANT (Company) → Owner (pemilik bisnis, daftar sendiri)
        └── Karyawan → Kasir (login 4-step, dikelola oleh Owner)
```

### 14.3 Dua Auth Flow

| | Owner | Kasir (existing) |
|---|---|---|
| Login | Email + password (Custom JWT) | 4-step: company → outlet → user → PIN |
| Cookie | `owner_session` (24 jam) | `session` (12 jam) |
| Secret | `TENANT_JWT_SECRET` (sama) | `TENANT_JWT_SECRET` |
| Library | `src/lib/auth/owner-session.ts` | `src/lib/auth/tenant-session.ts` |

### 14.4 Tabel Baru (Migration 014)

| Tabel | Fungsi |
|-------|--------|
| `owners` | Akun pemilik bisnis (email + password bcrypt, terpisah dari `users` tenant) |
| `plans` | Master paket langganan (Free/Pro/Business) |
| `employee_invitations` | Undangan karyawan (token-based, untuk Fase 2) |
| `entity_audit_logs` | Audit trail CRUD sensitif (untuk Fase 4) |

### 14.5 Rute Baru v3

| Rute | Deskripsi |
|------|-----------|
| `/(owner)/daftar` | Registrasi Owner baru |
| `/(owner)/masuk` | Login Owner |
| `/onboarding` | Wizard buat company + outlet pertama |
| `/dashboard` | Dashboard Owner (ringkasan bisnis) |
| `/dashboard/outlets` | CRUD outlet milik sendiri |
| `/dashboard/employees` | CRUD karyawan |
| `/dashboard/settings` | Pengaturan perusahaan |

### 14.6 API Routes Baru

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/auth/owner/register` | POST | Daftar Owner baru |
| `/api/auth/owner/login` | POST | Login Owner, set `owner_session` cookie |
| `/api/auth/owner/logout` | POST | Hapus cookie Owner |
| `/api/auth/owner/session` | GET | Baca session Owner saat ini |
| `/api/onboarding/company` | POST | Buat company + outlet + seed roles/tiers |
| `/api/dashboard/outlets` | POST | Tambah outlet baru (Owner) |
| `/api/dashboard/employees` | POST | Tambah karyawan baru (Owner) |

### 14.7 Scripts Baru

| Script | Perintah | Fungsi |
|--------|----------|--------|
| `backfill:owners` | `npm run backfill:owners` | Backfill company existing (RAKKU, TOKOKO) ke model ownership |

### 14.8 Alur Owner Baru

1. **Daftar** (`/daftar`) — input nama, email, password → simpan ke `owners`
2. **Masuk** (`/masuk`) — login email+password → set `owner_session` cookie
3. **Onboarding** (`/onboarding`) — jika belum punya company:
   - Step 1: nama company, kode, password company
   - Step 2: nama outlet pertama, alamat
   - Submit → buat company + outlet + seed 4 role default + 1 user Owner + access matrix
4. **Dashboard** (`/dashboard`) — ringkasan bisnis, akses cepat ke POS Register, kelola outlet/karyawan
5. **Kelola Karyawan** (`/dashboard/employees`) — tambah karyawan dengan PIN, assign role
6. **Kelola Outlet** (`/dashboard/outlets`) — tambah outlet baru dalam company

### 14.9 Catatan Penting

- **Semua API menggunakan service role key** — policy sama seperti v2.1 (bypass RLS). RLS tidak diaktifkan.
- **Owner auth menggunakan Custom JWT** (bukan Supabase Auth) — konsisten dengan auth kasir existing. Menggunakan library `jose` + `bcryptjs` yang sudah terinstall.
- **Cookie name** Owner terpisah: `owner_session` vs `session` (kasir).
- **Seed logic** di `/api/onboarding/company` mereplikasi logika `scripts/seed.ts` untuk membuat company + roles + access matrix + default user.
- **Middleware** diperluas untuk route group baru: `(owner)` untuk auth, `/onboarding` dan `/dashboard` untuk protected Owner routes.
