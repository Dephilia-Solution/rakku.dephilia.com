# Dokumentasi Sistem Rakku POS

> **Nama internal:** `rakku`
> **Stack aktif:** Next.js 14/16 (App Router) · Neon Postgres + Drizzle · Neon Managed Better Auth · Tailwind CSS · pnpm + Turborepo
> **Cakupan implementasi:** fitur v6.1 M1–M4 + runtime Neon, baseline `0001`–`0004`, demo publik browser-memory
> **Author:** Alif Dhimas
> **Pembaruan dokumentasi/source:** 17 Oktober 2026
>
> Dokumen ini menjelaskan implementasi yang ada di repository, termasuk keterbatasan dan risiko yang belum diperbaiki. Dokumen PRD/PROMPT adalah riwayat perencanaan dan bukan sumber kebenaran runtime.

Dokumen ini adalah **referensi teknis untuk developer dan operator**: arsitektur, konfigurasi, schema, routes, dan keterbatasan runtime. [README.md](README.md) menyediakan quick start; [NEON_MIGRATION.md](NEON_MIGRATION.md) menyediakan prosedur setup/deploy/pemulihan; [DEMO.md](DEMO.md) menjelaskan demo publik `/demo` secara operasional. Database Neon aktif dimulai baru tanpa copy data Supabase. Hasil rollout yang disebutkan berasal dari pemeriksaan 8 Oktober 2026, bukan pemeriksaan ulang semua domain production. [PANDUAN.md](PANDUAN.md) masih panduan BUILD lama dan akan diperbarui ke DEMO pada tahap berikutnya.

---

## Daftar Isi

