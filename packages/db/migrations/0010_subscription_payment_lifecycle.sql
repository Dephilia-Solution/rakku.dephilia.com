-- Additive subscription payment lifecycle. Run inside the migration runner's
-- transaction after 0009. No historical journal is fabricated here.
ALTER TABLE public.subscription_invoices
  ADD COLUMN attempt_no integer NOT NULL DEFAULT 0,
  ADD COLUMN provider_state text NOT NULL DEFAULT 'not_created',
  ADD COLUMN last_error text,
  ADD COLUMN provider_created_at timestamptz,
  ADD COLUMN terminal_at timestamptz,
  ADD COLUMN applied_at timestamptz,
  ADD COLUMN applied_subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN reconciliation_reason text;

ALTER TABLE public.subscription_invoices
  ADD CONSTRAINT subscription_invoices_provider_state_check
  CHECK (provider_state IN ('not_created','creating','accepted','unknown','terminal')) NOT VALID;
ALTER TABLE public.subscription_invoices
  ADD CONSTRAINT subscription_invoices_status_check
  CHECK (status IN ('pending','unknown','success','expired','failed','cancelled')) NOT VALID;

UPDATE public.subscription_invoices
SET provider_state = CASE
  WHEN status = 'success' OR status IN ('expired','failed','cancelled') THEN 'terminal'
  WHEN provider_transaction_id IS NOT NULL THEN 'accepted'
  ELSE 'not_created'
END
WHERE provider_state = 'not_created';

-- The old application activated exactly when it wrote status=success. Preserve
-- that evidence without inventing subscription IDs or journal rows.
UPDATE public.subscription_invoices
SET applied_at = COALESCE(paid_at, updated_at, created_at)
WHERE status = 'success' AND applied_at IS NULL;

CREATE INDEX subscription_invoices_state_idx
  ON public.subscription_invoices(company_id, plan_id, billing_cycle, status, created_at DESC);

CREATE TABLE app_private.subscription_payment_requests (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  request_hash text NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.subscription_invoices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, request_id)
);
CREATE INDEX subscription_payment_requests_invoice_idx
  ON app_private.subscription_payment_requests(invoice_id);
REVOKE ALL ON app_private.subscription_payment_requests FROM PUBLIC;
ALTER TABLE app_private.subscription_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.subscription_payment_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.subscription_payment_requests
  FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));

CREATE TABLE app_private.subscription_payment_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL UNIQUE REFERENCES public.subscription_invoices(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  billing_cycle text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  provider text NOT NULL,
  provider_transaction_id text,
  applied boolean NOT NULL,
  reason text,
  period_start timestamptz,
  period_end timestamptz,
  subscription_id uuid REFERENCES public.subscriptions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_payment_journal_company_idx
  ON app_private.subscription_payment_journal(company_id, created_at);
REVOKE ALL ON app_private.subscription_payment_journal FROM PUBLIC;
ALTER TABLE app_private.subscription_payment_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.subscription_payment_journal FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_read ON app_private.subscription_payment_journal
  FOR SELECT USING ((SELECT app_private.platform()));
CREATE POLICY platform_append ON app_private.subscription_payment_journal
  FOR INSERT WITH CHECK ((SELECT app_private.platform()));

CREATE TABLE app_private.subscription_reconciliation (
  invoice_id uuid PRIMARY KEY REFERENCES public.subscription_invoices(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  provider_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text
);
CREATE INDEX subscription_reconciliation_company_idx
  ON app_private.subscription_reconciliation(company_id, created_at);
REVOKE ALL ON app_private.subscription_reconciliation FROM PUBLIC;
ALTER TABLE app_private.subscription_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.subscription_reconciliation FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.subscription_reconciliation
  FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));
