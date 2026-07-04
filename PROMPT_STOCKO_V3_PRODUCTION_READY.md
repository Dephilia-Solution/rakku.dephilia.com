# PROMPT PENGEMBANGAN — Stocko (Rakku POS) v3.0
## Dari Internal Tool → SaaS Multi-Tenant Production-Ready

> **Dokumen ini adalah brief/prompt lengkap untuk AI coding agent** (Claude Code atau sejenisnya) yang akan mengeksekusi pengembangan. Tempel/beri dokumen ini ke agent sebagai instruksi kerja utama, bersama `DOCS.md` (dokumentasi v2.1) sebagai referensi kondisi eksisting.
>
> **Base version:** Stocko v2.1 (Multi-Tenant & Access Control) — Next.js 14 App Router + Supabase + Tailwind + Zustand
> **Target version:** v3.0 — Self-Service SaaS Multi-Tenant, siap dibuka untuk publik

---

## 0. CARA MENGGUNAKAN DOKUMEN INI (baca dulu, agent)

1. Baca `DOCS.md` (v2.1) secara menyeluruh dulu sebelum menulis kode apa pun — itu adalah *source of truth* struktur, skema, dan konvensi yang sudah ada.
2. **Jangan** menulis ulang dari nol. Sistem register/kasir, cart engine (`cartStore.ts`), pricing tier, tax/discount engine **sudah bagus dan sudah dipakai** — pertahankan, jangan sentuh logic-nya kecuali disebutkan eksplisit di dokumen ini.
3. Dokumen ini fokus pada **lapisan yang belum ada**: onboarding self-service, kepemilikan (ownership) tenant, landing page, dan hardening produksi.
4. Kerjakan **per fase** (lihat Bagian 14). Jangan gabungkan semua fase dalam satu batch besar — tiap fase harus bisa di-review dan diuji sendiri.
5. Setiap perubahan skema **wajib** berupa migration SQL baru bernomor lanjutan (`014_...sql` dst.) — jangan edit migration 001–013 yang sudah ada.
6. Ikuti konvensi kode yang sudah ada: TypeScript strict, App Router, path alias `@/*`, Tailwind custom palette, Zustand untuk state client, `jose` untuk JWT, `bcryptjs` untuk hashing.
7. Kalau ada keputusan desain yang ambigu, pilih pendekatan yang paling dekat dengan pola pasar (lihat Bagian 4) dan paling konsisten dengan arsitektur eksisting — jangan berhenti untuk bertanya kecuali benar-benar blocking.

---

## 1. RINGKASAN EKSEKUTIF

Stocko saat ini adalah sistem POS multi-tenant yang **fungsional secara teknis** (register, order, tier pricing, tax/discount, laporan semua sudah jalan) tapi **operasional model-nya masih "internal tool"**: satu-satunya cara sebuah company/outlet/user bisa ada di sistem adalah lewat **Superadmin** yang membuatkannya manual di panel superadmin. Tidak ada jalur bagi orang baru untuk datang, daftar sendiri, dan mulai pakai sistem tanpa campur tangan admin platform.

Ini adalah pola *internal admin tool*, bukan pola *SaaS produk*. Semua kompetitor di pasar POS Indonesia (Qasir, Majoo, Moka, Pawoon, Olsera, iSeller) beroperasi dengan pola **self-service**: pengguna daftar sendiri di landing page, otomatis jadi pemilik ("Owner"/BossQ/Admin), lalu dari dashboard-nya sendiri dia yang mengelola outlet dan karyawannya — platform hanya mengawasi dari belakang layar.

**Tujuan v3.0:** mengubah Stocko dari *internal tool bergaya superadmin-does-everything* menjadi *SaaS produk dengan onboarding self-service dan ownership hierarchy yang jelas*, tanpa merusak mesin POS yang sudah terbukti jalan.

---

## 2. KONDISI SAAT INI (ringkasan dari DOCS.md v2.1)

