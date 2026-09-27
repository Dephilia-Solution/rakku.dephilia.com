-- ============================================================
-- Rakku POS — Migration 014: Owner Self-Service (v3.0)
-- ============================================================
-- Features:
-- 1. Tabel `owners` — akun pemilik bisnis (terpisah dari `users` tenant berbasis PIN)
-- 2. Kolom `companies.owner_id` — relasi kepemilikan company ke owner
-- 3. Kolom `companies.slug` — slug unik untuk URL/branding
-- 4. Index untuk performa query owner

-- ============================================================
-- 1. Tabel owners
-- ============================================================
-- Akun pemilik bisnis yang mendaftar secara self-service.
-- Terpisah dari tabel `users` (karyawan berbasis PIN) — Owner
-- login dengan email + password (Custom JWT), bukan 4-step PIN.
CREATE TABLE owners (
  id                uuid primary key default gen_random_uuid(),
  email             text unique not null,
  phone             text,
  name              text not null,
  password_hash     text not null,             -- bcrypt
  email_verified_at timestamptz,
  is_active         boolean default true,
  last_login_at     timestamptz,
  created_at        timestamptz default now()
);

-- ============================================================
-- 2. Tambah kolom ke companies
-- ============================================================
-- owner_id: relasi kepemilikan — siapa pemilik company ini
-- slug: slug unik untuk URL publik/branding (mis. rakku-coffee)
ALTER TABLE companies
  ADD COLUMN owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  ADD COLUMN slug     text UNIQUE;

-- ============================================================
-- 3. Index untuk performa
-- ============================================================
CREATE INDEX idx_owners_email        ON owners(email);
CREATE INDEX idx_companies_owner_id  ON companies(owner_id);
CREATE INDEX idx_companies_slug      ON companies(slug);

-- ============================================================
-- 4. Comments untuk dokumentasi
-- ============================================================
COMMENT ON TABLE owners IS 'Akun pemilik bisnis (self-service). Terpisah dari users (karyawan berbasis PIN). Login via email + password (Custom JWT).';
COMMENT ON COLUMN companies.owner_id IS 'Reference ke owners.id — pemilik company ini. NULL untuk data lama yang belum di-backfill.';
COMMENT ON COLUMN companies.slug IS 'Slug unik untuk URL/branding publik (mis. rakku-coffee).';
