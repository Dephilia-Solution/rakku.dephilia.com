# PROMPT PENGEMBANGAN — rakku (Rakku POS) v4.0
## Dari Monolith Next.js → Monorepo 3-App Terpisah (Owner, POS, Superadmin)

> **Dokumen ini adalah brief/prompt lengkap untuk AI coding agent** (OpenCode) yang akan mengeksekusi migrasi. Tempel/beri dokumen ini ke agent sebagai instruksi kerja utama, bersama `DOCS.md` (v2.1 + Bagian 14 v3.0) sebagai referensi kondisi eksisting.
>
> **Base version:** rakku v3.0 (Self-Service Owner & Dashboard) — satu Next.js app, route group `/owner`, `/superadmin`, dan tenant/POS di root, semua share satu `middleware.ts` dan satu `SUPABASE_SERVICE_ROLE_KEY`.
> **Target version:** v4.0 — Monorepo dengan 3 Next.js app independen (`apps/owner`, `apps/pos`, `apps/superadmin`), tiap app deploy sendiri ke domain sendiri:
>
> | Domain | App |
> |---|---|
> | `rakku.com` | `apps/owner` — landing, daftar, masuk, onboarding, dashboard owner |
> | `pos.rakku.com` | `apps/pos` — 4-step login kasir, register, orders, reports, products, categories, pricing-tiers, taxes, discounts |
> | `superadmin.rakku.com` | `apps/superadmin` — companies, outlets, menus, roles, access-matrix, users, audit-logs |

---

## 0. CARA MENGGUNAKAN DOKUMEN INI (baca dulu, agent)

1. Baca `DOCS.md` menyeluruh dulu, terutama Bagian 3 (Struktur Proyek) dan Bagian 14 (v3.0) — itu peta lengkap file apa ada di mana sekarang.
2. Ini adalah **migrasi struktural**, bukan penulisan fitur baru. Logic bisnis (cart engine, pricing tier, tax/discount, 4-step login, RBAC, onboarding) **tidak boleh diubah perilakunya** — hanya dipindah lokasinya.
3. Kerjakan **satu fase per sesi/PR**, urut sesuai Bagian 8. Jangan lompat fase. Tiap fase harus tetap menghasilkan sistem yang **bisa dijalankan** (`pnpm dev` tidak error), walau belum semua app sudah pindah.
4. Alasan migrasi ini adalah **kerapian struktur & pemisahan akun** (owner dan kasir memang tidak berhubungan), bukan hardening keamanan — jadi jangan sisipkan perubahan besar di luar scope (mis. mengaktifkan RLS) kecuali disebutkan eksplisit di Bagian 9 (Catatan, bukan tugas fase ini).
5. Kalau ada file yang ambigu masuk app mana atau `packages/` mana, ikuti tabel pemetaan di Bagian 5. Kalau benar-benar tidak ada di tabel, taruh di app yang paling sering memakainya, jangan taruh di `packages/` kalau cuma dipakai satu app.
6. Jangan hapus riwayat migration SQL (001–014). Supabase tetap **satu project**, dipakai bersama oleh ketiga app — migrasi ini tidak menyentuh skema database sama sekali.
7. Update `DOCS.md` di akhir tiap fase (tambah bagian baru "Bagian 17 — v4.0 Monorepo", jangan hapus riwayat lama).

---

## 1. RINGKASAN EKSEKUTIF

rakku v3.0 sudah punya pemisahan logis yang baik lewat route group (`/owner`, `/superadmin`, tenant di root) dan `middleware.ts` yang menjaga masing-masing. Tapi secara fisik ini masih **satu Next.js app, satu deployment, satu build** — owner, kasir, dan superadmin selalu ikut ter-redeploy bersamaan, dan tidak ada batas tegas yang mencegah satu route tidak sengaja mengimpor query/komponen milik area lain.

**Tujuan v4.0:** memecah rakku menjadi **3 Next.js app independen** dalam satu monorepo (pnpm workspace + Turborepo), masing-masing deploy ke domain sendiri, dengan kode yang benar-benar terisolasi per app (bukan cuma dipisah lewat folder route group). Kode yang memang dipakai bersama (types, auth util generik, UI kecil, pricing helper) diekstrak ke `packages/` supaya tidak duplikasi.