| Aspek | Kondisi sekarang |
|---|---|
| Cara company dibuat | Manual oleh Superadmin di `/superadmin/companies` |
| Cara outlet dibuat | Manual oleh Superadmin di `/superadmin/outlets` |
| Cara user/karyawan dibuat | Manual oleh Superadmin di `/superadmin/users` |
| Role tertinggi tenant | "Owner" hanya label role di tabel `roles`, **tidak** membawa kuasa administratif teknis (tidak bisa create outlet/user sendiri) |
| Login publik | Tidak ada — hanya company code + password → outlet → akun → PIN (4 step), semua entitasnya sudah harus ada duluan |
| Landing page | Tidak ada — `/` langsung redirect ke `/login` |
| Sign up / pendaftaran mandiri | Tidak ada sama sekali |
| RLS Database | **Dimatikan** (`003_rls_permissive.sql`) — isolasi data hanya mengandalkan filter di level aplikasi |
| Monetisasi/billing | Tidak ada — belum ada konsep paket/plan/limit |
| Audit log | Hanya mencatat percobaan login, belum mencatat aksi CRUD sensitif |
| Superadmin auth | Supabase Auth (email/password) |
| Tenant auth | Custom JWT (bcrypt + jose), 4 langkah |

**Kesimpulan:** arsitektur data (`company_id` + `outlet_id` scoping, RBAC dinamis via `role_menu_access`) sebenarnya **sudah tepat sebagai fondasi multi-tenant** — yang hilang adalah *lapisan self-service di atasnya* dan *pengerasan keamanan* di baliknya.

---

## 3. GAP ANALYSIS — KENAPA BELUM SIAP PUBLIK

1. **Tidak ada jalur akuisisi pengguna mandiri.** Tanpa sign-up, tidak ada growth loop. Setiap tenant baru butuh kerja manual superadmin — tidak scalable untuk publik.
2. **Tidak ada "Owner" sungguhan.** Role "Owner" sekarang cuma nama role di dropdown, bukan pemilik akun/tenant. Tidak ada relasi `companies.owner_id`. Owner tidak bisa reset kata sandi company-nya sendiri, tidak bisa tambah outlet, tidak bisa tambah karyawan tanpa minta ke superadmin.
3. **RLS mati** → kalau `SUPABASE_SERVICE_ROLE_KEY` atau salah satu API route punya bug filter, data lintas tenant bisa bocor. Untuk produk publik dengan data bisnis banyak orang, ini risiko besar.
4. **Tidak ada landing page/marketing site** → tidak ada tempat orang kenal produk, lihat harga, atau daftar.
5. **Tidak ada model bisnis/paket** → tidak jelas siapa bayar apa, berapa outlet/karyawan yang boleh dibuat gratis.
6. **Tidak ada verifikasi email / lupa password untuk tenant** → risiko akun terkunci permanen, rawan penyalahgunaan sign-up.
7. **Audit trail belum menyeluruh** → hanya login, padahal untuk multi-tenant publik, perubahan harga/produk/role sensitif juga perlu dicatat siapa-kapan-apa.
8. **Superadmin adalah satu peran yang menyatu.** Perlu dipisah: *Platform Superadmin* (mengelola seluruh platform/bisnis SaaS-nya) vs *Company Owner* (mengelola tenant-nya sendiri).

---

## 4. RISET EKOSISTEM POS — POLA YANG PERLU DIADOPSI

Diadaptasi dari observasi produk POS SaaS yang sudah berjalan di pasar Indonesia dan global (Qasir, Majoo, Moka, Pawoon, Olsera, iSeller, Loyverse, Square). Pola umum yang konsisten muncul:

- **Self-registration langsung jadi pemilik akun.** Semua kompetitor: daftar (email/HP + password) langsung membuat akun bisnis, tanpa approval manual dari pihak platform.
- **Tingkatan paket/subscription dengan batasan fitur.** <cite index="1-1,4-1">Kompetitor menyediakan tingkatan gratis dengan fitur dasar, lalu paket berbayar untuk fitur seperti otorisasi karyawan, laporan lengkap, produk/karyawan tanpa batas, dan menu self-order.</cite> Batasan umum di versi gratis meliputi jumlah outlet, jumlah pegawai, dan histori laporan.
- **Manajemen karyawan dengan hak akses berjenjang** dikelola sendiri oleh pemilik usaha dari dashboard, bukan oleh pihak platform. <cite index="7-1">Fitur kelola outlet memungkinkan pemilik memantau semua cabang, stok, dan transaksi dalam satu akun, dan ini termasuk fitur dasar yang tersedia untuk semua pengguna.</cite>
- **Multi-outlet dalam satu akun pemilik**, dengan kemampuan menambah outlet baru langsung dari dashboard sebagai fitur inti (bukan fitur yang butuh minta ke admin platform), meski beberapa vendor mengenakan biaya tambahan per outlet ekstra.
- **Onboarding wizard singkat**: daftar → isi profil bisnis → buat outlet pertama → mulai pakai — biasanya dalam hitungan menit, tanpa perlu menunggu proses verifikasi manual.
- **Dua permukaan berbeda**: aplikasi kasir (untuk staf, cepat & sederhana) vs *back office*/dashboard web (untuk pemilik, berisi laporan, manajemen karyawan, pengaturan). Stocko sudah punya pemisahan ini secara arsitektur (`(dashboard)` untuk tenant, register untuk kasir) — tinggal menambah lapisan kepemilikan di atasnya.
- **Struktur harga tier** (Free / Pro / Pro Plus, atau Starter/Advanced) berdasarkan jumlah outlet, jumlah pegawai, dan fitur lanjutan (laporan, akuntansi, self-order, integrasi e-commerce).

