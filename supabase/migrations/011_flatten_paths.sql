-- =========================================================
-- Migration: 011_flatten_paths.sql
-- Purpose: Hapus prefix /admin dari path menu.
--          Akses dikontrol per-user via role_menu_access,
--          bukan via prefix path.
-- Date: 2 Juli 2026
-- =========================================================

UPDATE menus SET path = '/products'        WHERE path = '/admin/products';
UPDATE menus SET path = '/categories'      WHERE path = '/admin/categories';
UPDATE menus SET path = '/pricing-tiers'   WHERE path = '/admin/pricing-tiers';
