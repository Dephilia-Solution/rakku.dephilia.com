-- ============================================================
-- Rakku — Migration 023: Remove Supabase product-images policy
-- Purpose: alur storage berpindah ke Silos. Hapus policy RLS
--          bucket 'product-images'. Pembersihan data file dan
--          bucket dilakukan lewat Storage API (script
--          scripts/remove-supabase-bucket.ts) karena Supabase
--          memblokir DML langsung ke storage tables.
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "allow_authenticated_product_images"
  ON storage.objects;

COMMIT;
