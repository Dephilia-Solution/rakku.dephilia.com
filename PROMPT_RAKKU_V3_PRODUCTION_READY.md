# PROMPT PENGEMBANGAN — rakku (Rakku POS) v3.0
## Dari Internal Tool → SaaS Multi-Tenant Production-Ready

> **✅ UPDATE PROGRES: Fase 1 & 2 SUDAH DIIMPLEMENTASI**
>
> Fase 1 (Fondasi Ownership) dan Fase 2 (Onboarding & Self-Service Company/Outlet) sudah selesai. Owner bisa daftar sendiri (dengan verifikasi email), buat company + outlet, kelola role & akses menu, kelola karyawan (CRUD langsung dengan PIN, tanpa sistem undangan), dan kelola outlet (CRUD + toggle status). Lihat `DOCS.md` Bagian 14 untuk dokumentasi lengkap.
>
> Fase 3 (Landing Page & Monetisasi), Fase 4 (Production Hardening), dan Fase 5 (Superadmin v2) **belum dimulai**.
>
> **Catatan keputusan deviasi dari brief awal:**
> - Sistem undangan karyawan (`employee_invitations`) **tidak diimplementasi** — Owner membuat karyawan langsung dengan PIN dan kasih tahu secara manual (sesuai keputusan user).
> - Tabel `plans` & `subscriptions` **belum dibuat** — subscription ditunda ke fase belakangan. Semua company status `active` tanpa limit.
> - Route owner pakai prefix `/owner/...` (bukan `/dashboard/...`) untuk persiapan pemisahan subdomain di masa depan (mis. `owner.rakku.com` vs `pos.rakku.com`).
> - **Onboarding tidak men-seed role default** — Owner harus membuat role sendiri via panel "Kelola Role" di halaman Karyawan. Berbeda dari `scripts/seed.ts` yang seed 4 role untuk data testing.
> - **Email verification via nodemailer SMTP** (bukan Supabase Auth) — Owner daftar → verifikasi email → baru bisa login. Token JWT 1 jam.
> - **Role & access matrix management** dibangun langsung di halaman Karyawan sebagai modal panel, bukan halaman terpisah seperti superadmin.
>
> ---
>
> **Dokumen ini adalah brief/prompt lengkap untuk AI coding agent** (Claude Code atau sejenisnya) yang akan mengeksekusi pengembangan. Tempel/beri dokumen ini ke agent sebagai instruksi kerja utama, bersama `DOCS.md` (dokumentasi v2.1) sebagai referensi kondisi eksisting.
>
> **Base version:** rakku v2.1 (Multi-Tenant & Access Control) — Next.js 14 App Router + Supabase + Tailwind + Zustand
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

rakku saat ini adalah sistem POS multi-tenant yang **fungsional secara teknis** (register, order, tier pricing, tax/discount, laporan semua sudah jalan) tapi **operasional model-nya masih "internal tool"**: satu-satunya cara sebuah company/outlet/user bisa ada di sistem adalah lewat **Superadmin** yang membuatkannya manual di panel superadmin. Tidak ada jalur bagi orang baru untuk datang, daftar sendiri, dan mulai pakai sistem tanpa campur tangan admin platform.

Ini adalah pola *internal admin tool*, bukan pola *SaaS produk*. Semua kompetitor di pasar POS Indonesia (Qasir, Majoo, Moka, Pawoon, Olsera, iSeller) beroperasi dengan pola **self-service**: pengguna daftar sendiri di landing page, otomatis jadi pemilik ("Owner"/BossQ/Admin), lalu dari dashboard-nya sendiri dia yang mengelola outlet dan karyawannya — platform hanya mengawasi dari belakang layar.

