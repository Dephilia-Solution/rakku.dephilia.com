CREATE TABLE app_private.payment_reconciliation (
  intent_id uuid PRIMARY KEY REFERENCES public.payment_intents(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  amount numeric(12,2) NOT NULL CHECK (amount>0),
  reason text NOT NULL,
  provider_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text
);
REVOKE ALL ON app_private.payment_reconciliation FROM PUBLIC;
ALTER TABLE app_private.payment_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.payment_reconciliation FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.payment_reconciliation FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));
