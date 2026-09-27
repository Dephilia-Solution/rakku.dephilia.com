-- ============================================================
-- Rakku — Migration 020: Expenses (v5.0 Milestone 3)
-- Purpose: Pencatatan pengeluaran operasional harian (galon,
--          listrik, plastik, dll.) per outlet. Data ini nanti
--          dipakai Milestone 4 (laporan laba rugi: omzet - HPP -
--          pengeluaran).
--
-- Catatan: nomor 020 cocok dengan nomor PRD v5 (DOCS.md §17.1)
--          karena hanya M1/M2 yang digeser +1.
--
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

-- 1. Expenses (pengeluaran operasional, per outlet)
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id),
  category text NOT NULL,
  amount numeric(12,2) NOT NULL,
  description text,
  expense_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Index untuk query scoped company+outlet (pola app-level scoping)
CREATE INDEX IF NOT EXISTS idx_expenses_company_outlet
  ON expenses(company_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date
  ON expenses(expense_date);

-- 3. RLS: konsisten dengan pendekatan permissive app-level auth
--    (sama seperti stock_movements di migration 018).
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

GRANT ALL ON expenses TO authenticated;

-- 4. Daftarkan menu "Pengeluaran".
--    TIDAK di-seed ke role_menu_access — Owner mengatur sendiri
--    lewat panel "Kelola Role" (keputusan v3.0, DOCS.md §14.10).
INSERT INTO menus (slug, name, icon, path, sort_order)
VALUES ('expenses', 'Pengeluaran', 'Wallet', '/expenses', 7)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