**Yang TIDAK berubah:** skema database, logic cart/pricing/tax/discount, 4-step login kasir, alur onboarding owner, RBAC dinamis, bahasa UI (Indonesia), Tailwind palette (forest green, Plus Jakarta Sans/DM Sans).

---

## 2. KONDISI SAAT INI (ringkasan dari DOCS.md v3.0)

| Aspek | Kondisi sekarang |
|---|---|
| Jumlah app/deployment | 1 (satu Next.js project) |
| Domain | 1 domain, dibedakan lewat path (`/owner/*`, `/superadmin/*`, root) |
| `middleware.ts` | 1 file, cek path untuk tentukan proteksi mana yang berlaku |
| Service role key | 1 key, dipakai semua route API |
| JWT secret | `TENANT_JWT_SECRET` dipakai bersama untuk cookie `session` (kasir) dan `owner_session` (owner) |
| Types (`src/types/index.ts`) | 1 file, semua interface (owner, tenant, superadmin) campur jadi satu |
| Query layer | Sudah terpisah nama file (`queries.server.ts`, `queries.owner.ts`, `queries.superadmin.ts`) tapi tinggal satu folder yang sama |
| Komponen shared | `Badge`, `EmptyState`, `QtyControl`, `Toast` dipakai lintas area, campur di `src/components/shared/` |
| Deploy | Satu kali deploy untuk semua perubahan, app manapun yang diubah |

**Kesimpulan:** pemisahan logis sudah bagus (nama file, route group, middleware per-area sudah konsisten) — yang belum ada adalah **batas fisik antar app** dan **domain terpisah**.

---

## 3. KEPUTUSAN ARSITEKTUR

| Keputusan | Pilihan |
|---|---|
| Tooling monorepo | pnpm workspace + Turborepo |
| Jumlah app | 3 — `apps/owner`, `apps/pos`, `apps/superadmin` |
| Supabase project | Tetap **satu**, dipakai ketiga app (migrations tetap di root repo, bukan per-app) |
| Service role key | Tetap dipegang tiap app sendiri-sendiri via env Vercel masing-masing (bukan dipusatkan — di luar scope v4.0, lihat Bagian 9) |
| JWT secret | **Dipisah**: `POS_JWT_SECRET` (untuk `pending_login` + `session`) dan `OWNER_JWT_SECRET` (untuk `owner_session`) — supaya tidak ada ketergantungan tersembunyi antar app |
| Komunikasi antar app | **Tidak ada.** Owner dan kasir memang tidak berhubungan — tidak perlu shared cookie domain, tidak perlu API call antar app. Link "buka POS Kasir" di `OwnerSidebar` cukup `<a href="https://pos.rakku.com">` biasa |
| Deploy target | 3 project Vercel terpisah, masing-masing attach 1 domain/subdomain |

---

## 4. STRUKTUR TARGET

```
rakku/                              # root monorepo
├── apps/
│   ├── owner/                      # → rakku.com
│   │   ├── src/app/
│   │   │   ├── daftar/
│   │   │   ├── masuk/
│   │   │   ├── cek-email/
│   │   │   ├── onboarding/
│   │   │   ├── (dashboard)/        # page.tsx, outlets/, employees/, settings/
│   │   │   ├── api/
│   │   │   │   ├── auth/owner/
│   │   │   │   ├── onboarding/
│   │   │   │   └── owner/          # outlets, employees, roles, menus, settings
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── middleware.ts           # hanya guard /daftar, /masuk, /onboarding, (dashboard)
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   ├── pos/                        # → pos.rakku.com
│   │   ├── src/app/
│   │   │   ├── (auth)/login/       # 4-step: company → outlet → user → pin
│   │   │   ├── (dashboard)/        # register, orders, reports, products, categories,
│   │   │   │                       #   pricing-tiers, taxes, discounts
│   │   │   ├── api/
│   │   │   │   ├── auth/tenant/
│   │   │   │   ├── admin/
│   │   │   │   └── reports/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # redirect ke /login
│   │   ├── middleware.ts           # hanya guard tenant session
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── superadmin/                 # → superadmin.rakku.com
│       ├── src/app/
│       │   ├── login/
│       │   ├── (protected)/        # companies, outlets, menus, roles,
│       │   │                       #   access-matrix, users, audit-logs
│       │   ├── api/superadmin/
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── middleware.ts           # hanya guard superadmin session
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       └── package.json
│
├── packages/
│   ├── shared-types/               # src/types/index.ts dipecah per domain, re-export
│   ├── supabase-clients/           # admin.ts, client.ts, server.ts (factory, terima env dari app pemanggil)
│   ├── auth-utils/                 # jose/bcryptjs wrapper generik: sign/verify JWT,
│   │                                #   pin.ts (hash/verify+lockout), audit-log.ts
│   ├── ui/                         # Badge, Toast, EmptyState, QtyControl + tailwind preset
│   └── pricing/                    # tiers.ts (dipakai apps/owner saat onboarding & apps/pos saat seed outlet baru)
│
├── supabase/
│   ├── migrations/                 # TIDAK BERUBAH — tetap satu folder untuk satu project Supabase
│   └── seed.sql
│
├── scripts/                        # seed.ts, seed-full.ts, backfill-owners.ts — tetap satu tempat di root
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                    # root, workspace scripts
└── DOCS.md
```

