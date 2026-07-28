-- ============================================================
-- Rakku — Migration 015: Menu Consolidation (UI/UX revamp)
-- Purpose: Gabungkan menu Taxes + Discounts → "Pajak & Diskon"
--          (/tax-discounts). Pricing Tiers pindah ke area Produk
--          (dikelola via slide-over di /products).
--          Sekaligus rename nama menu ke Bahasa Indonesia.
--
-- Menu akhir (5):
--   1. Kasir          /register
--   2. Pesanan        /orders
--   3. Laporan        /reports
--   4. Produk         /products   (termasuk kategori & pricing tiers)
--   5. Pajak & Diskon /tax-discounts
--
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

-- 1. Buat menu gabungan baru
INSERT INTO menus (slug, name, icon, path, sort_order)
VALUES ('tax-discounts', 'Pajak & Diskon', 'Percent', '/tax-discounts', 5)
ON CONFLICT (slug) DO NOTHING;

-- 2. Migrasikan akses role: union dari akses taxes + discounts.
--    Role yang bisa view/create/edit/delete salah satunya
--    mendapat akses yang sama pada menu gabungan.
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

-- 3. Rename nama menu ke Bahasa Indonesia
UPDATE menus SET name = 'Kasir'   WHERE slug = 'register';
UPDATE menus SET name = 'Pesanan' WHERE slug = 'orders';
UPDATE menus SET name = 'Laporan' WHERE slug = 'reports';
UPDATE menus SET name = 'Produk'  WHERE slug = 'products';
UPDATE menus SET name = 'Pajak & Diskon' WHERE slug = 'tax-discounts';

-- 4. Hapus menu lama.
--    pricing-tiers: akses tercakup oleh menu Produk.
--    role_menu_access ikut terhapus via ON DELETE CASCADE.
DELETE FROM menus WHERE slug IN ('pricing-tiers', 'taxes', 'discounts');

COMMIT;
