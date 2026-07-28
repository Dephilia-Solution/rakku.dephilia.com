-- ============================================================
-- Stocko POS — Migration 001: Initial Schema
-- ============================================================

-- 1. Extensions
create extension if not exists "pgcrypto";

-- 2. Tables

create table categories (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  sort_order int         default 0,
  created_at timestamptz default now()
);

create table products (
  id          uuid         primary key default gen_random_uuid(),
  name        text         not null,
  price       numeric(10,2) not null,
  category_id uuid         references categories(id),
  image_url   text,
  is_active   boolean      default true,
  description text,
  created_at  timestamptz  default now(),
  updated_at  timestamptz  default now()
);

create table modifiers (
  id          uuid         primary key default gen_random_uuid(),
  product_id  uuid         references products(id) on delete cascade,
  name        text         not null,
  price_delta numeric(10,2) default 0
);

create table orders (
  id             uuid         primary key default gen_random_uuid(),
  order_number   serial       unique,
  order_type     text         check (order_type in ('dine_in', 'delivery')),
  payment_method text         check (payment_method in ('cash', 'qris', 'card')),
  subtotal       numeric(10,2) not null,
  tax_rate       numeric(5,2)  default 10,
  tax_amount     numeric(10,2) not null,
  total_price    numeric(10,2) not null,
  note           text,
  customer_name  text,
  created_at     timestamptz   default now()
);

create table order_items (
  id             uuid         primary key default gen_random_uuid(),
  order_id       uuid         references orders(id) on delete cascade,
  product_id     uuid         references products(id),
  product_name   text         not null,
  unit_price     numeric(10,2) not null,
  quantity       int          default 1,
  modifier_label text,
  subtotal       numeric(10,2) not null
);

-- 3. Indexes

create index idx_products_category_id on products(category_id);
create index idx_products_is_active  on products(is_active);
create index idx_orders_created_at   on orders(created_at);
create index idx_order_items_order_id on order_items(order_id);

-- 4. Trigger: auto-update updated_at on products

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_products_updated_at
  before update on products
  for each row
  execute function update_updated_at();

-- 5. Row Level Security (permissive — app-level auth)

alter table categories enable row level security;
alter table products   enable row level security;
alter table modifiers  enable row level security;
alter table orders     enable row level security;
alter table order_items enable row level security;

create policy "allow_all_authenticated_categories"
  on categories for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_all_authenticated_products"
  on products for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_all_authenticated_modifiers"
  on modifiers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_all_authenticated_orders"
  on orders for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_all_authenticated_order_items"
  on order_items for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 6. Storage Bucket

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "allow_authenticated_product_images"
  on storage.objects for all
  using (bucket_id = 'product-images' and auth.role() = 'authenticated')
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- ============================================================
-- Stocko POS — Migration 002: Multi-Tenant & RBAC
-- ============================================================

-- 1. New Tables

create table companies (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  name          text not null,
  password_hash text not null,
  logo_url      text,
  status        text check (status in ('active','suspended')) default 'active',
  created_at    timestamptz default now()
);

create table outlets (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name       text not null,
  address    text,
  status     text check (status in ('active','inactive')) default 'active',
  created_at timestamptz default now(),
  unique (company_id, name)
);

create table menus (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  icon       text,
  path       text not null,
  sort_order int default 0
);

create table roles (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name       text not null,
  unique (company_id, name)
);

create table role_menu_access (
  role_id    uuid not null references roles(id) on delete cascade,
  menu_id    uuid not null references menus(id) on delete cascade,
  can_view   boolean default true,
  can_create boolean default false,
  can_edit   boolean default false,
  can_delete boolean default false,
  primary key (role_id, menu_id)
);

create table users (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  role_id             uuid not null references roles(id),
  name                text not null,
  username            text not null,
  pin_hash            text not null,
  avatar_url          text,
  all_outlets         boolean default false,
  status              text check (status in ('active','inactive')) default 'active',
  failed_pin_attempts int default 0,
  locked_until        timestamptz,
  created_at          timestamptz default now(),
  unique (company_id, username)
);

create table user_outlets (
  user_id   uuid not null references users(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  primary key (user_id, outlet_id)
);

-- 2. Alter existing tables to add tenant scope

alter table categories
  add column company_id uuid references companies(id) on delete cascade,
  add column outlet_id  uuid references outlets(id) on delete cascade;

alter table products
  add column company_id uuid references companies(id) on delete cascade,
  add column outlet_id  uuid references outlets(id) on delete cascade;

alter table orders
  add column company_id uuid references companies(id),
  add column outlet_id  uuid references outlets(id),
  add column cashier_id uuid references users(id);

-- 3. Indexes

create index idx_categories_outlet on categories(outlet_id);
create index idx_products_outlet   on products(outlet_id);
create index idx_orders_outlet     on orders(outlet_id);
create index idx_orders_company    on orders(company_id);
create index idx_users_company     on users(company_id);
create index idx_roles_company     on roles(company_id);

-- 4. RLS policies for new tables (app-level auth)

alter table companies        enable row level security;
alter table outlets          enable row level security;
alter table menus            enable row level security;
alter table roles            enable row level security;
alter table role_menu_access enable row level security;
alter table users            enable row level security;
alter table user_outlets     enable row level security;

create policy "allow_all_authenticated_companies"
  on companies for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_all_authenticated_outlets"
  on outlets for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_all_authenticated_menus"
  on menus for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_all_authenticated_roles"
  on roles for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_all_authenticated_role_menu_access"
  on role_menu_access for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_all_authenticated_users"
  on users for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_all_authenticated_user_outlets"
  on user_outlets for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 5. Seed static data: default menus

insert into menus (slug, name, icon, path, sort_order) values
  ('register', 'Register', 'ShoppingCart', '/register', 1),
  ('orders',   'Orders',   'ClipboardList', '/orders',   2),
  ('reports',  'Reports',  'BarChart3',    '/reports',  3),
  ('products', 'Products', 'Package',      '/admin/products', 4)
on conflict (slug) do nothing;

-- ============================================================
-- Stocko POS — Migration 003: Relax RLS for app-level tables
-- Auth di-handle app-level (JWT session), bukan Supabase Auth.
-- RLS hanya menghalangi query legitimate tenant user.
-- ============================================================

-- 1. Products & related tables — disable RLS (app-level auth)
drop policy if exists "allow_all_authenticated_categories"   on categories;
drop policy if exists "allow_all_authenticated_products"     on products;
drop policy if exists "allow_all_authenticated_modifiers"    on modifiers;
drop policy if exists "allow_all_authenticated_orders"       on orders;
drop policy if exists "allow_all_authenticated_order_items"  on order_items;

alter table categories   disable row level security;
alter table products     disable row level security;
alter table modifiers    disable row level security;
alter table orders       disable row level security;
alter table order_items  disable row level security;

-- 2. Storage: allow authenticated uploads (tetap pakai Supabase Auth untuk superadmin)
-- Biarkan policy existing tetap jalan

-- ============================================================
-- Stocko POS — Migration 004: M6 Polish & Hardening
-- ============================================================
-- Features:
-- 1. Company login rate limiting
-- 2. Comprehensive audit logging
-- 3. Session idle timeout support

-- ============================================================
-- 1. Company Login Rate Limiting Columns
-- ============================================================

-- Add rate limiting columns to companies table
-- Following the same pattern as PIN lockout in users table
ALTER TABLE companies
  ADD COLUMN failed_login_attempts int DEFAULT 0,
  ADD COLUMN login_locked_until timestamptz,
  ADD COLUMN last_login_attempt timestamptz;

-- ============================================================
-- 2. Audit Logs Table
-- ============================================================

-- Create comprehensive audit log table for all authentication events
CREATE TABLE auth_audit_logs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid,
  outlet_id        uuid,
  user_id          uuid,
  event_type       text not null, -- 'company_login', 'outlet_select', 'account_select', 'pin_verify', 'session_created', 'logout'
  success          boolean not null,
  ip_address       text,
  user_agent       text,
  failure_reason   text,         -- e.g., "wrong_password", "account_locked", "pin_expired", "company_not_found"
  metadata         jsonb,       -- Additional context: {attempt_number, remaining_attempts, locked_until, etc.}
  created_at       timestamptz default now()
);

-- Indexes for efficient queries
CREATE INDEX idx_audit_logs_company ON auth_audit_logs(company_id);
CREATE INDEX idx_audit_logs_outlet ON auth_audit_logs(outlet_id);
CREATE INDEX idx_audit_logs_user ON auth_audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX idx_audit_logs_success ON auth_audit_logs(success);
CREATE INDEX idx_audit_logs_created_at ON auth_audit_logs(created_at DESC);

-- Composite index for common queries (filtering by company and date)
CREATE INDEX idx_audit_logs_company_created ON auth_audit_logs(company_id, created_at DESC);

-- ============================================================
-- 3. Enable RLS for Audit Logs
-- ============================================================

ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated_audit_logs"
  ON auth_audit_logs FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 4. Comments for Documentation
-- ============================================================

COMMENT ON COLUMN companies.failed_login_attempts IS 'Tracks failed company login attempts for rate limiting (max 10)';
COMMENT ON COLUMN companies.login_locked_until IS 'Timestamp until which company login is locked after too many failed attempts';
COMMENT ON COLUMN companies.last_login_attempt IS 'Timestamp of the last login attempt (successful or failed)';

COMMENT ON TABLE auth_audit_logs IS 'Comprehensive audit log for all authentication events. Tracks login attempts, session creation, and logout events.';
COMMENT ON COLUMN auth_audit_logs.event_type IS 'Type of event: company_login, outlet_select, account_select, pin_verify, session_created, logout';
COMMENT ON COLUMN auth_audit_logs.failure_reason IS 'Reason for failure: wrong_password, account_locked, company_not_found, wrong_pin, etc.';
COMMENT ON COLUMN auth_audit_logs.metadata IS 'Additional context as JSON: attempt number, remaining attempts, lock duration, etc.';

-- =========================================================
-- Migration: 006_pricing_draft.sql
-- Purpose: Pricing options (optional) + Draft orders + Customer name required
-- Author: Stocko Dev Team
-- Date: 30 Juni 2026
-- =========================================================

-- =========================================================
-- PRICING OPTIONS (Optional additional prices like Gojek)
-- =========================================================
CREATE TABLE IF NOT EXISTS pricing_options (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       text NOT NULL,           -- e.g., 'Gojek Regular', 'Gojek Express'
  price      numeric(10,2) NOT NULL,  -- Price for this option
  is_active  boolean DEFAULT true,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id  uuid REFERENCES outlets(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for pricing options
CREATE INDEX IF NOT EXISTS idx_pricing_options_product ON pricing_options(product_id);
CREATE INDEX IF NOT EXISTS idx_pricing_options_company ON pricing_options(company_id);
CREATE INDEX IF NOT EXISTS idx_pricing_options_outlet ON pricing_options(outlet_id);

-- =========================================================
-- ORDERS TABLE UPDATES
-- =========================================================

-- Add customer_name column (required for all orders)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT '';

-- Add status column for draft/pending/completed/cancelled
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed' CHECK (status IN ('draft', 'pending_payment', 'completed', 'cancelled'));

-- Add payment_status column
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'paid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded'));

