-- Rakku application baseline. Neon Auth owns neon_auth; this migration never
-- creates, drops, or imports identity/session tables in that managed schema.
-- The runtime uses server-mediated SQL; the Neon Data API remains disabled.
SET search_path = public;

CREATE TABLE owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL,
  phone text, name text NOT NULL, password_hash text NOT NULL,
  email_verified_at timestamptz, is_active boolean DEFAULT true,
  last_login_at timestamptz, created_at timestamptz DEFAULT now(),
  reset_token_hash text, reset_token_expires_at timestamptz
);
CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL,
  name text NOT NULL, description text,
  price_monthly numeric(12,2) NOT NULL DEFAULT 0, price_yearly numeric(12,2) NOT NULL DEFAULT 0,
  max_outlets int NOT NULL DEFAULT 1, max_employees int NOT NULL DEFAULT 2,
  max_products int NOT NULL DEFAULT 30, max_ingredients int NOT NULL DEFAULT 10,
  max_transactions_month int NOT NULL DEFAULT 500, report_history_days int NOT NULL DEFAULT 30,
  email_reports_month int NOT NULL DEFAULT 5, storage_mb int NOT NULL DEFAULT 50,
  features jsonb NOT NULL DEFAULT '{}', is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL,
  name text NOT NULL, password_hash text NOT NULL, logo_url text,
  status text DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz DEFAULT now(), failed_login_attempts int DEFAULT 0,
  login_locked_until timestamptz, last_login_attempt timestamptz,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL, slug text UNIQUE,
  plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  subscription_status text NOT NULL DEFAULT 'active', trial_ends_at timestamptz,
  plan_expires_at timestamptz, billing_cycle text NOT NULL DEFAULT 'monthly'
);
CREATE TABLE outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL, address text,
  status text DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now(), qr_menu_slug text,
  UNIQUE (company_id, name)
);
CREATE TABLE menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL,
  name text NOT NULL, icon text, path text NOT NULL, sort_order int DEFAULT 0
);
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL, UNIQUE (company_id, name)
);
CREATE TABLE role_menu_access (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  can_view boolean DEFAULT true, can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false, can_delete boolean DEFAULT false,
  PRIMARY KEY (role_id, menu_id)
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id), name text NOT NULL,
  username text NOT NULL, pin_hash text NOT NULL, avatar_url text,
  all_outlets boolean DEFAULT false,
  status text DEFAULT 'active' CHECK (status IN ('active','inactive')),
  failed_pin_attempts int DEFAULT 0, locked_until timestamptz,
  created_at timestamptz DEFAULT now(), UNIQUE (company_id, username)
);
CREATE TABLE user_outlets (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, outlet_id)
);
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  sort_order int DEFAULT 0, created_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES outlets(id) ON DELETE CASCADE
);
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  price numeric(10,2) DEFAULT 0, category_id uuid REFERENCES categories(id),
  image_url text, image_silo_id text, is_active boolean DEFAULT true,
  description text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES outlets(id) ON DELETE CASCADE
);
CREATE TABLE modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL, group_name text, price_delta numeric(10,2) DEFAULT 0
);
CREATE TABLE pricing_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL, price numeric(10,2) NOT NULL, is_active boolean DEFAULT true,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES outlets(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES outlets(id) ON DELETE CASCADE,
  name text NOT NULL, slug text NOT NULL, is_active boolean DEFAULT true,
  sort_order int DEFAULT 0, created_at timestamptz DEFAULT now(),
  UNIQUE (company_id, outlet_id, slug)
);
CREATE TABLE product_tier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES pricing_tiers(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL, UNIQUE (product_id, tier_id)
);
CREATE TABLE modifier_tier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id uuid NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES pricing_tiers(id) ON DELETE CASCADE,
  price_delta numeric(10,2) NOT NULL DEFAULT 0, UNIQUE (modifier_id, tier_id)
);
CREATE TABLE dining_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id), name text NOT NULL,
  status text NOT NULL DEFAULT 'available', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number serial UNIQUE,
  order_type text CHECK (order_type IN ('dine_in','take_away','delivery','gojek','grab','shopee')),
  payment_method text CHECK (payment_method IN ('cash','qris','card','later')),
  subtotal numeric(10,2) NOT NULL, tax_rate numeric(5,2) DEFAULT 10,
  tax_amount numeric(10,2) NOT NULL, total_price numeric(10,2) NOT NULL,
  note text, customer_name text, created_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES companies(id), outlet_id uuid REFERENCES outlets(id),
  cashier_id uuid REFERENCES users(id), cashier_name text,
  status text DEFAULT 'completed' CHECK (status IN ('draft','pending_payment','completed','cancelled')),
  payment_status text DEFAULT 'paid' CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  reserved_until timestamptz, pricing_option_id uuid REFERENCES pricing_options(id) ON DELETE SET NULL,
  split_bill boolean DEFAULT false, pricing_tier_id uuid REFERENCES pricing_tiers(id) ON DELETE SET NULL,
  discount_amount numeric(10,2) DEFAULT 0, taxes jsonb, discounts jsonb,
  source text NOT NULL DEFAULT 'pos', table_id uuid,
  payment_channel text,
  CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES dining_tables(id)
);
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id), product_name text NOT NULL,
  unit_price numeric(10,2) NOT NULL, quantity int DEFAULT 1,
  modifier_label text, note text, subtotal numeric(10,2) NOT NULL
);
CREATE TABLE split_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL, payment_method text NOT NULL CHECK (payment_method IN ('cash','qris','card')),
  status text DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid')),
  customer_name text, items jsonb NOT NULL DEFAULT '[]', created_at timestamptz DEFAULT now()
);
CREATE TABLE taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id), name text NOT NULL,
  type text NOT NULL CHECK (type IN ('percentage','fixed')), value numeric(10,2) NOT NULL,
  is_active boolean DEFAULT true, sort_order int DEFAULT 0, created_at timestamptz DEFAULT now()
);
CREATE TABLE product_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id), product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL, type text NOT NULL CHECK (type IN ('percentage','fixed')),
  value numeric(10,2) NOT NULL, start_date timestamptz NOT NULL, end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true, created_at timestamptz DEFAULT now()
);
CREATE TABLE order_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id), name text NOT NULL,
  type text NOT NULL CHECK (type IN ('percentage','fixed')), value numeric(10,2) NOT NULL,
  start_date timestamptz NOT NULL, end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true, created_at timestamptz DEFAULT now()
);
CREATE TABLE ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id), name text NOT NULL, unit text NOT NULL,
  stock_quantity numeric(12,2) NOT NULL DEFAULT 0, min_stock_alert numeric(12,2) NOT NULL DEFAULT 0,
  cost_per_unit numeric(12,2) NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id), quantity_used numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (product_id, ingredient_id)
);
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id), ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  type text NOT NULL, quantity_change numeric(12,2) NOT NULL, reference_id uuid, note text,
  created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ingredient_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id), supplier_name text, total_amount numeric(14,2) NOT NULL,
  purchase_date timestamptz NOT NULL DEFAULT now(), note text,
  created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ingredient_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid NOT NULL REFERENCES ingredient_purchases(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id), quantity numeric(12,2) NOT NULL,
  unit_cost numeric(12,2) NOT NULL, subtotal numeric(14,2) NOT NULL
);
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id), category text NOT NULL, amount numeric(12,2) NOT NULL,
  description text, expense_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid, outlet_id uuid, user_id uuid,
  event_type text NOT NULL, success boolean NOT NULL, ip_address text, user_agent text,
  failure_reason text, metadata jsonb, created_at timestamptz DEFAULT now()
);
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT, status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(), current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz, cancelled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT, billing_cycle text NOT NULL DEFAULT 'monthly',
  invoice_number text UNIQUE NOT NULL, amount numeric(12,2) NOT NULL DEFAULT 0,
  provider text NOT NULL DEFAULT 'vessel', provider_transaction_id text UNIQUE,
  qr_string text, status text NOT NULL DEFAULT 'pending', expired_at timestamptz, paid_at timestamptz,
  raw_payload jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL, period text NOT NULL, sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, type, period)
);
CREATE TABLE merchant_balances (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  available_balance numeric(14,2) NOT NULL DEFAULT 0, pending_balance numeric(14,2) NOT NULL DEFAULT 0,
  total_credited numeric(14,2) NOT NULL DEFAULT 0, total_fees numeric(14,2) NOT NULL DEFAULT 0,
  total_withdrawn numeric(14,2) NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES outlets(id) ON DELETE SET NULL, type text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0, pending_delta numeric(14,2) NOT NULL DEFAULT 0,
  fee_amount numeric(14,2) NOT NULL DEFAULT 0, balance_after numeric(14,2) NOT NULL DEFAULT 0,
  reference_type text, reference_id uuid, note text, created_by text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (company_id, reference_type, reference_id, type)
);
CREATE TABLE payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES outlets(id) ON DELETE SET NULL, order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'vessel', provider_transaction_id text UNIQUE, invoice_number text UNIQUE NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0, qr_string text, status text NOT NULL DEFAULT 'pending',
  expired_at timestamptz, paid_at timestamptz, raw_payload jsonb, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE merchant_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_name text NOT NULL, account_number text NOT NULL, account_holder text NOT NULL,
  is_default boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES merchant_bank_accounts(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL, fee numeric(14,2) NOT NULL DEFAULT 0, net_amount numeric(14,2) NOT NULL,
  bank_name text NOT NULL, account_number text NOT NULL, account_holder text NOT NULL,
  status text NOT NULL DEFAULT 'requested', note text, reject_reason text,
  transfer_proof_url text, reference_number text, requested_by uuid, processed_by text,
  requested_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE settlement_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL DEFAULT 'vessel',
  period_start date NOT NULL, period_end date NOT NULL, gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  mdr_amount numeric(14,2) NOT NULL DEFAULT 0, net_amount numeric(14,2) NOT NULL DEFAULT 0,
  expected_net numeric(14,2) NOT NULL DEFAULT 0, difference numeric(14,2) NOT NULL DEFAULT 0,
  note text, created_by text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SCHEMA app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
CREATE TABLE app_private.superadmins (
  auth_subject text PRIMARY KEY, email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  role text NOT NULL DEFAULT 'superadmin' CHECK (role = 'superadmin'),
  activated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.superadmin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL, used_at timestamptz, auth_subject text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_superadmin_invites_email ON app_private.superadmin_invites(email);

-- Index every FK, as well as the hot report/ledger lookup paths.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.conrelid::regclass AS tbl, c.conname, string_agg(quote_ident(a.attname), ', ' ORDER BY k.pos) AS cols
    FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(num,pos)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
    GROUP BY c.conrelid, c.conname
  LOOP
    EXECUTE format('CREATE INDEX %I ON %s (%s)', 'idx_' || r.conname, r.tbl, r.cols);
  END LOOP;
END $$;
CREATE INDEX idx_orders_company_status_created ON orders(company_id, status, created_at);
CREATE INDEX idx_products_company_outlet ON products(company_id, outlet_id);
CREATE INDEX idx_categories_company_outlet ON categories(company_id, outlet_id);
CREATE INDEX idx_balance_transactions_company ON balance_transactions(company_id, created_at DESC);
CREATE INDEX idx_balance_transactions_type ON balance_transactions(company_id, type);
CREATE INDEX idx_withdrawals_company ON withdrawals(company_id, requested_at DESC);
CREATE INDEX idx_withdrawals_status ON withdrawals(status, requested_at DESC);
CREATE INDEX idx_auth_audit_logs_company_created ON auth_audit_logs(company_id, created_at DESC);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_id);
CREATE INDEX idx_payment_intents_company ON payment_intents(company_id, created_at DESC);
CREATE INDEX idx_settlement_reports_period ON settlement_reports(period_end DESC);
CREATE UNIQUE INDEX idx_outlets_qr_menu_slug ON outlets(qr_menu_slug) WHERE qr_menu_slug IS NOT NULL;
CREATE UNIQUE INDEX idx_sale_deduction_once ON stock_movements(company_id, reference_id, ingredient_id)
  WHERE type = 'sale_deduction' AND reference_id IS NOT NULL;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['products','pricing_options','plans','subscription_invoices',
    'merchant_balances','payment_intents','withdrawals','ingredients']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      'trg_' || tbl || '_updated_at', tbl);
  END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
