-- Additive quota counters and reporting indexes. Run after 0012.
CREATE TABLE app_private.usage_counters (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period text NOT NULL,
  kind text NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, period, kind)
);
REVOKE ALL ON app_private.usage_counters FROM PUBLIC;
ALTER TABLE app_private.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.usage_counters FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.usage_counters
  FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));

CREATE INDEX IF NOT EXISTS orders_company_status_created_idx
  ON public.orders(company_id, status, created_at);
CREATE INDEX IF NOT EXISTS expenses_company_date_idx
  ON public.expenses(company_id, expense_date);
CREATE INDEX IF NOT EXISTS balance_transactions_report_idx
  ON public.balance_transactions(company_id, type, created_at);