-- Add reserved_until for auto-cancel drafts
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reserved_until timestamptz;

-- Add pricing_option_id for tracking which pricing option was used
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pricing_option_id uuid REFERENCES pricing_options(id) ON DELETE SET NULL;

-- Update updated_at trigger for pricing_options
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pricing_options_updated_at BEFORE UPDATE ON pricing_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- FIX: Allow 'later' payment method for draft/pay-later orders
-- =========================================================
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cash', 'qris', 'card', 'later'));

-- =========================================================
-- ROW LEVEL SECURITY (Disabled per project convention)
-- =========================================================
-- RLS is disabled for all tables in migration 003_rls_permissive.sql
-- No RLS policies needed for this migration

-- =========================================================
-- Migration: 007_july_features.sql
-- Purpose: Phase 2 features — 1 Juli 2026
--   1. cashier_name di orders (F-03)
--   2. pricing_tiers + product_tier_prices (F-11, schema only)
--   3. split_payments (F-12, schema only)
--   4. Update order_type constraint (F-11)
-- Author: Stocko Dev Team
-- Date: 1 Juli 2026
-- =========================================================

-- =========================================================
-- F-03: Cashier Name di Order
-- =========================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_name text;

-- =========================================================
-- F-12: Split Bill (schema)
-- =========================================================
CREATE TABLE IF NOT EXISTS split_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount        numeric(10,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'qris', 'card')),
  status        text DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  customer_name text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_split_payments_order ON split_payments(order_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS split_bill boolean DEFAULT false;

-- =========================================================
-- F-11: Pricing Tiers (schema)
-- =========================================================
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id  uuid REFERENCES outlets(id) ON DELETE CASCADE,
  name       text NOT NULL,
  slug       text NOT NULL,
  is_active  boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (company_id, outlet_id, slug)
);

CREATE TABLE IF NOT EXISTS product_tier_prices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tier_id    uuid NOT NULL REFERENCES pricing_tiers(id) ON DELETE CASCADE,
  price      numeric(10,2) NOT NULL,
  UNIQUE (product_id, tier_id)
);

CREATE INDEX IF NOT EXISTS idx_product_tier_prices_product ON product_tier_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tier_prices_tier ON product_tier_prices(tier_id);

-- =========================================================
-- Update order_type constraint untuk mendukung value baru
-- =========================================================
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('dine_in', 'take_away', 'delivery', 'gojek', 'grab', 'shopee'));

-- =========================================================
-- Migration: 008_pricing_tier_split.sql
-- Purpose: F-11 & F-12 database changes
--   1. pricing_tier_id di orders (F-11)
--   2. Seed default pricing tiers (F-11)
-- =========================================================

-- F-11: Add pricing_tier_id to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pricing_tier_id uuid REFERENCES pricing_tiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_pricing_tier ON orders(pricing_tier_id);

-- =========================================================
-- Migration: 009_pricing_tier_admin.sql
-- Purpose: Seed menu entry for Pricing Tiers (F-11 admin)
-- =========================================================

INSERT INTO menus (slug, name, icon, path, sort_order)
VALUES ('pricing-tiers', 'Pricing Tiers', 'DollarSign', '/admin/pricing-tiers', 5)
ON CONFLICT (slug) DO NOTHING;

-- =========================================================
-- Migration: 010_seed_default_tiers.sql
-- Purpose: F-11 backfill — seed default pricing tiers (Dine In,
--          Take Away) for every existing outlet, and backfill
--          product_tier_prices for every existing product from
--          its base price. Idempotent (safe to re-run).
-- Date: 1 Juli 2026
-- =========================================================

-- 1. Seed "Dine In" tier for outlets that don't have one
INSERT INTO pricing_tiers (company_id, outlet_id, name, slug, is_active, sort_order)
SELECT o.company_id, o.id, 'Dine In', 'dine-in', true, 1
FROM outlets o
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_tiers pt
  WHERE pt.company_id = o.company_id
    AND pt.outlet_id = o.id
    AND pt.slug = 'dine-in'
)
ON CONFLICT (company_id, outlet_id, slug) DO NOTHING;

-- 2. Seed "Take Away" tier for outlets that don't have one
INSERT INTO pricing_tiers (company_id, outlet_id, name, slug, is_active, sort_order)
SELECT o.company_id, o.id, 'Take Away', 'take-away', true, 2
FROM outlets o
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_tiers pt
  WHERE pt.company_id = o.company_id
    AND pt.outlet_id = o.id
    AND pt.slug = 'take-away'
)
ON CONFLICT (company_id, outlet_id, slug) DO NOTHING;

-- 3. Backfill product_tier_prices for every (product, outlet tier) pair
--    that doesn't have an entry yet, using the product's base price.
INSERT INTO product_tier_prices (product_id, tier_id, price)
SELECT p.id, pt.id, p.price
FROM products p
JOIN pricing_tiers pt
  ON pt.company_id = p.company_id
 AND pt.outlet_id = p.outlet_id
WHERE NOT EXISTS (
  SELECT 1 FROM product_tier_prices ptp
  WHERE ptp.product_id = p.id
    AND ptp.tier_id = pt.id
)
ON CONFLICT (product_id, tier_id) DO NOTHING;

-- =========================================================
-- Migration: 011_flatten_paths.sql
-- Purpose: Hapus prefix /admin dari path menu.
--          Akses dikontrol per-user via role_menu_access,
--          bukan via prefix path.
-- Date: 2 Juli 2026
-- =========================================================

UPDATE menus SET path = '/products'        WHERE path = '/admin/products';
UPDATE menus SET path = '/categories'      WHERE path = '/admin/categories';
UPDATE menus SET path = '/pricing-tiers'   WHERE path = '/admin/pricing-tiers';

-- =========================================================
-- Migration: 012_pricing_per_tier.sql
-- Purpose: F-11 pricing redesign — harga & modifier delta
--          sepenuhnya per-tier. Kolom price/delta lama jadi
--          nullable (tidak dipakai lagi oleh UI).
-- Date: 2 Juli 2026
-- =========================================================

-- 1. products.price → nullable (tidak dipakai lagi sebagai canonical price)
ALTER TABLE products ALTER COLUMN price DROP NOT NULL;
ALTER TABLE products ALTER COLUMN price SET DEFAULT 0;

-- 2. modifiers.price_delta → nullable (tidak dipakai lagi sebagai canonical delta)
ALTER TABLE modifiers ALTER COLUMN price_delta DROP NOT NULL;
ALTER TABLE modifiers ALTER COLUMN price_delta SET DEFAULT 0;

-- 3. Tabel modifier_tier_prices: delta per tier per modifier
CREATE TABLE IF NOT EXISTS modifier_tier_prices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id uuid NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
  tier_id     uuid NOT NULL REFERENCES pricing_tiers(id) ON DELETE CASCADE,
  price_delta numeric(10,2) NOT NULL DEFAULT 0,
  UNIQUE (modifier_id, tier_id)
);

CREATE INDEX IF NOT EXISTS idx_modifier_tier_prices_modifier ON modifier_tier_prices(modifier_id);
CREATE INDEX IF NOT EXISTS idx_modifier_tier_prices_tier     ON modifier_tier_prices(tier_id);

-- 4. Backfill modifier_tier_prices dari modifiers.price_delta existing
--    (untuk setiap modifier, buat 1 row per tier outlet-nya)
INSERT INTO modifier_tier_prices (modifier_id, tier_id, price_delta)
SELECT m.id, pt.id, COALESCE(m.price_delta, 0)
FROM modifiers m
JOIN products p ON p.id = m.product_id
JOIN pricing_tiers pt
  ON pt.company_id = p.company_id
 AND pt.outlet_id = p.outlet_id
WHERE NOT EXISTS (
  SELECT 1 FROM modifier_tier_prices mtp
  WHERE mtp.modifier_id = m.id
    AND mtp.tier_id = pt.id
)
ON CONFLICT (modifier_id, tier_id) DO NOTHING;

-- Migration 013: Dynamic Tax & Discount System
-- Adds: taxes, product_discounts, order_discounts tables
-- Alters: orders table with taxes jsonb, discounts jsonb, discount_amount

-- 1. Taxes table (per outlet)
CREATE TABLE taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) NOT NULL,
  outlet_id uuid REFERENCES outlets(id) NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value numeric(10,2) NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Product discounts (per product with period)
CREATE TABLE product_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) NOT NULL,
  outlet_id uuid REFERENCES outlets(id) NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value numeric(10,2) NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Order discounts (per order with period)
CREATE TABLE order_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) NOT NULL,
  outlet_id uuid REFERENCES outlets(id) NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value numeric(10,2) NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. Alter orders table
