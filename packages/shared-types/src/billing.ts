export type PlanSlug = "free" | "pro" | "business";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "grace"
  | "expired"
  | "cancelled";

export type BillingCycle = "monthly" | "yearly";

export type PlanLimitKey =
  | "outlets"
  | "employees"
  | "products"
  | "ingredients"
  | "transactions";

export type PlanFeatureKey =
  | "multi_outlet"
  | "custom_roles"
  | "profit_loss"
  | "email_reports"
  | "inventory_advanced"
  | "remove_qr_branding"
  | "audit_log"
  | "priority_support";

export interface Plan {
  id: string;
  slug: PlanSlug | string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_outlets: number;
  max_employees: number;
  max_products: number;
  max_ingredients: number;
  max_transactions_month: number;
  report_history_days: number;
  email_reports_month: number;
  storage_mb: number;
  features: Partial<Record<PlanFeatureKey, boolean>>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  company_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  started_at: string;
  current_period_start: string;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export type SubscriptionInvoiceStatus =
  | "pending"
  | "success"
  | "expired"
  | "failed"
  | "cancelled";

export interface SubscriptionInvoice {
  id: string;
  company_id: string;
  plan_id: string;
  billing_cycle: BillingCycle;
  invoice_number: string;
  amount: number;
  provider: string;
  provider_transaction_id: string | null;
  qr_string: string | null;
  status: SubscriptionInvoiceStatus;
  expired_at: string | null;
  paid_at: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface UsageSummary {
  plan: Plan;
  status: SubscriptionStatus;
  is_trial: boolean;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
  grace_ends_at: string | null;
  transaction_grace_ends_at: string | null;
  usage: Record<PlanLimitKey, number>;
  limits: Record<PlanLimitKey, number>;
  features: Partial<Record<PlanFeatureKey, boolean>>;
}

export interface PlanCheck {
  allowed: boolean;
  code?: "PLAN_LIMIT";
  error?: string;
  feature?: string;
  current?: number;
  max?: number;
  warning?: boolean;
  grace?: boolean;
  grace_ends_at?: string;
  upgrade_url?: string;
}