**Tujuan v3.0:** mengubah rakku dari *internal tool bergaya superadmin-does-everything* menjadi *SaaS produk dengan onboarding self-service dan ownership hierarchy yang jelas*, tanpa merusak mesin POS yang sudah terbukti jalan.

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
- **Dua permukaan berbeda**: aplikasi kasir (untuk staf, cepat & sederhana) vs *back office*/dashboard web (untuk pemilik, berisi laporan, manajemen karyawan, pengaturan). rakku sudah punya pemisahan ini secara arsitektur (`(dashboard)` untuk tenant, register untuk kasir) — tinggal menambah lapisan kepemilikan di atasnya.
- **Struktur harga tier** (Free / Pro / Pro Plus, atau Starter/Advanced) berdasarkan jumlah outlet, jumlah pegawai, dan fitur lanjutan (laporan, akuntansi, self-order, integrasi e-commerce).

**Implikasi untuk rakku:** hierarki yang perlu dibangun bukan cuma "Superadmin vs Tenant User", tapi tiga lapis:

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

### 7.1 Tabel baru — ✅ Sudah diimplementasi (Migration 014)

**`owners`** — akun pemilik bisnis (terpisah dari `users` tenant yang berbasis PIN):
```sql
create table owners (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  phone text,
  name text not null,
  password_hash text not null,       -- bcrypt (custom JWT, bukan Supabase Auth)
  email_verified_at timestamptz,
  is_active boolean default true,
  last_login_at timestamptz,
  created_at timestamptz default now()
);
```

**`companies`** — tambah kolom (hanya 2 dari 5 kolom yang diusulkan):
```sql
alter table companies
  add column owner_id uuid references owners(id) ON DELETE SET NULL,
  add column slug text UNIQUE;
```

> Kolom `status` (dengan enum trial/active/suspended/cancelled), `plan_id`, dan `trial_ends_at` **tidak ditambahkan** — semua company tetap `active` tanpa limit sampai Fase 3 monetisasi.

### 7.1b Tabel yang diusulkan tapi ⬜ BELUM dibuat

| Tabel | Status | Alasan |
|-------|--------|--------|
| `platform_admins` | ⬜ Belum | Ditunda ke Fase 5 (Superadmin v2) |
| `plans` | ⬜ Belum | Ditunda ke Fase 3 (Monetisasi) |
| `employee_invitations` | ❌ Tidak jadi | Owner buat karyawan langsung dengan PIN |
| `subscriptions` | ⬜ Belum | Ditunda ke Fase 3 (Monetisasi) |
| `entity_audit_logs` | ⬜ Belum | Ditunda ke Fase 4 (Production Hardening) |

### 7.2 Row Level Security — WAJIB diaktifkan ulang

Migration `003_rls_permissive.sql` mematikan RLS. Untuk versi publik, ini **harus dibalik**. Buat migration baru (`014_rls_production.sql`) yang:

- Mengaktifkan RLS di semua tabel tenant-scoped (`products`, `categories`, `orders`, `order_items`, dst.)
- Policy dasar: `company_id = current_setting('app.current_company_id')::uuid` — di-set oleh backend saat request masuk (via `set_config` di awal transaksi/RPC), **atau**
- Karena arsitektur backend memakai service-role key (bypass RLS) untuk operasi tenant, alternatif yang lebih realistis tanpa merombak semua query: pertahankan service-role untuk operasi normal API, tapi **aktifkan RLS sebagai lapisan pertahanan kedua (defense-in-depth)** untuk skenario akses langsung (mis. jika suatu saat expose Supabase client-side dengan anon key). Minimal: pastikan anon key **tidak pernah** bisa membaca tabel tenant tanpa context — set policy default `deny all` untuk anon/authenticated role, hanya service role yang bisa akses penuh.
- Dokumentasikan keputusan ini secara eksplisit di `DOCS.md` v3 agar developer berikutnya paham kenapa RLS diaktifkan tapi app tetap pakai service-role client.

---

## 8. AUTENTIKASI & OTORISASI v3

### 8.1 Dua alur auth yang hidup berdampingan

