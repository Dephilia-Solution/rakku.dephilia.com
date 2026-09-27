-- ============================================================
-- Rakku — Migration 018: Stock Movements (v5.0 Milestone 2)
-- Purpose: Audit trail potong stok otomatis (sale_deduction) saat
--          order selesai. Setiap perubahan stok WAJIB ada jejaknya
--          di tabel ini — stok tidak boleh di-overwrite tanpa baris
--          stock_movements.
--
-- Catatan: PRD v5 menyebut migration ini sebagai "017", digeser
--          ke 018 karena 017_ingredients_and_recipes sudah ada.
--
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

-- 1. Stock movements (jejak perubahan stok, per outlet)
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  type text NOT NULL, -- purchase, sale_deduction, adjustment, waste
  quantity_change numeric(12,2) NOT NULL, -- + atau -
  reference_id uuid, -- order_id / purchase_id, nullable
  note text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Index untuk query scoped company+outlet (pola app-level scoping)
CREATE INDEX IF NOT EXISTS idx_stock_movements_company_outlet
  ON stock_movements(company_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient
  ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference
  ON stock_movements(reference_id);

-- 3. RLS: konsisten dengan pendekatan permissive app-level auth
--    (sama seperti ingredients/product_recipes di migration 017).
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

GRANT ALL ON stock_movements TO authenticated;

COMMIT;