CREATE FUNCTION app_private.platform() RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT coalesce(current_setting('app.scope',true) = 'platform', false) $$;
CREATE FUNCTION app_private.company_id() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.company_id',true),'')::uuid $$;
CREATE FUNCTION app_private.outlet_id() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.outlet_id',true),'')::uuid $$;

-- Trusted server clients set transaction-local scope. No DB credentials are
-- distributed to users and no public Data API is enabled.
DO $$
DECLARE tbl text; rule text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['owners','plans','companies','outlets','menus','roles','role_menu_access',
    'users','user_outlets','categories','products','modifiers','pricing_options','pricing_tiers',
    'product_tier_prices','modifier_tier_prices','orders','order_items','split_payments','taxes',
    'product_discounts','order_discounts','ingredients','product_recipes','stock_movements',
    'ingredient_purchases','ingredient_purchase_items','expenses','dining_tables','auth_audit_logs',
    'subscriptions','subscription_invoices','notification_logs','merchant_balances','balance_transactions',
    'payment_intents','merchant_bank_accounts','withdrawals','settlement_reports']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY platform_access ON public.%I FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()))', tbl);
    rule := NULL;
    IF tbl IN ('categories','products','pricing_options','pricing_tiers','orders','taxes','product_discounts',
      'order_discounts','ingredients','stock_movements','ingredient_purchases','expenses','dining_tables') THEN
      rule := 'company_id = (SELECT app_private.company_id()) AND outlet_id = (SELECT app_private.outlet_id())';
    ELSIF tbl IN ('roles','users') THEN
      rule := 'company_id = (SELECT app_private.company_id())';
    ELSIF tbl = 'modifiers' THEN
      rule := 'EXISTS (SELECT 1 FROM public.products p WHERE p.id = modifiers.product_id)';
    ELSIF tbl = 'order_items' THEN
      rule := 'EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id)';
    ELSIF tbl = 'split_payments' THEN
      rule := 'EXISTS (SELECT 1 FROM public.orders o WHERE o.id = split_payments.order_id)';
    ELSIF tbl = 'product_tier_prices' THEN
      rule := 'EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_tier_prices.product_id) AND EXISTS (SELECT 1 FROM public.pricing_tiers t WHERE t.id = product_tier_prices.tier_id)';
    ELSIF tbl = 'modifier_tier_prices' THEN
      rule := 'EXISTS (SELECT 1 FROM public.modifiers m WHERE m.id = modifier_tier_prices.modifier_id) AND EXISTS (SELECT 1 FROM public.pricing_tiers t WHERE t.id = modifier_tier_prices.tier_id)';
    ELSIF tbl = 'product_recipes' THEN
      rule := 'EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_recipes.product_id) AND EXISTS (SELECT 1 FROM public.ingredients i WHERE i.id = product_recipes.ingredient_id)';
    ELSIF tbl = 'ingredient_purchase_items' THEN
      rule := 'EXISTS (SELECT 1 FROM public.ingredient_purchases p WHERE p.id = ingredient_purchase_items.purchase_id) AND EXISTS (SELECT 1 FROM public.ingredients i WHERE i.id = ingredient_purchase_items.ingredient_id)';
    ELSIF tbl = 'role_menu_access' THEN
      rule := 'EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_menu_access.role_id)';
    ELSIF tbl = 'payment_intents' THEN
      rule := 'company_id = (SELECT app_private.company_id()) AND outlet_id = (SELECT app_private.outlet_id())';
    END IF;
    IF rule IS NOT NULL THEN
      IF tbl IN ('roles','users','role_menu_access') THEN
        EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT USING (%s)', tbl, rule);
      ELSE
        EXECUTE format('CREATE POLICY tenant_access ON public.%I FOR ALL USING (%s) WITH CHECK (%s)', tbl, rule, rule);
      END IF;
    END IF;
  END LOOP;
END $$;
CREATE POLICY tenant_read ON public.plans FOR SELECT USING (current_setting('app.scope',true) = 'tenant');
CREATE POLICY tenant_read ON public.menus FOR SELECT USING (current_setting('app.scope',true) = 'tenant');
CREATE POLICY tenant_read ON public.companies FOR SELECT USING (id = (SELECT app_private.company_id()));
CREATE POLICY tenant_read ON public.outlets FOR SELECT USING (company_id = (SELECT app_private.company_id()));
CREATE POLICY tenant_read ON public.user_outlets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_outlets.user_id)
  AND EXISTS (SELECT 1 FROM public.outlets o WHERE o.id = user_outlets.outlet_id)
);

-- Deferrable constraints support one-transaction data-only restores without
-- disabling triggers or granting superuser privileges.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conrelid::regclass AS tbl, conname FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED', r.tbl, r.conname);
  END LOOP;
END $$;
