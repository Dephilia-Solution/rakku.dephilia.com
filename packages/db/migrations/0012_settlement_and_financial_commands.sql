-- Additive settlement/exception/financial-command foundation. Run inside the
-- migration runner's transaction after 0011.
ALTER TABLE public.merchant_balances
  ADD COLUMN unsettled_balance numeric(14,2) NOT NULL DEFAULT 0 CHECK (unsettled_balance >= 0);
ALTER TABLE public.balance_transactions
  ADD COLUMN unsettled_delta numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN unsettled_after numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN settlement_report_id uuid REFERENCES public.settlement_reports(id) ON DELETE SET NULL,
  ADD COLUMN settled_at timestamptz;

CREATE INDEX balance_transactions_unsettled_idx
  ON public.balance_transactions(company_id, type, created_at)
  WHERE settlement_report_id IS NULL;
CREATE INDEX balance_transactions_settlement_idx
  ON public.balance_transactions(settlement_report_id);

-- Transitional evidence only: receipts created before this migration were
-- already credited to available under the old schema. Mark them transition-
-- settled so a later provider statement cannot release the same funds again.
-- No balance or historical amount is changed here.
UPDATE public.balance_transactions
SET settled_at = created_at
WHERE type = 'sale_credit' AND settled_at IS NULL;

ALTER TABLE public.settlement_reports
  ADD COLUMN status text NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('recorded','matched','discrepancy','reconciled')),
  ADD COLUMN provider_reference text UNIQUE,
  ADD COLUMN settled_at timestamptz,
  ADD COLUMN settled_by text;
CREATE INDEX settlement_reports_status_idx
  ON public.settlement_reports(status, period_end DESC);

ALTER TABLE app_private.payment_reconciliation
  ADD COLUMN status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','investigating','resolved')),
  ADD COLUMN assigned_to text,
  ADD COLUMN resolution_type text,
  ADD COLUMN resolved_by text,
  ADD COLUMN proof_url text,
  ADD COLUMN resolution_reference text;
CREATE INDEX payment_reconciliation_status_idx
  ON app_private.payment_reconciliation(status, created_at);

ALTER TABLE public.withdrawals
  ADD COLUMN request_id text;
CREATE UNIQUE INDEX withdrawals_company_request_idx
  ON public.withdrawals(company_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE app_private.financial_requests (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  command text NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, request_id)
);
REVOKE ALL ON app_private.financial_requests FROM PUBLIC;
ALTER TABLE app_private.financial_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.financial_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.financial_requests
  FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));

DROP FUNCTION IF EXISTS public.apply_balance_transaction(uuid,uuid,text,numeric,numeric,numeric,text,uuid,text,text);
CREATE OR REPLACE FUNCTION public.apply_balance_transaction(
  p_company_id uuid, p_outlet_id uuid, p_type text, p_amount numeric,
  p_pending_delta numeric, p_unsettled_delta numeric, p_fee_amount numeric,
  p_reference_type text, p_reference_id uuid, p_note text, p_created_by text
) RETURNS TABLE (tx_id uuid, new_available numeric, new_unsettled numeric, inserted boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE existing uuid; available numeric; pending numeric; unsettled numeric;
BEGIN
  IF p_type NOT IN ('sale_credit','settlement_credit','withdrawal_hold','withdrawal_refund',
      'withdrawal','adjustment','refund','withdrawal_fee')
    OR p_amount IS NULL OR p_pending_delta IS NULL OR p_unsettled_delta IS NULL
    OR p_fee_amount IS NULL OR p_fee_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_BALANCE_MUTATION';
  END IF;
  IF (p_type = 'sale_credit' AND (p_amount < 0 OR p_pending_delta <> 0 OR p_unsettled_delta <> p_amount))
    OR (p_type = 'settlement_credit' AND (p_amount <= 0 OR p_pending_delta <> 0
      OR p_unsettled_delta <> -p_amount OR p_fee_amount <> 0))
    OR (p_type = 'withdrawal_hold' AND (p_amount >= 0 OR p_pending_delta <> -p_amount OR p_unsettled_delta <> 0))
    OR (p_type = 'withdrawal_refund' AND (p_amount <= 0 OR p_pending_delta <> -p_amount OR p_unsettled_delta <> 0))
    OR (p_type = 'withdrawal' AND (p_amount <> 0 OR p_pending_delta >= 0 OR p_unsettled_delta <> 0))
    OR (p_type = 'adjustment' AND (p_pending_delta <> 0 OR p_unsettled_delta <> 0 OR nullif(btrim(p_note), '') IS NULL))
    OR (p_type IN ('refund','withdrawal_fee') AND (p_amount > 0 OR p_pending_delta <> 0 OR p_unsettled_delta <> 0)) THEN
    RAISE EXCEPTION 'INVALID_BALANCE_MUTATION';
  END IF;
  IF p_outlet_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.outlets WHERE id = p_outlet_id AND company_id = p_company_id
  ) THEN RAISE EXCEPTION 'INVALID_OUTLET'; END IF;
  INSERT INTO public.merchant_balances(company_id) VALUES (p_company_id) ON CONFLICT DO NOTHING;
  SELECT available_balance, pending_balance, unsettled_balance INTO available, pending, unsettled
    FROM public.merchant_balances WHERE company_id = p_company_id FOR UPDATE;
  SELECT id INTO existing FROM public.balance_transactions
    WHERE company_id = p_company_id AND reference_type = p_reference_type
    AND reference_id = p_reference_id AND type = p_type;
  IF existing IS NOT NULL THEN
    RETURN QUERY SELECT existing, available, unsettled, false; RETURN;
  END IF;
  available := available + CASE WHEN p_type = 'sale_credit' THEN 0 ELSE p_amount END;
  pending := pending + p_pending_delta;
  unsettled := unsettled + p_unsettled_delta;
  IF available < 0 THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  IF pending < 0 THEN RAISE EXCEPTION 'INVALID_PENDING'; END IF;
  IF unsettled < 0 THEN RAISE EXCEPTION 'INVALID_UNSETTLED'; END IF;
  INSERT INTO public.balance_transactions(company_id,outlet_id,type,amount,pending_delta,unsettled_delta,
    fee_amount,balance_after,unsettled_after,reference_type,reference_id,note,created_by)
    VALUES(p_company_id,p_outlet_id,p_type,p_amount,p_pending_delta,p_unsettled_delta,p_fee_amount,
      available,unsettled,p_reference_type,p_reference_id,p_note,p_created_by) RETURNING id INTO existing;
  UPDATE public.merchant_balances SET available_balance = available, pending_balance = pending,
    unsettled_balance = unsettled,
    total_credited = total_credited + CASE WHEN p_type = 'sale_credit' THEN p_amount + p_fee_amount ELSE 0 END,
    total_fees = total_fees + CASE WHEN p_type = 'sale_credit' THEN p_fee_amount ELSE 0 END,
    total_withdrawn = total_withdrawn + CASE WHEN p_type = 'withdrawal' THEN -p_pending_delta ELSE 0 END
    WHERE company_id = p_company_id;
  RETURN QUERY SELECT existing, available, unsettled, true;
END $$;
REVOKE ALL ON FUNCTION public.apply_balance_transaction(uuid,uuid,text,numeric,numeric,numeric,numeric,text,uuid,text,text) FROM PUBLIC;
