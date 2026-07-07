-- =========================================================
-- Migration: 008_pricing_tier_split.sql
-- Purpose: F-11 & F-12 database changes
--   1. pricing_tier_id di orders (F-11)
--   2. Seed default pricing tiers (F-11)
-- =========================================================

-- F-11: Add pricing_tier_id to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pricing_tier_id uuid REFERENCES pricing_tiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_pricing_tier ON orders(pricing_tier_id);
