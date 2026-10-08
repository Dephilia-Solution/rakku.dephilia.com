-- Invoker functions: caller privileges and tenant policies remain in force.
CREATE OR REPLACE FUNCTION public.apply_balance_transaction(
  p_company_id uuid, p_outlet_id uuid, p_type text, p_amount numeric,
  p_pending_delta numeric, p_fee_amount numeric, p_reference_type text,
  p_reference_id uuid, p_note text, p_created_by text
) RETURNS TABLE (tx_id uuid, new_available numeric, inserted boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE existing uuid; available numeric; pending numeric;
BEGIN
  IF p_type NOT IN ('sale_credit','withdrawal_hold','withdrawal_refund','withdrawal','adjustment','refund','withdrawal_fee')
    OR p_amount IS NULL OR p_pending_delta IS NULL OR p_fee_amount IS NULL OR p_fee_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_BALANCE_MUTATION';
  END IF;
  IF (p_type = 'sale_credit' AND (p_amount < 0 OR p_pending_delta <> 0))
    OR (p_type = 'withdrawal_hold' AND (p_amount >= 0 OR p_pending_delta <> -p_amount))
    OR (p_type = 'withdrawal_refund' AND (p_amount <= 0 OR p_pending_delta <> -p_amount))
    OR (p_type = 'withdrawal' AND (p_amount <> 0 OR p_pending_delta >= 0))
    OR (p_type = 'adjustment' AND (p_pending_delta <> 0 OR nullif(btrim(p_note), '') IS NULL))
    OR (p_type IN ('refund','withdrawal_fee') AND (p_amount > 0 OR p_pending_delta <> 0)) THEN
    RAISE EXCEPTION 'INVALID_BALANCE_MUTATION';
  END IF;
  IF p_outlet_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.outlets WHERE id = p_outlet_id AND company_id = p_company_id
  ) THEN RAISE EXCEPTION 'INVALID_OUTLET'; END IF;
  INSERT INTO public.merchant_balances(company_id) VALUES (p_company_id) ON CONFLICT DO NOTHING;
  SELECT available_balance, pending_balance INTO available, pending
    FROM public.merchant_balances WHERE company_id = p_company_id FOR UPDATE;
  SELECT id INTO existing FROM public.balance_transactions
    WHERE company_id = p_company_id AND reference_type = p_reference_type
    AND reference_id = p_reference_id AND type = p_type;
  IF existing IS NOT NULL THEN
    RETURN QUERY SELECT existing, available, false; RETURN;
  END IF;
  available := available + p_amount; pending := pending + p_pending_delta;
  IF available < 0 THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  IF pending < 0 THEN RAISE EXCEPTION 'INVALID_PENDING'; END IF;
  INSERT INTO public.balance_transactions(company_id,outlet_id,type,amount,pending_delta,fee_amount,
    balance_after,reference_type,reference_id,note,created_by)
    VALUES(p_company_id,p_outlet_id,p_type,p_amount,p_pending_delta,p_fee_amount,available,
      p_reference_type,p_reference_id,p_note,p_created_by) RETURNING id INTO existing;
  UPDATE public.merchant_balances SET available_balance = available, pending_balance = pending,
    total_credited = total_credited + CASE WHEN p_type = 'sale_credit' THEN p_amount + p_fee_amount ELSE 0 END,
    total_fees = total_fees + CASE WHEN p_type = 'sale_credit' THEN p_fee_amount ELSE 0 END,
    total_withdrawn = total_withdrawn + CASE WHEN p_type = 'withdrawal' THEN -p_pending_delta ELSE 0 END
    WHERE company_id = p_company_id;
  RETURN QUERY SELECT existing, available, true;
END $$;
REVOKE ALL ON FUNCTION public.apply_balance_transaction(uuid,uuid,text,numeric,numeric,numeric,text,uuid,text,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.deduct_stock_for_order(
  p_order_id uuid, p_company_id uuid, p_outlet_id uuid, p_created_by uuid DEFAULT NULL
) RETURNS TABLE (deducted boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE ingredient record; delta numeric;
BEGIN
  PERFORM 1 FROM public.orders WHERE id = p_order_id AND company_id = p_company_id
    AND outlet_id = p_outlet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_ORDER_SCOPE'; END IF;
  IF EXISTS (SELECT 1 FROM public.stock_movements WHERE company_id = p_company_id
    AND reference_id = p_order_id AND type = 'sale_deduction') THEN
    RETURN QUERY SELECT false; RETURN;
  END IF;
  FOR ingredient IN SELECT i.id FROM public.ingredients i WHERE i.company_id = p_company_id
    AND i.outlet_id = p_outlet_id AND i.id IN (SELECT r.ingredient_id FROM public.product_recipes r
      JOIN public.order_items oi ON oi.product_id = r.product_id WHERE oi.order_id = p_order_id)
    ORDER BY i.id FOR UPDATE
  LOOP
    SELECT sum(oi.quantity * r.quantity_used) INTO delta FROM public.order_items oi
      JOIN public.product_recipes r ON r.product_id = oi.product_id
      WHERE oi.order_id = p_order_id AND r.ingredient_id = ingredient.id;
    UPDATE public.ingredients SET stock_quantity = stock_quantity - delta WHERE id = ingredient.id;
    INSERT INTO public.stock_movements(company_id,outlet_id,ingredient_id,type,quantity_change,reference_id,created_by)
      VALUES(p_company_id,p_outlet_id,ingredient.id,'sale_deduction',-delta,p_order_id,p_created_by);
  END LOOP;
  RETURN QUERY SELECT true;
END $$;
REVOKE ALL ON FUNCTION public.deduct_stock_for_order(uuid,uuid,uuid,uuid) FROM PUBLIC;