---

## 5. PEMETAAN FILE EXISTING → LOKASI BARU

### 5.1 → `apps/owner`
Semua isi `src/app/owner/**` (daftar, masuk, cek-email, onboarding, (dashboard) + sub-halamannya) pindah jadi `src/app/**` di app baru (prefix `/owner` dihilangkan karena sudah jadi domain sendiri). API `src/app/api/auth/owner/**`, `src/app/api/onboarding/**`, `src/app/api/owner/**` pindah jadi `src/app/api/**`. Komponen `src/components/owner/OwnerSidebar.tsx` ikut pindah. Library `src/lib/auth/owner-session.ts` dan `src/lib/supabase/queries.owner.ts` ikut pindah (tetap khusus app ini, tidak masuk `packages/`).

### 5.2 → `apps/pos`
Semua isi `src/app/(auth)/login/**` dan `src/app/(dashboard)/**` (register, orders, reports, products, categories, pricing-tiers, taxes, discounts) pindah apa adanya (prefix hilang karena jadi root domain `pos.rakku.com`). API `src/app/api/auth/tenant/**`, `src/app/api/admin/**`, `src/app/api/reports/**` pindah. Semua komponen `src/components/register/**` dan `src/components/admin/**` serta `src/components/reports/EmailReportModal.tsx` pindah. Library `src/lib/auth/tenant-session.ts`, `pending-login.ts`, `company.ts`, `menus.ts`, `src/lib/supabase/queries.server.ts`, `queries.client.ts`, `storage.ts`, `src/lib/store/cartStore.ts` semua ikut pindah ke sini (khusus POS, tidak di-share).

### 5.3 → `apps/superadmin`
Semua isi `src/app/superadmin/**` pindah apa adanya (prefix `/superadmin` hilang). API `src/app/api/superadmin/**` pindah. Library `src/lib/auth/superadmin.ts` dan `src/lib/supabase/queries.superadmin.ts` ikut pindah.

### 5.4 → `packages/shared-types`
`src/types/index.ts` (275 baris) dipecah jadi beberapa file per domain (`owner.ts`, `tenant.ts`, `superadmin.ts`, `common.ts` untuk yang benar-benar dipakai lintas app seperti `Company`, `Outlet` shape dasar), lalu di-barrel-export dari `index.ts` package ini.

### 5.5 → `packages/auth-utils`
Bagian **generik** dari `src/lib/auth/`: wrapper `jose` untuk sign/verify JWT (fungsi generik, terima secret & payload sebagai parameter — bukan hardcode `TENANT_JWT_SECRET`), `pin.ts` (hash/verify PIN + lockout, dipakai `apps/pos` dan `apps/owner` saat reset PIN karyawan), `audit-log.ts` (dipakai `apps/pos` untuk login attempt dan `apps/superadmin` untuk audit lintas tenant).

`tenant-session.ts` dan `owner-session.ts` **tidak** masuk sini — itu tetap tinggal di masing-masing app karena isinya spesifik shape cookie masing-masing (hanya memanggil fungsi generik dari `auth-utils`).