**Implikasi untuk Stocko:** hierarki yang perlu dibangun bukan cuma "Superadmin vs Tenant User", tapi tiga lapis:

```
PLATFORM  → Superadmin platform (Anda/tim Anda) — mengawasi seluruh bisnis SaaS
  └── TENANT (Company) → Owner — pemilik penuh atas company & SEMUA outlet-nya
        └── OUTLET → Admin/Manager Outlet — scoped ke outlet tertentu
              └── STAFF → Kasir — akses terbatas ke Register saja
```

---

## 5. HIERARKI AKSES BARU (RBAC v3)

### 5.1 Level Platform — Superadmin

Peran ini **tidak lagi mengelola operasional harian tenant** (tidak create outlet/karyawan orang lain secara rutin). Tanggung jawabnya jadi:

- Monitoring seluruh company yang terdaftar (jumlah, status aktif/suspend/trial)
- Approve/suspend/banned company yang melanggar (mis. penyalahgunaan, gagal bayar)
- Kelola master data platform: daftar menu sistem, paket/plan, harga langganan
- Lihat audit log lintas tenant untuk investigasi
- **Impersonate/support access** (opsional, dengan audit ketat) untuk bantu troubleshooting akun tenant atas izin
- **Tidak** rutin membuatkan outlet/user untuk tenant — itu jadi tanggung jawab Owner masing-masing

### 5.2 Level Tenant — Owner

Owner adalah pengguna yang **membuat company saat sign up**. Owner otomatis punya:

- Kuasa penuh atas **company miliknya** dan **seluruh outlet di bawahnya** (tidak perlu di-assign per outlet — implisit "all outlets" seperti pola `user_outlets` yang sudah ada dengan flag `all_outlets`)
- CRUD outlet (tambah/edit/nonaktifkan outlet)
- CRUD karyawan: undang karyawan baru (via email invite atau generate kredensial), assign role, assign outlet mana saja yang boleh diakses karyawan tsb.
- Kelola role & access matrix khusus company-nya (fitur `role_menu_access` yang sudah ada — sekarang dibuka untuk Owner, bukan hanya superadmin)
- Kelola pricing tier, tax, discount, produk — lintas semua outlet miliknya
- Kelola profil company: nama, logo, alamat, kontak, kode company, ganti password company
- Lihat laporan gabungan (semua outlet) maupun per outlet
- Kelola langganan/billing (jika model subscription diimplementasi)

### 5.3 Level Outlet — Admin/Manager Outlet

Role custom yang dibuat Owner (mis. "Kepala Cabang" yang sudah ada di seed), dengan scope dibatasi ke outlet tertentu lewat `user_outlets` (tanpa `all_outlets`):

- Kelola produk/kategori **hanya di outlet miliknya** (perlu penyesuaian query agar difilter juga per assigned outlet, bukan hanya company)
- Lihat laporan outlet miliknya
- Tidak bisa membuat outlet baru atau mengubah pengaturan company

### 5.4 Level Staff — Kasir

Tidak berubah dari sekarang — akses ke Register saja, login via 4-step + PIN.

### 5.5 Matriks Ringkas

