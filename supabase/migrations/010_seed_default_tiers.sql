-- =========================================================
-- Migration: 010_seed_default_tiers.sql
-- Purpose: F-11 backfill — seed default pricing tiers (Dine In,
--          Take Away) for every existing outlet, and backfill
--          product_tier_prices for every existing product from
--          its base price. Idempotent (safe to re-run).
-- Date: 1 Juli 2026
-- =========================================================

-- 1. Seed "Dine In" tier for outlets that don't have one
INSERT INTO pricing_tiers (company_id, outlet_id, name, slug, is_active, sort_order)
SELECT o.company_id, o.id, 'Dine In', 'dine-in', true, 1
FROM outlets o
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_tiers pt
  WHERE pt.company_id = o.company_id
    AND pt.outlet_id = o.id
    AND pt.slug = 'dine-in'
)
ON CONFLICT (company_id, outlet_id, slug) DO NOTHING;

-- 2. Seed "Take Away" tier for outlets that don't have one
INSERT INTO pricing_tiers (company_id, outlet_id, name, slug, is_active, sort_order)
SELECT o.company_id, o.id, 'Take Away', 'take-away', true, 2
FROM outlets o
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_tiers pt
  WHERE pt.company_id = o.company_id
    AND pt.outlet_id = o.id
    AND pt.slug = 'take-away'
)
ON CONFLICT (company_id, outlet_id, slug) DO NOTHING;

-- 3. Backfill product_tier_prices for every (product, outlet tier) pair
--    that doesn't have an entry yet, using the product's base price.
INSERT INTO product_tier_prices (product_id, tier_id, price)
SELECT p.id, pt.id, p.price
FROM products p
JOIN pricing_tiers pt
  ON pt.company_id = p.company_id
 AND pt.outlet_id = p.outlet_id
WHERE NOT EXISTS (
  SELECT 1 FROM product_tier_prices ptp
  WHERE ptp.product_id = p.id
    AND ptp.tier_id = pt.id
)
ON CONFLICT (product_id, tier_id) DO NOTHING;
