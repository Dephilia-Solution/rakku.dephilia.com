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
