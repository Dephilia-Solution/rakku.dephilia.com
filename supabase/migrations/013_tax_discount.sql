-- Migration 013: Dynamic Tax & Discount System
-- Adds: taxes, product_discounts, order_discounts tables
-- Alters: orders table with taxes jsonb, discounts jsonb, discount_amount

-- 1. Taxes table (per outlet)
CREATE TABLE taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) NOT NULL,
  outlet_id uuid REFERENCES outlets(id) NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value numeric(10,2) NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Product discounts (per product with period)
CREATE TABLE product_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) NOT NULL,
  outlet_id uuid REFERENCES outlets(id) NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value numeric(10,2) NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Order discounts (per order with period)
CREATE TABLE order_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) NOT NULL,
  outlet_id uuid REFERENCES outlets(id) NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value numeric(10,2) NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. Alter orders table
ALTER TABLE orders ADD COLUMN discount_amount numeric(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN taxes jsonb;
ALTER TABLE orders ADD COLUMN discounts jsonb;

-- 5. Backfill existing orders: convert tax_rate/tax_amount to taxes jsonb
UPDATE orders
SET taxes = jsonb_build_array(
  jsonb_build_object(
    'name', 'Tax',
    'type', 'percentage',
    'value', COALESCE(tax_rate, 10),
    'amount', tax_amount
  )
)
WHERE tax_rate > 0;

-- 6. Enable RLS on new tables (consistent with permissive approach like other tables)
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_discounts ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated role (app-level auth, permissive)
GRANT ALL ON taxes TO authenticated;
GRANT ALL ON product_discounts TO authenticated;
GRANT ALL ON order_discounts TO authenticated;

-- 7. Seed menu entries for Taxes and Discounts
INSERT INTO menus (slug, name, icon, path, sort_order) VALUES
  ('taxes', 'Taxes', 'DollarSign', '/taxes', 6),
  ('discounts', 'Discounts', 'Percent', '/discounts', 7)
ON CONFLICT (slug) DO NOTHING;