| Aksi | Superadmin | Owner | Admin Outlet | Kasir |
|---|:---:|:---:|:---:|:---:|
| Kelola semua company | ✅ | ❌ | ❌ | ❌ |
| Suspend/approve company | ✅ | ❌ | ❌ | ❌ |
| Buat/edit outlet company sendiri | ❌* | ✅ | ❌ | ❌ |
| Buat/undang karyawan | ❌* | ✅ | opsional (jika diberi izin) | ❌ |
| Atur role & access matrix | ❌* | ✅ | ❌ | ❌ |
| Ubah profil & password company | ❌* | ✅ | ❌ | ❌ |
| CRUD produk/kategori | ❌* | ✅ (semua outlet) | ✅ (outlet sendiri) | ❌ |
| Lihat laporan | ❌* | ✅ (semua outlet) | ✅ (outlet sendiri) | ❌ |
| Transaksi di Register | ❌ | opsional | opsional | ✅ |

\* Superadmin tetap **bisa** untuk keperluan support/investigasi, tapi lewat jalur "support access" yang tercatat di audit log, bukan alur kerja rutin.

---

## 6. USER JOURNEY BARU (END-TO-END)

```
┌─────────────────────────────────────────────────────────────────┐
│  1. LANDING PAGE  (/)                                            │
│     Hero, fitur, harga/paket, testimoni, FAQ, CTA "Daftar Gratis"│
└───────────────────────────┬───────────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────────┐
│  2. SIGN UP  (/register atau /daftar)                             │
│     Input: nama, email, no. HP, password                         │
│     → Buat akun Owner (Supabase Auth atau tabel `owners`)         │
│     → Kirim email verifikasi                                      │
└───────────────────────────┬───────────────────────────────────────┘
                            │ verifikasi email
┌───────────────────────────▼───────────────────────────────────────┐
│  3. ONBOARDING WIZARD  (/onboarding)                              │
│     Step A: Data bisnis → nama company, kategori usaha, kode      │
│              company (auto-suggest, unik), password company       │
│     Step B: Outlet pertama → nama outlet, alamat                  │
│     Step C: (opsional) pilih paket/plan (bisa skip → trial/free)  │
│     → Insert companies (owner_id = current user), outlets,        │
│       default roles (Owner/Admin/Kasir), default pricing tier     │
└───────────────────────────┬───────────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────────┐
│  4. OWNER DASHBOARD  (/dashboard/*)                                │
│     - Ringkasan bisnis (semua outlet)                              │
│     - Kelola Outlet (tambah cabang baru)                           │
│     - Kelola Karyawan (undang, assign role & outlet)               │
│     - Kelola Role & Access Matrix                                  │
│     - Produk, Kategori, Pricing Tier, Pajak, Diskon (existing)     │
│     - Laporan (existing, tapi bisa lintas outlet)                  │
│     - Pengaturan Company (profil, password, billing)               │
└───────────────────────────┬───────────────────────────────────────┘
                            │ Owner mengundang karyawan
┌───────────────────────────▼───────────────────────────────────────┐
│  5. KARYAWAN MENERIMA UNDANGAN                                    │
│     Email/link berisi token → set PIN 6 digit pertama kali        │
│     (menggantikan proses "dibuatkan superadmin")                  │
└───────────────────────────┬───────────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────────┐
│  6. LOGIN KASIR  (4-step, TETAP SAMA seperti v2.1)                │
│     Company code + password → pilih outlet → pilih akun → PIN     │
│     → Redirect ke /register (POS)                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Catatan penting:** alur login 4-step untuk kasir **tidak diubah** — itu sudah baik untuk kecepatan operasional di outlet (device bersama, banyak kasir gantian). Yang baru adalah *jalur terpisah* untuk Owner masuk ke dashboard-nya (email+password, bukan lewat 4-step), karena Owner butuh akses dari mana saja (HP pribadi, laptop di rumah), bukan dari device kasir di outlet.

---

## 7. PERUBAHAN SKEMA DATABASE

### 7.1 Tabel baru

**`platform_admins`** — pisahkan superadmin platform dari data tenant (kalau belum terpisah dari `auth.users` Supabase secara eksplisit):
```sql
create table platform_admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id),
  name text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

**`owners`** — akun pemilik bisnis (terpisah dari `users` tenant yang berbasis PIN):
```sql
create table owners (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id), -- jika pakai Supabase Auth
  email text unique not null,
  phone text,
  name text not null,
  password_hash text, -- jika tidak pakai Supabase Auth, pakai bcrypt sendiri
  email_verified_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

**`companies`** — tambah kolom:
```sql
alter table companies
  add column owner_id uuid references owners(id),
  add column status text default 'trial' check (status in ('trial','active','suspended','cancelled')),
  add column plan_id uuid references plans(id),
  add column trial_ends_at timestamptz,
  add column slug text unique;