### 5.6 → `packages/supabase-clients`
`admin.ts`, `client.ts`, `server.ts` diubah jadi factory function yang menerima `NEXT_PUBLIC_SUPABASE_URL` dkk dari env app pemanggil (tiap app tetap punya env sendiri, cuma logic pembuatan client-nya di-share).

### 5.7 → `packages/ui`
`src/components/shared/Badge.tsx`, `EmptyState.tsx`, `QtyControl.tsx`, `Toast.tsx` — dipakai baik di `apps/pos` maupun `apps/owner`. Sertakan juga tailwind preset (`primary`, `forest`, `neutral`, `danger`, `warning`, `success`, font `display`/`body`/`mono`, radius `card`/`modal`, animasi `slide-up`/`fade-in`/`bounce-in`) supaya ketiga app konsisten visual tanpa copy-paste config.

### 5.8 → `packages/pricing`
`src/lib/pricing/tiers.ts` — dipakai `apps/owner` (seed default tier saat onboarding company/outlet baru) dan `apps/pos` (kalau ada logic terkait tier di admin pricing-tiers page).

### 5.9 Tetap di root (tidak masuk `apps/` atau `packages/`)
`supabase/migrations/**`, `supabase/seed.sql`, `scripts/**` (seed.ts, seed-full.ts, backfill-owners.ts, run-migration.ts/js, migration-004.ts) — semua ini operasional database level project, bukan kode app.

---

## 6. ENV VARIABLES PER APP

| Variabel | `apps/owner` | `apps/pos` | `apps/superadmin` |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (env sendiri di Vercel) | ✅ (env sendiri) | ✅ (env sendiri) |
| `OWNER_JWT_SECRET` | ✅ | ❌ | ❌ |
| `POS_JWT_SECRET` | ❌ | ✅ | ❌ |
| `NEXT_PUBLIC_TAX_RATE` | ❌ | ✅ | ❌ |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | ❌ | ✅ (laporan) | ❌ |
| SMTP nodemailer (verifikasi email) | ✅ | ❌ | ❌ |

Catatan: `SUPABASE_SERVICE_ROLE_KEY` sengaja tetap sama nilainya di ketiga env (satu Supabase project), tapi disimpan sebagai env var terpisah per project Vercel — supaya kalau nanti mau di-rotate/dipersempit per app, tinggal ganti satu tanpa pengaruh ke app lain.

---

## 7. PEMETAAN DOMAIN & DEPLOYMENT

| Domain | Vercel Project | Root Directory (monorepo) |
|---|---|---|
| `rakku.com`, `www.rakku.com` | `rakku-owner` | `apps/owner` |
| `pos.rakku.com` | `rakku-pos` | `apps/pos` |
| `superadmin.rakku.com` | `rakku-superadmin` | `apps/superadmin` |

Vercel mendukung "Root Directory" per project dalam satu Git repo monorepo — jadi tetap **satu Git repository**, tiga Vercel project yang masing-masing menunjuk ke `apps/owner`, `apps/pos`, `apps/superadmin` sebagai root direktorinya. Push ke `main` akan trigger build ketiganya (Turborepo cache akan skip app yang tidak berubah filenya).

---

## 8. ROADMAP FASE IMPLEMENTASI

### Fase 1 — Setup Skeleton Monorepo ✅
- [x] Inisialisasi `pnpm-workspace.yaml` (`packages: - "apps/*" - "packages/*"`)
- [x] Inisialisasi `turbo.json` dengan task dasar (`dev`, `build`, `lint`)
- [x] Root `package.json` dengan scripts workspace (`pnpm -w dev`, dst.)
- [x] Buat folder kosong `apps/owner`, `apps/pos`, `apps/superadmin`, `packages/shared-types`, `packages/supabase-clients`, `packages/auth-utils`, `packages/ui`, `packages/pricing` masing-masing dengan `package.json` minimal
- **Definition of Done:** `pnpm install` di root berhasil, workspace terdeteksi (`pnpm ls -r` menampilkan semua package kosong)

