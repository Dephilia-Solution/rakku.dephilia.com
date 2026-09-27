-- ============================================================
-- Rakku POS — Migration 030: Withdrawals (v6.1 M3)
-- ============================================================
-- Rekening bank merchant + pengajuan pencairan saldo.
-- Proses transfer dilakukan manual oleh superadmin.
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

-- 1. Rekening bank payout
CREATE TABLE IF NOT EXISTS merchant_bank_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_name      text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  is_default     boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_bank_accounts_company
  ON merchant_bank_accounts(company_id);

-- 2. Pengajuan pencairan
CREATE TABLE IF NOT EXISTS withdrawals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id    uuid REFERENCES merchant_bank_accounts(id) ON DELETE SET NULL,
  amount             numeric(14,2) NOT NULL,
  fee                numeric(14,2) NOT NULL DEFAULT 0,
  net_amount         numeric(14,2) NOT NULL,
  bank_name          text NOT NULL,
  account_number     text NOT NULL,
  account_holder     text NOT NULL,
  status             text NOT NULL DEFAULT 'requested',
  note               text,
  reject_reason      text,
  transfer_proof_url text,
  reference_number   text,
  requested_by       uuid,
  processed_by       text,
  requested_at       timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_company
  ON withdrawals(company_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status
  ON withdrawals(status, requested_at DESC);

DROP TRIGGER IF EXISTS trg_withdrawals_updated_at ON withdrawals;
CREATE TRIGGER trg_withdrawals_updated_at
  BEFORE UPDATE ON withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. RLS: authenticated-only (superadmin); service role bypass.
ALTER TABLE merchant_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_merchant_bank_accounts" ON merchant_bank_accounts;
CREATE POLICY "allow_authenticated_merchant_bank_accounts"
  ON merchant_bank_accounts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_authenticated_withdrawals" ON withdrawals;
CREATE POLICY "allow_authenticated_withdrawals"
  ON withdrawals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE merchant_bank_accounts IS 'Rekening bank payout merchant (v6.1 M3).';
COMMENT ON TABLE withdrawals IS 'Pengajuan pencairan saldo; transfer manual oleh superadmin (v6.1 M3).';

COMMIT;