1. [Ikhtisar Sistem](#1-ikhtisar-sistem)
2. [Tech Stack](#2-tech-stack)
3. [Struktur Proyek](#3-struktur-proyek)
4. [Konfigurasi](#4-konfigurasi)
5. [Arsitektur](#5-arsitektur)
6. [Autentikasi & Otorisasi](#6-autentikasi--otorisasi)
7. [Database (Neon Postgres)](#7-database-neon-postgres)
8. [Rute Aplikasi](#8-rute-aplikasi)
9. [Komponen Utama](#9-komponen-utama)
10. [Library, Packages & Utilities](#10-library-packages--utilities)
11. [Detail API Penting](#11-detail-api-penting)
12. [Panduan Development](#12-panduan-development)
13. [PWA (Progressive Web App)](#13-pwa-progressive-web-app)
14. [Alur Lengkap (End-to-End)](#14-alur-lengkap-end-to-end)
15. [Riwayat Versi](#15-riwayat-versi)
16. [Catatan Teknis & Known Issues](#16-catatan-teknis--known-issues)
17. [Demo Publik Browser-Memory](#17-demo-publik-browser-memory)

---

## 1. Ikhtisar Sistem

**Rakku** (Rakku POS) adalah sistem **Point of Sale (POS), inventory, billing, dan settlement** multi-tenant untuk bisnis F&B (kedai, cafe, restoran kecil). Data aplikasi berada di Neon Postgres, diakses server Next.js melalui `@rakku/db` (Drizzle + `postgres.js`). Isolasi POS memakai autentikasi/otorisasi server, context tenant transaction-local, FORCE RLS, dan trigger integritas company/outlet. Platform/Owner tetap membutuhkan guard dan scoping aplikasi karena client platform dapat mengakses lintas tenant. Lihat §16 untuk keterbatasan yang masih ada.

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
| **Multi-Tenant** | owner, pos, superadmin | Banyak company/outlet; tenant context, FORCE RLS, trigger relasi tenant, dan guard server |
| **RBAC Dinamis** | owner, pos, superadmin | Role & menu access matrix per company; `can_view` ditegakkan pada POS server boundary, belum CRUD grants terpisah |
| **Pricing Tiers** | owner, pos | Harga berbeda per tier (Dine In, Take Away, Gojek, dll) |
| **Manajemen Produk** | owner, pos | CRUD produk per outlet, gambar (Silos), modifier, tier pricing, resep |
| **Manajemen Order** | owner, pos | Order completed, draft/pay-later (24 jam), split bill, invoice print 58mm |
| **Pajak & Diskon** | owner, pos | Pajak multi-tipe (persentase/fixed), diskon produk & order berperiode |
| **Bahan Baku & Resep** | owner, pos | Ingredients per outlet + BOM per produk (resep) |
| **Potong Stok Otomatis** | pos | Deduksi resep dalam transaksi order/payment, row locks dan unique sale-deduction guard |
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
| **Audit Log** | superadmin | Viewer event autentikasi POS yang dicatat ke `auth_audit_logs` |
| **Rate Limiting** | pos | Lockout PIN (5x) dan password company (10x) |
| **Email Transaksional** | owner, pos | Verifikasi owner, reset sandi, laporan penjualan via Echo API |
| **PWA (POS)** | pos | Installable, offline fallback, service worker (Serwist) |
| **Mobile-First Nav** | owner, pos | Sidebar desktop, bottom nav + more sheet di mobile |
| **Demo Publik** | owner (+ komponen POS) | `/demo/owner/*` dan `/demo/pos/*` memakai komponen/layout asli dengan sandbox browser-memory; reset/logout/refresh kembali ke fixture, tanpa persistensi atau akses Neon/provider |
| **Landing Page** | landing | Marketing statis dengan mockup POS, resep, laba |
| **Paket & Limit (v6 M1)** | owner, pos | Plan Free/Pro/Business + enforcement limit di server (outlet, karyawan, produk, bahan, transaksi) |
| **Pembayaran QRIS Pelanggan & Saldo (v6.1)** | pos, owner, superadmin | QRIS dinamis via Vessel + saldo merchant (ledger) + withdrawal manual + rekonsiliasi/analytics. **M1-M4 tersedia di source** |

### 1.3 Environment dan Domain

| App | Localhost | Development (Vercel) | Production (Dephilia) |
|---|---|---|---|
| Landing | `http://localhost:3003` | URL Vercel belum dikonfirmasi | `https://rakku.dephilia.com` |
| Owner | `http://localhost:3000` | `https://rakku.vercel.app` | `https://app.rakku.dephilia.com` |
| POS | `http://localhost:3001` | `https://pos-rakku.vercel.app` | `https://pos.rakku.dephilia.com` |
| Superadmin | `http://localhost:3002` | `https://superadmin-rakku.vercel.app` | `https://admin.rakku.dephilia.com` |

Development/production adalah klasifikasi deployment Rakku. URL `*.vercel.app` dapat tetap memakai environment Vercel **Production**, `.env.production`, dan build `NODE_ENV=production`. Domain production di tabel adalah keputusan yang dikonfirmasi developer, bukan bukti domain assignment/env cloud sudah selesai.

Pada rollout 8 Oktober 2026, Owner/POS Vercel lulus login/session/dashboard/register; Superadmin Vercel lulus route activation/Auth dan guard anonim, serta akun admin telah diaktivasi oleh pemiliknya. Custom domain Superadmin terakhir masih 404. Production Owner/POS/Landing belum memiliki hasil smoke test tercatat. Database/Auth lokal dan deployment yang diverifikasi masih resource Neon bersama; isolasi development-production belum diterapkan.

---

## 2. Tech Stack

### 2.1 Aplikasi

| Layer | Teknologi | Keterangan |
|-------|-----------|------------|
| **Framework** | Next.js 14.2.35 / 16.4.0 | Owner/POS/Landing memakai 14; Superadmin memakai 16 untuk SDK Neon Auth |
| **Bahasa** | TypeScript 5.x | Strict mode, path alias `@/*` dan `@rakku/*` |
| **Database** | Neon Postgres | Runtime role `rakku_runtime`, pooled SQL server-only; PostgreSQL 18.6 terverifikasi |
| **Database layer** | Drizzle 0.45.1 + `postgres.js` 3.4.8 | Query compiler berparameter, catalog FK, native transactions, FORCE RLS |
| **Auth (Tenant)** | Custom (JWT + bcrypt) | 4-step login: Company → Outlet → Akun → PIN |
| **Auth (Owner)** | Custom (JWT + bcrypt) | Email + password, verifikasi email, reset sandi |
| **Auth (Superadmin)** | Neon Managed Better Auth | `@neondatabase/auth` 0.5.0-beta, invitation + allowlist privat |
| **State** | Zustand 5.x | Cart store POS, sidebar store |
| **Demo sandbox** | Browser memory (`@rakku/demo`) | Fixture immutable, command atomik, adapter API lokal; tanpa cookie/storage/Neon |
| **Styling** | Tailwind CSS 3.x | Preset bersama `rakkuPreset` dari `@rakku/ui` |
| **Icons** | lucide-react | Icon set konsisten |
| **Animasi** | framer-motion 11.x | Sidebar, landing page, transisi |
| **Drag & Drop** | @dnd-kit | Urutkan kategori & pricing tier |
| **QR Code** | qrcode.react 4.x | QR menu di owner settings |
| **Image Processing** | sharp 0.35.x | Kompresi WebP 800px sebelum upload |
| **PWA** | Serwist 9.x | Service worker (hanya `apps/pos`, production) |
| **JWT** | jose 6.x (via `@rakku/auth-utils`) | Sign/verify JWT HS256 |
| **Hashing** | bcryptjs 3.x | Password owner/company & PIN karyawan |
| **Monorepo** | pnpm workspace + Turborepo | 4 app + 14 package internal |

### 2.2 Layanan Eksternal

| Layanan | Dipakai untuk | Env |
|---------|---------------|-----|
| **Neon** | PostgreSQL + Managed Better Auth untuk Superadmin | `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` |
| **Echo** (`echo.dephilia.com`) | Email transaksional (verifikasi, reset sandi, laporan) | `ECHO_API_URL`, `ECHO_API_KEY`, `ECHO_FROM` |
| **Silos** (`silos.dephilia.com`) | Upload/hapus file gambar | `SILOS_API_URL`, `SILOS_API_KEY` |
| **CDN Dephilia** (`cdn.dephilia.com`) | URL publik gambar (produk, logo email) | — (dari response Silos) |
| **Vessel** (`vessel.surn.me`) | QRIS langganan dan QRIS dinamis pelanggan | `VESSEL_API_URL`, `VESSEL_API_KEY` (server-only, owner dan POS) |

Email aplikasi dan invitation Superadmin memakai Echo. Email verification/password reset Managed Better Auth memakai konfigurasi pengiriman Auth tersendiri. Variabel Supabase, `SMTP_*`, `EMAIL`, dan `APP_PASSWORD` telah dibersihkan dari env aktif; tidak diperlukan untuk runtime Neon.

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
│   │   │   ├── demo/                 # /demo, /demo/owner/*, /demo/pos/*, /demo/menu/[slug]
│   │   │   └── api/
│   │   │       ├── auth/owner/       # login, register, logout, session, verify-email,
│   │   │       │                      # resend-verification, forgot-password, reset-password
│   │   │       ├── onboarding/       # suggest kode/slug + buat company + outlet + seed tiers
│   │   │       └── owner/            # outlets, employees, roles, menus, products, categories,
│   │   │                              # pricing-tiers, product-tier-prices, modifiers, ingredients,
│   │   │                              # recipes, orders, taxes, discounts, tables, menu-qr,
│   │   │                              # settings, reports/profit-loss, reports/send-email
│   │   ├── src/components/           # auth, layout (+OwnerShell), owner (+OwnerDashboardView),
│   │   │                              # demo, charges, products, reports, billing, ui
│   │   ├── src/hooks/                # useMediaQuery, useModalHistory, useNavMode, useSwipe
│   │   ├── src/lib/                  # auth, store, merchant-runtime, supabase, format
│   │   ├── src/middleware.ts           # JWT gate; DB checks pada layout/API
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
│   │   ├── src/components/           # layout (+PosShell), auth, menu, register, products,
│   │   │                              # charges, inventory, reports, billing, ui
│   │   ├── src/hooks/                # useNavMode, useDraftCount, useLowStockCount, dll
│   │   ├── src/lib/                  # auth, db (tenant boundary), store, merchant-runtime,
│   │   │                              # supabase, format
│   │   ├── src/middleware.ts           # JWT/Origin API guard + metadata route
│   │   ├── next.config.mjs           # withSerwist + downlevel ES2017
│   │   ├── vercel.json
│   │   └── .env.local
│   │
│   ├── superadmin/                    # @rakku/superadmin — port 3002
│   │   ├── src/app/
│   │   │   ├── login/ activate/ reset-password/ # Neon Managed Better Auth
│   │   │   ├── (protected)/          # companies, outlets, menus, roles, access-matrix,
│   │   │   │                          # users, audit-logs
│   │   │   ├── api/auth/[...path]/   # Proxy Auth dengan endpoint allowlist
│   │   │   └── api/superadmin/       # resources platform, invitation activation, logout
│   │   ├── src/lib/auth/              # SDK, allowlist, origins, require-superadmin
│   │   ├── src/proxy.ts               # Next.js 16 session gate
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
│   ├── shared-types/                  # common.ts, tenant.ts, owner.ts, inventory.ts, billing.ts
│   ├── db/                           # Drizzle/Postgres, SQL compiler, migrations, RLS, invitation
│   ├── auth-utils/                   # jwt.ts, pin.ts, audit-log.ts
│   ├── ui/                           # Badge/Tabs/Toast/SlideOver/PageHeader, RegisterProductCard,
│   │                                  # merchant-runtime + tailwind.preset
│   ├── plans/                        # getCompanyPlan, checkLimit, checkFeature, getUsageSummary (v6)
│   ├── ledger/                       # creditBalance, holdBalance, releaseBalance, adjustBalance, getBalance (v6.1)
│   ├── emails/                       # renderRakkuEmail + sendBillingEmail (idempotent, v6.1)
│   ├── inventory/                    # deductStockForOrder (dipindah dari apps/pos, v6.1 M2)
│   ├── payments/                     # createQrisIntent, processOrderPayment (QRIS order idempotent, v6.1 M2)
│   ├── vessel-client/                # createQrisPayment, getPaymentStatus, syncPaymentStatus → Vessel API
│   ├── pricing/                      # DEFAULT_TIERS, seedDefaultTiers, syncProductTierPrices
│   ├── echo-client/                  # sendEmail() → Echo API
│   ├── silos-client/                 # uploadFile(), deleteFile(), getFile() → Silos API
│   └── demo/                         # Fixture + sandbox browser-memory, adapter runtime, e2e demo
│
├── supabase/                          # Historis; tidak dipakai provisioning Neon
│   ├── migrations/                   # 30 file lama (001-031, tanpa 005)
│   └── seed.sql                      # Dataset historis
│
├── scripts/
│   ├── seed.ts                       # Seed company RAKKU
│   ├── seed-full.ts                  # Seed TOKOKO + Outlet Cabang (STOCKO)
│   ├── seed-build.ts                 # Seed tenant BUILD COFFEE lengkap (inventory, meja, QR)
│   ├── seed-build-images.ts          # Download foto Wikimedia → sharp → upload Silos
│   ├── backfill-owners.ts            # Backfill akun owner untuk company existing
│   ├── neon-*.ts                     # Provision/migrate/seed/check/copy/smoke/env/Auth/status
│   ├── invite-superadmin.ts          # Invitation sekali pakai via Echo
│   ├── lib/neon-config.ts            # Direct DB utilities + 39 APPLICATION_TABLES
│   └── generate-favicons.mjs         # Generate favicon per app
│
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml               # Workspace: apps/* + packages/*
├── package.json                      # Root scripts (dev, build, lint, seed, dll)
├── tsconfig.base.json                # Base TS config + path alias @rakku/*
├── .env.local                        # Env root scripts; tidak dibaca app Next.js
├── .env.neon                         # Referensi konfigurasi privat instalasi aktif (ignored)
├── NEON_MIGRATION.md                  # Setup, deploy, invitation, optional copy, recovery
├── DEMO.md                           # Arsitektur/operasional demo publik browser-memory
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

Salin `.env.example` root dan setiap app menjadi `.env.local`, lalu isi sesuai template. Next.js membaca env di direktori app, bukan `.env.local` root monorepo. Untuk build/start lokal production, gunakan `.env.production.local`; file `.env.production` tracked hanya berisi URL/nilai publik. Env cloud diisi pada **Vercel Project Settings** tiap project dan tidak tersinkron dari file lokal.

Demo publik tidak memerlukan secret/feature flag baru. Demo menggunakan origin Owner dan hanya membaca `NEXT_PUBLIC_OWNER_URL`/`NEXT_PUBLIC_POS_URL` yang sudah ada untuk CTA dan redirect POS; provider/DB production tidak dihubungi oleh aktivitas demo.

| Variabel | Root scripts | Owner | POS | Superadmin | Landing | Fungsi |
|---|---|---|---|---|---|---|
| `DATABASE_URL` | Ya | Ya | Ya | Ya | — | Pooled Neon URL dengan runtime role, server-only |
| `DATABASE_URL_UNPOOLED` | Ya | — | — | — | — | Direct URL migration owner; bukan credential app |
| `SOURCE_DATABASE_URL` | Opsional | — | — | — | — | Source lama untuk copy/check/assets saja |
| `OWNER_JWT_SECRET` | — | Ya | — | — | — | JWT Owner, minimal 32 karakter |
| `POS_JWT_SECRET` | — | — | Ya | — | — | JWT POS, minimal 32 karakter |
| `NEON_AUTH_BASE_URL` | Untuk Auth check | — | — | Ya | — | Endpoint Managed Better Auth branch yang sama dengan database |
| `NEON_AUTH_COOKIE_SECRET` | — | — | — | Ya | — | Secret cookie SDK, minimal 32 karakter |
| `SUPERADMIN_URL` | Ya | — | — | Ya | — | Origin invitation dan guard app |
| `SUPERADMIN_ALLOWED_ORIGINS` | — | — | — | Bila memakai alias | — | Alias origin app, dipisah koma |
| `NEXT_PUBLIC_OWNER_URL` | Sesuai script/email | Ya | Ya | Ya | Ya | Link Owner, auth email, callback, CTA |
| `NEXT_PUBLIC_POS_URL` | — | Ya | Ya | — | Ya | Link POS, menu QR, CTA |
| `SILOS_API_URL` / `SILOS_API_KEY` | Seed/assets | Ya | Ya | — | — | Upload/hapus gambar |
| `ECHO_API_URL` / `ECHO_API_KEY` / `ECHO_FROM` | Invitation | Ya | Ya | Ya | — | Email Rakku dan invitation |
| `VESSEL_API_URL` / `VESSEL_API_KEY` | — | Ya | Ya | — | — | Pembayaran provider, server-only |
| `CRON_SECRET` | — | Ya | — | — | — | Proteksi cron billing |

Tidak ada URL/key Supabase yang diperlukan. Database/password/API keys tidak memakai prefix `NEXT_PUBLIC_`. Landing hanya memerlukan URL Owner/POS; tanpa nilai tersebut CTA dapat terbentuk sebagai `undefined/register` atau `undefined/login`.

**Profil URL:**

| Variable | Localhost | Development Vercel | Production Dephilia |
|---|---|---|---|
| `NEXT_PUBLIC_OWNER_URL` | `http://localhost:3000` | `https://rakku.vercel.app` | `https://app.rakku.dephilia.com` |
| `NEXT_PUBLIC_POS_URL` | `http://localhost:3001` | `https://pos-rakku.vercel.app` | `https://pos.rakku.dephilia.com` |
| `SUPERADMIN_URL` | `http://localhost:3002` | `https://superadmin-rakku.vercel.app` | `https://admin.rakku.dephilia.com` |

Pada instalasi aktif, `.env.neon` menjadi sumber privat dan scripts database default membaca `.env.local` root. `NEON_ENV_FILE` dapat memilih file lain untuk scripts Neon. `auth:check` default memakai `.env.neon`; `env:check` khusus membandingkan `.env.neon` dengan file lokal instalasi bersama, bukan env Vercel. Pemisahan branch/env kelak memerlukan penyesuaian checker itu.

File `.env.production` Owner/POS/Landing masih memakai URL Vercel; Superadmin memakai Owner Vercel, canonical Dephilia, dan alias Vercel. Root invitation sementara memakai Superadmin Vercel yang tersedia. Profil di tabel adalah konfigurasi tujuan dan belum otomatis mengubah file atau cloud env.

Connection runtime dan migration owner menunjuk endpoint/database yang sama, tetapi role berbeda. Driver menghapus parameter libpq `channel_binding`, memverifikasi certificate TLS hosted (`sslmode=verify-full`), dan menonaktifkan prepared statements untuk pooled runtime. Script migrasi/copy menolak URL pooler. `.env.neon`, `.env*.local`, dump, dan backup privat di-ignore.

Trusted domains pada Console Neon Auth terpisah dari `SUPERADMIN_ALLOWED_ORIGINS`. Alias yang dipakai harus diizinkan di keduanya. Origin localhost `3002`, Superadmin Vercel, dan Superadmin Dephilia diterima pada rollout; ini tidak membuktikan custom domain sudah melayani route aplikasi.

### 4.2 `next.config.mjs` per App

**`apps/owner`**
- `redirects()` (non-permanent): `/pricing-tiers` → `/products`; `/taxes` → `/tax-discounts?tab=pajak`; `/discounts` → `/tax-discounts?tab=produk`.
- `images.remotePatterns`: `https://cdn.dephilia.com`.
- `transpilePackages`: shared types, DB, auth, UI, emails, ledger, plans, payments, dan Vessel; daftar exact ada di config.

**`apps/pos`**
- Dibungkus `withSerwistInit` (lihat §13) + plugin webpack `DownlevelSerwistSW` yang menurunkan sintaks bundle service worker/chunk ke **ES2017** untuk Android WebView lama (browserslist: Android ≥ 8, Chrome ≥ 62).
- Redirect sama seperti owner, plus `/categories` → `/products`.
- `images.remotePatterns`: CDN Dephilia.
- `transpilePackages`: package domain POS termasuk DB/auth/pricing/inventory/payments/plans, `@serwist/next`, dan `serwist`.

**`apps/superadmin`**
- `images.remotePatterns`: CDN Dephilia.
- `transpilePackages`: emails, ledger, pricing, shared types, DB, dan UI.

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

### 4.5 Middleware dan Proxy

Middleware Owner/POS berada di **`src/middleware.ts`**, sesuai struktur app yang memakai `src/app`. Superadmin Next.js 16 memakai **`src/proxy.ts`**. Gate ini tidak membuka koneksi PostgreSQL; pemeriksaan authoritative berada di layout/API/database boundary.

| App | Gate request | Pemeriksaan authoritative |
|---|---|---|
| Owner | JWT pada matcher dashboard/onboarding/outlet/employee/settings/report/order/subscription/balance; login/register tetap dapat dibuka | `getOwnerSessionFromCookies()` membaca owner aktif dan company yang dimiliki serta statusnya; API memverifikasi resource company/outlet |
| POS | JWT pada halaman utama dan `/api/admin/*`, `/api/reports/*`; mutasi API harus memiliki Origin sama dengan request origin | Session user/company/outlet aktif, role dan assignment outlet; menu-level `can_view` di `src/lib/db.ts`; tenant RLS/trigger FK |
| Superadmin | SDK Neon Auth session gate; login/activate/reset/API dikecualikan matcher | Session Neon + allowlist `active`/`superadmin`; Origin bila ada cocok canonical/alias |
| Landing | Tidak ada middleware/Auth | Tidak ada data privat |

POS menulis `x-rakku-path` dan metadata API server-side serta menimpa metadata client. Client tidak boleh menentukan route/method capability sendiri. Halaman yang tidak masuk daftar gate JWT tertentu tetap berada pada protected layout; matcher lengkap ada pada file source masing-masing.

### 4.6 `vercel.json`

Semua app deploy sebagai project Vercel terpisah, Root Directory `apps/<app>`, dengan pola build yang sama (ganti `<app>` menjadi nama app):

```json
{
  "buildCommand": "pnpm --filter @rakku/<app> build",
  "installCommand": "PNPM_ONLY_BUILT_DEPENDENCIES=esbuild,unrs-resolver pnpm install",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

Owner juga menjadwalkan cron `/api/cron/billing` dengan `0 1 * * *` (01:00 UTC). Domain assignment dan env ada di Vercel Project Settings; `vercel.json` tidak menetapkan domain atau mengirim secret lokal. Integrasi Neon di satu project dapat menyediakan resource bersama, tetapi app server lain tetap membutuhkan `DATABASE_URL` runtime manual. Env integrasi ber-prefix bukan pengganti env Rakku.

---

## 5. Arsitektur

### 5.1 Multi-Tenancy

- **Company** = tenant (instalasi testing aktif: `DEMO`); **Outlet** = cabang dalam company. RAKKU/TOKOKO/BUILD adalah pilihan dataset legacy.
- Model data memakai `company_id` dan, untuk data operasional, `outlet_id`.
- POS memakai `createTenantClient()` request-local. Scope `app.scope=tenant`, `app.company_id`, `app.outlet_id`, dan `app.user_id` dipasang transaction-local; FORCE RLS membatasi tabel langsung dan children melalui parent FK.
- Trigger `0004_tenant_integrity.sql` menolak parent/product/tier/ingredient/order/table/role/outlet yang tidak cocok dengan company/outlet resource. Query tetap memakai filter resource yang relevan.
- **Ownership:** `companies.owner_id` → `owners.id`. Owner memeriksa ownership/company aktif dari DB dan memakai helper scoping seperti `verifyOutletBelongsToCompany()`.
- `@rakku/db.createAdminClient()` memakai `app.scope=platform` pada server tepercaya. Ini bukan role `BYPASSRLS`, tetapi policy memang mengizinkan akses lintas tenant untuk scope platform; guard aplikasi wajib mendahului penggunaan client ini. Credential runtime tidak pernah dibagikan kepada browser.

### 5.2 RBAC (Role-Based Access Control)

- **Superadmin** memakai Managed Better Auth untuk identitas dan allowlist privat untuk hak platform. Session Auth saja tidak cukup; subject harus terdaftar dengan status `active` dan role `superadmin`.
- **Role** didefinisikan per company. Onboarding membuat Owner/Kasir; DEMO mempunyai satu role kasir. Dataset legacy dapat mempunyai role tambahan seperti Kepala Cabang/Admin.
- **Menu** = modul sistem di tabel `menus`; menu aktif saat ini: `register`, `orders`, `reports`, `products`, `tax-discounts`, `ingredients`, `tables`, `expenses`, `purchases`.
- **Access matrix** = `role_menu_access` (role × menu). UI dan POS database boundary memakai `can_view`. Kolom `can_create`, `can_edit`, dan `can_delete` tersedia, tetapi belum menjadi kontrak CRUD terpisah pada UI/API.
- Route/method dipetakan ke menu di `apps/pos/src/lib/db.ts`; beberapa read katalog diizinkan untuk `register` agar kasir dapat bertransaksi tanpa akses mutasi produk.
- Sidebar POS dirender dari `getAllowedMenus(roleId)`. Onboarding baru membuat role **Owner** dengan semua menu yang ada dan **Kasir** dengan `register`, `orders`, `reports`, serta `tax-discounts`; akses dapat diubah lewat panel "Kelola Role & Akses". Script BUILD memakai access map sendiri dan masih menyebut slug legacy `taxes` (§16.4).

### 5.3 Pola Server vs Client

| Konteks | Pola |
|---------|------|
| Halaman dashboard | Server Component: verifikasi session/ownership/menu → query server Neon → kirim props ke client component |
| Aksi tulis (CRUD) | Client component → API Next.js → guard/scope → query/transaksi Drizzle/Postgres |
| Browser Auth | Superadmin memakai SDK client lewat proxy Auth Next.js; browser tidak memiliki credential PostgreSQL |
| Cache | POS register memuat katalog saat server render; data dinamis (draft count, low stock) dipoll client tiap 30 detik |

### 5.4 Alur Data Order

```
Register (cart store)
   │  items + modifier + tier + pajak/diskon + meja + customer
   ▼
POST /api/admin/orders  ── atau ──  POST /api/admin/orders/draft (pay-later, reserved_until 24 jam)
   │
   ├─ guard session/menu + scope company/outlet/cashier dari session
   └─ transaksi: orders + order_items + split_payments
       ├─ snapshot nama/harga, taxes/discounts (jsonb)
       ├─ completed → deductStockForOrder() + stock_movements
       └─ completed ber-meja → dining_tables.status = 'occupied'
   ▼
InvoiceReceipt (print 58mm) / Invoice page
```

- **Draft:** create/replacement items/completion memakai transaksi. Saat completed, deduksi stok dan occupancy ikut commit; row lock/unique stock movement mencegah deduksi ganda.
- **Split bill:** `POST /api/admin/orders/split` hanya mencatat `split_payments` (tidak menyentuh stok).
- **Switch user / shift:** event login/switch/shift POS dicatat di `auth_audit_logs`; tabel ini bukan log seluruh session Managed Auth/Owner.

Endpoint order standar memakai company/outlet/cashier dari session, bukan ID tenant client. Harga, pajak, diskon, dan total masih berasal dari payload client; server belum menghitung ulang seluruh nominal berdasarkan katalog. Ini tetap keterbatasan integritas business input (§16.6), meskipun scope tenant dan transaksi sudah diperbaiki.

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
- Deduksi memakai fungsi invoker `deduct_stock_for_order`, lock order/ingredients berurutan, aritmetika SQL, dan unique sale-deduction index. Pembelian/opname menyimpan perubahan stok dan movement dalam transaksi yang sama; runtime tidak mendapat UPDATE/DELETE pada movement.
- Badge "stok menipis" muncul bila `min_stock_alert > 0` dan `stock_quantity <= min_stock_alert` (poll 30 detik).

### 5.6 Email Transaksional (Echo)

- Package `@rakku/echo-client` → `sendEmail({ to, subject, html, from? })` → `POST {ECHO_API_URL}/api/send` dengan `Authorization: Bearer {ECHO_API_KEY}`.
- `from` default `ECHO_FROM` (mis. `rakku@notify.dephilia.com`).
- Template email: package `@rakku/emails` → `renderRakkuEmail()` (eyebrow, title, paragraf, CTA, note) dengan logo **absolut** ke `cdn.dephilia.com` (bukan URL app, agar bisa dimuat klien email).
- Pengiriman saat ini: verification/reset Owner, laporan penjualan Owner/POS, invitation Superadmin, dan notifikasi billing/withdrawal. Verification/reset Managed Auth memakai konfigurasi email Neon Auth terpisah.
- Kegagalan kirim **tidak** boleh di-swallow: route mengembalikan error ke UI (kecuali kebijakan khusus).

### 5.7 Gambar & Silos

- Upload gambar produk (owner & POS): validasi JPG/PNG/WebP ≤ 2 MB → kompres `sharp` ke WebP maks 800px → `uploadFile()` ke Silos → simpan `products.image_url` + `products.image_silo_id`.
- Hapus gambar: `deleteFile(image_silo_id)` + null-kan kolom (POS: `DELETE /api/admin/products/image`).
- URL publik file dari Silos berupa `https://cdn.dephilia.com/...` (sudah di-allow di `next.config`).
- Runtime tidak bergantung pada Supabase Storage. `products.image_silo_id` tersedia pada baseline Neon; utilitas `db:images` hanya untuk pemindahan asset source lama yang opsional.
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
- `GET/POST /api/cron/billing` (dilindungi `CRON_SECRET`, Vercel Cron `0 1 * * *`): sync invoice/payment intent pending ke Vessel, expire trial/langganan, kirim reminder, dan peringatan kuota. **`?dry=1` bukan mode read-only**: sync/finalisasi pembayaran tetap terjadi sebelum return; hanya tahap siklus langganan/notifikasi berikutnya yang dilewati.
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

Nomor migration `028`–`031` pada riwayat milestone berikut adalah nomor Supabase lama. Seluruh schema fitur ini sekarang termasuk baseline Neon `0001_baseline.sql`; fungsi transaksi, RLS, dan tenant integrity memakai `0002`–`0004`.

- M1: migration 028, package `@rakku/ledger`, halaman owner `/balance`, halaman superadmin `/balances` + koreksi saldo (adjustment).
- M2: migration 029, packages `@rakku/inventory` + `@rakku/payments`, endpoint POS QRIS (create/poll/retry/cancel), webhook diperluas, cron sync, UI QRIS di PaymentModal, badge "Menunggu".
- M3: migration 030, rekening bank + pengajuan pencairan (hold saldo), antrian superadmin (proses/selesai/tolak + bukti), notifikasi email via `@rakku/emails`.
- M4: migration 031 (`settlement_reports`), halaman superadmin `/reconciliation` (saldo sistem vs posisi kas vs settlement, selisih/gap) dan `/analytics` (volume QRIS, MDR, saldo, pencairan, grafik 14 hari); bullet QRIS di landing.

**Konsep:** pelanggan membayar via **QRIS dinamis milik Rakku** (Vessel/DOKU). Uang masuk ke akun Rakku, merchant mendapat **saldo** yang bisa dicairkan (withdrawal) ke rekening bank.

**Alur QRIS dinamis (POS):**
1. Kasir pilih QRIS → "QRIS Dinamis (Rakku)" → order dibuat `pending_payment`/`unpaid` + `payment_intents` + QR dari Vessel (`expired_in_minutes: 15`).
2. QR + countdown tampil di kasir; status dicek via webhook **dan** polling tiap 4 detik (selalu re-verify ke Vessel).
3. Sukses → re-verify provider di luar transaksi, lalu lock intent/order, finalisasi order, stok, meja, ledger credit, dan status intent success dalam transaksi yang sama. Kegagalan tahap database me-rollback rangkaian tersebut.
4. Expired → order tetap pending; kasir bisa buat QR baru (retry) atau batalkan.
5. **QRIS manual lama tetap ada** (uang langsung ke QRIS merchant, tidak masuk ledger); dinamis otomatis nonaktif untuk split bill / pembayaran draft.

**Fee & saldo:**
- MDR **pass-through 0,7%**: `saldo masuk = gross − round(gross × 0.007)`; Rakku tidak mengambil margin.
- Ledger `balance_transactions` = sumber kebenaran (append-only, idempotent UNIQUE `company_id+reference_type+reference_id+type`); `merchant_balances` = cache saldo.
- Mutasi memakai fungsi PostgreSQL `apply_balance_transaction` (**SECURITY INVOKER**, company balance lock, tolak available/pending negatif). Grants diberikan ke runtime role; otorisasi platform/tenant tetap mengikuti server boundary dan policy, bukan service role Supabase.
- Refund QRIS belum tersedia di API Vessel → koreksi lewat `adjustment` manual superadmin.

**Withdrawal (manual dulu):**
- Owner ajukan dari `/balance` → lock company, periksa limit, insert withdrawal dan hold saldo (`available → pending`) dalam transaksi.
- Superadmin memproses transfer manual lalu **completed** (referensi + bukti) atau **rejected** (saldo kembali); lock withdrawal, ledger transition, dan status ikut transaksi, email setelah commit.
- Default: minimum Rp50.000, biaya Rp0, maks 1 pengajuan pending per company, maks Rp10 juta/hari (konstanta, mudah diubah).
- Notifikasi email: pengajuan diterima, selesai, ditolak. Pembayaran pelanggan tidak memicu email.

Disbursement masih manual dan refund provider belum tersedia. Saldo kewajiban merchant, posisi kas, dan settlement dicatat melalui fitur rekonsiliasi; jangan menyamakan keberhasilan login smoke dengan verifikasi pembayaran/settlement nyata.

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

- Identitas email/password dikelola **Neon Managed Better Auth**, melalui SDK `@neondatabase/auth`. Browser mengakses proxy `/api/auth/[...path]`; app tidak membuka signup publik atau admin-plugin proxy.
- Bootstrap: `pnpm admin:invite <email>` mengirim link sekali pakai via Echo. Token acak 256-bit, hash SHA-256 pada `app_private.superadmin_invites`, expiry 24 jam; token berada di fragment `/activate#token=...`.
- Aktivasi: periksa token → buat akun Auth bila perlu → sign-in membuktikan password → transaksi lock invitation, cocokkan email/subject, insert/update allowlist, tandai `used_at`. Invitation baru membatalkan pending invitation lama.
- Hak panel/API: subject harus ada di `app_private.superadmins` dengan `status=active` dan `role=superadmin`. Akun Auth tanpa allowlist tidak diberi hak platform.
- `src/proxy.ts` hanya session gate. Protected layout/API memeriksa session + allowlist melalui helper Auth; beberapa callers mempertahankan bentuk adapter `auth.getUser()` historis yang sekarang mengarah ke pemeriksaan Neon tersebut.
- SDK session-data cache 60 detik; membership diperiksa ulang pada boundary. `NEON_AUTH_COOKIE_SECRET` minimal 32 karakter.
- Logout: `POST /api/superadmin/auth/logout` memanggil sign-out Neon. Password reset melalui `/reset-password`; delivery email Managed Auth harus diuji terpisah dari Echo invitation.
- Origin guard app mengizinkan canonical `SUPERADMIN_URL` dan alias `SUPERADMIN_ALLOWED_ORIGINS` bila header Origin ada. Trusted domains Auth di Console Neon adalah konfigurasi terpisah.

Operator memeriksa membership dengan `pnpm admin:status [email]`; pencabutan akses aplikasi memakai `status=inactive` pada allowlist. Flow lengkap dan recovery aktivasi ada di [NEON_MIGRATION.md](NEON_MIGRATION.md#4-superadmin-invitation-dan-aktivasi).

### 6.4 Cookie & JWT

| Cookie | App | Isi | TTL | Secret |
|--------|-----|-----|-----|--------|
| `pending_login` | pos | company_id, company_name, outlet_id, outlet_name | 10 menit | `POS_JWT_SECRET` |
| `session` | pos | user/company/outlet/role + nama | JWT expiry dan cookie 12 jam | `POS_JWT_SECRET` |
| `owner_session` | owner | owner_id, email, name, company_id/name/slug | 24 jam (30 hari remember) | `OWNER_JWT_SECRET` |
| Neon Auth cookies | superadmin | Dikelola SDK Managed Better Auth | Session Auth + cache SDK 60 detik | `NEON_AUTH_COOKIE_SECRET` |

- Cookie custom menggunakan HttpOnly dan SameSite=Lax. `owner_session` dan `session` menambahkan `Secure` pada `NODE_ENV=production`; `pending_login` belum menambahkannya.
- JWT custom memakai jose HS256. Middleware mengimpor `@rakku/auth-utils/jwt` agar tidak menarik bcrypt/DB; Superadmin memakai SDK Auth, bukan JWT custom tersebut.
- Session signing dan pending login fail-fast bila JWT secret kosong/<32 karakter. Route Owner register/resend/verify-email masih memiliki fallback verification secret historis; env tetap wajib diisi (§16.6).
- POS server session memeriksa ulang user/company/outlet aktif, company/outlet cocok, role tidak berubah, dan assignment outlet. Ini invalidasi berbasis keadaan DB, bukan daftar pencabutan setiap JWT individual.
- Owner server session membaca ulang owner aktif dan company yang dimiliki/status aktif, sehingga ownership tidak dipercayai hanya dari payload cookie.

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

## 7. Database (Neon Postgres)

Baseline aktif berada di `packages/db/migrations/`: **empat migration**, **39 tabel `public`**, serta private tables untuk Superadmin. PostgreSQL 18.6/database `neondb` terverifikasi pada rollout. Schema Managed Better Auth `neon_auth` diaktifkan melalui Neon dan tidak dibuat/diimpor oleh migration aplikasi. Runtime tidak memakai Neon Data API atau Supabase SDK.

| Schema | Isi | Pengelolaan |
|---|---|---|
| `public` | 39 tabel bisnis, SQL functions, indexes, tenant triggers/RLS | Migration aplikasi |
| `app_private` | `superadmins`, `superadmin_invites`, scope helpers | Migration aplikasi; bukan API publik |
| `rakku_migrations` | `history`: nama/checksum/waktu migration | Runner `db:migrate` |
| `neon_auth` | Identitas/session Managed Better Auth | Layanan Neon Auth |

DDL exact adalah SQL baseline, bukan daftar historis `supabase/migrations/` atau file export lokal. `packages/db/src/schema.ts` mendefinisikan private tables Drizzle; tabel bisnis/relasi pada compatibility query layer dibaca dari catalog PostgreSQL. Daftar kanonik 39 tabel ada di `scripts/lib/neon-config.ts`.

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

Seluruh tabel bisnis di bawah dibuat oleh `0001_baseline.sql`. Nomor `001`–`031` pada §7.6 hanya menjelaskan asal fitur historis, bukan urutan provisioning Neon.

#### Core

**`categories`** — Kategori produk

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| name | text | |
| sort_order | int | |
| company_id / outlet_id | uuid FK | Scope tenant |
| created_at | timestamptz | |

**`products`** — Produk

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| name | text | |
| price | numeric(10,2) | Base price, nullable; default 0 |
| category_id | uuid FK→categories | |
| image_url | text | URL publik CDN Dephilia (Silos) |
| image_silo_id | text | ID file Silos untuk hapus |
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
| price_delta | numeric(10,2) | Nullable, default 0; delta per-tier ada pada `modifier_tier_prices` |
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
| customer_name | text | Handler order mewajibkan nama; kolom baseline nullable |
| cashier_name | text | Snapshot nama kasir |
| status | text | draft, pending_payment, completed, cancelled |
| payment_status | text | unpaid, partial, paid, refunded |
| note | text | |
| reserved_until | timestamptz | Expiry draft (24 jam) |
| pricing_option_id | uuid FK→pricing_options | |
| pricing_tier_id | uuid FK→pricing_tiers | |
| split_bill | boolean | |
| source | text | Default `'pos'` |
| table_id | uuid FK→dining_tables | Meja terkait |
| payment_channel | text | `dynamic_qris` / `manual_qris` / null untuk channel lain |
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

#### Tenant & RBAC

**`companies`** — Perusahaan (tenant)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| code | text UNIQUE | Kode login kasir |
| name | text | |
| password_hash | text | bcrypt (dipakai step 1 POS) |
| logo_url | text | |
| status | text | active, suspended |
| owner_id | uuid FK→owners | Pemilik |
| slug | text UNIQUE | Slug bisnis |
| plan_id | uuid FK→plans | Paket aktif |
| subscription_status | text | trial/active/grace/expired/cancelled pada aplikasi |
| trial_ends_at | timestamptz | Trial Pro 14 hari |
| plan_expires_at | timestamptz | Akhir periode berbayar |
| billing_cycle | text | monthly/yearly |
| failed_login_attempts | int | Rate limit password company |
| login_locked_until / last_login_attempt | timestamptz | Lockout/waktu percobaan |
| created_at | timestamptz | |

**`outlets`** — Cabang

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid PK | |
| company_id | uuid FK→companies | |
| name | text | UNIQUE per company |
| address | text | |
| status | text | active, inactive |
| qr_menu_slug | text | Slug menu QR, partial UNIQUE |
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

#### Owner

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
| reset_token_hash | text | SHA-256 token reset |
| reset_token_expires_at | timestamptz | Berlaku 1 jam |
| created_at | timestamptz | |

#### Billing & Langganan

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

`plans`/`menus` dapat dibaca dalam tenant scope; mutasi konfigurasi platform memakai authorized platform client. Semua tabel `public` memiliki FORCE RLS, bukan policy role Supabase `authenticated`.

**`subscriptions`** — Riwayat periode langganan: id, company_id FK cascade, plan_id FK restrict, status (`active`/`expired`/`cancelled`), started_at, current_period_start/end, cancelled_at, created_at.

**`subscription_invoices`** — Tagihan QRIS: id, company_id FK, plan_id FK, billing_cycle (`monthly`/`yearly`), invoice_number UNIQUE, amount, provider (`vessel`), provider_transaction_id UNIQUE, qr_string, status (`pending`/`success`/`expired`/`failed`/`cancelled`), expired_at, paid_at, raw_payload jsonb, timestamps. FK indexes dan updated_at trigger tersedia; akses melalui authorized platform client.

**`notification_logs`** — Log email notifikasi billing: id, company_id FK cascade, type (mis. `trial_h3`, `limit_80`, `payment_success`), period, sent_at. UNIQUE (company_id, type, period) → idempotency notification claim; akses melalui authorized platform client.

#### v6.1 - Pembayaran Pelanggan, Saldo, Withdrawal, dan Settlement

**Saldo dan ledger:**

| Tabel | Isi |
|-------|-----|
| `merchant_balances` | Cache saldo per company: `available_balance`, `pending_balance`, `total_credited`, `total_fees`, `total_withdrawn` |
| `balance_transactions` | Ledger append-only: type (`sale_credit`/`withdrawal_hold`/`withdrawal`/`withdrawal_refund`/`withdrawal_fee`/`adjustment`/`refund`), amount, pending_delta, fee_amount, balance_after, reference + UNIQUE untuk idempotensi |

Fungsi `apply_balance_transaction(...)` dari `0002_atomic_functions.sql` adalah SECURITY INVOKER; company balance lock, idempotency key mencakup company, dan available/pending balance tidak boleh negatif. Runtime tidak diberi UPDATE/DELETE pada ledger.

**Payment intents:**

| Tabel | Isi |
|-------|-----|
| `payment_intents` | QRIS dinamis per order: provider_transaction_id UNIQUE, invoice_number UNIQUE, amount, qr_string, status, expired_at, paid_at |
| `orders.payment_channel` | Channel `dynamic_qris` / `manual_qris` / NULL (cash/kartu) |

**Rekening dan withdrawal:**

| Tabel | Isi |
|-------|-----|
| `merchant_bank_accounts` | Rekening payout: bank_name, account_number, account_holder, is_default, status |
| `withdrawals` | Pengajuan pencairan: amount, fee, net_amount, snapshot rekening, status (`requested`/`processing`/`completed`/`rejected`/`failed`), reject_reason, transfer_proof_url, reference_number, processed_by/at |

**Settlement:**

| Tabel | Isi |
|-------|-----|
| `settlement_reports` | Catatan rekonsiliasi: provider, period_start/end, gross_amount, mdr_amount, net_amount, expected_net (dari ledger), difference, note, created_by |

#### Pricing

**`pricing_options`** — Opsi harga per produk (mis. Gojek Regular/Express): id, product_id, name, price, is_active, company_id, outlet_id, sort_order, timestamps.

**`pricing_tiers`** — Tier harga per outlet: id, company_id, outlet_id, name, slug, is_active, sort_order, created_at. UNIQUE (company, outlet, slug).

**`product_tier_prices`** — Harga produk per tier: id, product_id FK, tier_id FK, price. UNIQUE (product, tier).

**`modifier_tier_prices`** — Delta modifier per tier: id, modifier_id FK cascade, tier_id FK cascade, price_delta (default 0). UNIQUE (modifier, tier).

#### Pembayaran & Pajak

**`split_payments`** — Pembayaran terpisah: id, order_id FK cascade, amount, payment_method (cash/qris/card), status (unpaid/paid), customer_name, items jsonb (`SplitPaymentItem[]`), created_at.

**`taxes`** — Pajak per outlet: id, company_id, outlet_id, name, type (`percentage`/`fixed`), value, is_active, sort_order, created_at.

**`product_discounts`** — Diskon per produk berperiode: id, company_id, outlet_id, product_id, name, type, value, start_date, end_date, is_active, created_at.

**`order_discounts`** — Diskon tingkat order berperiode: id, company_id, outlet_id, name, type, value, start_date, end_date, is_active, created_at.

#### Inventory & Operasional

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

#### Meja & QR

**`dining_tables`** — Meja per outlet: id, company_id, outlet_id, name (mis. "Meja 1"), status (`available`/`occupied`), created_at.

#### Audit

**`auth_audit_logs`** — Log percobaan auth: id, company_id (nullable), outlet_id, user_id, event_type, success, ip_address, user_agent, failure_reason, metadata jsonb, created_at.

#### Private Superadmin

| Tabel | Kolom utama | Fungsi |
|---|---|---|
| `app_private.superadmins` | `auth_subject` text PK, email UNIQUE, status active/inactive, role superadmin, activated_at, created_at | Allowlist hak platform berdasarkan subject Managed Auth |
| `app_private.superadmin_invites` | id, email, token_hash UNIQUE, expires_at, used_at, auth_subject, created_at | Invitation sekali pakai; tidak menyimpan token mentah |

Tabel privat ini di luar hitungan 39 tabel `public`. Schema `neon_auth` dikelola Neon; identity/session tables tidak dimasukkan ke data copy atau migration aplikasi.

### 7.3 Indexes

Baseline membuat index untuk setiap FK `public` dengan pola `idx_<constraint_name>`, ditambah index hot paths berikut. Unique constraints juga membuat index untuk primary/business keys.

| Index | Kolom/perilaku |
|---|---|
| `idx_orders_company_status_created` | company_id, status, created_at |
| `idx_products_company_outlet`, `idx_categories_company_outlet` | company_id, outlet_id |
| `idx_balance_transactions_company`, `idx_balance_transactions_type` | company/timestamp descending atau company/type |
| `idx_withdrawals_company`, `idx_withdrawals_status` | company atau status, requested_at descending |
| `idx_auth_audit_logs_company_created` | company_id, created_at descending |
| `idx_stock_movements_reference` | reference_id |
| `idx_payment_intents_company` | company_id, created_at descending |
| `idx_settlement_reports_period` | period_end descending |
| `idx_outlets_qr_menu_slug` | Partial UNIQUE untuk slug non-null |
| `idx_sale_deduction_once` | Partial UNIQUE company_id/reference_id/ingredient_id untuk sale_deduction |
| `idx_superadmin_invites_email` | Email pada private invitation table |

### 7.4 RLS & Keamanan

- `0003_tenant_policies.sql` mengaktifkan dan **memaksa RLS** pada seluruh 39 tabel `public`. Runtime `rakku_runtime` tidak menjadi pemilik tabel, superuser, atau `BYPASSRLS` role.
- Tenant policies membatasi company/outlet langsung atau melalui parent FK; tabel reference tertentu dapat dibaca tenant. Tabel bisnis platform/billing yang tidak mempunyai tenant policy hanya terbuka pada scope platform.
- FORCE RLS di atas berlaku pada `public`, bukan otomatis pada `app_private` atau `neon_auth`. Private tables mempunyai grants runtime untuk flow server invitation/allowlist; aksesnya dibatasi komposisi helper/route server, bukan policy tenant publik.
- Platform policy mengizinkan scope server `app.scope=platform`. Scope ini dipasang oleh kode server tepercaya dan bukan bukti otorisasi user dengan sendirinya; setiap platform call tetap memerlukan guard/ownership atau verifikasi integrasi sistem.
- Context tenant bersifat transaction-local agar tidak bocor melalui pooled connections. Jangan menyimpan tenant client global atau memakai migration owner sebagai app credential.
- `0004_tenant_integrity.sql` memeriksa konsistensi tenant FK, termasuk children yang tidak memiliki kolom tenant sendiri. FK dibuat deferrable untuk one-transaction restore tanpa menonaktifkan trigger.
- Ledger dan stock movements append-only bagi runtime melalui grants; fungsi finansial/stok memakai SECURITY INVOKER, execute PUBLIC dicabut. RLS tidak menggantikan validasi harga/total atau menu authorization (§16.6).

### 7.5 Daftar Migrasi

| File aktif | Isi |
|---|---|
| `packages/db/migrations/0001_baseline.sql` | 39 tabel bisnis, private Superadmin tables, indexes, updated_at triggers |
| `packages/db/migrations/0002_atomic_functions.sql` | Ledger dan deduksi stok invoker, lock/idempotency/invarians |
| `packages/db/migrations/0003_tenant_policies.sql` | FORCE RLS, scope helpers/platform/tenant policies, FK deferrable |
| `packages/db/migrations/0004_tenant_integrity.sql` | Trigger validasi company/outlet parent links |

`pnpm db:migrate` memakai koneksi direct migration owner, advisory lock, dan history/checksum SHA-256 `rakku_migrations.history`. Baseline menolak `public` yang sudah memiliki tabel. Runtime role harus terpisah dan sudah tersedia; grants diberikan runner. Migration applied tidak boleh diedit; tambahkan file baru untuk perubahan schema berikutnya. Empat file ini sudah diterapkan pada database aktif.

### 7.6 Riwayat Supabase sebelum Neon

Terdapat 30 file historis di `supabase/migrations/` (`001`–`031`, tanpa `005`). Tabel berikut menjelaskan asal fitur **sebelum migrasi**, bukan policy/grants aktif atau instruksi provisioning Neon. Jangan menjalankan chain ini di database Neon baru.

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

Riwayat source pernah mengalami repair/manual drift. Baseline Neon sudah memuat kolom seperti `modifiers.group_name`, `order_items.note`, `split_payments.items`, dan `products.image_silo_id`. Bila suatu saat menyalin source lama, audit schema nyata dan ikuti bagian copy opsional pada [NEON_MIGRATION.md](NEON_MIGRATION.md#7-opsional-rekonsiliasi-dan-copy-source-lama); instalasi aktif tidak memakai copy tersebut.

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
| `/login` | Login Managed Better Auth + allowlist aplikasi |
| `/activate` | Invitation sekali pakai, buat/sign-in akun lalu aktifkan allowlist |
| `/reset-password` | Minta link/form reset password Managed Auth |
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
| `/balances` | Saldo merchant/float dan adjustment beraudit |
| `/withdrawals` | Antrian pencairan, process/complete/reject |

API resource: `/api/superadmin/{companies,outlets,menus,roles,users,access-matrix,audit-logs,plans,subscriptions,balances,withdrawals,reconciliation,payments-analytics}` dengan method sesuai resource. Boundary `createClient()` memanggil `requireSuperadmin()` (session Neon + membership aktif + Origin guard) sebelum memberi platform client; adapter `auth.getUser()` dipertahankan bagi caller lama.

| Endpoint Auth | Method | Fungsi |
|---|---|---|
| `/api/auth/[...path]` | GET/POST sesuai SDK | Proxy allowlist sign-in/email, sign-out, get-session, request/reset-password, verify-email |
| `/api/superadmin/auth/activate` | POST | Verifikasi invitation, akun/password Auth, aktivasi allowlist |
| `/api/superadmin/auth/logout` | POST | Sign-out Managed Auth |

Proxy juga menerima link GET reset-password bertoken. Signup/admin-plugin endpoints tidak dipublikasikan. Next.js 16 memakai async route params pada proxy/handlers dinamis Superadmin.

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

### 8.6 Demo Publik — `apps/owner/src/app/demo/`

Route demo memakai namespace asli di balik prefix aplikasi. Komponen, layout, sidebar, dan alur login yang dirender adalah komponen merchant existing; hanya penyedia datanya berupa sandbox memori. Tidak ada route demo yang memakai session/cookie merchant, API production, atau menulis ke Neon.

| Route | Isi |
|---|---|
| `/demo` | Entry pilih Demo Owner / Demo Kasir |
| `/demo/owner/dashboard` | Dashboard Owner (komponen `OwnerDashboardView` yang sama) |
| `/demo/owner/outlets`, `/employees`, `/settings` | Halaman client Owner existing |
| `/demo/owner/products`, `products/add`, `products/[id]/edit` | Katalog, tier, modifier, resep, upload memori |
| `/demo/owner/orders`, `orders/[id]/invoice`, `/reports`, `/tax-discounts`, `/tables` | Operasional dan laporan Owner |
| `/demo/owner/subscription`, `subscription/checkout/[invoiceId]`, `/balance` | Langganan, invoice simulasi, ledger/withdrawal simulasi |
| `/demo/pos/login`, `login/select-outlet`, `login/select-user`, `login/enter-pin` | Empat langkah login POS existing |
| `/demo/pos/register`, `/orders`, `orders/[id]/invoice`, `/reports` | Kasir, pesanan, struk, laporan |
| `/demo/pos/products`, `products/add`, `products/[id]/edit` | Katalog POS |
| `/demo/pos/ingredients`, `ingredients/add`, `ingredients/[id]/edit`, `/purchases`, `purchases/add`, `/expenses` | Inventory dan operasional |
| `/demo/pos/tables`, `/tax-discounts` | Meja dan konfigurasi pajak/diskon |
| `/demo/menu/pusat`, `/demo/menu/taman` | Menu publik view-only dari fixture awal |

`/demo?mode=pos` mengarah ke pemilihan outlet. `/demo/pos/admin/products/*` di-redirect kompatibilitas ke `/demo/pos/products/*`. Provider pada route group bersama menjaga sandbox selama Next soft navigation; setiap halaman memiliki bundle sendiri. Detail lifecycle, fixture, simulator, dan batasan ada di [DEMO.md](DEMO.md) serta §17.

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
| `RegisterProductCard` | Presentasi kartu produk register bersama; POS production memasok Next Image, demo memasok gambar sesi |
| `merchant-runtime` | Context client netral (`MerchantRuntimeProvider`, `useMerchantRuntime`, `useMerchantRequest`) untuk request, navigasi, toast, store, gambar, dan total cart |
| `rakkuPreset` | Tailwind preset bersama |

### 9.2 Owner — `apps/owner/src/components/`

| Folder | Isi |
|--------|-----|
| `auth/` | `AuthShell` (layout split-screen login/register/reset) |
| `layout/` | `nav-config.ts` (menu owner), `ResponsiveNav`, `BottomNav`, `MoreMenuSheet`, `DashboardContent`, `OwnerShell` (komposisi shell dipakai production dan demo) |
| `owner/` | `OwnerSidebar` (collapsible, framer-motion), `OwnerDashboardView` (presentasi dashboard bersama), `OwnerOutletsClient`, `OwnerEmployeesClient`, `OwnerSettingsClient` (dipindahkan dari route agar dapat dipakai demo) |
| `demo/` | `DemoProvider` (controller tab-local), `DemoArea`, `DemoOwnerShell`, `DemoPosShell`, `DemoPosLoginShell`, `DemoControls`, `DemoSimulation`, `product-data` |
| `charges/` | `TaxFormSlideOver`, `DiscountFormSlideOver` |
| `products/` | `ProductForm`, `CategoryManagerSlideOver`, `TierManagerSlideOver`, `RecipeManagerSlideOver` |
| `reports/` | `ProfitLossClient`, `EmailReportModal` |
| `billing/` | `PlanProvider`, `PlanBanner`, `UpgradeModal`, `SubscriptionClient`, `CheckoutClient`, `BalanceClient` (v6 M2/M3) |
| `ui/` | `ConfirmDialog` |

### 9.3 POS — `apps/pos/src/components/`

| Folder | Isi |
|--------|-----|
| `layout/` | `ResponsiveNav`, `AppSidebar`, `SideRail`, `BottomNav`, `MoreMenuSheet`, `DashboardContent`, `PosShell` (komposisi shell dipakai production dan demo), `DevServiceWorkerCleanup` |
| `auth/` | `CompanyLogin`, `SelectOutlet`, `SelectUser`, `EnterPin` (komponen empat langkah login, dipakai route POS dan demo) |
| `menu/` | `PublicMenuView` (presentasi menu publik, dipakai route POS dan demo) |
| `register/` | `RegisterView`, `ProductGrid`, `ProductCard`, `CategoryTabs`, `OrderSidebar`, `PaymentModal`, `SplitBillSheet`, `SplitBillPanel`, `DraftOrdersPanel`, `ItemDetailModal`, `PricingOptionSelector`, `MobileCartBar`, `InvoiceReceipt` |
| `products/` | `ProductForm`, `CategoryManagerSlideOver`, `TierManagerSlideOver`, `RecipeManagerSlideOver` |
| `charges/` | `TaxFormSlideOver`, `DiscountFormSlideOver` |
| `inventory/` | `IngredientForm` |
| `reports/` | `EmailReportModal` |
| `billing/` | `PlanProvider`, `LimitBanner`, `UpgradeModal` (v6 M2) |
| `ui/` | `ConfirmDialog` |

### 9.4 Superadmin — `apps/superadmin/src/app/`

Komponen halaman berada langsung di route (`companies`, `outlets`, `menus`, `roles`, `access-matrix`, `users`, `audit-logs`) + layout sidebar statis di `(protected)/layout.tsx`.

### 9.5 Landing — `apps/landing/src/components/`

`index.tsx` (komposisi `LandingPage`), `header`, `mobile-menu`, `hero`, `hero-product-menu`, `signal-strip`, `problem`, `features`, `feature-previews`, `workflow`, `inventory-story`, `recipe-board`, `audience`, `pricing`, `faq`, `final-cta`, `footer`, `motion`, `scroll-reveal`, `primitives`, `icons`, `site.ts`.

### 9.6 Hooks

| App | Hook | Fungsi |
|-----|------|--------|
| owner & pos | `useNavMode` | Mode nav: `bottom` / `rail` / `sidebar`; breakpoint 767/768 px, orientasi hanya dipakai pada perangkat coarse pointer |
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
| `@rakku/db` | `createAdminClient`, `createTenantClient`, `DatabaseClient`, `sql`, `closeDatabase`, invitation helpers | owner, pos, superadmin, business packages, scripts |
| `@rakku/auth-utils` | `signJwt`, `verifyJwt`, `hashPin`, `verifyPin`, `isLocked`, `computeLockedUntil`, `getLockoutConfig`, `getRemainingAttempts`, `logAuthEvent`, `getClientIp`, `FailureReasons`, `AuthEventType` | owner, pos |
| `@rakku/ui` | Komponen UI + `rakkuPreset` + `merchant-runtime` (boundary client) | semua app |
| `@rakku/demo` | `createDemoSandbox`, fixture/engine, `createDemoRequestAdapter`, projection, payload normalizer, `demoHref`, e2e routed | owner (demo), test |
| `@rakku/pricing` | `DEFAULT_TIERS`, `seedDefaultTiers()`, `syncProductTierPrices()` | pos, superadmin (lihat §16) |
| `@rakku/plans` | `getCompanyPlan()`, `checkLimit()`, `checkFeature()`, `getUsageSummary()`, `countMonthlyTransactions()`, `hasFeature()`, `PLAN_FEATURES` | owner, pos |
| `@rakku/ledger` | `creditBalance()`, `holdBalance()`, `releaseBalance()`, `settleWithdrawal()`, `adjustBalance()`, `getBalance()`, `listBalanceTransactions()`, `applyBalanceTransaction()` | owner, superadmin, pos (via payments) |
| `@rakku/emails` | `renderRakkuEmail()` (template branded) + `sendBillingEmail()` (idempotent via `notification_logs`) | owner, superadmin |
| `@rakku/inventory` | `deductStockForOrder()`, `recordPurchase()`, `adjustStock()`; transaksi SQL/lock/idempotency movement | pos, owner (via payments) |
| `@rakku/payments` | `createQrisIntent()`, `processOrderPayment()`, `expirePendingIntents()`, `generateOrderInvoiceNumber()` | pos, owner |
| `@rakku/vessel-client` | `createQrisPayment()`, `getPaymentStatus()`, `syncPaymentStatus()` | owner, pos/shared payments |
| `@rakku/echo-client` | `sendEmail(params)` + tipe `EchoEmailLog`, `EchoSendParams` | owner, pos |
| `@rakku/silos-client` | `uploadFile()`, `deleteFile()`, `getFile()` + tipe `SilosFile` | owner, pos, script seeding |

Semua package **source-only** (`main`/`types` → `./src/index.ts`, tanpa build step) dan di-transpile oleh Next.js via `transpilePackages`.

#### Kontrak `@rakku/db`

Compatibility layer di `packages/db/src/query.ts` mempertahankan hasil `{ data, error, count }`, fluent filters, pagination, upsert, single/maybeSingle, serta nested FK relations (`!inner` dan hint FK). Table/column/relasi divalidasi terhadap catalog, nilai dikompilasi sebagai SQL parameters. Exact count dan page berasal dari satu statement/snapshot. Ini bukan SDK Supabase atau HTTP PostgREST.

Pool runtime memakai `max:5`, `prepare:false`, idle timeout 20 detik, connect timeout 15 detik, dan statement timeout 30 detik per process. Transaksi memakai native Drizzle `db.transaction`. Query helpers dapat mengembalikan `error` alih-alih throw; use case transaksional harus melempar error agar rollback terjadi. SQL langsung memakai `sql` berparameter, bukan string input client.

### 10.2 Auth Library per App

| File | Fungsi |
|------|--------|
| `apps/owner/src/lib/auth/owner-session.ts` | Sign/verify `owner_session`, cookie helpers, `getOwnerSessionFromCookies()` |
| `apps/owner/src/lib/auth/reset-token.ts` | Generate token reset (32 byte hex), `hashResetToken()` SHA-256, TTL 1 jam |
| `apps/pos/src/lib/auth/company.ts` | `verifyCompanyLogin` (bcrypt + lockout + audit), `getActiveOutlets`, `getAccountsForOutlet` |
| `apps/pos/src/lib/auth/pending-login.ts` | JWT `pending_login` (10 menit) |
| `apps/pos/src/lib/auth/tenant-session.ts` | JWT `session`, `getTenantSessionFromCookies()` |
| `apps/pos/src/lib/auth/menus.ts` | `getAllowedMenus(roleId)`, `getAllMenus()` |
| `apps/owner/src/lib/auth/session-token.ts` | JWT-only signing/verification, secret validation; aman di middleware tanpa DB |
| `apps/pos/src/lib/auth/session-token.ts` | JWT-only session 12 jam; token tanpa exp ditolak |
| `apps/pos/src/lib/db.ts` | Request-local tenant scope dan server-side menu authorization |
| `apps/superadmin/src/lib/auth/server.ts` / `client.ts` | Neon Auth SDK server/browser |
| `apps/superadmin/src/lib/auth/require-superadmin.ts` | Session + allowlist aktif + Origin guard |
| `apps/superadmin/src/lib/auth/database.ts` | Authorized platform client dan adapter caller historis |
| `apps/superadmin/src/lib/auth/origins.ts` | Canonical/alias origins |

### 10.3 Query Modules per App

Nama folder `lib/supabase` adalah historis; semua akses database di modul berikut sudah memakai Neon. Package/dependency Supabase lama telah dihapus.

| File | Isi |
|------|-----|
| `apps/owner/src/lib/supabase/queries.owner.ts` | Slug/code generator, owner CRUD + reset token, onboarding, outlet, employee, role, menu queries |
| `apps/owner/src/lib/supabase/queries.data.ts` | Query data tenant (orders, pricing, taxes, discounts, products, categories, modifiers, ingredients, recipes) + `verifyOutletBelongsToCompany()` |
| `apps/pos/src/lib/supabase/queries.server.ts` | Query client tenant: produk, kategori, modifier, tier, order, laporan, draft, inventory, expenses, tables, purchases; public menu memakai komposisi client server tersendiri dengan projection terbatas |
| `apps/pos/src/lib/supabase/queries.client.ts` | Wrapper `fetch` ke `/api/admin/*` untuk operasi client |
| `apps/pos/src/lib/supabase/storage.ts` | `uploadProductImage()`, `deleteProductImage()` |

### 10.4 Cart Store — `apps/pos/src/lib/store/cartStore.ts`

Zustand store untuk register:

- State: items (dengan modifier & note), order type, customer, meja, pricing tier, peta harga tier produk/modifier, split payments, pajak & diskon aktif.
- Hook `useCartTotals`: subtotal → diskon order → pajak. Bila `MerchantRuntime.cartTotals` tersedia (demo), total dihitung oleh adapter sandbox agar sama dengan finalisasi.
- Aksi: `fetchActiveTaxesAndDiscounts`, `saveAsDraft`, `clear`, grouping item per kategori/produk.
- Store dibuat oleh `createCartStore(request)` dan diakses lewat `useCartStoreApi()`/`useCartStore(selector)`. Runtime demo menyimpan store per controller pada `getStore`, sehingga cart tidak bocor antar tab/visitor.
- `sidebarStore` (owner & pos) kini dibuat per runtime. Di demo, collapse/expand disimpan sebagai state memori dan tidak menulis localStorage merchant; production tetap memakai preference persisten.

Komponen merchant (kartu produk, modal, form, navigasi) membaca dependency environment melalui `@rakku/ui/merchant-runtime`. Di luar provider, helper memakai fetch/router/toast/gambar production seperti sebelumnya. Di dalam `/demo`, provider mengganti request ke adapter lokal, pathname ke path logis untuk active menu, href ke `/demo/{owner|pos}`, serta menyediakan store/gambar scoped. Tidak ada monkey-patch global.

### 10.5 Helper & Utility

| File | Fungsi |
|------|--------|
| `packages/inventory/src/index.ts` | Deduksi stok, pembelian, dan opname shared; dipanggil routes POS dan finalisasi payment |
| `packages/emails` | `renderRakkuEmail()` (template branded) + `sendBillingEmail()` (idempotent) |
| `apps/owner/src/lib/format.ts` | `formatCurrency` (IDR), `formatDate` (id-ID) |
| `apps/pos/src/lib/format.ts` | `formatCurrency` (IDR), `formatDate` (id-ID) |
| `packages/shared-types/src/inventory.ts` | Tipe inventory & operasional |

---

## 11. Detail API Penting

Daftar endpoint lengkap ada di §8. Bagian ini menjelaskan konvensi dan contoh request/response untuk endpoint yang paling sering dipakai.

### 11.1 Konvensi Umum

- **Auth:** cookie custom Owner/POS atau session SDK Neon + allowlist Superadmin. POS middleware terlebih dahulu menolak API privat tanpa JWT valid; layout/API/database boundary tetap melakukan pemeriksaan authoritative.
- **Error format:** `{ "error": "pesan ramah" }` + HTTP status (`400`, `401`, `403`, `404`, `409`, `423`, `500`, `502`).
- **Sukses:** `{ "message": "..." }` atau objek data (`{ owner }`, `{ redirect }`, `{ success: true }`, dst).
- **Tenant scope:** company/outlet/user dari session. Client POS memasang transaction-local tenant context; RLS dan trigger FK memvalidasi resource. Platform client harus didahului authorization/ownership/integration checks.
- **Origin:** mutasi POS `/api/admin/*` dan `/api/reports/*` harus same-origin; Auth proxy dan platform guard Superadmin memakai aturan canonical/alias terkait.
- **Validasi finansial:** order standar sudah menurunkan ID tenant/cashier dari session, tetapi harga/total/pajak/diskon belum dihitung ulang penuh di server.

### 11.2 Auth Tenant (POS)

```
POST /api/auth/tenant/company
{ "code": "DEMO", "password": "DemoPOS2026!" }
→ 200 { message } + Set-Cookie: pending_login=... (10 menit)
→ 401 { error }
→ 423 { error: "Terkunci hingga ..." }

POST /api/auth/tenant/verify-pin
{ "user_id": "...", "pin": "123456" }
→ 200 { redirect: "/register" } + Set-Cookie: session=...
→ 401 { error } (sisa percobaan disampaikan pada pesan)
→ 423 { error: "Akun terkunci hingga ..." }
```

### 11.3 Buat Order (POS)

`POST /api/admin/orders` menerima camelCase pada header order dan bentuk `CartItem` pada items, bukan payload kolom SQL. Contoh berikut menunjukkan field yang dibaca handler; UUID produk harus diganti dengan resource pada outlet session. Request wajib membawa cookie session dan Origin app.

```json
{
  "orderType": "dine_in",
  "paymentMethod": "cash",
  "customerName": "Budi",
  "subtotal": 50000,
  "total": 50000,
  "items": [{
    "product": { "id": "11111111-1111-4111-8111-111111111111", "name": "Kopi" },
    "quantity": 2,
    "unit_price": 25000,
    "subtotal": 50000,
    "modifier_label": "",
    "note": ""
  }],
  "taxes": [],
  "discounts": [],
  "splitPayments": []
}
```

Field opsional: `tableId`, `pricingTierId`, `note`, `status` (default completed), `paymentStatus` (default paid). Handler mengembalikan **201 dengan objek order langsung**, bukan `{ order }`. Header/items/splits/deduksi stok/meja ikut satu transaksi; kesalahan database di tahap tersebut me-rollback.

**Draft:** `POST /api/admin/orders/draft` (reserved 24 jam), `PATCH` untuk update/complete dalam transaksi, `DELETE` untuk hapus. Endpoint split mencatat split payment; dynamic QRIS memakai family `/orders/qris`, bukan endpoint cash ini.

### 11.4 Inventory (POS)

```
POST /api/admin/purchases
{
  "supplier_name": "Supplier Kopi",
  "purchase_date": "2026-09-10T00:00:00Z",
  "note": "...",
  "items": [{ "ingredient_id": "...", "quantity": 5000, "unit_cost": 120 }]
}
→ 201 { success: true, id, total_amount }
   • stock_quantity += quantity; cost_per_unit = unit_cost (last cost)
   • insert stock_movements type 'purchase'

POST /api/admin/ingredients/[id]/adjust
{ "stock_quantity": 4200, "note": "Hasil opname" }
→ 200 { success: true, previous_stock, new_stock, quantity_change }
   • set stok absolut (>= 0), catat 'adjustment'
```

Session scope dan feature `inventory_advanced` wajib. Pembelian menolak quantity nonpositif/harga negatif; opname menolak stok nonfinite/negatif. Header/items/stok/movements pembelian atau update stok/movement opname commit bersama.

### 11.5 Laporan Laba Rugi (Owner)

```
GET /api/owner/reports/profit-loss?date_range=week&outlet_id=...
→ 200 {
  "totalRevenue": 0, "totalHpp": 0, "grossProfit": 0,
  "totalExpenses": 0, "netProfit": 0, "totalTransactions": 0
}
```
`date_range`: `today | yesterday | week | all` (default `all`). HPP = Σ `cost_per_unit × quantity_used × qty terjual`. Perhitungan memakai resep/cost bahan **saat laporan dibaca**, bukan snapshot biaya saat penjualan; perubahan resep/last cost dapat mengubah laporan historis.

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
→ 200 { outletName, categories: [{ id, name, products: [{ id, name, price, description, image_url }] }] }
→ 404 { error } bila slug tidak dikenal
```
Tanpa auth; hanya produk `is_active`; tidak mengekspos cost/stok/resep.

---

## 12. Panduan Development

### 12.1 Prasyarat

- Node.js **24 direkomendasikan**; verifikasi memakai 24.11.1. pnpm **11.10.0** sesuai `packageManager` root; workspace linking dan Turborepo diperlukan.
- Project Neon, koneksi direct migration owner dan pooled runtime role, serta Managed Better Auth untuk Superadmin.
- Echo untuk email aplikasi/invitation, Silos untuk gambar, Vessel bila menguji QRIS, dan konfigurasi email Managed Auth untuk verification/reset.
- Database development baru yang kosong atau akses ke instalasi Neon yang sudah disiapkan. Supabase CLI tidak diperlukan untuk runtime/setup aktif.

### 12.2 Langkah Setup

Clone bila belum memiliki repository:

```powershell
git clone https://github.com/alifdhimasctr/stocko.git rakku
```

Buka terminal pada root repository `rakku`, lalu:

```powershell
pnpm install
```

Salin `.env.example` root dan masing-masing app menjadi `.env.local`. Isi matriks §4.1; untuk development lokal gunakan URL localhost. Database runtime dan Auth Superadmin harus berasal dari branch/database yang sama. Root `.env.local` untuk scripts tidak menggantikan file env pada app.

**Database baru saja:** siapkan runtime URL `rakku_runtime` dengan password hex 64 karakter serta direct migration-owner URL mengikuti [panduan Neon](NEON_MIGRATION.md#1-siapkan-project-auth-dan-role), lalu jalankan:

```powershell
pnpm db:provision
pnpm db:migrate
pnpm db:seed
pnpm db:demo
pnpm admin:invite admin@example.com
```

Database aktif sudah memiliki role, migration, plan/menu, DEMO, dan admin aktif; setup developer pada database tersebut cukup mengisi env dan menjalankan app. Copy source lama tidak diperlukan. Jangan menjalankan seluruh legacy seeds sebagai langkah default.

```powershell
pnpm dev
```

Gunakan port §3.1. Invitation lokal membutuhkan `SUPERADMIN_URL=http://localhost:3002` pada root serta origin tersebut di trusted domains Neon Auth. Invitation deployment memakai URL environment yang tersedia.

### 12.3 Migrasi

- File aktif: `packages/db/migrations/*.sql`; urutan lexicographic, runner `pnpm db:migrate`, history/checksum §7.5.
- Runner memakai **direct migration owner**, bukan pooled runtime URL. Runtime role harus tersedia dan berbeda dari owner.
- Applied migration tidak diedit. Penambahan schema dibuat pada file baru, diuji, kemudian diterapkan pada branch tujuan.
- `pnpm db:inspect` memeriksa identitas/versi/roles/schema/counts/Auth; `pnpm db:check` memeriksa invarians target, dan source-target hanya bila source URL diisi.
- Chain/export Supabase lama adalah sejarah. Reconciliation/source copy adalah opsional dan mengharuskan target public kosong tanpa seed; detail [NEON_MIGRATION.md](NEON_MIGRATION.md#7-opsional-rekonsiliasi-dan-copy-source-lama).

### 12.4 Scripts

| Script | Fungsi |
|--------|--------|
| `pnpm dev` | Jalankan semua app paralel (Turborepo) |
| `pnpm dev:owner` / `dev:pos` / `dev:superadmin` / `dev:landing` | Jalankan satu app |
| `pnpm build` / `build:owner` / `build:pos` / `build:superadmin` / `build:landing` | Build |
| `pnpm lint` / `typecheck` / `typecheck:scripts` | ESLint, types app/package, types utilitas |
| `pnpm test:db` | 13 tests PGlite SQL/RLS/atomic operations/invitation |
| `pnpm test:demo` | 74 domain/adapter/route + 3 request-policy tests; tanpa DB/Neon/provider nyata |
| `pnpm test:demo:browser` | 5 suite browser routed terhadap build production lokal; `--dev-owner` untuk StrictMode |
| `pnpm db:provision` | Buat/verifikasi `rakku_runtime`; tidak merotasi password existing |
| `pnpm db:migrate` | Terapkan migration/checksum/grants |
| `pnpm db:inspect` | Identitas, role privileges, schema/table counts, Managed Auth |
| `pnpm db:seed` | Plan/menu referensi pada instalasi baru |
| `pnpm db:demo` | Satu Owner/POS demo; idempotent tanpa reset stok/password/trial |
| `pnpm db:check` | Invarians finansial/tenant/assets target; optional source comparison |
| `pnpm db:smoke` | Neon driver, runtime role, DEMO bcrypt/PIN, count/relations/RLS, rollback |
| `pnpm smoke:http` | Dev servers `127.0.0.1:3100`–`3102`, DEMO login/read, Superadmin anonymous guard |
| `pnpm smoke:production --vercel-only` | Login/read smoke development Vercel, custom Superadmin domain dilewati |
| `pnpm smoke:production` | Default Vercel Owner/POS + Vercel/Dephilia Superadmin; belum seluruh domain production |
| `pnpm auth:check` | Trusted origins langsung ke Neon Auth, expected invalid-credential 401 |
| `pnpm env:check` | Sinkronisasi file privat instalasi bersama dan tracked empty placeholders; bukan cloud checker |
| `pnpm admin:invite <email>` / `admin:status [email]` | Kirim invitation / periksa membership dan invitation terakhir |
| `pnpm db:copy --write-freeze-confirmed` | Opsional: snapshot source dan one-transaction copy ke target kosong |
| `pnpm db:images` | Opsional: pindahkan asset legacy pada source sebelum final snapshot/copy |
| `pnpm seed` / `seed:full` | Legacy testing datasets RAKKU/TOKOKO; tidak dijalankan pada instalasi aktif baru |
| `pnpm backfill:owners` | Backfill akun owner untuk company existing |
| `pnpm tsx scripts/seed-build.ts` | Legacy testing dataset BUILD; bukan DEMO aktif |
| `pnpm tsx scripts/seed-build-images.ts [--force]` | Foto dataset BUILD → sharp → Silos |
| `pnpm tsx scripts/generate-favicons.mjs <app>` | Generate favicon per app |

Command singkat seperti `dev:pos`/`build:pos` pada tabel tetap dijalankan dengan prefix `pnpm`. Runtime/migration utility arguments dan flags diteruskan langsung ke scripts root `package.json`.

Scripts Neon database membaca `NEON_ENV_FILE` atau `.env.local` root. `admin:invite` selalu memuat `.env.local` root (process env tetap berlaku); `auth:check` default `.env.neon`; `env:check` membaca file instalasi fixed; smoke deployment membaca process env untuk URL overrides. App HTTP smoke membaca env dari masing-masing app. Jangan menganggap satu env loader berlaku pada semua scripts.

### 12.5 Akun Testing

Database Neon aktif dimulai baru dengan tenant **DEMO**:

| Login | Credential |
|---|---|
| Owner | `demo_owner@rakku.test` / `DemoOwner2026!` |
| POS company | `DEMO` / `DemoPOS2026!` |
| POS outlet/user/PIN | `Outlet Demo` / `kasir_demo` / `123456` |
| Superadmin | Invitation + password pribadi pemilik akun; tidak ada shared demo password |

Demo berisi satu kasir/role, dua produk (Kopi Demo/Teh Demo), dua pricing tier, satu meja, ingredient/resep dan opening stock beraudit. Trial Pro 14 hari sejak seed pertama; seed ulang tidak memperpanjang trial atau mereset credential/stok. Admin `alifdhimasctr@gmail.com` sudah terkonfirmasi aktif pada rollout.

RAKKU/TOKOKO/BUILD hanya tersedia bila scripts dataset terkait dijalankan; akun pada panduan BUILD lama tidak otomatis ada di database baru. Menu mengikuti access matrix role dan fitur paket efektif. `db:smoke`/HTTP smoke mengharapkan dataset DEMO tertentu; penambahan outlet/produk atau pergantian password dapat membuat assertions dataset gagal walaupun app berjalan.

Akun **demo publik** berbeda dari tenant testing di atas: `Owner Demo Rakku`, company `DEMO_CAFE`, karyawan Rani/Bima/Dita/Raka, semuanya hanya hidup di sandbox browser dan tidak dibuat di Neon. Kredensial lengkap dan alamat fiktif ada di [DEMO.md](DEMO.md).

### 12.6 Build & Deploy

```powershell
pnpm test:demo
pnpm test:db
pnpm typecheck --concurrency=1
pnpm typecheck:scripts
pnpm lint --concurrency=1
$env:NODE_OPTIONS = '--max-old-space-size=1024'
pnpm build --concurrency=1
```

`pnpm test:demo:browser` dijalankan terpisah karena memerlukan Playwright/Chrome dan build production (detail [DEMO.md](DEMO.md)).

Untuk start build lokal, jalankan app yang diperlukan pada terminal terpisah: `pnpm --filter @rakku/owner start` (3000), `@rakku/pos` (3001), `@rakku/superadmin` (3002), atau `@rakku/landing` (3003). `NODE_OPTIONS` di atas membatasi heap Node per process pada mesin verifikasi; tidak mengubah konfigurasi deployment cloud.

1. Buat/hubungkan empat project Vercel, Root Directory `apps/<app>`, config §4.6. Deploy masing-masing app dengan workspace package yang kompatibel.
2. Pasang env §4.1 pada Project Settings. Neon integrasi satu project dapat membuat resource; tiga app server memerlukan pooled **runtime** URL secara manual, bukan integration owner URL. Landing tidak memerlukan DB/Auth secret.
3. Tentukan resource/branch per environment yang benar-benar disiapkan. Kondisi rollout masih satu DB/Auth bersama; pemisahan database/secret development-production adalah pekerjaan lanjutan, bukan fitur yang sudah terpasang.
4. Gunakan URL §1.3/§4.1. Development tetap URL Vercel; production Owner `https://app.rakku.dephilia.com`, POS `https://pos.rakku.dephilia.com`, Superadmin `https://admin.rakku.dephilia.com`, Landing `https://rakku.dephilia.com`.
5. Pastikan callback Vessel `https://app.rakku.dephilia.com/api/webhooks/vessel` pada production Owner dapat dijangkau. Di development gunakan URL Owner Vercel; localhost tidak dapat menerima callback provider tanpa endpoint publik. Auth/reset email/QR menu/CTA Landing juga perlu URL environment benar. Demo `/demo` disajikan oleh Owner; build POS/Landing harus memakai `NEXT_PUBLIC_OWNER_URL` yang benar agar CTA/redirect demo menuju origin Owner tersebut.
6. Set canonical/alias Superadmin, trusted domains Neon Auth, dan domain assignment Vercel. Redeploy setelah env build-time berubah; file env lokal tidak otomatis terkirim.
7. Set `CRON_SECRET`, cron Owner 01:00 UTC, dan tentukan deployment penanggung jawab cron bila memakai DB bersama. `?dry=1` masih melakukan sinkronisasi/finalisasi payment (§5.8).
8. Uji deployment. `pnpm smoke:production --vercel-only` memakai defaults Vercel; tanpa flag menambah custom Superadmin. Override Owner/POS production dengan `OWNER_PRODUCTION_URL`/`POS_PRODUCTION_URL` pada process env; Superadmin masih hardcoded kedua host. Prosedur lengkap [NEON_MIGRATION.md](NEON_MIGRATION.md#6-deploy-dan-verifikasi-environment).

Script smoke mengharapkan akun DEMO; environment production terpisah tanpa DEMO memerlukan akun testing/pemeriksaan yang sesuai. Domain Landing dan flow admin berpassword diperiksa terpisah. Login smoke tidak membuat order/payment atau mengubah stok, tetapi menambah audit/update last login. Perbaikan custom Superadmin domain 404 masih ditunda pada hasil rollout terakhir.

---

## 13. PWA (Progressive Web App)

PWA hanya diterapkan di **`apps/pos`** (kasir), bukan di owner/superadmin/landing. Implementasi memakai **Serwist** 9.x (fork Workbox) untuk Next.js App Router, aktif hanya saat production.

### 13.1 Caching Strategy

| Tipe request | Strategi |
|--------------|----------|
| `/demo` dan `/demo/*` pada POS | **NetworkOnly** — redirect/route demo tidak disimpan sebagai halaman/RSC bersama |
| Navigasi halaman | NetworkFirst (fallback cache) |
| Aset statis (`_next/static`) | CacheFirst |
| Gambar | StaleWhileRevalidate |
| Request lainnya, termasuk API Next.js | Handler `defaultCache` Serwist setelah custom rules; tidak ada koneksi SQL di browser |
| Host `supabase.co` | Rule NetworkFirst legacy masih ada di worker, tidak digunakan runtime Neon |
| Fallback | Halaman `/~offline` |

Demo interaktif berada di origin Owner (Owner tidak memasang service worker); POS hanya mengarahkan `/demo` ke sana. Route demo Owner memakai `force-dynamic`/`no-store`. Menutup/membuka demo tidak membersihkan cache merchant, dan aktivitas demo tidak disimpan ke Cache Storage.

Service worker juga dapat menyimpan response navigasi dashboard terautentikasi. Belum ada pembersihan runtime cache saat logout; perilaku pada perangkat kasir bersama harus diuji sebelum produksi.

PWA menyediakan app shell/fallback, **bukan offline order queue atau transaksi lokal**. Order, PIN/session checks, inventory, dan pembayaran tetap memerlukan server/Neon. Mode build production berlaku juga pada URL development Vercel.

### 13.2 File Terkait

| File | Fungsi |
|------|--------|
| `apps/pos/src/app/sw.ts` | Sumber service worker (precache manifest + runtime caching); `/demo` dan subpath memakai NetworkOnly agar redirect/route demo tidak di-cache |
| `apps/pos/src/app/manifest.ts` | Web app manifest (standalone, portrait, theme `#2E7D32`, shortcut `/register` & `/orders`, ikon maskable) |
| `apps/pos/src/app/~offline/page.tsx` | Halaman fallback offline |
| `apps/pos/src/components/layout/DevServiceWorkerCleanup.tsx` | Unregister SW + clear cache saat development |
| `apps/pos/scripts/generate-pwa-icons.mjs` | Generate `public/icons/*` dari `rakku_logo.png` (sharp) |
| `apps/pos/public/sw.js` | Output build SW (gitignored) |
| `apps/pos/next.config.mjs` | `withSerwistInit` + downlevel ES2017 untuk Android WebView lama |

### 13.3 Testing

1. Jalankan `pnpm build:pos`, lalu setelah sukses `pnpm --filter @rakku/pos start` (build production lokal).
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
      → order/items/splits, deduksi stok/movement, meja occupied dalam transaksi
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
invitation Echo → /activate → sign-in Auth + transaksi allowlist
/login (Managed Better Auth + allowlist aktif) → /companies
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
| **Migrasi Neon** | Database/Auth dan integritas transaksi | `@rakku/db`, baseline `0001`–`0004`, runtime role/FORCE RLS/tenant triggers, transaksi bisnis, Superadmin Managed Auth + invitation/allowlist, POS expiry/revalidation, 13 tests PGlite + live smoke |
| **Demo publik** | Sandbox cafe browser-memory | `/demo/owner/*` dan `/demo/pos/*` memakai komponen/layout/sidebar existing; fixture dua outlet, empat karyawan, 20 produk, inventory, ledger, langganan; adapter API lokal tanpa persistensi; 74 domain + 3 policy tests dan 5 suite browser routed |

Nomor migration dan perilaku best-effort pada baris versi lama menjelaskan keadaan saat versi tersebut dibuat. Implementasi aktif mengikuti bagian Neon/transaksi pada dokumen ini; versi root `package.json` tetap `4.0.0`, bukan penanda schema migration.

---

## 16. Catatan Teknis & Known Issues

### 16.1 Status Instalasi dan Riwayat Source

- Developer memilih **database baru**, tanpa memulihkan source Supabase. Runtime role, empat migration, plan/menu, satu DEMO, dan aktivasi admin sudah selesai; source copy bukan prasyarat yang masih pending.
- Riwayat Supabase pernah mengalami migration repair/manual drift. Baseline Neon sudah memasukkan kolom yang dipakai kode seperti reset token Owner, `modifiers.group_name`, `order_items.note`, dan `split_payments.items`.
- `supabase_full_export.sql` lokal bukan restore source yang valid. File export/dump/backup berisi data privat dan bukan sumber schema aktif; gunakan migration/history Neon.
- Tidak diperlukan baseline/seed ulang pada database aktif. Perubahan berikutnya memakai migration baru dengan checksum; source restore hanya lewat prosedur opsional yang memang memerlukannya.

### 16.2 Batas Middleware dan Otorisasi

Middleware/proxy adalah gate awal, bukan satu-satunya guard. Owner mengautentikasi API lewat server helpers; POS kini menolak JWT invalid pada API privat dan memasang metadata route server-side; Superadmin memeriksa allowlist di layout/API.

- Owner `/products`, `/tax-discounts`, `/tables` tidak termasuk matcher middleware tertentu, tetapi berada pada protected layout. Matcher masih memuat beberapa route redirect legacy.
- POS `/ingredients`, `/purchases`, `/expenses`, `/tables` tidak termasuk daftar halaman JWT `dashboardPaths`, tetapi layout/query boundary melakukan pemeriksaan session/menu. `/menu/[slug]` memang publik.
- `createAdminClient` **lokal POS** adalah tenant wrapper; ekspor bernama sama dari **`@rakku/db`** adalah platform client. Jangan menukarnya tanpa mempertimbangkan authorization.
- Platform scope memang memiliki akses lintas tenant via policy. Tidak ada credential/claim browser yang boleh menentukan scope tersebut; RLS bukan pengganti guard platform.

### 16.3 Bug Redirect Setelah Login POS

`apps/pos/src/app/api/auth/tenant/verify-pin/route.ts` masih memetakan menu pertama `products` ke `/admin/products`, sedangkan halaman aktual `/products`. Role dengan menu pertama Produk dapat menerima redirect yang berakhir 404. Login DEMO yang menuju register tidak menguji kasus ini.

### 16.4 Nama dan Dataset Legacy

- Folder `lib/supabase`, nama variabel lokal `supabase`, dan adapter `auth.getUser()` pada caller Superadmin adalah nama historis. Runtime memakai Neon, tanpa SDK/client package Supabase.
- `pricing_options` dan API terkait masih tersedia; UI aktif terutama memakai pricing tiers. Compatibility bukan instruksi membuat dependency Supabase baru.
- Seeds RAKKU/TOKOKO/BUILD bukan dataset aktif Neon. Script BUILD memiliki access-map historis; periksa slug menu `tax-discounts` bila memilih dataset itu. `PANDUAN.md` belum diselaraskan ke DEMO.
- Policy/cache/migration artifacts Supabase historis tetap dapat ditemukan. Provisioning baru memakai `packages/db/migrations`, bukan runner/export lama.

### 16.5 Schema dan Perilaku Query

- DDL lengkap ada di SQL migration. Tabel bisnis bukan seluruhnya model TypeScript Drizzle yang statis; catalog compiler mempertahankan kontrak query lama.
- Helpers menghasilkan `{ data, error, count }`; transaksi hanya rollback bila error dilempar atau statement SQL gagal. Caller tidak boleh mengabaikan helper error pada mutasi multi-step.
- Pool dan catalog dapat di-cache per process; tenant authorization/client harus request-local, context memakai transaction-local settings.
- Exact count/page memakai satu statement. Ini tidak membuat beberapa query laporan otomatis satu snapshot/transaksi.
- Laporan HPP memakai recipe/last cost saat dibaca, bukan historical cost snapshot; histori laba dapat berubah setelah biaya/resep diubah.

### 16.6 Status Keamanan dan Integritas

Migrasi sudah menambahkan expiry/revalidation POS, menu authorization server-side, tenant RLS/trigger, allowlist Superadmin, dan transaksi bisnis. Temuan Supabase-era seperti akses platform bagi setiap akun Auth atau deduksi stok best-effort tidak lagi menggambarkan implementasi aktif. Pengujian yang tersedia tetap sesuai cakupan §16.9.

Keterbatasan source yang masih ada:

- **Nominal order:** standard order mengambil harga item, pajak, diskon, subtotal/total dari client. Company/outlet/cashier sekarang berasal dari session, tetapi seluruh nominal belum dihitung ulang dari katalog server.
- **Permission:** kontrak UI/API POS memakai menu-level `can_view`. Kolom CRUD ada di schema, tetapi belum ditegakkan sebagai grants create/edit/delete yang terpisah.
- **PIN issuance:** verify-pin masih berfokus pada user/company/PIN; assignment outlet/status company-outlet diperiksa authoritative ketika session dipakai. Pemeriksaan sebelum penerbitan session juga perlu diselaraskan, walaupun invalid session ditolak database boundary.
- **Verification secret Owner:** session/pending-login fail-fast, tetapi register/resend/verify-email masih mempunyai fallback secret verification. `OWNER_JWT_SECRET` tetap wajib disediakan pada deployment.
- **Cookie sementara:** session utama Owner/POS memakai Secure pada production; `pending_login` belum menambahkan Secure.
- **Reset Owner:** forgot-password/resend membedakan akun ada/tidak ada; belum ada rate limiting Owner setara lockout POS. Reset password tidak menyediakan denylist untuk setiap JWT individual yang sudah terbit.
- **Cache PWA:** navigasi terautentikasi dapat tersimpan dan cache runtime belum dibersihkan saat logout. Uji perpindahan kasir/outlet pada perangkat bersama; bukan offline transaction engine.
- **Cron dry:** `?dry=1` tetap menyinkronkan/finalisasi payment sebelum return. Jangan menggunakannya sebagai pemeriksaan read-only pada data aktif.

### 16.7 Environment dan Domain Outstanding

- Development: Owner `rakku.vercel.app`, POS `pos-rakku.vercel.app`, Superadmin `superadmin-rakku.vercel.app`. URL Landing Vercel belum dikonfirmasi.
- Production: Landing `rakku.dephilia.com`, Owner **`app.rakku.dephilia.com`**, POS `pos.rakku.dephilia.com`, Superadmin `admin.rakku.dephilia.com`.
- Superadmin custom domain terakhir 404 pada `/activate` dan `/api/auth/get-session`; alias Vercel 200. Assignment project/deployment Vercel perlu diselaraskan; trusted origins Auth kedua host sudah diterima.
- Production Owner/POS/Landing belum memiliki hasil smoke tercatat. File `.env.production` publik beberapa masih memakai URL Vercel; profil domain pada dokumen belum mengubah cloud env atau domain assignment.
- Root invitation sementara memakai URL Superadmin Vercel. Akun admin sudah active; perbaikan domain tidak mengharuskan reset akun atau menerapkan ulang baseline.
- Superadmin Next.js 16 masih memakai React 18; build tercatat lulus dengan warning deprecation React 18. Upgrade framework/library berikutnya perlu meninjau peer dependencies SDK beta dan React.
- Lokal/deployment yang diverifikasi masih berbagi resource Neon/Auth. Branch/database/secrets terisolasi per environment adalah pekerjaan lanjutan; `env:check` saat ini memang mengharapkan konfigurasi bersama.
- Secret database/JWT/Auth/Echo/Silos/Vessel/cron tidak masuk Git. Env integrasi Vercel dan file `.env.production.local` tidak otomatis menjadi env runtime app pada cloud.

### 16.8 Operasional Pembayaran

- Fitur ledger/saldo, adjustment, dynamic QRIS, withdrawal manual, settlement reconciliation, dan analytics ada di source. Default withdrawal: minimum Rp50.000, biaya Rp0, satu pengajuan pending per company, maksimum Rp10 juta/hari.
- MDR 0,7% pass-through: saldo merchant = gross − pembulatan MDR. Ledger append-only mencatat perubahan; balance cache dan pending/open withdrawals diperiksa oleh rekonsiliasi.
- Refund QRIS provider dan disbursement otomatis belum tersedia melalui integrasi ini. Withdrawal diselesaikan manual dengan referensi/bukti; adjustment dicatat di ledger.
- Order/payment finalization dan withdrawal ledger transitions memakai transaksi DB; provider calls dan email berada di luar transaksi tersebut. Tidak ada transaksi terdistribusi dengan Vessel/Echo/Silos.
- Callback Vessel harus mencapai app Owner environment yang benar. Bila DB bersama, tentukan deployment penanggung jawab webhook/cron; dua domain berbeda belum berarti data/operasi terisolasi.
- Flow payment nyata dan posisi kas/settlement tidak dibuktikan oleh smoke login DEMO.

### 16.9 Cakupan Pengujian dan Hasil Rollout

| Pemeriksaan | Hasil tercatat pada rollout | Cakupan |
|---|---|---|
| `pnpm test:db` | **13/13 lulus** | PGlite baseline/FK/relations/filters/count/parameters/JSON/numeric, tenant RLS, ledger idempotency, stock rollback, payment late-failure/retry, invitation sekali pakai |
| Types/lint/build | Lulus | App/package types, script types, ESLint, build empat app |
| `db:check` / `db:smoke` | Lulus | 39 tabel/invarians finansial dan Neon driver/runtime role/DEMO auth/RLS/native rollback |
| `env:check` / `auth:check` | Lulus | File lokal ignored/sinkron pada instalasi bersama; trusted origins invalid-credential response |
| `smoke:http` | Lulus | Owner/POS login/read pada local dev servers, Superadmin anonymous session/guard |
| `smoke:production --vercel-only` | Lulus | Development Vercel Owner/POS login/read/public menu, Superadmin activation/proxy/anonymous guard |
| Aktivasi admin | Terverifikasi | Pemilik akun membuat password/sign-in; allowlist active dan invitation used_at dikonfirmasi |
| Custom Superadmin domain | **404 pada pemeriksaan terakhir** | `/activate` dan `/api/auth/get-session`; default deployment smoke belum lulus seluruh host |
| Production Owner/POS/Landing | Belum tercatat | Domain tujuan sudah dikonfirmasi |

Verifikasi deployment di tabel berasal dari 8 Oktober 2026; pembaruan dokumentasi tidak menjalankan ulang flow yang mengubah database. Smoke HTTP/deployment login dapat menambah audit event/update last login, tetapi tidak membuat order/payment atau mengubah stok. `db:smoke` melakukan insert marker transaksi yang sengaja di-rollback.

Suite browser production untuk **demo publik** kini tersedia di `packages/demo/e2e`; arsitektur dan cakupannya dijelaskan di [DEMO.md](DEMO.md). Ini terpisah dari verifikasi deployment merchant. Delivery verification/reset Managed Auth dan Owner email, QRIS/provider callback nyata, full CRUD/cart validation akun nyata, concurrency bisnis menyeluruh, PWA/logout merchant pada perangkat bersama, dan withdrawal/settlement manual tetap memerlukan uji integrasi pada deployment tujuan. Keberhasilan demo/build/DB tests bukan bukti bahwa integrasi provider atau seluruh domain production sudah terverifikasi.

Verifikasi demo publik terakhir (**17 Oktober 2026**, build production lokal) mencatat `pnpm test:demo` **74 domain/adapter/route + 3 request-policy tests lulus**, `pnpm test:demo:browser` **5/5 suite routed lulus** pada Chrome production dan development/StrictMode, serta typecheck 17 task, typecheck scripts, lint, `test:db` 13/13, dan build empat app lulus. Suite membuktikan route/sidebar asli, soft navigation mempertahankan sandbox, transaksi POS terlihat di Owner, isolasi tab/reset/logout, lazy feature bundles, menu mobile/breakpoint, serta badge draft/stok sidebar tidak ter-clip. Angka ini adalah hasil lokal, bukan smoke deployment.

## 17. Demo Publik Browser-Memory

`/demo` pada aplikasi Owner adalah entry untuk namespace route asli yang diprefix:

- `/demo/owner/dashboard`, `/outlets`, `/employees`, `/products`, `/orders`, `/reports`, `/tax-discounts`, `/tables`, `/settings`, `/subscription`, `/balance` beserta subroute add/edit/invoice/checkout.
- `/demo/pos/login/select-outlet`, `/select-user`, `/enter-pin`, lalu `/demo/pos/register`, `/products`, `/orders`, `/reports`, `/ingredients`, `/purchases`, `/expenses`, `/tables`, `/tax-discounts` beserta subroute add/edit/invoice.
- `/demo/menu/pusat` dan `/demo/menu/taman` untuk menu publik view-only.
- `/demo?mode=pos` mengarah ke pemilihan outlet; `/demo/pos/admin/products/*` redirect kompatibilitas ke `/demo/pos/products/*`.

Komponen merchant **tidak diduplikasi**: `OwnerShell`/`PosShell`, `OwnerDashboardView`, halaman client outlet/karyawan/settings, empat langkah login POS, register/payment/receipt, laporan, inventory, billing, dan `PublicMenuView` dipakai oleh route production maupun demo. Provider pada route group `(sandbox)` menjaga satu sandbox tab-local selama Next soft navigation antarhalaman/Owner/POS. Setiap fitur dimuat sebagai route/bundle sendiri, sehingga dashboard tidak mengimpor seluruh aplikasi.

Boundary data berada di `packages/ui/src/merchant-runtime.tsx` dan `packages/demo/src/runtime/`. Komponen membaca request/navigasi/toast/store/gambar dari context; di luar demo semuanya memakai perilaku production, sedangkan di demo adapter memetakan kontrak API existing ke engine lokal dan menolak URL/konteks/resource yang tidak valid. Tidak ada `fetch` monkey-patch, fallback API nyata, cookie/token demo, `Map` server, TTL, atau aktivitas demo di Neon. `pnpm db:demo` adalah tenant testing permanen yang **terpisah** dan tidak dipakai/reset oleh demo publik.

Lifecycle: soft navigation mempertahankan bisnis dan cart; ganti kasir/outlet membersihkan actor/cart; reset/logout membuang sandbox dan URL gambar; refresh/tab baru/BFCache restore kembali ke fixture awal; hide tab tidak logout. Store sidebar demo bersifat memori per controller (tidak menulis preference merchant), dan request generasi lama ditolak.

Perbaikan UI terakhir: badge jumlah draft/stok pada `AppSidebar`/`SideRail` POS semula berada di luar slot ikon yang memakai `overflow-hidden` sehingga angka terpotong. Badge kini diposisikan relatif ke wrapper ikon yang rapat, mengikuti pola `BottomNav`; perilaku production dan demo sama. Verifikasi browser mengukur ukuran, batas sidebar, dan hit-testing badge pada state expanded/collapsed di dua outlet.

Detail lengkap fixture dua outlet/empat karyawan/20 produk, lifecycle/cache, matriks fitur, simulator pembayaran/langganan/withdrawal/email/upload, batasan source, dan perintah pengujian ada di **[DEMO.md](DEMO.md)**.
