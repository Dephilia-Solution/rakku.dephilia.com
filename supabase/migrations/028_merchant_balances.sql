-- ============================================================
-- Rakku POS — Migration 028: Merchant Balances & Ledger (v6.1 M1)
-- ============================================================
-- Saldo merchant dari pembayaran QRIS dinamis (v6.1).
-- `balance_transactions` = ledger append-only (sumber kebenaran),
-- `merchant_balances` = cache saldo per company.
-- Semua mutasi lewat RPC `apply_balance_transaction` (atomic + idempotent).
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

-- 1. Cache saldo per company
CREATE TABLE IF NOT EXISTS merchant_balances (
  company_id        uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  available_balance numeric(14,2) NOT NULL DEFAULT 0,
  pending_balance   numeric(14,2) NOT NULL DEFAULT 0,
  total_credited    numeric(14,2) NOT NULL DEFAULT 0,
  total_fees        numeric(14,2) NOT NULL DEFAULT 0,
  total_withdrawn   numeric(14,2) NOT NULL DEFAULT 0,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 2. Ledger append-only
CREATE TABLE IF NOT EXISTS balance_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id      uuid REFERENCES outlets(id) ON DELETE SET NULL,
  type           text NOT NULL,
  amount         numeric(14,2) NOT NULL DEFAULT 0,   -- delta available_balance (signed)
  pending_delta  numeric(14,2) NOT NULL DEFAULT 0,   -- delta pending_balance (signed)
  fee_amount     numeric(14,2) NOT NULL DEFAULT 0,   -- info MDR (sale_credit)
  balance_after  numeric(14,2) NOT NULL DEFAULT 0,   -- snapshot available setelah transaksi
  reference_type text,
  reference_id   uuid,
  note           text,
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reference_type, reference_id, type)
);

CREATE INDEX IF NOT EXISTS idx_balance_transactions_company
  ON balance_transactions(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_type
  ON balance_transactions(company_id, type);

DROP TRIGGER IF EXISTS trg_merchant_balances_updated_at ON merchant_balances;
CREATE TRIGGER trg_merchant_balances_updated_at
  BEFORE UPDATE ON merchant_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. RPC atomic + idempotent untuk semua mutasi saldo
CREATE OR REPLACE FUNCTION apply_balance_transaction(
  p_company_id     uuid,
  p_outlet_id      uuid,
  p_type           text,
  p_amount         numeric,
  p_pending_delta  numeric,
  p_fee_amount     numeric,
  p_reference_type text,
  p_reference_id   uuid,
  p_note           text,
  p_created_by     text
) RETURNS TABLE (tx_id uuid, new_available numeric, inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id         uuid;
  v_available     numeric(14,2);
  v_pending       numeric(14,2);
  v_new_available numeric(14,2);
  v_new_pending   numeric(14,2);
BEGIN
  -- Idempotency: satu referensi + tipe hanya boleh tercatat sekali
  IF p_reference_type IS NOT NULL AND p_reference_id IS NOT NULL THEN
    SELECT bt.id INTO v_tx_id
      FROM balance_transactions bt
     WHERE bt.reference_type = p_reference_type
       AND bt.reference_id = p_reference_id
       AND bt.type = p_type
     LIMIT 1;

    IF v_tx_id IS NOT NULL THEN
      SELECT mb.available_balance INTO v_available
        FROM merchant_balances mb
       WHERE mb.company_id = p_company_id;
      RETURN QUERY SELECT v_tx_id, COALESCE(v_available, 0)::numeric, false;
      RETURN;
    END IF;
  END IF;

  -- Pastikan baris saldo ada
  INSERT INTO merchant_balances (company_id) VALUES (p_company_id)
  ON CONFLICT (company_id) DO NOTHING;

  -- Lock baris saldo (single-writer per company)
  SELECT mb.available_balance, mb.pending_balance
    INTO v_available, v_pending
    FROM merchant_balances mb
   WHERE mb.company_id = p_company_id
   FOR UPDATE;

  v_new_available := v_available + COALESCE(p_amount, 0);
  v_new_pending := v_pending + COALESCE(p_pending_delta, 0);

  IF v_new_available < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  IF v_new_pending < 0 THEN
    RAISE EXCEPTION 'INVALID_PENDING';
  END IF;

  INSERT INTO balance_transactions (
    company_id, outlet_id, type, amount, pending_delta, fee_amount,
    balance_after, reference_type, reference_id, note, created_by
  ) VALUES (
    p_company_id, p_outlet_id, p_type,
    COALESCE(p_amount, 0), COALESCE(p_pending_delta, 0), COALESCE(p_fee_amount, 0),
    v_new_available, p_reference_type, p_reference_id, p_note, p_created_by
  )
  RETURNING id INTO v_tx_id;

  UPDATE merchant_balances mb SET
    available_balance = v_new_available,
    pending_balance = v_new_pending,
    total_credited = mb.total_credited + CASE
      WHEN p_type = 'sale_credit' THEN COALESCE(p_amount, 0) + COALESCE(p_fee_amount, 0)
      ELSE 0 END,
    total_fees = mb.total_fees + CASE
      WHEN p_type = 'sale_credit' THEN COALESCE(p_fee_amount, 0)
      ELSE 0 END,
    total_withdrawn = mb.total_withdrawn + CASE
      WHEN p_type = 'withdrawal' THEN -1 * COALESCE(p_pending_delta, 0)
      ELSE 0 END,
    updated_at = now()
  WHERE mb.company_id = p_company_id;

  RETURN QUERY SELECT v_tx_id, v_new_available, true;
END;
$$;

-- Hanya service role (API server) yang boleh memanggil RPC ini.
REVOKE ALL ON FUNCTION apply_balance_transaction(
  uuid, uuid, text, numeric, numeric, numeric, text, uuid, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_balance_transaction(
  uuid, uuid, text, numeric, numeric, numeric, text, uuid, text, text
) TO service_role;

-- 4. RLS: authenticated-only (superadmin read); service role bypass.
ALTER TABLE merchant_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_merchant_balances" ON merchant_balances;
CREATE POLICY "allow_authenticated_merchant_balances"
  ON merchant_balances FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_authenticated_balance_transactions" ON balance_transactions;
CREATE POLICY "allow_authenticated_balance_transactions"
  ON balance_transactions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE merchant_balances IS 'Cache saldo merchant (v6.1). Ledger balance_transactions = sumber kebenaran.';
COMMENT ON TABLE balance_transactions IS 'Ledger saldo merchant, append-only, idempotent via UNIQUE(reference_type, reference_id, type).';
COMMENT ON FUNCTION apply_balance_transaction IS 'Mutasi saldo atomic + idempotent. Hanya service_role.';

COMMIT;
