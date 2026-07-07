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
