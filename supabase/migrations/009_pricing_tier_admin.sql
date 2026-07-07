-- =========================================================
-- Migration: 009_pricing_tier_admin.sql
-- Purpose: Seed menu entry for Pricing Tiers (F-11 admin)
-- =========================================================

INSERT INTO menus (slug, name, icon, path, sort_order)
VALUES ('pricing-tiers', 'Pricing Tiers', 'DollarSign', '/admin/pricing-tiers', 5)
ON CONFLICT (slug) DO NOTHING;
