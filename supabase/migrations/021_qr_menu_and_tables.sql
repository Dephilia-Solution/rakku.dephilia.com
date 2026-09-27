-- ============================================================
-- Rakku — Migration 021: QR Menu & Dining Tables (v5.0 Milestone 6)
-- Purpose: (1) kolom qr_menu_slug per outlet untuk menu digital
--          QR (view-only, tanpa auth); (2) orders.source untuk
--          asal order; (3) tabel dining_tables + orders.table_id
--          untuk manajemen meja sederhana (status available/occupied).
--
-- Catatan: nomor 021 cocok dengan nomor PRD v5 (DOCS.md §17.1)
--          setelah 021_customers_loyalty dihapus (fitur F10 batal).
--
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

-- 1. qr_menu_slug per outlet (link halaman publik /menu/[slug])
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS qr_menu_slug text;

-- 2. orders.source — asal order (pos = kasir, qr_self_order = nanti)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pos';

-- 3. orders.table_id — meja tempat order berlangsung
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id uuid;

-- 4. Dining tables (meja sederhana: status kosong/terisi)
CREATE TABLE IF NOT EXISTS dining_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'available', -- available, occupied
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. FK orders.table_id -> dining_tables(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_table'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT fk_orders_table
      FOREIGN KEY (table_id) REFERENCES dining_tables(id);
  END IF;
END $$;

-- 6. Unique index qr_menu_slug (NULL unik di Postgres, jadi aman)
CREATE UNIQUE INDEX IF NOT EXISTS idx_outlets_qr_menu_slug
  ON outlets(qr_menu_slug) WHERE qr_menu_slug IS NOT NULL;

-- 7. Index untuk query scoped company+outlet (pola app-level scoping)
CREATE INDEX IF NOT EXISTS idx_dining_tables_company_outlet
  ON dining_tables(company_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id
  ON orders(table_id);

-- 8. RLS: konsisten dengan pendekatan permissive app-level auth
--    (sama seperti migration 018/020).
ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;

GRANT ALL ON dining_tables TO authenticated;

-- 9. Daftarkan menu "Meja".
--    TIDAK di-seed ke role_menu_access — Owner mengatur sendiri
--    lewat panel "Kelola Role" (keputusan v3.0, DOCS.md §14.10).
INSERT INTO menus (slug, name, icon, path, sort_order)
VALUES ('tables', 'Meja', 'Grid3X3', '/tables', 6)
ON CONFLICT (slug) DO NOTHING;

COMMIT;