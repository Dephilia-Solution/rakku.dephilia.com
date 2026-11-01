ALTER TABLE public.orders ADD COLUMN checkout_key uuid;
ALTER TABLE public.orders ADD COLUMN checkout_hash text;
ALTER TABLE public.orders ADD COLUMN rounding_amount numeric(10,2) NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX orders_checkout_key_idx ON public.orders(company_id,outlet_id,checkout_key) WHERE checkout_key IS NOT NULL;
ALTER TABLE public.order_items ADD COLUMN modifier_ids jsonb NOT NULL DEFAULT '[]';
-- NOT VALID preserves legacy records for a separate reconciliation; new writes are checked now.
ALTER TABLE public.order_items ADD CONSTRAINT positive_order_quantity CHECK (quantity IS NOT NULL AND quantity>0) NOT VALID;
ALTER TABLE public.order_items ADD CONSTRAINT nonnegative_order_item CHECK (unit_price>=0 AND subtotal>=0) NOT VALID;
ALTER TABLE public.orders ADD CONSTRAINT nonnegative_order_totals CHECK (subtotal>=0 AND tax_amount>=0 AND total_price>=0 AND discount_amount>=0) NOT VALID;
ALTER TABLE public.split_payments ADD CONSTRAINT positive_split_amount CHECK (amount>0) NOT VALID;
CREATE FUNCTION app_private.protect_paid_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='completed' OR OLD.payment_status IN ('paid','refunded') THEN
    RAISE EXCEPTION 'PAID_ORDER_CANNOT_BE_DELETED';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER protect_paid_order BEFORE DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION app_private.protect_paid_order();
