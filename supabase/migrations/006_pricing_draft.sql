-- =========================================================
-- Migration: 006_pricing_draft.sql
-- Purpose: Pricing options (optional) + Draft orders + Customer name required
-- Author: Stocko Dev Team
-- Date: 30 Juni 2026
-- =========================================================

-- =========================================================
-- PRICING OPTIONS (Optional additional prices like Gojek)
-- =========================================================
CREATE TABLE IF NOT EXISTS pricing_options (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       text NOT NULL,           -- e.g., 'Gojek Regular', 'Gojek Express'
  price      numeric(10,2) NOT NULL,  -- Price for this option
  is_active  boolean DEFAULT true,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id  uuid REFERENCES outlets(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for pricing options
CREATE INDEX IF NOT EXISTS idx_pricing_options_product ON pricing_options(product_id);
CREATE INDEX IF NOT EXISTS idx_pricing_options_company ON pricing_options(company_id);
CREATE INDEX IF NOT EXISTS idx_pricing_options_outlet ON pricing_options(outlet_id);

-- =========================================================
-- ORDERS TABLE UPDATES
-- =========================================================

-- Add customer_name column (required for all orders)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT '';

-- Add status column for draft/pending/completed/cancelled
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed' CHECK (status IN ('draft', 'pending_payment', 'completed', 'cancelled'));

-- Add payment_status column
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'paid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded'));

-- Add reserved_until for auto-cancel drafts
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reserved_until timestamptz;

-- Add pricing_option_id for tracking which pricing option was used
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pricing_option_id uuid REFERENCES pricing_options(id) ON DELETE SET NULL;

-- Update updated_at trigger for pricing_options
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pricing_options_updated_at BEFORE UPDATE ON pricing_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- FIX: Allow 'later' payment method for draft/pay-later orders
-- =========================================================
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cash', 'qris', 'card', 'later'));

-- =========================================================
-- ROW LEVEL SECURITY (Disabled per project convention)
-- =========================================================
-- RLS is disabled for all tables in migration 003_rls_permissive.sql
-- No RLS policies needed for this migration
