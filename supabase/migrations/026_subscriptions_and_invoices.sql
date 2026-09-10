-- ============================================================
-- Rakku POS — Migration 026: Subscriptions & Invoices (v6.0 M3)
-- ============================================================
-- Menyimpan riwayat periode langganan + tagihan QRIS (Vessel).
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

-- 1. Riwayat periode langganan
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id               uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status                text NOT NULL DEFAULT 'active',
  started_at            timestamptz NOT NULL DEFAULT now(),
  current_period_start  timestamptz NOT NULL DEFAULT now(),
  current_period_end    timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 2. Tagihan / invoice QRIS
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id                  uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  billing_cycle            text NOT NULL DEFAULT 'monthly',
  invoice_number           text UNIQUE NOT NULL,
  amount                   numeric(12,2) NOT NULL DEFAULT 0,
  provider                 text NOT NULL DEFAULT 'vessel',
  provider_transaction_id  text UNIQUE,
  qr_string                text,
  status                   text NOT NULL DEFAULT 'pending',
  expired_at               timestamptz,
  paid_at                  timestamptz,
  raw_payload              jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_company
  ON subscription_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status
  ON subscription_invoices(status);

DROP TRIGGER IF EXISTS trg_subscription_invoices_updated_at ON subscription_invoices;
CREATE TRIGGER trg_subscription_invoices_updated_at
  BEFORE UPDATE ON subscription_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. RLS: hanya authenticated (superadmin) yang boleh; anon ditolak.
--    Owner app memakai service role (bypass RLS).
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_subscriptions" ON subscriptions;
CREATE POLICY "allow_authenticated_subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_authenticated_subscription_invoices" ON subscription_invoices;
CREATE POLICY "allow_authenticated_subscription_invoices"
  ON subscription_invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE subscriptions IS 'Riwayat periode langganan company (v6).';
COMMENT ON TABLE subscription_invoices IS 'Invoice QRIS langganan via Vessel (v6).';
COMMENT ON COLUMN subscription_invoices.provider_transaction_id IS 'transaction_id dari Vessel; dipakai untuk re-verify & idempotensi.';

COMMIT;
