ALTER TABLE public.orders ADD COLUMN stock_deducted_at timestamptz;
ALTER TABLE public.order_items ADD COLUMN cogs_amount numeric(14,2);
ALTER TABLE public.ingredients ADD CONSTRAINT nonnegative_ingredient_cost CHECK (cost_per_unit>=0 AND min_stock_alert>=0) NOT VALID;
ALTER TABLE public.product_recipes ADD CONSTRAINT positive_recipe_quantity CHECK (quantity_used>0) NOT VALID;
ALTER TABLE public.ingredient_purchase_items ADD CONSTRAINT valid_purchase_amounts CHECK (quantity>0 AND unit_cost>=0 AND subtotal>=0) NOT VALID;

CREATE OR REPLACE FUNCTION public.deduct_stock_for_order(
  p_order_id uuid, p_company_id uuid, p_outlet_id uuid, p_created_by uuid DEFAULT NULL
) RETURNS TABLE (deducted boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE snapshot jsonb; ingredient record; already_at timestamptz;
BEGIN
  SELECT stock_deducted_at INTO already_at FROM public.orders WHERE id=p_order_id
    AND company_id=p_company_id AND outlet_id=p_outlet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_ORDER_SCOPE'; END IF;
  IF already_at IS NOT NULL OR EXISTS (SELECT 1 FROM public.stock_movements
    WHERE company_id=p_company_id AND reference_id=p_order_id AND type='sale_deduction') THEN
    RETURN QUERY SELECT false; RETURN;
  END IF;
  -- Parent locks also prevent a recipe insert from changing the set mid-finalization.
  PERFORM p.id FROM public.products p WHERE p.id IN
    (SELECT oi.product_id FROM public.order_items oi WHERE oi.order_id=p_order_id) ORDER BY p.id FOR UPDATE;
  PERFORM r.id FROM public.product_recipes r JOIN public.ingredients i ON i.id=r.ingredient_id
    WHERE r.product_id IN (SELECT oi.product_id FROM public.order_items oi WHERE oi.order_id=p_order_id)
    ORDER BY i.id,r.id FOR UPDATE OF i,r;
  SELECT coalesce(jsonb_agg(jsonb_build_object('item_id',oi.id,'ingredient_id',i.id,
    'quantity',oi.quantity*r.quantity_used,'cost',oi.quantity*r.quantity_used*i.cost_per_unit)), '[]'::jsonb)
    INTO snapshot FROM public.order_items oi JOIN public.product_recipes r ON r.product_id=oi.product_id
    JOIN public.ingredients i ON i.id=r.ingredient_id
    WHERE oi.order_id=p_order_id AND i.company_id=p_company_id AND i.outlet_id=p_outlet_id;
  UPDATE public.order_items oi SET cogs_amount=coalesce((SELECT round(sum((v->>'cost')::numeric),2)
    FROM jsonb_array_elements(snapshot) v WHERE (v->>'item_id')::uuid=oi.id),0) WHERE oi.order_id=p_order_id;
  FOR ingredient IN SELECT (v->>'ingredient_id')::uuid AS id, sum((v->>'quantity')::numeric) AS quantity
    FROM jsonb_array_elements(snapshot) v GROUP BY 1 ORDER BY 1
  LOOP
    UPDATE public.ingredients SET stock_quantity=stock_quantity-ingredient.quantity WHERE id=ingredient.id;
    INSERT INTO public.stock_movements(company_id,outlet_id,ingredient_id,type,quantity_change,reference_id,created_by)
      VALUES(p_company_id,p_outlet_id,ingredient.id,'sale_deduction',-ingredient.quantity,p_order_id,p_created_by);
  END LOOP;
  UPDATE public.orders SET stock_deducted_at=now() WHERE id=p_order_id;
  RETURN QUERY SELECT true;
END $$;
