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