| | Owner (BARU) | Kasir (existing) |
|---|---|---|
| Metode | Email + password (Custom JWT — jose + bcryptjs, sama seperti kasir) | Company code + outlet + akun + PIN |
| Sesi | JWT `owner_session` cookie (24 jam) | JWT `session` cookie (existing, 12 jam) |
| Device | HP pribadi, laptop, dari mana saja | Device kasir di outlet |
| Tujuan | Dashboard manajemen (outlet, karyawan, role, pengaturan) | POS Register operasional |
| Signup | Self-service di `/owner/daftar` + verifikasi email | Tidak ada — dibuat oleh Owner |
| Library | `src/lib/auth/owner-session.ts` | `src/lib/auth/tenant-session.ts` |

### 8.2 Alur yang Dibangun (✅ sudah selesai)

- `POST /api/auth/owner/register` — sign up Owner baru + kirim email verifikasi (pakai nodemailer SMTP)
- `GET /api/auth/owner/verify-email?token=...` — verifikasi email via token JWT (1 jam)
- `POST /api/auth/owner/resend-verification` — kirim ulang email verifikasi
- `POST /api/auth/owner/login` — login Owner (wajib email已验证)
- `POST /api/auth/owner/logout` — logout Owner
- `GET /api/auth/owner/session` — baca session Owner saat ini
- `POST /api/onboarding/company` — buat company + outlet pertama + seed default pricing tiers (Dine In, Take Away). Role & akses menu **tidak di-seed** — Owner kelola sendiri.
- `GET /api/onboarding/company?name=...` — suggest kode & slug dari nama company
- `GET/POST /api/owner/outlets`, `PATCH/DELETE /api/owner/outlets/[id]` — CRUD outlet milik Owner sendiri
- `GET/POST /api/owner/employees`, `PATCH/DELETE /api/owner/employees/[id]` — CRUD karyawan + toggle status + reset PIN
- `GET/POST /api/owner/roles`, `PATCH/DELETE /api/owner/roles/[id]` — CRUD role
- `GET/POST /api/owner/roles/[id]/access` — toggle akses menu per role
- `GET /api/owner/menus` — list semua menu sistem
- `GET/PUT /api/owner/settings` — baca & update profil company + ganti password

**Tidak diimplementasi (deviasi):**
- `POST /api/auth/owner/forgot-password` / `reset-password` — belum ada, ditunda
- `POST /api/dashboard/employees/invite` — tidak diimplementasi, Owner buat langsung dengan PIN
- `GET/POST /api/invite/[token]` — tidak diimplementasi
- Email verifikasi pakai nodemailer SMTP (bukan Resend yang sudah terintegrasi untuk laporan)

### 8.3 Middleware

Perluas `middleware.ts` untuk route group baru:

| Route | Proteksi |
|---|---|---|
| `/`, `/_next`, `/api`, `/favicon` | Publik (tanpa proteksi) |
| `/owner/daftar`, `/owner/masuk` | Publik, redirect ke `/owner` atau `/owner/onboarding` jika sudah login |
| `/owner/onboarding` | Perlu login Owner + belum punya company → redirect ke `/owner/masuk` jika belum login, redirect ke `/owner` jika sudah punya company |
| `/owner`, `/owner/outlets`, `/owner/employees`, `/owner/settings` | Perlu login Owner **dan** company sudah ada → redirect ke `/owner/masuk` jika belum login, redirect ke `/owner/onboarding` jika belum punya company |
| `/login/*` (kasir, existing) | Publik (tanpa proteksi) |
| `/register`, `/orders`, `/reports`, `/products`, `/categories`, `/pricing-tiers`, `/taxes`, `/discounts` | Tenant session — redirect ke `/login` jika invalid |
| `/superadmin/login` | Publik, redirect ke `/superadmin/companies` jika sudah login |
| `/superadmin/*` (kecuali login) | Superadmin — redirect ke `/superadmin/login` jika belum auth via Supabase Auth |

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

> Catatan: kalau tujuan awal hanya "buka ke publik" tanpa monetisasi dulu, Bagian 10 bisa ditunda ke fase belakangan — tapi struktur tabel `plans`/`companies.plan_id` tetap sebaiknya disiapkan dari awal agar tidak migrasi ulang besar-besaran nanti. **Keputusan aktual:** tabel `plans` dan kolom terkait (`plan_id`, `trial_ends_at`, `status` enum) **tidak jadi dibuat di Fase 1–2** — akan ditambahkan dengan migration baru di Fase 3.

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

