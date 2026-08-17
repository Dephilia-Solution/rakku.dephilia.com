-- ============================================================
-- Rakku — Migration 019: Ingredient Purchases (v5.0 Milestone 5)
-- Purpose: Pencatatan pembelian/restock bahan baku per outlet.
--          Input pembelian otomatis menambah stok ingredient dan
--          memperbarui cost_per_unit (metode last cost), plus
--          mencatat jejak type=purchase di stock_movements.
--
-- Catatan: PROMPT v5 menyebut migration ini sebagai "018",
--          digeser ke 019 karena 018_stock_movements sudah ada
--          (DOCS.md §17.1).
--
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

-- 1. Ingredient purchases (header pembelian)
CREATE TABLE IF NOT EXISTS ingredient_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id),
  supplier_name text,
  total_amount numeric(14,2) NOT NULL,
  purchase_date timestamptz NOT NULL DEFAULT now(),
  note text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Ingredient purchase items (detail per bahan)
CREATE TABLE IF NOT EXISTS ingredient_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES ingredient_purchases(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  quantity numeric(12,2) NOT NULL,
  unit_cost numeric(12,2) NOT NULL,
  subtotal numeric(14,2) NOT NULL
);

-- 3. Index untuk query scoped company+outlet (pola app-level scoping)
CREATE INDEX IF NOT EXISTS idx_ingredient_purchases_company_outlet
  ON ingredient_purchases(company_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_purchases_date
  ON ingredient_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_ingredient_purchase_items_purchase
  ON ingredient_purchase_items(purchase_id);

-- 4. RLS: konsisten dengan pendekatan permissive app-level auth
--    (sama seperti stock_movements di migration 018).
ALTER TABLE ingredient_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_purchase_items ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ingredient_purchases TO authenticated;
GRANT ALL ON ingredient_purchase_items TO authenticated;

-- 5. Daftarkan menu "Pembelian".
--    TIDAK di-seed ke role_menu_access — Owner mengatur sendiri
--    lewat panel "Kelola Role" (keputusan v3.0, DOCS.md §14.10).
INSERT INTO menus (slug, name, icon, path, sort_order)
VALUES ('purchases', 'Pembelian', 'ShoppingBag', '/purchases', 8)
ON CONFLICT (slug) DO NOTHING;

COMMIT;