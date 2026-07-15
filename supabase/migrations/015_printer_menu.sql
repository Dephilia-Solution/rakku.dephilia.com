-- ============================================================
-- Rakku POS — Migration 015: Printer Menu & Role Access (v4.1)
-- ============================================================
-- Menambahkan menu "Printer" untuk mengakses halaman
-- /settings/printer (konfigurasi printer thermal via Bluetooth).
-- Semua role mendapatkan akses view.
-- ============================================================

-- ============================================================
-- 1. Insert menu Printer
-- ============================================================
INSERT INTO menus (slug, name, icon, path, sort_order)
VALUES ('printer', 'Printer', 'Printer', '/settings/printer', 5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. Grant akses ke semua role
-- ============================================================
DO $$
DECLARE
  v_menu_id uuid;
  v_role_record record;
BEGIN
  SELECT id INTO v_menu_id FROM menus WHERE slug = 'printer';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menu ''printer'' tidak ditemukan';
  END IF;

  FOR v_role_record IN SELECT id FROM roles LOOP
    INSERT INTO role_menu_access (role_id, menu_id, can_view)
    VALUES (v_role_record.id, v_menu_id, true)
    ON CONFLICT (role_id, menu_id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- 3. Index untuk performa
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_role_menu_access_menu_id ON role_menu_access(menu_id);

-- ============================================================
-- 4. Comment
-- ============================================================
COMMENT ON COLUMN menus.sort_order IS 'Urutan tampilan menu di sidebar (default 0). Printer di 5 agar muncul setelah Products.';