## 12. MIGRASI DATA EXISTING (RAKKU, TOKOKO) — ✅ SELESAI

Company yang sudah ada (RAKKU, TOKOKO) sudah di-backfill via `scripts/backfill-owners.ts` agar konsisten dengan model baru:

1. ✅ Akun `owners` dibuat untuk user yang berperan "Owner": `budi@rakku.test` (RAKKU) dan `ali@rakku.test` (TOKOKO) — email placeholder untuk testing.
2. ✅ `companies.owner_id` di-set mengarah ke akun owner tersebut.
3. ✅ `companies.status` tetap `'active'` (tidak ada logic trial baru yang mengubahnya).
4. ⬜ `companies.plan_id` — tidak di-set karena tabel `plans` belum dibuat. Semua company tanpa limit paket sampai Fase 3.
5. ✅ Tidak ada data transaksi/order yang diubah.

---

## 13. STRUKTUR ROUTE BARU (status: Fase 1 & 2 selesai)

```
src/app/
├── owner/                          # ✅ BARU — Owner self-service (prefix /owner/...)
│   ├── daftar/page.tsx             # ✅ Signup Owner
│   ├── masuk/page.tsx              # ✅ Login Owner
│   ├── cek-email/page.tsx          # ✅ Prompt verifikasi email + form kirim ulang
│   ├── onboarding/page.tsx         # ✅ Wizard company + outlet pertama
│   └── (dashboard)/                # ✅ Route group (pakai sidebar layout)
│       ├── layout.tsx              # ✅ Guard owner login + company exists + sidebar
│       ├── page.tsx                # ✅ /owner — Dashboard overview
│       ├── outlets/page.tsx        # ✅ CRUD outlet + toggle status + hapus
│       ├── employees/page.tsx      # ✅ CRUD karyawan + reset PIN + Kelola Role (dengan access matrix)
│       └── settings/page.tsx       # ✅ Edit profil & password company
│
├── (marketing)/                    # ⬜ BELUM ADA — Fase 3
├── invite/[token]/                 # ⬜ TIDAK DIIMPLEMENTASI (keputusan: tanpa sistem undangan)
│
├── (auth)/login/...                # TIDAK BERUBAH — login kasir 4-step
├── (dashboard)/register|orders|... # TIDAK BERUBAH — operasional POS existing
└── superadmin/...                  # TIDAK BERUBAH secara struktur, scope kewenangan disesuaikan Bagian 5.1 (Fase 5)
```

> **Catatan penamaan:** Route owner pakai prefix `/owner/...` (bukan `/dashboard/...`) untuk persiapan pemisahan subdomain di masa depan (mis. `owner.rakku.com` vs `pos.rakku.com`), sesuai keputusan user. Route group `(dashboard)` di dalam `owner/` memisahkan layout (dengan sidebar) dari auth pages (daftar, masuk, onboarding) yang tidak pakai sidebar.

---

## 14. ROADMAP FASE IMPLEMENTASI

### Fase 1 — Fondasi Ownership (wajib, prasyarat semua fase lain) ✅ SELESAI
- [x] Migration `014_owner_self_service.sql`: tabel `owners`, kolom `companies.owner_id`, `companies.slug`
- [x] Auth library `src/lib/auth/owner-session.ts` (JWT 24 jam, cookie `owner_session`)
- [x] Types: `Owner`, `OwnerSession`, `OwnerDashboardOutlet`, `OwnerDashboardEmployee`
- [x] API: `POST /api/auth/owner/register` — daftar Owner baru
- [x] API: `POST /api/auth/owner/login` & `logout` & `GET session`
- [x] Backfill data existing via `scripts/backfill-owners.ts` (RAKKU → budi@rakku.test, TOKOKO → ali@rakku.test)
- [x] Middleware update: proteksi route `/owner/*`
- **Definition of Done:** ✅ Owner baru bisa daftar dan login ke sesi kosong (belum ada company) → redirect ke onboarding

