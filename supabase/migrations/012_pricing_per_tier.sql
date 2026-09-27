-- =========================================================
-- Migration: 012_pricing_per_tier.sql
-- Purpose: F-11 pricing redesign — harga & modifier delta
--          sepenuhnya per-tier. Kolom price/delta lama jadi
--          nullable (tidak dipakai lagi oleh UI).
-- Date: 2 Juli 2026
-- =========================================================

-- 1. products.price → nullable (tidak dipakai lagi sebagai canonical price)
ALTER TABLE products ALTER COLUMN price DROP NOT NULL;
ALTER TABLE products ALTER COLUMN price SET DEFAULT 0;

-- 2. modifiers.price_delta → nullable (tidak dipakai lagi sebagai canonical delta)
ALTER TABLE modifiers ALTER COLUMN price_delta DROP NOT NULL;
ALTER TABLE modifiers ALTER COLUMN price_delta SET DEFAULT 0;

-- 3. Tabel modifier_tier_prices: delta per tier per modifier
CREATE TABLE IF NOT EXISTS modifier_tier_prices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id uuid NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
  tier_id     uuid NOT NULL REFERENCES pricing_tiers(id) ON DELETE CASCADE,
  price_delta numeric(10,2) NOT NULL DEFAULT 0,
  UNIQUE (modifier_id, tier_id)
);

CREATE INDEX IF NOT EXISTS idx_modifier_tier_prices_modifier ON modifier_tier_prices(modifier_id);
CREATE INDEX IF NOT EXISTS idx_modifier_tier_prices_tier     ON modifier_tier_prices(tier_id);

-- 4. Backfill modifier_tier_prices dari modifiers.price_delta existing
--    (untuk setiap modifier, buat 1 row per tier outlet-nya)
INSERT INTO modifier_tier_prices (modifier_id, tier_id, price_delta)
SELECT m.id, pt.id, COALESCE(m.price_delta, 0)
FROM modifiers m
JOIN products p ON p.id = m.product_id
JOIN pricing_tiers pt
  ON pt.company_id = p.company_id
 AND pt.outlet_id = p.outlet_id
WHERE NOT EXISTS (
  SELECT 1 FROM modifier_tier_prices mtp
  WHERE mtp.modifier_id = m.id
    AND mtp.tier_id = pt.id
)
ON CONFLICT (modifier_id, tier_id) DO NOTHING;