### Fase 2 — Ekstrak `packages/` ✅
- [x] Pindahkan & pecah `src/types/index.ts` → `packages/shared-types`
- [x] Pindahkan bagian generik `src/lib/auth/` (JWT wrapper, `pin.ts`, `audit-log.ts`) → `packages/auth-utils`
- [x] Ubah `admin.ts`/`client.ts`/`server.ts` jadi factory → `packages/supabase-clients`
- [x] Pindahkan `Badge`, `EmptyState`, `QtyControl`, `Toast` + tailwind preset → `packages/ui`
- [x] Pindahkan `tiers.ts` → `packages/pricing`
- [x] Semua package expose lewat `exports` di `package.json` masing-masing, build dengan `tsup` atau langsung transpile via Next (workspace package biasa tanpa build step lebih simpel untuk awal)
- **Definition of Done:** package-package ini belum dipakai app manapun, tapi sudah bisa di-`pnpm build` tanpa error type

### Fase 3 — Migrasi `apps/pos` (duluan, karena paling besar & paling stabil) ✅
- [x] Pindahkan semua route, komponen, lib khusus tenant sesuai Bagian 5.2
- [x] Ganti import internal yang tadinya dari `src/types`, `src/lib/auth` generik, `src/components/shared`, jadi import dari `@rakku/shared-types`, `@rakku/auth-utils`, `@rakku/ui`
- [x] Buat `middleware.ts` baru khusus proteksi tenant session saja (hapus percabangan superadmin/owner)
- [x] `next.config.mjs` dan `tailwind.config.ts` baru khusus app ini
- [x] Rename `TENANT_JWT_SECRET` → `POS_JWT_SECRET` di kode dan `.env.local`
- [x] Jalankan `pnpm --filter pos dev`, test manual: 4-step login, register, checkout, orders, reports, products CRUD
- **Definition of Done:** `apps/pos` jalan mandiri di localhost, semua fitur existing berfungsi sama seperti sebelum migrasi

### Fase 4 — Migrasi `apps/owner` ✅
- [x] Pindahkan semua route, komponen, lib khusus owner sesuai Bagian 5.1
- [x] Ganti import ke `@rakku/*` packages
- [x] `middleware.ts`, `next.config.mjs`, `tailwind.config.ts` baru khusus app ini
- [x] Rename penggunaan `TENANT_JWT_SECRET` untuk `owner_session` → `OWNER_JWT_SECRET`
- [x] Ganti link "buka POS Kasir" di `OwnerSidebar` dari relative path ke absolute URL (`https://pos.rakku.com`, pakai env var `NEXT_PUBLIC_POS_URL` supaya beda antara local/staging/production)
- [x] Test manual: daftar, verifikasi email, onboarding, CRUD outlet/karyawan/role, settings
- **Definition of Done:** `apps/owner` jalan mandiri, tidak ada lagi dependency ke folder `pos`/`superadmin`

### Fase 5 — Migrasi `apps/superadmin` ✅
- [x] Pindahkan semua route, komponen, lib khusus superadmin sesuai Bagian 5.3
- [x] Ganti import ke `@rakku/*` packages
- [x] `middleware.ts`, `next.config.mjs`, `tailwind.config.ts` baru khusus app ini
- [x] Superadmin tetap pakai Supabase Auth (tidak berubah)
- [x] Test manual: login superadmin, CRUD companies/outlets/menus/roles/access-matrix/users, lihat audit-logs
- **Definition of Done:** `apps/superadmin` jalan mandiri

### Fase 6 — Hapus Struktur Lama & Cleanup ✅
- [x] Hapus `src/app/owner`, `src/app/superadmin`, `src/app/(auth)`, `src/app/(dashboard)` dari root lama (root app sekarang seharusnya sudah kosong dari route)
- [x] Pastikan tidak ada lagi file duplikat antara `apps/*` dan sisa struktur lama
- [x] Update `.gitignore`, `tsconfig.json` base di root untuk path alias `@rakku/*`
- [x] Update `DOCS.md`: tambah "Bagian 15 — v4.0 Monorepo" berisi struktur baru, pemetaan domain, cara jalankan tiap app (`pnpm --filter owner dev`, dst.)
- **Definition of Done:** repo bersih, tidak ada kode mati, `DOCS.md` akurat dengan kondisi baru

