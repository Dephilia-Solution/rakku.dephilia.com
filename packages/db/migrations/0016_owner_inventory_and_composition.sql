-- Owner inventory writes retain the actual actor without impersonating a POS user.
ALTER TABLE public.stock_movements
  ADD COLUMN created_by_owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL,
  ADD CONSTRAINT stock_movement_one_actor CHECK (num_nonnulls(created_by, created_by_owner_id) <= 1);
ALTER TABLE public.ingredient_purchases
  ADD COLUMN created_by_owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL,
  ADD CONSTRAINT ingredient_purchase_one_actor CHECK (num_nonnulls(created_by, created_by_owner_id) <= 1);

CREATE FUNCTION app_private.assert_inventory_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.created_by_owner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies c WHERE c.id = NEW.company_id AND c.owner_id = NEW.created_by_owner_id
  ) THEN RAISE EXCEPTION 'INVENTORY_OWNER_MISMATCH'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.assert_inventory_owner() FROM PUBLIC;
CREATE TRIGGER inventory_owner BEFORE INSERT OR UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION app_private.assert_inventory_owner();
CREATE TRIGGER inventory_owner BEFORE INSERT OR UPDATE ON public.ingredient_purchases
  FOR EACH ROW EXECUTE FUNCTION app_private.assert_inventory_owner();

-- Keep stock, cost and recipe quantities in one unit even when a POS client edits metadata.
CREATE FUNCTION app_private.assert_ingredient_unit() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.unit IS DISTINCT FROM OLD.unit AND (
    OLD.stock_quantity <> 0
    OR EXISTS (SELECT 1 FROM public.product_recipes r WHERE r.ingredient_id=OLD.id)
    OR EXISTS (SELECT 1 FROM public.stock_movements m WHERE m.ingredient_id=OLD.id)
    OR EXISTS (SELECT 1 FROM public.ingredient_purchase_items p WHERE p.ingredient_id=OLD.id)
  ) THEN RAISE EXCEPTION 'INGREDIENT_UNIT_IN_USE'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.assert_ingredient_unit() FROM PUBLIC;
CREATE TRIGGER ingredient_unit BEFORE UPDATE OF unit ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION app_private.assert_ingredient_unit();

CREATE INDEX stock_movements_outlet_history_idx ON public.stock_movements(company_id, outlet_id, created_at DESC, id DESC);
CREATE INDEX stock_movements_ingredient_history_idx ON public.stock_movements(ingredient_id, created_at DESC, id DESC);
CREATE INDEX ingredient_purchases_outlet_history_idx ON public.ingredient_purchases(company_id, outlet_id, purchase_date DESC, id DESC);
CREATE INDEX stock_movements_owner_idx ON public.stock_movements(created_by_owner_id) WHERE created_by_owner_id IS NOT NULL;
CREATE INDEX ingredient_purchases_owner_idx ON public.ingredient_purchases(created_by_owner_id) WHERE created_by_owner_id IS NOT NULL;

ALTER TABLE app_private.import_batches DROP CONSTRAINT import_batches_domain_check;
ALTER TABLE app_private.import_batches ADD CONSTRAINT import_batches_domain_check
  CHECK (domain IN ('products', 'employees', 'ingredients'));
