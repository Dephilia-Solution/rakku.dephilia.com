-- ============================================================
-- Rakku — Migration 022: Silos image file id
-- Purpose: menyimpan id file Silos untuk produk (image_silo_id)
--          agar file di Silos bisa dihapus (DELETE /files/:id).
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_silo_id text;

COMMIT;