### Fase 7 — Deployment & Domain Cutover ⬜
- [ ] Buat 3 project Vercel baru dari repo yang sama, masing-masing set Root Directory sesuai Bagian 7
- [ ] Set env variables per project sesuai Bagian 6
- [ ] Deploy ketiganya ke preview URL dulu, test end-to-end di preview
- [ ] Attach domain: `rakku.com` → `rakku-owner`, `pos.rakku.com` → `rakku-pos`, `superadmin.rakku.com` → `rakku-superadmin`
- [ ] Update DNS (CNAME/A record sesuai instruksi Vercel)
- [ ] Setelah DNS propagate, smoke test production: daftar owner baru, login kasir existing (RAKKU/TOKOKO), login superadmin
- [ ] Matikan/redirect domain lama kalau sebelumnya sudah ada production di 1 domain
- **Definition of Done:** ketiga domain live di production, tidak ada regresi dari v3.0

---

## 9. CATATAN PENTING (bukan tugas fase ini, tapi perlu disadari)

- **RLS masih mati** (`003_rls_permissive.sql`) dan ketiga app tetap memegang `SUPABASE_SERVICE_ROLE_KEY` penuh. Migrasi v4.0 ini murni soal kerapian struktur/deploy, **bukan** hardening keamanan — kalau nanti mau memperkuat isolasi data, itu pekerjaan terpisah (aktifkan RLS + policy berbasis JWT claim, atau sentralisasi service role key ke satu backend API).
- Karena akun owner dan akun kasir memang tidak berhubungan, sengaja **tidak dibuat** shared cookie domain (`.rakku.com`) atau SSO antar app — ini keputusan sadar, bukan kelalaian.
- Kalau di masa depan ingin menambah app ke-4 (misal landing/marketing page terpisah dari dashboard owner), pola `apps/*` di monorepo ini sudah siap menampungnya tanpa restrukturisasi ulang.

---

## 10. INSTRUKSI KHUSUS UNTUK AI AGENT

- Kerjakan **satu fase per sesi/PR**. Setiap fase diakhiri dengan: (a) daftar file yang dipindah/diubah, (b) perintah untuk menjalankan & test app yang baru dipindah, (c) konfirmasi tidak ada perubahan perilaku fitur.
- **Jangan** ubah logic bisnis apa pun (cart, pricing, tax/discount, RBAC, alur onboarding) selama migrasi — kalau ada import yang perlu berubah, ubah path import-nya saja, bukan isinya.
- **Jangan** menyentuh `supabase/migrations/**` sama sekali di fase manapun pada dokumen ini.
- Pertahankan bahasa UI existing (Bahasa Indonesia) dan Tailwind palette/font yang sudah ada — pindahkan config-nya apa adanya ke `packages/ui` / masing-masing app, jangan redesign.
- Kalau satu fase ternyata terlalu besar untuk satu sesi, boleh dipecah lebih kecil lagi (misal Fase 3 dipecah per sub-folder: register dulu, lalu orders, lalu reports, dst.) — tapi tetap laporkan progress per sub-bagian dengan jelas.
- Setelah Fase 7 selesai, akun testing existing (`budi@rakku.test`/`budi12345`, `ali@rakku.test`/`ali12345`, company RAKKU/TOKOKO) harus tetap bisa dipakai tanpa perlu dibuat ulang.

---

**Ringkasan satu paragraf untuk AI agent:** Pecah rakku dari satu Next.js app menjadi monorepo pnpm+Turborepo dengan 3 app independen (`apps/owner`, `apps/pos`, `apps/superadmin`) yang deploy ke domain terpisah (`rakku.com`, `pos.rakku.com`, `superadmin.rakku.com`), dengan kode yang benar-benar dipakai bersama diekstrak ke `packages/shared-types`, `packages/supabase-clients`, `packages/auth-utils`, `packages/ui`, dan `packages/pricing` — tanpa mengubah sedikit pun logic bisnis, skema database, atau perilaku fitur yang sudah berjalan di v3.0. Kerjakan bertahap per fase (Bagian 8), migrasi POS dulu (paling besar & stabil), lalu Owner, lalu Superadmin, baru cleanup dan deployment cutover di akhir.
