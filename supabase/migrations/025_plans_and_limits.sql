-- ============================================================
-- Rakku POS — Migration 025: Plans & Limits (v6.0 M1)
-- ============================================================
-- Fondasi freemium: tabel plans + kolom langganan di companies.
-- Semua company existing di-backfill ke paket Free.
--
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

-- 1. Tabel plans
CREATE TABLE IF NOT EXISTS plans (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text UNIQUE NOT NULL,
  name                    text NOT NULL,
  description             text,
  price_monthly           numeric(12,2) NOT NULL DEFAULT 0,
  price_yearly            numeric(12,2) NOT NULL DEFAULT 0,
  max_outlets             int NOT NULL DEFAULT 1,     -- -1 = unlimited
  max_employees           int NOT NULL DEFAULT 2,
  max_products            int NOT NULL DEFAULT 30,
  max_ingredients         int NOT NULL DEFAULT 10,
  max_transactions_month  int NOT NULL DEFAULT 500,
  report_history_days     int NOT NULL DEFAULT 30,
  email_reports_month     int NOT NULL DEFAULT 5,
  storage_mb              int NOT NULL DEFAULT 50,
  features                jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active               boolean NOT NULL DEFAULT true,
  sort_order              int NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Trigger updated_at (fungsi sudah ada sejak migration 006)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plans_updated_at ON plans;
CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Kolom langganan di companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS plan_id             uuid REFERENCES plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS trial_ends_at       timestamptz,
  ADD COLUMN IF NOT EXISTS plan_expires_at     timestamptz,
  ADD COLUMN IF NOT EXISTS billing_cycle       text NOT NULL DEFAULT 'monthly';

CREATE INDEX IF NOT EXISTS idx_companies_plan_id ON companies(plan_id);

-- 3. Index untuk hitung transaksi bulanan per company
CREATE INDEX IF NOT EXISTS idx_orders_company_status_created
  ON orders(company_id, status, created_at);

-- 4. Seed 3 paket default (idempotent)
INSERT INTO plans (
  slug, name, description,
  price_monthly, price_yearly,
  max_outlets, max_employees, max_products, max_ingredients,
  max_transactions_month, report_history_days, email_reports_month, storage_mb,
  features, sort_order
) VALUES
  (
    'free', 'Free', 'Untuk kedai kecil yang baru mulai',
    0, 0,
    1, 2, 30, 10,
    500, 30, 5, 50,
    '{}'::jsonb,
    1
  ),
  (
    'pro', 'Pro', 'Untuk cafe yang sedang berkembang',
    99000, 990000,
    3, 15, 500, -1,
    5000, 365, 100, 1024,
    '{
      "multi_outlet": true,
      "custom_roles": true,
      "profit_loss": true,
      "email_reports": true,
      "inventory_advanced": true,
      "remove_qr_branding": true
    }'::jsonb,
    2
  ),
  (
    'business', 'Business', 'Untuk bisnis multi-cabang',
    249000, 2490000,
    -1, -1, -1, -1,
    -1, -1, -1, 5120,
    '{
      "multi_outlet": true,
      "custom_roles": true,
      "profit_loss": true,
      "email_reports": true,
      "inventory_advanced": true,
      "remove_qr_branding": true,
      "audit_log": true,
      "priority_support": true
    }'::jsonb,
    3
  )
ON CONFLICT (slug) DO NOTHING;

-- 5. Backfill company existing → paket Free
UPDATE companies
SET plan_id = (SELECT id FROM plans WHERE slug = 'free')
WHERE plan_id IS NULL;

-- 6. RLS plans: hanya authenticated (superadmin) yang boleh; anon ditolak.
--    Service role (owner/pos enforcement) bypass RLS.
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_plans" ON plans;
CREATE POLICY "allow_authenticated_plans"
  ON plans FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE plans IS 'Paket langganan freemium (Free/Pro/Business) — limit & fitur per paket.';
COMMENT ON COLUMN companies.plan_id IS 'Paket aktif company. NULL = belum di-set (fallback Free di kode).';
COMMENT ON COLUMN companies.subscription_status IS 'trial | active | grace | expired | cancelled';

COMMIT;
