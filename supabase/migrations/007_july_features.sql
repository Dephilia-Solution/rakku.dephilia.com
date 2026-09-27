-- =========================================================
-- Migration: 007_july_features.sql
-- Purpose: Phase 2 features — 1 Juli 2026
--   1. cashier_name di orders (F-03)
--   2. pricing_tiers + product_tier_prices (F-11, schema only)
--   3. split_payments (F-12, schema only)
--   4. Update order_type constraint (F-11)
-- Author: Stocko Dev Team
-- Date: 1 Juli 2026
-- =========================================================

-- =========================================================
-- F-03: Cashier Name di Order
-- =========================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_name text;

-- =========================================================
-- F-12: Split Bill (schema)
-- =========================================================
CREATE TABLE IF NOT EXISTS split_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount        numeric(10,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'qris', 'card')),
  status        text DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  customer_name text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_split_payments_order ON split_payments(order_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS split_bill boolean DEFAULT false;

-- =========================================================
-- F-11: Pricing Tiers (schema)
-- =========================================================
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id  uuid REFERENCES outlets(id) ON DELETE CASCADE,
  name       text NOT NULL,
  slug       text NOT NULL,
  is_active  boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (company_id, outlet_id, slug)
);

CREATE TABLE IF NOT EXISTS product_tier_prices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tier_id    uuid NOT NULL REFERENCES pricing_tiers(id) ON DELETE CASCADE,
  price      numeric(10,2) NOT NULL,
  UNIQUE (product_id, tier_id)
);

CREATE INDEX IF NOT EXISTS idx_product_tier_prices_product ON product_tier_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tier_prices_tier ON product_tier_prices(tier_id);

-- =========================================================
-- Update order_type constraint untuk mendukung value baru
-- =========================================================
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('dine_in', 'take_away', 'delivery', 'gojek', 'grab', 'shopee'));