```

**`plans`** — master paket langganan:
```sql
create table plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- Free, Starter, Pro, Business
  price_monthly numeric(10,2),
  max_outlets int,                  -- null = unlimited
  max_employees int,
  features jsonb,                   -- flag fitur: self_order, advanced_report, dst.
  is_active boolean default true
);
```

**`employee_invitations`** — undangan karyawan, menggantikan proses "superadmin buat user manual":
```sql
create table employee_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  outlet_id uuid references outlets(id),
  email text,
  phone text,
  role_id uuid not null references roles(id),
  invited_by uuid not null references owners(id),
  token text unique not null,
  status text default 'pending' check (status in ('pending','accepted','expired','revoked')),
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
```

**`subscriptions`** (jika implementasi billing di Fase 3):
```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  plan_id uuid not null references plans(id),
  status text default 'active' check (status in ('active','past_due','cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  payment_gateway_ref text,
  created_at timestamptz default now()
);
```

**`audit_logs_extended`** — perluas audit log yang sudah ada (saat ini hanya login) agar mencakup aksi CRUD sensitif:
```sql
create table entity_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  actor_type text check (actor_type in ('owner','tenant_user','platform_admin')),
  actor_id uuid,
  action text not null,          -- 'create_outlet','update_price','delete_product', dst.
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  created_at timestamptz default now()
);
```

### 7.2 Row Level Security — WAJIB diaktifkan ulang

Migration `003_rls_permissive.sql` mematikan RLS. Untuk versi publik, ini **harus dibalik**. Buat migration baru (`014_rls_production.sql`) yang:

- Mengaktifkan RLS di semua tabel tenant-scoped (`products`, `categories`, `orders`, `order_items`, dst.)
- Policy dasar: `company_id = current_setting('app.current_company_id')::uuid` — di-set oleh backend saat request masuk (via `set_config` di awal transaksi/RPC), **atau**
- Karena arsitektur backend memakai service-role key (bypass RLS) untuk operasi tenant, alternatif yang lebih realistis tanpa merombak semua query: pertahankan service-role untuk operasi normal API, tapi **aktifkan RLS sebagai lapisan pertahanan kedua (defense-in-depth)** untuk skenario akses langsung (mis. jika suatu saat expose Supabase client-side dengan anon key). Minimal: pastikan anon key **tidak pernah** bisa membaca tabel tenant tanpa context — set policy default `deny all` untuk anon/authenticated role, hanya service role yang bisa akses penuh.
- Dokumentasikan keputusan ini secara eksplisit di `DOCS.md` v3 agar developer berikutnya paham kenapa RLS diaktifkan tapi app tetap pakai service-role client.

---

## 8. AUTENTIKASI & OTORISASI v3

### 8.1 Dua alur auth yang hidup berdampingan

| | Owner/Admin | Kasir (existing) |
|---|---|---|
| Metode | Email + password (Supabase Auth, konsisten dengan superadmin) | Company code + outlet + akun + PIN |
| Sesi | JWT/cookie Supabase session | JWT `session` cookie (existing, 12 jam) |
| Device | HP pribadi, laptop, dari mana saja | Device kasir di outlet |
| Tujuan | Dashboard manajemen | POS Register operasional |

### 8.2 Alur baru yang perlu dibangun

- `POST /api/auth/owner/register` — sign up Owner baru + kirim email verifikasi (pakai Resend yang sudah terintegrasi)
- `POST /api/auth/owner/login` — login Owner
- `POST /api/auth/owner/forgot-password` / `reset-password`
- `POST /api/onboarding/company` — buat company + outlet pertama + seed default roles/tiers (reuse logic dari `scripts/seed.ts` yang sudah ada, tapi dipanggil dari API bukan CLI)
- `POST /api/dashboard/employees/invite` — Owner mengundang karyawan (generate token, simpan di `employee_invitations`, kirim email)
- `GET/POST /api/invite/[token]` — halaman terima undangan, karyawan set PIN pertama kali
- `POST /api/dashboard/outlets` — Owner CRUD outlet sendiri (bukan lewat superadmin lagi)

### 8.3 Middleware

Perluas `middleware.ts` untuk route group baru:

| Route | Proteksi |
|---|---|
| `/`, `/harga`, `/tentang`, `/fitur` | Publik (landing page) |
| `/daftar`, `/masuk` (Owner) | Publik, redirect ke dashboard jika sudah login |
| `/onboarding/*` | Perlu login Owner, belum punya company |
| `/dashboard/*` | Perlu login Owner **dan** company sudah ada |
| `/invite/[token]` | Publik, validasi token di halaman |
| `/login/*` (kasir, existing) | Tidak berubah |
| `/superadmin/*` | Tidak berubah secara alur, tapi scope kewenangan berubah sesuai Bagian 5.1 |

---

## 9. LANDING PAGE & MARKETING SITE

Halaman minimum untuk go-public:

1. **Beranda (`/`)** — hero + value proposition, screenshot/demo produk, ringkasan fitur (Register, Multi-Outlet, Laporan, RBAC), CTA "Daftar Gratis" & "Lihat Demo"
2. **Harga (`/harga`)** — tabel paket (lihat Bagian 11), FAQ seputar billing
3. **Fitur (`/fitur`)** — detail per fitur dengan visual
4. **Tentang (`/tentang`)** — cerita produk (opsional untuk trust)
5. **Syarat & Ketentuan (`/syarat-ketentuan`)** dan **Kebijakan Privasi (`/kebijakan-privasi`)** — **wajib** ada sebelum publik, terutama karena menyimpan data transaksi bisnis orang lain (relevan dengan UU No. 27/2022 PDP)
6. **Kontak/Bantuan (`/bantuan`)** — form kontak atau link WhatsApp/email support

Gunakan skill `frontend-design` saat membangun halaman-halaman ini agar visualnya tidak generik.

---

## 10. MONETISASI & PAKET LANGGANAN (rekomendasi)

Mengikuti pola pasar (versi gratis terbatas + tier berbayar):

| Paket | Outlet | Karyawan | Fitur |
|---|---|---|---|
| **Gratis** | 1 | 2 | Register, produk terbatas, laporan dasar (30 hari terakhir) |
| **Pro** | hingga 3 | tanpa batas | + laporan lengkap, tier pricing, tax/discount, email report |
| **Business** | tanpa batas | tanpa batas | + multi-outlet penuh, access matrix custom, audit log lengkap, prioritas support |

Implementasi limit: cek `plans.max_outlets` / `max_employees` di server action sebelum insert outlet/karyawan baru — kembalikan error yang jelas + CTA upgrade.

**Integrasi pembayaran** (Fase 3, opsional untuk MVP publik): Midtrans atau Xendit untuk pembayaran langganan bulanan lokal Indonesia (dukungan QRIS, VA, e-wallet) — pilih salah satu, jangan bangun dua-duanya sekaligus di awal.

> Catatan: kalau tujuan awal hanya "buka ke publik" tanpa monetisasi dulu, Bagian 10 bisa ditunda ke fase belakangan — tapi struktur tabel `plans`/`companies.plan_id` tetap sebaiknya disiapkan dari awal agar tidak migrasi ulang besar-besaran nanti.

---

## 11. PRODUCTION HARDENING CHECKLIST

### Keamanan
- [ ] Aktifkan kembali RLS dengan deny-by-default untuk anon/authenticated key (Bagian 7.2)
- [ ] Validasi input di semua API route dengan schema (zod) — cegah payload sembarangan
- [ ] Rate limiting di endpoint publik (`sign up`, `forgot password`, `invite accept`) — bukan cuma di PIN/company login yang sudah ada
- [ ] CSRF protection untuk form-form sensitif
- [ ] Audit `npm audit` / dependency scanning berkala
- [ ] Rotasi & penyimpanan aman untuk `TENANT_JWT_SECRET`, service role key (gunakan secret manager platform hosting, jangan commit)
- [ ] Pastikan `SUPABASE_SERVICE_ROLE_KEY` **tidak pernah** terekspos ke client bundle

### Reliabilitas
- [ ] Error boundary di setiap route group (sudah ada sebagian — perluas ke route baru)
- [ ] Logging terstruktur + error tracking (mis. Sentry) untuk production
- [ ] Backup database terjadwal (Supabase punya point-in-time recovery di paket berbayar — aktifkan)
- [ ] Health check endpoint untuk monitoring uptime

### Data & Kepatuhan
- [ ] Halaman ToS & Privacy Policy (Bagian 9)
- [ ] Kebijakan retensi data & penghapusan akun (hak pengguna sesuai UU PDP)
- [ ] Audit log CRUD sensitif (Bagian 7.1, `entity_audit_logs`)

### Kualitas & Deployment
- [ ] Environment terpisah: development, staging, production (project Supabase terpisah untuk tiap env)
- [ ] CI minimal: lint + type-check + build sebelum deploy
- [ ] Test end-to-end untuk alur kritikal: sign up → onboarding → invite karyawan → login kasir → transaksi → laporan
- [ ] Migration lama (001–013) tetap dipertahankan; migration baru dijalankan berurutan lewat runner yang sama (`scripts/run-migration.ts`)

---

## 12. MIGRASI DATA EXISTING (RAKKU, TOKOKO)

Company yang sudah ada (RAKKU, TOKOKO — lihat Bagian 12.3/12.5 `DOCS.md`) perlu dibackfill agar konsisten dengan model baru:

1. Buat akun `owners` untuk user yang saat ini berperan "Owner" di masing-masing company (mis. `budi` di RAKKU, `ali` di TOKOKO) — perlu keputusan: apakah email asli mereka dipakai, atau dibuatkan email placeholder untuk keperluan testing.
2. Set `companies.owner_id` mengarah ke akun owner baru tsb.
3. Set `companies.status = 'active'` (bukan trial) untuk data existing agar tidak ke-lock oleh logic trial baru.
4. Set `companies.plan_id` ke paket "Business" (unlimited) agar data seed lama tidak tersandung limit paket baru.
5. Jangan hapus/ubah data transaksi/order lama.

---

## 13. STRUKTUR ROUTE BARU (ringkasan)

```
src/app/
├── (marketing)/                 # BARU — landing page publik
│   ├── page.tsx                 # Beranda
│   ├── harga/page.tsx
│   ├── fitur/page.tsx
│   ├── syarat-ketentuan/page.tsx
│   └── kebijakan-privasi/page.tsx
│
├── (owner-auth)/                # BARU — auth untuk Owner
│   ├── daftar/page.tsx
│   ├── masuk/page.tsx
│   ├── lupa-password/page.tsx
│   └── verifikasi-email/page.tsx
│
├── onboarding/                  # BARU
│   └── page.tsx                 # Wizard: company → outlet → (plan)
│
├── invite/[token]/              # BARU
│   └── page.tsx                 # Karyawan terima undangan, set PIN
│
├── dashboard/                   # BARU — panel Owner (terpisah dari (dashboard) existing?)
│   ├── layout.tsx
│   ├── outlets/page.tsx         # CRUD outlet
│   ├── employees/page.tsx       # Undang & kelola karyawan
│   ├── roles/page.tsx           # Access matrix per company (dibuka utk Owner)
│   ├── settings/page.tsx        # Profil company, password, branding
│   └── billing/page.tsx         # Paket & histori pembayaran
│
├── (auth)/login/...             # TIDAK BERUBAH — login kasir 4-step
├── (dashboard)/register|orders|... # TIDAK BERUBAH — operasional POS existing
└── superadmin/...               # TIDAK BERUBAH secara struktur, scope kewenangan disesuaikan Bagian 5.1
```

> Catatan penamaan: karena `(dashboard)` sudah dipakai untuk area operasional tenant (register, orders, reports), gunakan nama route group berbeda untuk panel Owner (mis. `/dashboard` non-grouped atau `/kelola`) supaya tidak bentrok. Sesuaikan dengan konvensi yang paling minim breaking-change terhadap kode existing.

---

## 14. ROADMAP FASE IMPLEMENTASI

### Fase 1 — Fondasi Ownership (wajib, prasyarat semua fase lain)
- Migration: tabel `owners`, kolom `companies.owner_id`
- Auth Owner: sign up, login, verifikasi email, forgot password
- Migrasi data existing (Bagian 12)
- **Definition of Done:** Owner baru bisa daftar dan login ke sesi kosong (belum ada company)

### Fase 2 — Onboarding & Self-Service Company/Outlet
- Wizard onboarding (buat company + outlet pertama, reuse seed logic)
- Dashboard Owner: CRUD outlet, CRUD karyawan via invite token, kelola role/access matrix
- **DoD:** Owner baru bisa daftar → buat company & outlet sendiri → undang kasir pertama → kasir bisa login 4-step dan transaksi — semuanya tanpa sentuhan superadmin

### Fase 3 — Landing Page & (opsional) Monetisasi
- Halaman marketing lengkap + legal pages
- Tabel `plans`, limit enforcement, (opsional) integrasi payment gateway
- **DoD:** Orang asing bisa menemukan produk, paham harga, dan daftar dari landing page

### Fase 4 — Production Hardening
- RLS aktif, audit log diperluas, rate limiting publik, error tracking, backup terjadwal
- **DoD:** checklist Bagian 11 selesai semua

### Fase 5 — Superadmin v2 (platform ops)
- Sederhanakan panel superadmin sesuai Bagian 5.1: monitoring, suspend/approve, plan management, audit lintas tenant
- **DoD:** Superadmin tidak lagi jadi jalur wajib untuk operasional harian tenant mana pun

---

## 15. INSTRUKSI KHUSUS UNTUK AI AGENT

- Kerjakan **satu fase per sesi/PR**, dengan migration SQL, kode, dan pembaruan `DOCS.md` sebagai satu paket yang bisa direview.
- Setiap fase baru harus diakhiri dengan: (a) daftar file yang diubah/ditambah, (b) migration baru yang perlu dijalankan manual di Supabase SQL editor (ikuti pola existing — dijalankan berurutan), (c) langkah testing manual untuk verifikasi.
- Jangan mengubah perilaku POS Register, cart engine, payment modal, split bill, atau invoice — itu di luar scope dokumen ini kecuali disebutkan eksplisit.
- Pertahankan bahasa UI existing (Bahasa Indonesia) untuk konsistensi produk.
- Untuk semua halaman baru yang customer-facing (landing, dashboard Owner), pertahankan/adaptasi Tailwind palette & font yang sudah didefinisikan di `tailwind.config.ts` (primary green, forest, Plus Jakarta Sans/DM Sans) — jangan bawa desain sistem baru yang tidak konsisten.
- Update `DOCS.md` di akhir tiap fase agar dokumentasi tetap jadi source of truth yang akurat (tambahkan bagian baru, jangan hapus riwayat v2.1).
- Tulis seed/testing account baru untuk Owner (mis. `owner-demo@stocko.test`) agar QA fase berikutnya mudah, tanpa mengganggu akun RAKKU/TOKOKO existing.

---

## 16. LAMPIRAN — REFERENSI POLA FITUR KOMPETITOR

| Platform | Pola onboarding | Pola multi-outlet | Model harga |
|---|---|---|---|
| Qasir | Daftar mandiri, langsung pakai | Kelola outlet fitur dasar, tambah cabang biaya tambahan di Pro | Gratis terbatas → Pro/Pro Plus berlangganan tahunan |
| Majoo | Daftar mandiri | Multi-outlet dalam satu langganan | Mulai ~Rp129rb/bulan, all-in-one |
| Moka POS | Daftar mandiri, cloud-based | Manajemen karyawan & multi-channel (online+offline) | Berlangganan, tanpa integrasi ERP penuh |
| Pawoon | Daftar mandiri | Kelola beberapa toko dalam satu akun | Gratis terbatas (transaksi/hari) → berbayar |
| Loyverse | Daftar mandiri | Back office terpusat | Basic gratis, fitur karyawan/inventaris lanjutan berbayar dengan trial 14 hari |

*(Detail harga berubah dari waktu ke waktu — gunakan tabel ini sebagai referensi pola struktural, bukan angka final untuk pricing page Stocko.)*

---

**Ringkasan satu paragraf untuk AI agent:** Bangun lapisan self-service di atas fondasi multi-tenant yang sudah solid — Owner mendaftar sendiri, membuat company & outlet-nya sendiri, mengundang karyawannya sendiri, dan mengelola semuanya dari dashboard sendiri; Superadmin mundur jadi pengawas platform, bukan operator harian tenant; dan sebelum dibuka ke publik, keraskan keamanan (RLS, audit, rate limit) serta lengkapi kebutuhan legal dasar (ToS, Privacy Policy) — semua dikerjakan bertahap per fase tanpa mengganggu mesin POS yang sudah terbukti berjalan.