### Fase 2 — Onboarding & Self-Service Company/Outlet ✅ SELESAI
- [x] Library `src/lib/supabase/queries.owner.ts` (semua CRUD queries)
- [x] API `POST /api/onboarding/company` — buat company + outlet pertama + default pricing tiers (Dine In, Take Away). Role & akses menu **tidak di-seed** — Owner buat sendiri via panel Kelola Role.
- [x] API `GET /api/onboarding/company` — suggest kode & slug dari nama
- [x] API CRUD outlets: `GET/POST /api/owner/outlets`, `PATCH/DELETE /api/owner/outlets/[id]` (toggle status, hapus)
- [x] API CRUD employees: `GET/POST /api/owner/employees`, `PATCH/DELETE /api/owner/employees/[id]` (toggle status, reset PIN)
- [x] API CRUD roles: `GET/POST /api/owner/roles`, `PATCH/DELETE /api/owner/roles/[id]` + toggle akses menu per role
- [x] API `GET /api/owner/menus` — list semua menu sistem (untuk matriks akses)
- [x] API `GET/PUT /api/owner/settings` — edit profil & ganti password company
- [x] Halaman `/owner/daftar` — signup (UI dari `signup_reference.html`, foto pakai placeholder gradient)
- [x] Halaman `/owner/masuk` — login (UI dari `login_reference.html`, foto pakai placeholder gradient)
- [x] Halaman `/owner/cek-email` — prompt verifikasi email setelah daftar, form kirim ulang
- [x] Halaman `/owner/onboarding` — wizard 2-step (company → outlet)
- [x] Halaman `/owner` — dashboard overview (statistik outlet, karyawan, penjualan)
- [x] Halaman `/owner/outlets` — CRUD outlet (list, tambah, edit, toggle status, hapus)
- [x] Halaman `/owner/employees` — CRUD karyawan + panel **Kelola Role** (buat/edit/hapus role, atur akses menu per role dengan toggle)
- [x] Halaman `/owner/settings` — edit profil & password company
- [x] Komponen `OwnerSidebar.tsx` — sidebar dinamis (Dashboard, Outlet, Karyawan, Pengaturan, Logout, link POS Kasir)
- [x] Layout `owner/(dashboard)/layout.tsx` — guard owner login + company exists
- [x] Email verification flow — Owner baru verifikasi email (token JWT 1 jam, nodemailer SMTP) sebelum bisa login
- **Keputusan deviasi:**
  - Sistem undangan karyawan (`employee_invitations`) tidak diimplementasi — Owner buat karyawan langsung dengan PIN, kasih tahu secara manual.
  - Onboarding tidak men-seed role default — Owner harus membuat role sendiri. Ini berbeda dari `scripts/seed.ts` yang seed 4 role untuk data testing.
  - Role & access matrix management dibangun langsung di halaman Karyawan, bukan halaman terpisah.
- **Definition of Done:** ✅ Owner baru bisa daftar → verifikasi email → login → buat company & outlet sendiri → buat role → tambah karyawan dengan PIN → kasir login 4-step dan transaksi — semuanya tanpa sentuhan superadmin

### Fase 3 — Landing Page & (opsional) Monetisasi ⬜ BELUM DIMULAI
- Halaman marketing lengkap + legal pages (ToS, Privacy Policy)
- Tabel `plans`, limit enforcement, (opsional) integrasi payment gateway
- **DoD:** Orang asing bisa menemukan produk, paham harga, dan daftar dari landing page

### Fase 4 — Production Hardening ⬜ BELUM DIMULAI
- RLS aktif (deny-by-default untuk anon key), audit log CRUD diperluas (`entity_audit_logs`), rate limiting publik (sign up, forgot password), error tracking (Sentry), backup terjadwal
- Validasi input dengan zod di semua API route
- CSRF protection untuk form sensitif
- **DoD:** checklist Bagian 11 selesai semua

