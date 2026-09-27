-- ============================================================
-- Rakku — Migration 017: Ingredients & Recipes (v5.0 Milestone 1)
-- Purpose: Fondasi inventory kedai/cafe — bahan baku (ingredients)
--          + resep/BOM per produk (product_recipes).
--          Belum ada potong stok otomatis (itu migration 018+).
--
-- Catatan: PRD v5 menyebut migration ini sebagai "016", digeser
--          ke 017 karena 016_owner_password_reset sudah ada.
--
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

-- 1. Ingredients (bahan baku, per outlet)
CREATE TABLE IF NOT EXISTS ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id),
  name text NOT NULL,
  unit text NOT NULL, -- gram, ml, pcs, kg, liter
  stock_quantity numeric(12,2) NOT NULL DEFAULT 0,
  min_stock_alert numeric(12,2) NOT NULL DEFAULT 0,
  cost_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Product recipes (BOM: 1 baris = 1 bahan per produk)
CREATE TABLE IF NOT EXISTS product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  quantity_used numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, ingredient_id)
);

-- 3. Index untuk query scoped company+outlet (pola app-level scoping)
CREATE INDEX IF NOT EXISTS idx_ingredients_company_outlet
  ON ingredients(company_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_product
  ON product_recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_ingredient
  ON product_recipes(ingredient_id);

-- 4. RLS: konsisten dengan pendekatan permissive app-level auth
--    (sama seperti taxes/product_discounts di migration 013).
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ingredients TO authenticated;
GRANT ALL ON product_recipes TO authenticated;

-- 5. Daftarkan menu "Bahan Baku".
--    TIDAK di-seed ke role_menu_access — Owner mengatur sendiri
--    lewat panel "Kelola Role" (keputusan v3.0, DOCS.md §14.10).
INSERT INTO menus (slug, name, icon, path, sort_order)
VALUES ('ingredients', 'Bahan Baku', 'Boxes', '/ingredients', 5)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