ALTER TABLE orders ADD COLUMN discount_amount numeric(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN taxes jsonb;
ALTER TABLE orders ADD COLUMN discounts jsonb;

-- 5. Backfill existing orders: convert tax_rate/tax_amount to taxes jsonb
UPDATE orders
SET taxes = jsonb_build_array(
  jsonb_build_object(
    'name', 'Tax',
    'type', 'percentage',
    'value', COALESCE(tax_rate, 10),
    'amount', tax_amount
  )
)
WHERE tax_rate > 0;

-- 6. Enable RLS on new tables (consistent with permissive approach like other tables)
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_discounts ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated role (app-level auth, permissive)
GRANT ALL ON taxes TO authenticated;
GRANT ALL ON product_discounts TO authenticated;
GRANT ALL ON order_discounts TO authenticated;

-- 7. Seed menu entries for Taxes and Discounts
INSERT INTO menus (slug, name, icon, path, sort_order) VALUES
  ('taxes', 'Taxes', 'DollarSign', '/taxes', 6),
  ('discounts', 'Discounts', 'Percent', '/discounts', 7)
ON CONFLICT (slug) DO NOTHING;

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

-- ============================================================
-- Migration: 015_menu_consolidation.sql
-- Purpose: Gabungkan menu Taxes + Discounts → "Pajak & Diskon"
--          (/tax-discounts). Pricing Tiers pindah ke area Produk.
--          Rename nama menu ke Bahasa Indonesia.
--
-- Menu akhir (5): Kasir, Pesanan, Laporan, Produk, Pajak & Diskon
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

INSERT INTO menus (slug, name, icon, path, sort_order)
VALUES ('tax-discounts', 'Pajak & Diskon', 'Percent', '/tax-discounts', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_menu_access (role_id, menu_id, can_view, can_create, can_edit, can_delete)
SELECT
  rma.role_id,
  m.id,
  bool_or(rma.can_view),
  bool_or(rma.can_create),
  bool_or(rma.can_edit),
  bool_or(rma.can_delete)
FROM role_menu_access rma
JOIN menus old ON old.id = rma.menu_id AND old.slug IN ('taxes', 'discounts')
JOIN menus m ON m.slug = 'tax-discounts'
GROUP BY rma.role_id, m.id
ON CONFLICT (role_id, menu_id) DO NOTHING;

UPDATE menus SET name = 'Kasir'   WHERE slug = 'register';
UPDATE menus SET name = 'Pesanan' WHERE slug = 'orders';
UPDATE menus SET name = 'Laporan' WHERE slug = 'reports';
UPDATE menus SET name = 'Produk'  WHERE slug = 'products';
UPDATE menus SET name = 'Pajak & Diskon' WHERE slug = 'tax-discounts';

DELETE FROM menus WHERE slug IN ('pricing-tiers', 'taxes', 'discounts');

COMMIT;


-- =====================================================
-- Supabase Export: https://xislxiikkiecgozwsxxg.supabase.co
-- Generated: 2026-07-27T14:29:12.888Z
-- =====================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('a1b2c3d4-0001-4000-8000-000000000001', 'Coffee', 1, '2026-06-28T22:35:27.892447+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('a1b2c3d4-0001-4000-8000-000000000002', 'Non-Coffee', 2, '2026-06-28T22:35:28.059583+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('a1b2c3d4-0001-4000-8000-000000000003', 'Pastry', 3, '2026-06-28T22:35:28.180787+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('a1b2c3d4-0001-4000-8000-000000000004', 'Add-ons', 4, '2026-06-28T22:35:28.304124+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('e0000000-0000-4000-8000-000000000001', 'Minuman Kopi', 1, '2026-06-29T00:47:22.458549+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('e0000000-0000-4000-8000-000000000002', 'Minuman Non-Kopi', 2, '2026-06-29T00:47:22.686662+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('e0000000-0000-4000-8000-000000000003', 'Makanan Ringan', 3, '2026-06-29T00:47:22.914347+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('e0000000-0000-4000-8000-000000000004', 'Kopi', 1, '2026-06-29T00:47:24.043252+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('e0000000-0000-4000-8000-000000000005', 'Non-Kopi', 2, '2026-06-29T00:47:24.271433+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('e0000000-0000-4000-8000-000000000006', 'Pastry', 3, '2026-06-29T00:47:24.491618+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('e0000000-0000-4000-8000-000000000007', 'Makanan Berat', 1, '2026-06-29T00:47:26.797477+00:00', '6f794056-27be-446d-b9e7-39df43cff99a', 'b0000000-0000-4000-8000-000000000003');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('e0000000-0000-4000-8000-000000000008', 'Makanan Ringan', 2, '2026-06-29T00:47:27.025718+00:00', '6f794056-27be-446d-b9e7-39df43cff99a', 'b0000000-0000-4000-8000-000000000003');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('e0000000-0000-4000-8000-000000000009', 'Minuman', 3, '2026-06-29T00:47:27.245775+00:00', '6f794056-27be-446d-b9e7-39df43cff99a', 'b0000000-0000-4000-8000-000000000003');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('f347c54c-5ebb-4722-b4af-4b984084be08', 'Makanan', 1, '2026-06-29T08:56:45.428174+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('dea92740-b202-4123-8849-f5325ad96aa6', 'Minuman', 2, '2026-06-29T08:56:57.170246+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('e2ff8b83-0a62-4ea1-81b7-a2dcef12aba7', 'Snack', 3, '2026-06-29T08:57:04.724761+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('aaaa381c-2fd0-4eb3-9a92-7b9203a24f4c', 'Desert', 4, '2026-06-29T08:57:08.305582+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291');
INSERT INTO "categories" ("id", "name", "sort_order", "created_at", "company_id", "outlet_id") VALUES ('50f7fb2a-64e9-430d-9dd6-9999b64d6e39', 'Appetizer', 5, '2026-07-08T05:48:55.394387+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291');

INSERT INTO "companies" ("id", "code", "name", "password_hash", "logo_url", "status", "created_at", "failed_login_attempts", "login_locked_until", "last_login_attempt", "owner_id", "slug") VALUES ('6f794056-27be-446d-b9e7-39df43cff99a', 'TOKOKO', 'Toko Ko', '$2b$10$3MxB8iqhcFZclCvZL0JS9.Qtqs1SjOFjA4y6.h2Jchg4mmqaVGxwu', NULL, 'active', '2026-06-28T22:48:59.929673+00:00', 0, NULL, NULL, '2d3a9137-fbbd-43f4-bcc3-b2663aef7be7', NULL);
INSERT INTO "companies" ("id", "code", "name", "password_hash", "logo_url", "status", "created_at", "failed_login_attempts", "login_locked_until", "last_login_attempt", "owner_id", "slug") VALUES ('c844892c-a4ed-44da-a0d9-d8a46840293b', 'SEBLAKCUCUR', 'SEBLAK CUCUR', '$2b$10$sEnRcsm.llp54xAmHK8yQ.2xTLyNtqw5iXXm6cNIJF.yJFH/P2lAS', NULL, 'active', '2026-07-06T03:29:47.571941+00:00', 0, NULL, NULL, 'b852be19-4966-411d-a8a5-0a09f4ed0d9d', 'seblak-cucur');
INSERT INTO "companies" ("id", "code", "name", "password_hash", "logo_url", "status", "created_at", "failed_login_attempts", "login_locked_until", "last_login_attempt", "owner_id", "slug") VALUES ('b4b6daf4-7ab4-48d0-a528-d40cb3f5bcdf', 'ALIFGANTENG', 'ALIF GANTENG', '$2b$10$JlFmpk6Udp0ql0uzIghZaekuUF5x8Qlf.zL3eaStTafOw7oSQuxQC', NULL, 'active', '2026-07-06T08:19:28.193639+00:00', 0, NULL, NULL, '70d7f077-2be6-4251-9160-e7145bbfed08', 'alif-ganteng');
INSERT INTO "companies" ("id", "code", "name", "password_hash", "logo_url", "status", "created_at", "failed_login_attempts", "login_locked_until", "last_login_attempt", "owner_id", "slug") VALUES ('4f7b4d59-21c4-4640-933b-264741fa7960', 'KOPKEN', 'KOPKEN', '$2b$10$arhoPZnYTDVW9vnlftkmleV/I.PKwcdtx/EEzz8CwFLcgfAcpsYQS', NULL, 'active', '2026-07-08T11:45:19.09905+00:00', 0, NULL, NULL, '2fa54550-2f4b-4750-9a54-093ae7370033', 'kopken');
INSERT INTO "companies" ("id", "code", "name", "password_hash", "logo_url", "status", "created_at", "failed_login_attempts", "login_locked_until", "last_login_attempt", "owner_id", "slug") VALUES ('a0000000-0000-4000-8000-000000000001', 'STOCKO', 'Stocko Default', '$2b$10$WYi6mBKh5TE1F8MS3ixGzeAoPeTSl1AfBnLbxrEkJ7p6OH6HPk/1S', NULL, 'active', '2026-06-28T22:34:54.056264+00:00', 0, NULL, NULL, NULL, NULL);
INSERT INTO "companies" ("id", "code", "name", "password_hash", "logo_url", "status", "created_at", "failed_login_attempts", "login_locked_until", "last_login_attempt", "owner_id", "slug") VALUES ('84e29f64-0d52-4f34-abf4-8a13bf902a61', 'KEDAN', 'Kedan Kedai Medan Kak Inong', '$2b$10$P6E/rMihfX48DwuTkzta7O2ixEo1xsU6Xu0OhWxnLuLgWCyqj7Hru', NULL, 'active', '2026-06-29T08:26:30.816295+00:00', 0, NULL, '2026-07-15T01:59:25.611+00:00', '864c6094-f5b1-4e90-ab84-13357afe6c4e', NULL);

INSERT INTO "order_discounts" ("id", "company_id", "outlet_id", "name", "type", "value", "start_date", "end_date", "is_active", "created_at") VALUES ('86e0d9ce-2df2-46df-a812-f82347ff4f2f', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', 'Akhir bulan', 'percentage', 10, '2026-07-09T13:11:00+00:00', '2026-07-22T13:11:00+00:00', TRUE, '2026-07-09T13:11:17.905321+00:00');

INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('c1d2e3f4-0001-4000-8000-000000000001', 'b1c2d3e4-0001-4000-8000-000000000002', 'Oat Milk', 5000, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('c1d2e3f4-0001-4000-8000-000000000002', 'b1c2d3e4-0001-4000-8000-000000000003', 'Oat Milk', 5000, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('c1d2e3f4-0001-4000-8000-000000000003', 'b1c2d3e4-0001-4000-8000-000000000001', 'Extra Shot', 5000, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('c1d2e3f4-0001-4000-8000-000000000004', 'b1c2d3e4-0001-4000-8000-000000000002', 'Extra Shot', 5000, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('c1d2e3f4-0001-4000-8000-000000000005', 'b1c2d3e4-0001-4000-8000-000000000003', 'Extra Shot', 5000, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('c1d2e3f4-0001-4000-8000-000000000006', 'b1c2d3e4-0001-4000-8000-000000000004', 'Extra Shot', 5000, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('c1d2e3f4-0001-4000-8000-000000000007', 'b1c2d3e4-0001-4000-8000-000000000006', 'Whipped Cream', 3000, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('bcb8a947-0171-4ff2-9725-00031bfeec66', 'f0000000-0000-4000-8000-000000000001', 'dvzdfv', 1200, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('186168e0-42d8-4993-b87a-def5c549f6b8', '6f94d258-1416-4287-8ff9-2d0c09aa8511', 'Hot', 0, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('7710fa2c-b3d3-46e2-aa51-0b2c267ca366', '6f94d258-1416-4287-8ff9-2d0c09aa8511', 'Ice', 0, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('41563f06-3279-480c-b998-2064c4e589df', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Hot', 0, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('acd8b1ed-6bd0-4e62-b480-25c5474fdc79', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Iced', 0, NULL);
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('70dca78b-fe62-4e91-9939-ddc5e260b7b8', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Dadar', 0, 'Telur');
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('c8e9c1e9-b170-46eb-9a1a-b416a18acfe1', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Ceplok', 0, 'Telur');
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('e6500c38-0c5f-4ffc-9b32-2a7d5ef8b628', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', '1/2 mateng', 0, 'Tingkat');
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('85655094-ad6f-4479-bdf9-21579f8d65e7', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Mateng', 0, 'Tingkat');
INSERT INTO "modifiers" ("id", "product_id", "name", "price_delta", "group_name") VALUES ('d8791871-c103-4ff8-b52a-6343e38a5e5e', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Barendo', 0, 'Telur');

INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('d4e53345-f833-46cf-8bcf-f7674f962597', 'b7ca8f51-7c83-4be7-8604-6a0e643523b3', 'f0000000-0000-4000-8000-000000000001', 'Americano', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('f9ad9a87-1d84-406e-bbd4-b570ea8bd764', 'b7ca8f51-7c83-4be7-8604-6a0e643523b3', 'f0000000-0000-4000-8000-000000000002', 'Cappuccino', 30000, 1, NULL, 30000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('ed049d40-6d8c-457c-a807-1b0a01d1259e', 'b7ca8f51-7c83-4be7-8604-6a0e643523b3', 'f0000000-0000-4000-8000-000000000009', 'Cheesecake', 30000, 1, NULL, 30000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('54ed4790-8cba-4048-ba7c-9f1a28dc3a4c', 'b7ca8f51-7c83-4be7-8604-6a0e643523b3', 'f0000000-0000-4000-8000-000000000008', 'Chiffon Cake', 18000, 1, NULL, 18000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('c4288f7d-4d51-4941-8ff3-ff4fc8931e55', 'b7ca8f51-7c83-4be7-8604-6a0e643523b3', 'f0000000-0000-4000-8000-000000000007', 'Croissant', 22000, 1, NULL, 22000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('e2de73f1-e754-4228-9732-bc8a90457688', 'b7ca8f51-7c83-4be7-8604-6a0e643523b3', 'f0000000-0000-4000-8000-000000000003', 'Vanilla Latte', 35000, 1, NULL, 35000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('b1aee44b-5ed2-45d1-8b03-91fcd4638fe2', 'b7ca8f51-7c83-4be7-8604-6a0e643523b3', 'f0000000-0000-4000-8000-000000000005', 'Thai Tea', 28000, 1, NULL, 28000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('193ec0f4-6c23-488d-9ede-c4739283dd09', 'b7ca8f51-7c83-4be7-8604-6a0e643523b3', 'f0000000-0000-4000-8000-000000000004', 'Milo', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('5aa9bf88-93ec-4e06-9dde-f3e6364cbc6d', 'b7ca8f51-7c83-4be7-8604-6a0e643523b3', 'f0000000-0000-4000-8000-000000000006', 'Lemon Tea', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('2e3b5775-85b9-4ec0-86d9-d71a749d93a7', 'b46da0a6-abfc-4ce0-bced-798faf3cf3d7', 'b1c2d3e4-0001-4000-8000-000000000008', 'Banana Muffin', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('0a577d4e-d607-4202-a200-face327689ed', 'b46da0a6-abfc-4ce0-bced-798faf3cf3d7', 'b1c2d3e4-0001-4000-8000-000000000007', 'Butter Croissant', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('0010cb0a-ac60-46fc-8686-7f80c2f8032c', 'b46da0a6-abfc-4ce0-bced-798faf3cf3d7', 'b1c2d3e4-0001-4000-8000-000000000002', 'Cafe Latte', 35000, 1, 'Oat Milk +5.000', 40000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('5ea60022-b7d1-4fad-b438-aa9aeccc7446', 'b46da0a6-abfc-4ce0-bced-798faf3cf3d7', 'b1c2d3e4-0001-4000-8000-000000000006', 'Chocolate', 30000, 1, 'Whipped Cream +3.000', 33000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('59b5659c-ffb7-4ffd-b9db-59f73f8ed3e5', 'b46da0a6-abfc-4ce0-bced-798faf3cf3d7', 'b1c2d3e4-0001-4000-8000-000000000001', 'Espresso', 25000, 1, 'Extra Shot +5.000', 30000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('dfef4a7e-3f69-4f52-be63-650d8d8d417c', 'b46da0a6-abfc-4ce0-bced-798faf3cf3d7', 'b1c2d3e4-0001-4000-8000-000000000005', 'Green Tea', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('08993d80-c0a2-474d-a30f-724bbfecea86', 'b46da0a6-abfc-4ce0-bced-798faf3cf3d7', 'b1c2d3e4-0001-4000-8000-000000000004', 'Iced Americano', 30000, 1, NULL, 30000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('ef7ddbbb-c65a-4bea-a05d-bd7ef40a56d2', '7862e832-5bd1-42e4-ac46-b46e2310d8aa', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 2, 'Telur Dadar +0', 40000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('ba2e1e9e-620c-4f95-ac6f-c8edbbb0def8', '7862e832-5bd1-42e4-ac46-b46e2310d8aa', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('5bdb71b8-cbfd-4365-bc01-c0d94f1cef8e', '7862e832-5bd1-42e4-ac46-b46e2310d8aa', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('42e28392-c496-4a72-b386-3507ad5551f8', '7862e832-5bd1-42e4-ac46-b46e2310d8aa', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('3a41caed-af60-4181-9c26-75ef819322b4', '7d0234ec-f881-4595-a26d-afe4f4764b55', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('3510f2a1-086f-46a3-8171-6b17c5bb7a4a', '7d0234ec-f881-4595-a26d-afe4f4764b55', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('13316857-4859-4856-b032-b83ea5e130ac', '7d0234ec-f881-4595-a26d-afe4f4764b55', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('ee4e315c-433c-448d-8fb3-99411573dd4b', '7d0234ec-f881-4595-a26d-afe4f4764b55', '6f94d258-1416-4287-8ff9-2d0c09aa8511', 'Teh Tawar', 4000, 1, 'Ice +0', 4000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('5d9804b1-6713-46c8-9cbc-924fb3d28098', '2ed99248-8e65-402c-9acd-b3fbf1814833', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('7665bf99-8a80-4d7b-8a68-9226da6a622f', '2ed99248-8e65-402c-9acd-b3fbf1814833', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('6e9a01a8-2099-4148-a1e4-6db460d1e0a3', '2ed99248-8e65-402c-9acd-b3fbf1814833', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('2acde075-79f7-47fa-9db9-79818a02996e', '2ed99248-8e65-402c-9acd-b3fbf1814833', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('2a4c3ff7-311a-4d84-ad77-2e1634553762', '00581b4c-c54b-403d-826b-aa90592bd1ac', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('7524b7c1-016f-4667-ab47-5e5bcd5a5319', '00581b4c-c54b-403d-826b-aa90592bd1ac', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, NULL, 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('e9bded92-0056-4c69-bea6-65c3e6e3d3c8', '00581b4c-c54b-403d-826b-aa90592bd1ac', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('bd5964bf-1a42-4567-b91b-1c5297b061d7', '36ebdf30-0596-485d-9370-240862ef4a40', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('14bc5f7c-78ab-4503-b5e3-84f0525a0423', '36ebdf30-0596-485d-9370-240862ef4a40', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('7bba7345-0081-4479-954d-7a030cd438ce', '36ebdf30-0596-485d-9370-240862ef4a40', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('97431b7e-29e9-43fb-984b-e17b2e6172e8', '36ebdf30-0596-485d-9370-240862ef4a40', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('2fd66872-9894-4caa-b666-8f9d8d86d515', '36ebdf30-0596-485d-9370-240862ef4a40', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('96ba61a2-23fe-4edb-8225-d643092acb52', '36ebdf30-0596-485d-9370-240862ef4a40', '6f94d258-1416-4287-8ff9-2d0c09aa8511', 'Teh Tawar', 4000, 1, NULL, 4000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('158a74f4-8c0d-4c13-97a8-2e67a2a68595', '36ebdf30-0596-485d-9370-240862ef4a40', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'Hot +0', 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('d3c8ba0b-f222-4426-9e0b-af571b80ad25', '36ebdf30-0596-485d-9370-240862ef4a40', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'Hot +0', 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('2a3b52ea-c6cc-4cbb-a6bf-5ae63293ddfc', '36ebdf30-0596-485d-9370-240862ef4a40', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'Iced +0', 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('4c188666-28ee-4ba6-9bbe-7cb72aca6b7d', '74e3b7ce-4289-4246-b376-8c5454c40c01', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 2, 'Hot +0', 10000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('47c86b7f-6a67-4bd8-8e44-c3d159ae506c', '74e3b7ce-4289-4246-b376-8c5454c40c01', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 3, NULL, 15000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('67bef445-9db1-4767-b123-37182706fc2c', '74e3b7ce-4289-4246-b376-8c5454c40c01', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 2, '1/2 matang +0', 40000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('28e9ff5a-2cb4-4ee0-bda9-c03854e83696', '74e3b7ce-4289-4246-b376-8c5454c40c01', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('3e0f55cd-43f3-4482-a66b-bdf7a2edbe26', '74e3b7ce-4289-4246-b376-8c5454c40c01', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('d251cd26-68b0-4452-9ba2-fac6e1ace5d4', 'ece7de19-d992-4da8-a7fb-f3af5b9b9339', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('9c440a9f-69f3-48a7-89ef-ae4c097b2368', 'ece7de19-d992-4da8-a7fb-f3af5b9b9339', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, NULL, 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('d0f7f43e-1d3e-4907-8dde-6e43acd6b560', 'ece7de19-d992-4da8-a7fb-f3af5b9b9339', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('8f81ab8e-fc6e-4242-b83f-8c6a20901097', 'ece7de19-d992-4da8-a7fb-f3af5b9b9339', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'ty +0', 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('7f88d19e-ccf5-4b96-b527-a171a2d5c77d', 'ece7de19-d992-4da8-a7fb-f3af5b9b9339', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'yuuguugy +0', 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('54b178b3-208c-432a-b843-7cc18271cc21', '52dcbe89-e0e9-403e-9704-d31d35a2a663', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('a9619d21-b03c-47e2-9eb8-f1dac56ec022', '52dcbe89-e0e9-403e-9704-d31d35a2a663', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, NULL, 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('01a348a6-a4c2-4c3a-b1a1-3f97701b3843', 'fc111f1f-3feb-4592-b6b4-0d70343e92d7', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('d11d3845-adf2-42e2-aa16-3045336d6326', 'fc111f1f-3feb-4592-b6b4-0d70343e92d7', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 3, NULL, 36000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('2a4a0690-f081-48ed-9e20-21a8b0bbcde3', 'fc111f1f-3feb-4592-b6b4-0d70343e92d7', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 2, NULL, 50000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('f0cd3753-ffd1-4446-92b6-eac773afb14a', 'fc111f1f-3feb-4592-b6b4-0d70343e92d7', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, '655567 +0', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('c1c839ef-9ce5-4701-92c2-2d48f7a77707', '137955c2-2d20-4504-b9bf-7cc7d2ecaba1', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('314fd77e-3645-45e4-bf42-c0da33f61254', '137955c2-2d20-4504-b9bf-7cc7d2ecaba1', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Telur Dadar +0', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('91a35fe0-8422-43ad-ad1a-a59ab54d7332', '137955c2-2d20-4504-b9bf-7cc7d2ecaba1', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Telur Ceplok +0', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('500aff97-cb07-4eb1-9220-e6ebb00ab9a4', '137955c2-2d20-4504-b9bf-7cc7d2ecaba1', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, '1/2 matang +0', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('f31b5b98-110c-42c3-9674-f0578f105be9', '137955c2-2d20-4504-b9bf-7cc7d2ecaba1', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 2, 'Iced +0', 10000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('6dbeac69-cf9b-4236-ba3f-fb61cabee69b', '137955c2-2d20-4504-b9bf-7cc7d2ecaba1', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'Hot +0', 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('1645e45d-109c-4048-930c-caa16823eb6d', '3b8931d1-f62f-427e-a27f-bc4710a0e7fe', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('011bb23d-f703-4ace-bd5f-28f844223a0d', '3b8931d1-f62f-427e-a27f-bc4710a0e7fe', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('431a4028-9dca-4309-8ecf-16418ba482ab', '3b8931d1-f62f-427e-a27f-bc4710a0e7fe', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('3acffe87-47a3-4026-9a75-8e7b9fc372d4', '3b8931d1-f62f-427e-a27f-bc4710a0e7fe', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'matang +0', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('5a7390e6-55fd-4d07-8d68-c507fbc42e88', '64c58dce-2702-4c1d-aa16-68bbd2a4fb69', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('74a840ed-2170-4475-a327-4d7a4e6e5c19', '64c58dce-2702-4c1d-aa16-68bbd2a4fb69', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'Iced +0', 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('98ba38e7-92ab-435a-a26e-b32786e65ec5', '64c58dce-2702-4c1d-aa16-68bbd2a4fb69', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('d1140066-4be5-4018-bc9d-33ab1a7ba239', '8588c614-2a08-4b4a-a665-52622700b933', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('ad2f8d71-8ca7-49e7-8760-1f6a79ee2cf2', '8588c614-2a08-4b4a-a665-52622700b933', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('69c2e1cc-fcdd-4e82-aa50-b3f7210caec3', '8588c614-2a08-4b4a-a665-52622700b933', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Mateng, Ceplok', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('c5f9cf8a-f043-4593-a0bc-4ad9e430d150', '77d5e554-20d9-4e59-a4de-2f4f7da0544b', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('f5e42ab7-51fe-40b6-bee5-0e388d66e0c8', '77d5e554-20d9-4e59-a4de-2f4f7da0544b', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('29f800b3-3734-430a-80a6-cf6b74760f6a', '77d5e554-20d9-4e59-a4de-2f4f7da0544b', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Mateng, Ceplok', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('70af201c-af18-4690-b11b-a5d003082789', '77d5e554-20d9-4e59-a4de-2f4f7da0544b', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Dadar, 1/2 mateng', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('09867f44-04db-4ef5-9ef2-28adbe982b54', '1340a52c-25f7-42ad-b4ea-6ec6ac79d571', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('23ff31be-8841-4c9e-afa1-8a1a518231b7', '1340a52c-25f7-42ad-b4ea-6ec6ac79d571', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 2, NULL, 24000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('c15b2f73-4fd3-44f9-b4b7-aec97f333253', '1340a52c-25f7-42ad-b4ea-6ec6ac79d571', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('15c6c9b7-9433-44c0-9b6b-2cf3c4e2f337', '1340a52c-25f7-42ad-b4ea-6ec6ac79d571', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Mateng, Ceplok', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('2bea7d01-0a18-42ed-91b8-1c445519b3dc', '9caa0cfb-1cf0-4a47-a24e-34b328bfebcb', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Ceplok, 1/2 mateng', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('e1fdead3-71e3-4f2f-b4b2-681e145d54fa', '9caa0cfb-1cf0-4a47-a24e-34b328bfebcb', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Dadar, Mateng', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('3ea99eaf-638c-473f-835f-88c08dfee1c4', '9caa0cfb-1cf0-4a47-a24e-34b328bfebcb', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 22000, 1, NULL, 22000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('42a19865-1f8f-47fe-9772-86f65b814560', '1e5cd237-aa90-44cf-a905-c369fdac2c00', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 4, NULL, 100000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('e1868e05-f6e9-4ab3-8dad-c44151acb743', '3f18b5df-c86a-436c-8d0e-edd888716f5c', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('fd2d5953-a08e-479a-924e-4409085f2e08', '3f18b5df-c86a-436c-8d0e-edd888716f5c', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('ec4d3d4c-cfea-4d48-8b67-72e3d848be99', '3f18b5df-c86a-436c-8d0e-edd888716f5c', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('cf6b9b43-9f91-4586-ac40-8e3f0b886a90', '3f18b5df-c86a-436c-8d0e-edd888716f5c', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Ceplok, Mateng', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('60df9b43-2279-495f-88f7-d35f738a2c3f', '3f18b5df-c86a-436c-8d0e-edd888716f5c', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'Iced', 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('4238fb56-0b42-4faa-9a2b-afee5b0cfd67', '6367d4bd-a851-4b85-9482-718a75e57d5d', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('3094a572-aa0c-4dd9-bf2f-ad173a1614dd', '6367d4bd-a851-4b85-9482-718a75e57d5d', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('4d6a7b50-7e50-471e-9f16-56619c096127', '6367d4bd-a851-4b85-9482-718a75e57d5d', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('6e8df3d9-ae27-4cb2-83dd-d5aea51bd84c', '6367d4bd-a851-4b85-9482-718a75e57d5d', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Ceplok, Mateng', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('1ea8ba04-d2c1-4db1-b755-e270654eaabe', '6367d4bd-a851-4b85-9482-718a75e57d5d', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'Iced', 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('41feed91-d2a0-425d-84e3-87fcef578779', '61a850c8-2d84-4f38-8d97-effe0fbcd023', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('332a6487-9fe1-47c2-9499-3336c435e866', '61a850c8-2d84-4f38-8d97-effe0fbcd023', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('6d2129c3-7126-4183-bc58-c3131de9b179', '61a850c8-2d84-4f38-8d97-effe0fbcd023', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, '1/2 mateng, Dadar', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('a13e666f-8d1d-4349-b734-b81c03d62178', '61a850c8-2d84-4f38-8d97-effe0fbcd023', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('b73273b6-853d-455d-acb7-8280b0ddbc97', '3ed2cdc5-6b01-45bd-8205-100f08c8db1b', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('07e459eb-7178-4ec3-ae12-d6943c053770', '3ed2cdc5-6b01-45bd-8205-100f08c8db1b', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('deb5370c-2842-4a52-9e3c-fbac033e7061', '3ed2cdc5-6b01-45bd-8205-100f08c8db1b', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('77c28427-d175-42b4-bb77-fe99bc83438e', '3ed2cdc5-6b01-45bd-8205-100f08c8db1b', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Dadar, Mateng', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('3349751d-1035-4d20-87a6-dd140408ca79', '3ed2cdc5-6b01-45bd-8205-100f08c8db1b', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'Iced', 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('0e79c29a-546b-44af-894e-82a2aac0a00b', '1338f23a-4fe7-4e42-840a-2cc5d6f06b8f', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('6b19afe8-644d-4fa2-b017-df290f3cd2bc', '1338f23a-4fe7-4e42-840a-2cc5d6f06b8f', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 22000, 1, NULL, 22000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('d3de6424-fa69-4db1-85f9-191d56bcf11a', '1338f23a-4fe7-4e42-840a-2cc5d6f06b8f', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('5dd763d5-1559-4af2-bf48-143d93aa2016', '831ccde7-e5e6-4c97-a2ca-e6c5e151ebf1', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('01a5f871-2411-409d-b807-db1c493e23c5', '831ccde7-e5e6-4c97-a2ca-e6c5e151ebf1', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('22a0b115-fe9d-4c85-ae02-51dc64c0b171', '831ccde7-e5e6-4c97-a2ca-e6c5e151ebf1', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('464f6be4-7352-4a42-839d-0d5c142b5845', '831ccde7-e5e6-4c97-a2ca-e6c5e151ebf1', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Ceplok, Mateng', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('a98f3dd0-7f9e-45e3-97c3-d9f55e2f3b79', '831ccde7-e5e6-4c97-a2ca-e6c5e151ebf1', '6f94d258-1416-4287-8ff9-2d0c09aa8511', 'Teh Tawar', 4000, 1, 'Ice', 4000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('ff99a6c9-9e29-4bc2-988b-688d6f53c839', 'a64953cc-8762-4208-972c-7e612b4a3352', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('dc291672-4bb4-472d-8339-dd3953663a5c', 'a64953cc-8762-4208-972c-7e612b4a3352', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('cebbc47a-be48-426b-8855-87dbcaa56b3b', 'a64953cc-8762-4208-972c-7e612b4a3352', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('5331d7e7-ed8f-45d7-8ca9-da32196df5e6', 'a64953cc-8762-4208-972c-7e612b4a3352', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Ceplok, Mateng', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('35f55ef4-1407-4942-a89a-757d85f336f7', '23f948be-bdf8-48e7-968b-d5f2f5b965f2', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 2, NULL, 50000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('9de8321f-4fe1-4f1f-abc7-80d54e530002', '23f948be-bdf8-48e7-968b-d5f2f5b965f2', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('5532a04f-4d9a-4967-bf73-9466fcac01c0', '23f948be-bdf8-48e7-968b-d5f2f5b965f2', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('d1c4c914-f67f-4ee6-b4ed-b2709dc7c518', '23f948be-bdf8-48e7-968b-d5f2f5b965f2', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'Iced', 5000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('99616b22-0ddf-4f1d-adc4-976afe89dae0', '5b09c47e-4351-44ca-b035-ed4de9d65850', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 2, NULL, 50000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('66cd971d-e7a3-408e-9522-411bc6441a25', '5b09c47e-4351-44ca-b035-ed4de9d65850', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('18d19ab5-5332-436a-bb19-680e1c23e4d9', '5b09c47e-4351-44ca-b035-ed4de9d65850', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('b2f3c426-9ab0-454f-9398-11999ef6a4bc', '5b09c47e-4351-44ca-b035-ed4de9d65850', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, 'Dadar, Mateng', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('68ea2a78-bdb0-4df2-960f-0ab0aff8edc9', '5b09c47e-4351-44ca-b035-ed4de9d65850', '859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 1, 'Iced', 3000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('4c39ad8b-e164-4f67-9c94-30395207f30a', '5b09c47e-4351-44ca-b035-ed4de9d65850', '6f94d258-1416-4287-8ff9-2d0c09aa8511', 'Teh Tawar', 4000, 1, 'Ice', 4000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('3648d448-b654-42e0-9cc8-3ad1aa0da89f', 'b54c837d-a03a-4472-9953-92aedc9269d5', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('ebd6160a-22e5-4f97-8e52-6e083302bbeb', 'b54c837d-a03a-4472-9953-92aedc9269d5', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('a28884dd-51c5-437a-821e-1fa943ab233f', '1863f902-54a7-4da5-ba28-6d80e20c071f', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 14000, 1, 'extra parutan kelapa +2.000', 14000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('99c65b30-2c47-4e80-8534-3cb0ac142c27', '1863f902-54a7-4da5-ba28-6d80e20c071f', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('3399bc80-b19c-4635-a5fe-2d99e8794a60', 'f7241747-baad-4a46-9661-107374f9c9a4', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('80bb4c0f-2a8c-47b5-80fb-7ad672c1cfcf', 'f7241747-baad-4a46-9661-107374f9c9a4', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('75f6b8ce-8b77-4185-93a9-47143304c7b3', 'f7241747-baad-4a46-9661-107374f9c9a4', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('3db1019c-ff5f-46dc-9d45-a73952a04075', '2213f3f3-7fb1-4d68-9591-d638c1317154', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('a176aef6-d9f5-4cc9-a44a-b15a3e95234d', '2213f3f3-7fb1-4d68-9591-d638c1317154', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('17b7622a-cc67-44e6-bf74-19a68957bebb', '2213f3f3-7fb1-4d68-9591-d638c1317154', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('2385cf81-8966-4cb0-8c8d-b42eb2ce97d0', '2213f3f3-7fb1-4d68-9591-d638c1317154', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('badfdbce-6a05-471f-9949-7cc573d8fd08', '0755c802-390a-4829-ba29-659e83281906', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 2, NULL, 40000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('2747c84c-2ced-45fd-a470-7ad81e0d62f5', '0755c802-390a-4829-ba29-659e83281906', 'caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 1, '1/2 mateng', 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('b32c3b52-d501-4325-bf1f-b4702434ca2f', '0755c802-390a-4829-ba29-659e83281906', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('3eec1135-c2ab-4265-8a33-2404caedea30', 'cda318bb-0422-4e1f-bf1e-134252176d44', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('03f9718a-0c84-408c-9638-e9b56e85cf4f', 'cda318bb-0422-4e1f-bf1e-134252176d44', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('6501b008-9c21-406c-b15f-2c934cfa8902', '99fc50ed-16bf-4324-950a-c77d02651695', '1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 1, NULL, 20000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('c5bb6fdf-ce03-4f25-b09d-17dc02321c73', '99fc50ed-16bf-4324-950a-c77d02651695', '371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 1, NULL, 12000, NULL);
INSERT INTO "order_items" ("id", "order_id", "product_id", "product_name", "unit_price", "quantity", "modifier_label", "subtotal", "note") VALUES ('17c5b801-fad7-4cb5-aa98-079f93166da8', '99fc50ed-16bf-4324-950a-c77d02651695', 'e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 1, NULL, 25000, NULL);

INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('b7ca8f51-7c83-4be7-8604-6a0e643523b3', 2, 'delivery', 'cash', 228000, 11, 22800, 250800, NULL, NULL, '2026-06-29T08:22:17.964375+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'd0000000-0001-4000-8000-000000000001', 'completed', 'paid', NULL, NULL, NULL, FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('b46da0a6-abfc-4ce0-bced-798faf3cf3d7', 3, 'dine_in', 'qris', 203000, 11, 20300, 223300, NULL, NULL, '2026-06-29T08:23:13.205224+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0001-4000-8000-000000000003', 'completed', 'paid', NULL, NULL, NULL, FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('7862e832-5bd1-42e4-ac46-b46e2310d8aa', 4, 'dine_in', 'cash', 97000, 12, 9700, 106700, NULL, NULL, '2026-06-29T11:21:08.358148+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, NULL, FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('7d0234ec-f881-4595-a26d-afe4f4764b55', 5, 'dine_in', 'cash', 61000, 11, 6100, 67100, NULL, NULL, '2026-06-29T14:57:13.899027+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, NULL, FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('2ed99248-8e65-402c-9acd-b3fbf1814833', 7, 'dine_in', 'cash', 77000, 11, 7700, 84700, NULL, 'ALIF', '2026-06-30T08:39:48.254721+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, NULL, FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('00581b4c-c54b-403d-826b-aa90592bd1ac', 23, 'dine_in', 'cash', 42000, 12, 4200, 46200, NULL, 'alif', '2026-06-30T12:59:43.846821+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, NULL, FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('36ebdf30-0596-485d-9370-240862ef4a40', 24, 'dine_in', 'qris', 103000, 11, 10300, 113300, NULL, 'anjay', '2026-07-01T01:09:33.621619+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('74e3b7ce-4289-4246-b376-8c5454c40c01', 25, 'dine_in', 'cash', 102000, 11, 10200, 112200, NULL, 'o', '2026-07-01T01:49:57.090929+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('ece7de19-d992-4da8-a7fb-f3af5b9b9339', 26, 'dine_in', 'cash', 52000, 11, 5200, 57200, NULL, 'alif', '2026-07-01T01:54:57.870059+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('52dcbe89-e0e9-403e-9704-d31d35a2a663', 27, 'dine_in', 'qris', 25000, 11, 2500, 27500, NULL, 'P', '2026-07-01T02:13:25.660127+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('fc111f1f-3feb-4592-b6b4-0d70343e92d7', 29, 'dine_in', 'qris', 126000, 11, 12600, 138600, NULL, 'u', '2026-07-01T15:53:53.491491+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'partial', NULL, NULL, 'Diyah Intan Maulana', TRUE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('137955c2-2d20-4504-b9bf-7cc7d2ecaba1', 30, 'dine_in', 'later', 100000, 12, 12000, 112000, NULL, 'cinta', '2026-07-02T14:50:01.327052+00:00', NULL, NULL, NULL, 'draft', 'unpaid', '2026-07-03T14:50:00.768+00:00', NULL, NULL, FALSE, '8df6381b-0caf-4483-966c-0214e41fc2d8', 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('3b8931d1-f62f-427e-a27f-bc4710a0e7fe', 33, 'dine_in', 'cash', 77000, 12, 7700, 84700, NULL, 'p', '2026-07-02T15:01:19.04168+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('64c58dce-2702-4c1d-aa16-68bbd2a4fb69', 34, 'dine_in', 'qris', 42000, 12, 4200, 46200, NULL, 'alif', '2026-07-02T15:01:32.035407+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('8588c614-2a08-4b4a-a665-52622700b933', 35, 'dine_in', 'qris', 52000, 11, 5200, 57200, NULL, 'p', '2026-07-03T05:41:17.153738+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('77d5e554-20d9-4e59-a4de-2f4f7da0544b', 38, 'dine_in', 'cash', 85000, 11, 8500, 93500, NULL, 'p', '2026-07-03T13:25:42.252395+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, NULL, 0, '[object Object]', NULL);
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('1340a52c-25f7-42ad-b4ea-6ec6ac79d571', 39, 'dine_in', 'cash', 89000, 0, 0, 92916, NULL, 'ANJAY', '2026-07-03T14:02:43.680044+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 8900, '[object Object],[object Object]', '[object Object]');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('9caa0cfb-1cf0-4a47-a24e-34b328bfebcb', 40, 'dine_in', 'qris', 62000, 0, 0, 64728, NULL, 'sayang', '2026-07-03T14:11:39.054374+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, '8df6381b-0caf-4483-966c-0214e41fc2d8', 6200, '[object Object],[object Object]', '[object Object]');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('1e5cd237-aa90-44cf-a905-c369fdac2c00', 41, 'dine_in', 'cash', 100000, 0, 0, 100000, NULL, 'p', '2026-07-03T14:12:21.349411+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, NULL, 0, '', '');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('3f18b5df-c86a-436c-8d0e-edd888716f5c', 42, 'dine_in', 'qris', 82000, 0, 0, 85608, NULL, 'ALIF', '2026-07-05T02:10:08.2792+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 8200, '[object Object],[object Object]', '[object Object]');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('6367d4bd-a851-4b85-9482-718a75e57d5d', 43, 'dine_in', 'qris', 82000, 0, 0, 85608, NULL, 'ALIF', '2026-07-05T02:25:50.833722+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 8200, '[object Object],[object Object]', '[object Object]');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('61a850c8-2d84-4f38-8d97-effe0fbcd023', 44, 'dine_in', 'qris', 77000, 0, 0, 80388, NULL, 'P', '2026-07-05T02:50:04.427281+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 7700, '[object Object],[object Object]', '[object Object]');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('3ed2cdc5-6b01-45bd-8205-100f08c8db1b', 45, 'dine_in', 'qris', 82000, 0, 0, 85608, NULL, 'P', '2026-07-05T02:55:42.488866+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 8200, '[object Object],[object Object]', '[object Object]');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('1338f23a-4fe7-4e42-840a-2cc5d6f06b8f', 46, 'dine_in', 'qris', 59000, 0, 0, 61596, NULL, 'pv', '2026-07-05T04:36:13.106277+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, '8df6381b-0caf-4483-966c-0214e41fc2d8', 5900, '[object Object],[object Object]', '[object Object]');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('831ccde7-e5e6-4c97-a2ca-e6c5e151ebf1', 47, 'dine_in', 'cash', 81000, 0, 0, 84564, NULL, 'p', '2026-07-06T03:35:27.844455+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 8100, '[object Object],[object Object]', '[object Object]');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('a64953cc-8762-4208-972c-7e612b4a3352', 48, 'dine_in', 'cash', 77000, 0, 0, 80388, NULL, 'CINTA', '2026-07-07T14:30:42.110885+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 7700, '[object Object],[object Object]', '[object Object]');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('23f948be-bdf8-48e7-968b-d5f2f5b965f2', 49, 'dine_in', 'cash', 87000, 0, 0, 87000, NULL, 'c', '2026-07-07T14:59:07.076614+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 0, '', '');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('5b09c47e-4351-44ca-b035-ed4de9d65850', 53, 'dine_in', 'cash', 109000, 0, 0, 107910, NULL, 'p', '2026-07-09T13:32:13.254312+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 12900, '[object Object]', '[object Object],[object Object]');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('b54c837d-a03a-4472-9953-92aedc9269d5', 54, 'dine_in', 'cash', 32000, 0, 0, 31680, NULL, 'P', '2026-07-15T01:28:15.511937+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 3200, '[object Object]', '[object Object]');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('1863f902-54a7-4da5-ba28-6d80e20c071f', 55, 'dine_in', 'cash', 39000, 0, 0, 42900, NULL, 'Budi', '2026-07-24T14:33:56.628544+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'partial', NULL, NULL, 'Diyah Intan Maulana', TRUE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 0, '[object Object]', '');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('f7241747-baad-4a46-9661-107374f9c9a4', 57, 'dine_in', 'cash', 57000, 0, 0, 65550, NULL, 'ghfj', '2026-07-26T02:39:32.584258+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 0, '[object Object],[object Object]', '');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('2213f3f3-7fb1-4d68-9591-d638c1317154', 58, 'dine_in', 'cash', 77000, 0, 0, 88550, NULL, 'fhfghfgh', '2026-07-26T03:38:00.585366+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 0, '[object Object],[object Object]', '');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('0755c802-390a-4829-ba29-659e83281906', 59, 'dine_in', 'cash', 72000, 0, 0, 82800, NULL, 'P', '2026-07-27T11:43:19.441843+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 0, '[object Object],[object Object]', '');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('cda318bb-0422-4e1f-bf1e-134252176d44', 60, 'dine_in', 'cash', 32000, 0, 0, 36800, NULL, 'pp', '2026-07-27T11:49:07.644874+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 0, '[object Object],[object Object]', '');
INSERT INTO "orders" ("id", "order_number", "order_type", "payment_method", "subtotal", "tax_rate", "tax_amount", "total_price", "note", "customer_name", "created_at", "company_id", "outlet_id", "cashier_id", "status", "payment_status", "reserved_until", "pricing_option_id", "cashier_name", "split_bill", "pricing_tier_id", "discount_amount", "taxes", "discounts") VALUES ('99fc50ed-16bf-4324-950a-c77d02651695', 61, 'dine_in', 'cash', 57000, 0, 0, 65550, NULL, 'p', '2026-07-27T11:53:24.925436+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', '5393c391-3caa-46d2-b456-43d86298a581', 'completed', 'paid', NULL, NULL, 'Diyah Intan Maulana', FALSE, 'f478eb02-e9fa-42df-aedc-e3dc99d03556', 0, '[object Object],[object Object]', '');

INSERT INTO "owners" ("id", "email", "phone", "name", "password_hash", "email_verified_at", "is_active", "last_login_at", "created_at") VALUES ('2d3a9137-fbbd-43f4-bcc3-b2663aef7be7', 'ali@rakku.test', NULL, 'Ali Pemilik', '$2b$10$ArlWSxrTmZMT00Bj/YOAqeK2mCny3Svrx6KbtUl0fiOtUV9sEIohS', '2026-07-05T06:33:52.418+00:00', TRUE, '2026-07-05T06:37:13.479+00:00', '2026-07-05T06:33:53.194424+00:00');
INSERT INTO "owners" ("id", "email", "phone", "name", "password_hash", "email_verified_at", "is_active", "last_login_at", "created_at") VALUES ('864c6094-f5b1-4e90-ab84-13357afe6c4e', 'muthia@kedan.com', '081265430987', 'Muthia', '$2b$10$P6E/rMihfX48DwuTkzta7O2ixEo1xsU6Xu0OhWxnLuLgWCyqj7Hru', '2026-07-05T06:41:49+00:00', TRUE, '2026-07-27T14:11:25.165+00:00', '2026-07-05T06:42:00+00:00');
INSERT INTO "owners" ("id", "email", "phone", "name", "password_hash", "email_verified_at", "is_active", "last_login_at", "created_at") VALUES ('70d7f077-2be6-4251-9160-e7145bbfed08', 'diyahintan10@gmail.com', NULL, 'Diyah Intan Cantik', '$2b$10$GAGCFK.oTOIKd6QTIz66q.D5Ok82LSKApZbt/wiJbRkBLFm9VbtNK', '2026-07-06T08:18:53.767+00:00', TRUE, NULL, '2026-07-06T08:09:35.315064+00:00');
INSERT INTO "owners" ("id", "email", "phone", "name", "password_hash", "email_verified_at", "is_active", "last_login_at", "created_at") VALUES ('7388749c-a303-43cf-b3db-79202fe796b3', 'yanto@gmail.com', NULL, 'yanto', '$2b$10$OTyFi4snpRbHcZsp5zBOruiSk2/1Iwz8MZbD7Yt.ZjHEtmlvpZ2Ra', NULL, TRUE, NULL, '2026-07-08T11:11:44.070364+00:00');
INSERT INTO "owners" ("id", "email", "phone", "name", "password_hash", "email_verified_at", "is_active", "last_login_at", "created_at") VALUES ('2fa54550-2f4b-4750-9a54-093ae7370033', 'kristiandavid644@gmail.com', NULL, 'david', '$2b$10$g574I4mrM9.vJFSyAKiLQe/wq9F4sO80gADiDwruni7AiWvpCkppq', '2026-07-08T11:44:30.518+00:00', TRUE, NULL, '2026-07-08T11:44:03.986632+00:00');
INSERT INTO "owners" ("id", "email", "phone", "name", "password_hash", "email_verified_at", "is_active", "last_login_at", "created_at") VALUES ('b852be19-4966-411d-a8a5-0a09f4ed0d9d', 'alifdhimasxz@gmail.com', NULL, 'Dhimas Alif Prabowo', '$2b$10$qfuQjpy7o2g4Am/O4Y.Eset36vXTJncHLAcl2K.Iz573NP.5.tCsa', '2026-07-06T03:29:13.966+00:00', TRUE, '2026-07-12T14:32:18.551+00:00', '2026-07-06T03:27:59.285772+00:00');

INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('f478eb02-e9fa-42df-aedc-e3dc99d03556', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', 'Dine In', 'dine-in', TRUE, 1, '2026-07-02T06:06:16.911365+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('0a683878-0700-4f2c-aec7-714683ffc0f5', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', 'Gojek', 'gojek', TRUE, 3, '2026-07-02T06:06:57.246423+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('9c71b5ee-bceb-439b-9f2c-672a9d8752ce', '6f794056-27be-446d-b9e7-39df43cff99a', 'b0000000-0000-4000-8000-000000000003', 'Dine In', 'dine-in', TRUE, 1, '2026-07-02T10:44:03.392198+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('feaae352-4928-4973-93ab-1d934a2392ae', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Dine In', 'dine-in', TRUE, 1, '2026-07-02T10:44:03.392198+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('b4e8e440-e142-4ec3-b1d6-cb52314171b9', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Dine In', 'dine-in', TRUE, 1, '2026-07-02T10:44:03.392198+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('5b6407ee-b89f-4fd1-b295-79ce2788a623', '6f794056-27be-446d-b9e7-39df43cff99a', 'b0000000-0000-4000-8000-000000000003', 'Take Away', 'take-away', TRUE, 2, '2026-07-02T10:44:03.392198+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('8df6381b-0caf-4483-966c-0214e41fc2d8', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', 'Take Away', 'take-away', TRUE, 2, '2026-07-02T10:44:03.392198+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('d6e2eae6-2ebf-4735-94c9-d25d7d867a53', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Take Away', 'take-away', TRUE, 2, '2026-07-02T10:44:03.392198+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('4c3d7597-4d08-44bf-aa34-c09056deb20e', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Take Away', 'take-away', TRUE, 2, '2026-07-02T10:44:03.392198+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('a647359a-2bd0-4eb3-90a9-55121c9ab311', 'c844892c-a4ed-44da-a0d9-d8a46840293b', '4a12ec2d-7446-4074-83c1-98658e3a6479', 'Dine In', 'dine-in', TRUE, 0, '2026-07-06T03:29:48.369987+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('285a7af5-166d-4928-a4f8-1a650001c216', 'c844892c-a4ed-44da-a0d9-d8a46840293b', '4a12ec2d-7446-4074-83c1-98658e3a6479', 'Take Away', 'take-away', TRUE, 1, '2026-07-06T03:29:48.369987+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('7f072a71-e50d-4924-8623-a34d999c83c1', 'b4b6daf4-7ab4-48d0-a528-d40cb3f5bcdf', 'c085725a-8d18-4036-a46f-06feb812954e', 'Dine In', 'dine-in', TRUE, 0, '2026-07-06T08:19:29.257859+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('702b43c2-e5cb-45e2-8e19-ef2009be944e', 'b4b6daf4-7ab4-48d0-a528-d40cb3f5bcdf', 'c085725a-8d18-4036-a46f-06feb812954e', 'Take Away', 'take-away', TRUE, 1, '2026-07-06T08:19:29.257859+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('b74f0f7d-956a-4253-b8c5-07826e067072', '4f7b4d59-21c4-4640-933b-264741fa7960', '1ea3d5f0-9018-4b8b-8d1a-32ee0658c85d', 'Dine In', 'dine-in', TRUE, 0, '2026-07-08T11:45:20.629175+00:00');
INSERT INTO "pricing_tiers" ("id", "company_id", "outlet_id", "name", "slug", "is_active", "sort_order", "created_at") VALUES ('f992f0e5-00e7-42b6-b7a5-96790b69796a', '4f7b4d59-21c4-4640-933b-264741fa7960', '1ea3d5f0-9018-4b8b-8d1a-32ee0658c85d', 'Take Away', 'take-away', TRUE, 1, '2026-07-08T11:45:20.629175+00:00');

INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('b1c2d3e4-0001-4000-8000-000000000001', 'Espresso', 25000, 'a1b2c3d4-0001-4000-8000-000000000001', NULL, TRUE, 'Shot of pure espresso', '2026-06-28T22:35:28.421157+00:00', '2026-06-28T22:35:28.421157+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('b1c2d3e4-0001-4000-8000-000000000002', 'Cafe Latte', 35000, 'a1b2c3d4-0001-4000-8000-000000000001', NULL, TRUE, 'Espresso with steamed milk', '2026-06-28T22:35:28.544488+00:00', '2026-06-28T22:35:28.544488+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('b1c2d3e4-0001-4000-8000-000000000003', 'Cappuccino', 35000, 'a1b2c3d4-0001-4000-8000-000000000001', NULL, TRUE, 'Espresso with foam & steamed milk', '2026-06-28T22:35:28.661342+00:00', '2026-06-28T22:35:28.661342+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('b1c2d3e4-0001-4000-8000-000000000004', 'Iced Americano', 30000, 'a1b2c3d4-0001-4000-8000-000000000001', NULL, TRUE, 'Espresso with cold water & ice', '2026-06-28T22:35:28.780588+00:00', '2026-06-28T22:35:28.780588+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('b1c2d3e4-0001-4000-8000-000000000005', 'Green Tea', 25000, 'a1b2c3d4-0001-4000-8000-000000000002', NULL, TRUE, 'Japanese green tea', '2026-06-28T22:35:28.893859+00:00', '2026-06-28T22:35:28.893859+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('b1c2d3e4-0001-4000-8000-000000000006', 'Chocolate', 30000, 'a1b2c3d4-0001-4000-8000-000000000002', NULL, TRUE, 'Rich hot chocolate', '2026-06-28T22:35:29.00972+00:00', '2026-06-28T22:35:29.00972+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('b1c2d3e4-0001-4000-8000-000000000007', 'Butter Croissant', 25000, 'a1b2c3d4-0001-4000-8000-000000000003', NULL, TRUE, 'Flaky butter croissant', '2026-06-28T22:35:29.132362+00:00', '2026-06-28T22:35:29.132362+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('b1c2d3e4-0001-4000-8000-000000000008', 'Banana Muffin', 20000, 'a1b2c3d4-0001-4000-8000-000000000003', NULL, TRUE, 'Moist banana muffin', '2026-06-28T22:35:29.24848+00:00', '2026-06-28T22:35:29.24848+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('f0000000-0000-4000-8000-000000000002', 'Cappuccino', 30000, 'e0000000-0000-4000-8000-000000000004', NULL, TRUE, 'Italian cappuccino', '2026-06-29T00:47:24.943554+00:00', '2026-06-29T00:47:24.943554+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('f0000000-0000-4000-8000-000000000003', 'Vanilla Latte', 35000, 'e0000000-0000-4000-8000-000000000004', NULL, TRUE, 'Latte with vanilla syrup', '2026-06-29T00:47:25.169751+00:00', '2026-06-29T00:47:25.169751+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('f0000000-0000-4000-8000-000000000004', 'Milo', 25000, 'e0000000-0000-4000-8000-000000000005', NULL, TRUE, 'Iced milo', '2026-06-29T00:47:25.394824+00:00', '2026-06-29T00:47:25.394824+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('f0000000-0000-4000-8000-000000000005', 'Thai Tea', 28000, 'e0000000-0000-4000-8000-000000000005', NULL, TRUE, 'Thai iced tea', '2026-06-29T00:47:25.630575+00:00', '2026-06-29T00:47:25.630575+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('f0000000-0000-4000-8000-000000000006', 'Lemon Tea', 20000, 'e0000000-0000-4000-8000-000000000005', NULL, TRUE, 'Fresh lemon tea', '2026-06-29T00:47:25.854498+00:00', '2026-06-29T00:47:25.854498+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('f0000000-0000-4000-8000-000000000007', 'Croissant', 22000, 'e0000000-0000-4000-8000-000000000006', NULL, TRUE, 'Butter croissant', '2026-06-29T00:47:26.09497+00:00', '2026-06-29T00:47:26.09497+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('f0000000-0000-4000-8000-000000000008', 'Chiffon Cake', 18000, 'e0000000-0000-4000-8000-000000000006', NULL, TRUE, 'Soft chiffon cake', '2026-06-29T00:47:26.327511+00:00', '2026-06-29T00:47:26.327511+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('f0000000-0000-4000-8000-000000000009', 'Cheesecake', 30000, 'e0000000-0000-4000-8000-000000000006', NULL, TRUE, 'New York cheesecake', '2026-06-29T00:47:26.562266+00:00', '2026-06-29T00:47:26.562266+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('f0000000-0000-4000-8000-000000000001', 'Americano', 20000, 'e0000000-0000-4000-8000-000000000004', NULL, TRUE, 'Classic black coffee', '2026-06-29T00:47:24.718225+00:00', '2026-06-29T08:12:04.608036+00:00', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('e10ab7cd-e9d6-4bbf-85a3-5fdef118f012', 'Nasi Ayam Rendang', 25000, 'f347c54c-5ebb-4722-b4af-4b984084be08', 'https://xislxiikkiecgozwsxxg.supabase.co/storage/v1/object/public/product-images/e10ab7cd-e9d6-4bbf-85a3-5fdef118f012/1783003215035.webp', TRUE, '', '2026-06-29T08:57:22.713596+00:00', '2026-07-13T06:18:36.323806+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('caaae4d3-be5d-429e-9bbb-512bd0c35179', 'Nasi Telur ', 20000, 'f347c54c-5ebb-4722-b4af-4b984084be08', 'https://xislxiikkiecgozwsxxg.supabase.co/storage/v1/object/public/product-images/caaae4d3-be5d-429e-9bbb-512bd0c35179/1783003293660.webp', TRUE, '', '2026-06-29T08:57:33.090194+00:00', '2026-07-14T12:04:51.716468+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('371928da-bdd4-433b-8689-3b967520cec1', 'Kue Lupis', 12000, 'aaaa381c-2fd0-4eb3-9a92-7b9203a24f4c', 'https://xislxiikkiecgozwsxxg.supabase.co/storage/v1/object/public/product-images/371928da-bdd4-433b-8689-3b967520cec1/1783003184113.webp', TRUE, '', '2026-06-29T08:58:09.937892+00:00', '2026-07-02T14:39:45.361229+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('1b23ee32-fc7c-4209-8234-98aa4720de36', 'Kopi Gula Aren', 20000, 'dea92740-b202-4123-8849-f5325ad96aa6', 'https://xislxiikkiecgozwsxxg.supabase.co/storage/v1/object/public/product-images/1b23ee32-fc7c-4209-8234-98aa4720de36/1783003151141.webp', TRUE, '', '2026-06-29T08:57:57.549517+00:00', '2026-07-27T14:25:07.95539+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('859fbda1-770d-491a-85bb-cadc6db8f8b8', 'Teh Manis', 5000, 'dea92740-b202-4123-8849-f5325ad96aa6', 'https://xislxiikkiecgozwsxxg.supabase.co/storage/v1/object/public/product-images/859fbda1-770d-491a-85bb-cadc6db8f8b8/1783003306015.webp', TRUE, '', '2026-06-29T13:57:03.303223+00:00', '2026-07-02T14:41:47.522999+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291');
INSERT INTO "products" ("id", "name", "price", "category_id", "image_url", "is_active", "description", "created_at", "updated_at", "company_id", "outlet_id") VALUES ('6f94d258-1416-4287-8ff9-2d0c09aa8511', 'Teh Tawar', 4000, 'dea92740-b202-4123-8849-f5325ad96aa6', 'https://xislxiikkiecgozwsxxg.supabase.co/storage/v1/object/public/product-images/6f94d258-1416-4287-8ff9-2d0c09aa8511/1783003316198.webp', TRUE, '', '2026-06-29T08:57:41.891354+00:00', '2026-07-02T14:41:57.165031+00:00', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291');

INSERT INTO "taxes" ("id", "company_id", "outlet_id", "name", "type", "value", "is_active", "sort_order", "created_at") VALUES ('5da936a6-e0b2-4fe3-8eb6-799c456c9798', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', 'PPn', 'percentage', 10, TRUE, 0, '2026-07-09T12:56:05.895449+00:00');
INSERT INTO "taxes" ("id", "company_id", "outlet_id", "name", "type", "value", "is_active", "sort_order", "created_at") VALUES ('daf30a22-d01a-44e0-b375-45c722769c81', '84e29f64-0d52-4f34-abf4-8a13bf902a61', 'e2da8f87-c21c-40b8-9bab-1ae9994bd291', 'Service Tax', 'percentage', 5, TRUE, 2, '2026-07-24T14:38:54.041094+00:00');

INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('d0000000-0001-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0001-4000-8000-000000000003', 'Siti Admin', 'siti', '$2b$10$ykHPZTWUs.3WOjTuVhiFtel64JpLbKqf7GPc0PZgFpbE.TaAVaDPu', NULL, FALSE, 'active', 0, NULL, '2026-06-28T22:34:54.842013+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('d0000000-0001-4000-8000-000000000006', '6f794056-27be-446d-b9e7-39df43cff99a', 'c0000000-0002-4000-8000-000000000001', 'Ali Owner', 'ali', '$2b$10$JU3Q1N.x/wrJgWTEPnpfDu.89IA7LwGmcB1uVpKKGftTGSOeMWclS', NULL, TRUE, 'active', 0, NULL, '2026-06-29T00:47:20.064176+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('d0000000-0001-4000-8000-000000000007', '6f794056-27be-446d-b9e7-39df43cff99a', 'c0000000-0002-4000-8000-000000000003', 'Rina Admin', 'rina', '$2b$10$JU3Q1N.x/wrJgWTEPnpfDu.89IA7LwGmcB1uVpKKGftTGSOeMWclS', NULL, FALSE, 'active', 0, NULL, '2026-06-29T00:47:20.28868+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('d0000000-0001-4000-8000-000000000008', '6f794056-27be-446d-b9e7-39df43cff99a', 'c0000000-0002-4000-8000-000000000004', 'Joko Kasir', 'joko', '$2b$10$JU3Q1N.x/wrJgWTEPnpfDu.89IA7LwGmcB1uVpKKGftTGSOeMWclS', NULL, FALSE, 'active', 0, NULL, '2026-06-29T00:47:20.519248+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('d0000000-0001-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0001-4000-8000-000000000004', 'Dewi Kasir', 'dewi', '$2b$10$JU3Q1N.x/wrJgWTEPnpfDu.89IA7LwGmcB1uVpKKGftTGSOeMWclS', NULL, FALSE, 'active', 0, NULL, '2026-06-29T00:47:21.774756+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('d0000000-0001-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0001-4000-8000-000000000002', 'Rudi Kepala Cabang', 'rudi', '$2b$10$JU3Q1N.x/wrJgWTEPnpfDu.89IA7LwGmcB1uVpKKGftTGSOeMWclS', NULL, FALSE, 'active', 0, NULL, '2026-06-29T00:47:21.550903+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('d99fad8f-0b49-47ea-aa1d-71a8fab94a6c', '84e29f64-0d52-4f34-abf4-8a13bf902a61', '005d33c5-ed64-415b-883f-6d69d4ac1135', 'Aya', 'ayaaaa', '$2b$10$v9r.DPjBY/RyWfJ6icQfB.aGXA.fzgGTiY15/6YChuF2v0hKo7Txi', NULL, FALSE, 'active', 0, NULL, '2026-06-29T08:29:32.005876+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('d0000000-0001-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0001-4000-8000-000000000001', 'Budi Pemilik', 'budi', '$2b$10$I1tT98KXPLoiK1qCiJn2ueDaq0hti2edhtJqM3CRUy6tFXxWQffLG', NULL, TRUE, 'active', 0, NULL, '2026-06-28T22:34:54.842013+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('d0000000-0001-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0001-4000-8000-000000000004', 'Ahmad Kasir', 'ahmad', '$2b$10$PUEldMIjICqak4khr664/Ov5ogLoVtkZYhfDBSJiay402gyX99dRG', NULL, FALSE, 'active', 0, NULL, '2026-06-28T22:34:54.842013+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('5393c391-3caa-46d2-b456-43d86298a581', '84e29f64-0d52-4f34-abf4-8a13bf902a61', '31e6a624-0350-42a4-8c60-c6fb05ebda24', 'Diyah Intan Maulana', 'diyahintan', '$2b$10$S4p24pHI5mmTrm4uAd7qJ.m7jZZmzENYnt/CEcWKtjnNgt92BQluG', NULL, TRUE, 'active', 0, NULL, '2026-06-29T08:29:14.83028+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('92b9c12e-14dd-4e37-90bd-97100b5f614f', 'c844892c-a4ed-44da-a0d9-d8a46840293b', '7d337cae-6097-4cad-baa2-b3692ec69614', 'Dhimas Alif Prabowo', 'dhimasalif', '$2b$10$MQlq2Hq9XYfmEupH7vi5WO65Df6GxJIvh6HkjKTHlMUNIitwgn9vW', NULL, TRUE, 'active', 0, NULL, '2026-07-06T03:33:15.263748+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('dce992d5-baca-4450-a23e-b44c9850165d', 'b4b6daf4-7ab4-48d0-a528-d40cb3f5bcdf', '4c3cd9c0-f03e-433a-8059-d36f8d15a2b0', 'Alif', 'alif', '$2b$10$lXFYMH4dXPNU86sHR8cKVOZCauH2UQ4VgpbabwCXG57xOVeFc7APS', NULL, TRUE, 'active', 0, NULL, '2026-07-06T08:22:20.121715+00:00');
INSERT INTO "users" ("id", "company_id", "role_id", "name", "username", "pin_hash", "avatar_url", "all_outlets", "status", "failed_pin_attempts", "locked_until", "created_at") VALUES ('63a29bd4-c0fb-4c14-8e9b-986e31f500ef', '84e29f64-0d52-4f34-abf4-8a13bf902a61', '6e737844-b581-4da8-b7b4-0311ba18fd52', 'Muthia', 'muthia', '$2b$10$ly8tUx74Ns7TJCa/Kx19G.tBLAKMUPkFzWcFvzYumDOVm8nWx/BCC', NULL, TRUE, 'active', 0, NULL, '2026-06-29T08:29:46.227729+00:00');