### Fase 5 — Superadmin v2 (platform ops) ⬜ BELUM DIMULAI
- Sederhanakan panel superadmin sesuai Bagian 5.1: monitoring, suspend/approve company, plan management, audit lintas tenant
- Buat tabel `platform_admins` untuk pisahkan superadmin platform dari data tenant
- **DoD:** Superadmin tidak lagi jadi jalur wajib untuk operasional harian tenant mana pun

---

## 15. INSTRUKSI KHUSUS UNTUK AI AGENT

- Kerjakan **satu fase per sesi/PR**, dengan migration SQL, kode, dan pembaruan `DOCS.md` sebagai satu paket yang bisa direview.
- Setiap fase baru harus diakhiri dengan: (a) daftar file yang diubah/ditambah, (b) migration baru yang perlu dijalankan manual di Supabase SQL editor (ikuti pola existing — dijalankan berurutan), (c) langkah testing manual untuk verifikasi.
- Jangan mengubah perilaku POS Register, cart engine, payment modal, split bill, atau invoice — itu di luar scope dokumen ini kecuali disebutkan eksplisit.
- Pertahankan bahasa UI existing (Bahasa Indonesia) untuk konsistensi produk.
- Untuk semua halaman baru yang customer-facing (landing, dashboard Owner), pertahankan/adaptasi Tailwind palette & font yang sudah didefinisikan di `tailwind.config.ts` (primary green, forest, Plus Jakarta Sans/DM Sans) — jangan bawa desain sistem baru yang tidak konsisten.
- Update `DOCS.md` di akhir tiap fase agar dokumentasi tetap jadi source of truth yang akurat (tambahkan bagian baru, jangan hapus riwayat v2.1).
- Tulis seed/testing account baru untuk Owner (mis. `owner-demo@rakku.test`) agar QA fase berikutnya mudah, tanpa mengganggu akun RAKKU/TOKOKO existing.
- Akun testing Owner yang sudah ada (via `scripts/backfill-owners.ts`): `budi@rakku.test` / `budi12345` (RAKKU), `ali@rakku.test` / `ali12345` (TOKOKO). Password company & PIN kasir tidak berubah dari v2.1.

---

## 16. LAMPIRAN — REFERENSI POLA FITUR KOMPETITOR

| Platform | Pola onboarding | Pola multi-outlet | Model harga |
|---|---|---|---|
| Qasir | Daftar mandiri, langsung pakai | Kelola outlet fitur dasar, tambah cabang biaya tambahan di Pro | Gratis terbatas → Pro/Pro Plus berlangganan tahunan |
| Majoo | Daftar mandiri | Multi-outlet dalam satu langganan | Mulai ~Rp129rb/bulan, all-in-one |
| Moka POS | Daftar mandiri, cloud-based | Manajemen karyawan & multi-channel (online+offline) | Berlangganan, tanpa integrasi ERP penuh |
| Pawoon | Daftar mandiri | Kelola beberapa toko dalam satu akun | Gratis terbatas (transaksi/hari) → berbayar |
| Loyverse | Daftar mandiri | Back office terpusat | Basic gratis, fitur karyawan/inventaris lanjutan berbayar dengan trial 14 hari |

*(Detail harga berubah dari waktu ke waktu — gunakan tabel ini sebagai referensi pola struktural, bukan angka final untuk pricing page rakku.)*

---

**Ringkasan satu paragraf untuk AI agent:** Bangun lapisan self-service di atas fondasi multi-tenant yang sudah solid — Owner mendaftar sendiri, membuat company & outlet-nya sendiri, mengundang karyawannya sendiri, dan mengelola semuanya dari dashboard sendiri; Superadmin mundur jadi pengawas platform, bukan operator harian tenant; dan sebelum dibuka ke publik, keraskan keamanan (RLS, audit, rate limit) serta lengkapi kebutuhan legal dasar (ToS, Privacy Policy) — semua dikerjakan bertahap per fase tanpa mengganggu mesin POS yang sudah terbukti berjalan.
