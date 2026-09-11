-- ============================================================
-- Rakku POS — Migration 029: Order Payment Intents (v6.1 M2)
-- ============================================================
-- QRIS dinamis untuk pembayaran pelanggan di POS.
-- Order ditahan `pending_payment` sampai pembayaran terverifikasi.
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

-- 1. Kanal pembayaran order (dinamis vs manual vs cash/kartu)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_channel text;

COMMENT ON COLUMN orders.payment_channel IS 'dynamic_qris | manual_qris | NULL (cash/kartu)';

-- 2. Payment intent per order (QRIS dinamis via Vessel)
CREATE TABLE IF NOT EXISTS payment_intents (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id               uuid REFERENCES outlets(id) ON DELETE SET NULL,
  order_id                uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider                text NOT NULL DEFAULT 'vessel',
  provider_transaction_id text UNIQUE,
  invoice_number          text UNIQUE NOT NULL,
  amount                  numeric(12,2) NOT NULL DEFAULT 0,
  qr_string               text,
  status                  text NOT NULL DEFAULT 'pending',
  expired_at              timestamptz,
  paid_at                 timestamptz,
  raw_payload             jsonb,
  created_by              uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_order
  ON payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_company
  ON payment_intents(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status
  ON payment_intents(status);

DROP TRIGGER IF EXISTS trg_payment_intents_updated_at ON payment_intents;
CREATE TRIGGER trg_payment_intents_updated_at
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. RLS: authenticated-only (superadmin); service role bypass.
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_payment_intents" ON payment_intents;
CREATE POLICY "allow_authenticated_payment_intents"
  ON payment_intents FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE payment_intents IS 'QRIS dinamis per order (v6.1 M2). Finalisasi idempotent via atomic claim status=pending.';

COMMIT;
