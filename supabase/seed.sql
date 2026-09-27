-- ============================================================
-- Stocko POS — Seed Data (Sample products & modifiers)
-- Catatan: Company, roles, users, dan access matrix di-seed
-- via script: npx tsx scripts/seed.ts
-- ============================================================

-- Categories
insert into categories (id, name, sort_order) values
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Coffee',      1),
  ('a1b2c3d4-0001-4000-8000-000000000002', 'Non-Coffee',  2),
  ('a1b2c3d4-0001-4000-8000-000000000003', 'Pastry',      3),
  ('a1b2c3d4-0001-4000-8000-000000000004', 'Add-ons',     4)
on conflict (id) do nothing;

-- Products
insert into products (id, name, price, category_id, description, is_active) values
  ('b1c2d3e4-0001-4000-8000-000000000001', 'Espresso',         25000, 'a1b2c3d4-0001-4000-8000-000000000001', 'Shot of pure espresso', true),
  ('b1c2d3e4-0001-4000-8000-000000000002', 'Cafe Latte',       35000, 'a1b2c3d4-0001-4000-8000-000000000001', 'Espresso with steamed milk', true),
  ('b1c2d3e4-0001-4000-8000-000000000003', 'Cappuccino',       35000, 'a1b2c3d4-0001-4000-8000-000000000001', 'Espresso with foam & steamed milk', true),
  ('b1c2d3e4-0001-4000-8000-000000000004', 'Iced Americano',   30000, 'a1b2c3d4-0001-4000-8000-000000000001', 'Espresso with cold water & ice', true),
  ('b1c2d3e4-0001-4000-8000-000000000005', 'Green Tea',        25000, 'a1b2c3d4-0001-4000-8000-000000000002', 'Japanese green tea', true),
  ('b1c2d3e4-0001-4000-8000-000000000006', 'Chocolate',        30000, 'a1b2c3d4-0001-4000-8000-000000000002', 'Rich hot chocolate', true),
  ('b1c2d3e4-0001-4000-8000-000000000007', 'Butter Croissant', 25000, 'a1b2c3d4-0001-4000-8000-000000000003', 'Flaky butter croissant', true),
  ('b1c2d3e4-0001-4000-8000-000000000008', 'Banana Muffin',    20000, 'a1b2c3d4-0001-4000-8000-000000000003', 'Moist banana muffin', true)
on conflict (id) do nothing;

-- Modifiers
insert into modifiers (id, product_id, name, price_delta) values
  ('c1d2e3f4-0001-4000-8000-000000000001', 'b1c2d3e4-0001-4000-8000-000000000002', 'Oat Milk',      5000),
  ('c1d2e3f4-0001-4000-8000-000000000002', 'b1c2d3e4-0001-4000-8000-000000000003', 'Oat Milk',      5000),
  ('c1d2e3f4-0001-4000-8000-000000000003', 'b1c2d3e4-0001-4000-8000-000000000001', 'Extra Shot',    5000),
  ('c1d2e3f4-0001-4000-8000-000000000004', 'b1c2d3e4-0001-4000-8000-000000000002', 'Extra Shot',    5000),
  ('c1d2e3f4-0001-4000-8000-000000000005', 'b1c2d3e4-0001-4000-8000-000000000003', 'Extra Shot',    5000),
  ('c1d2e3f4-0001-4000-8000-000000000006', 'b1c2d3e4-0001-4000-8000-000000000004', 'Extra Shot',    5000),
  ('c1d2e3f4-0001-4000-8000-000000000007', 'b1c2d3e4-0001-4000-8000-000000000006', 'Whipped Cream', 3000)
on conflict (id) do nothing;
