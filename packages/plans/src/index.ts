import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Plan,
  PlanCheck,
  PlanFeatureKey,
  PlanLimitKey,
  SubscriptionStatus,
  UsageSummary,
} from "@rakku/shared-types";

export const GRACE_DAYS = 7;
export const TRANSACTION_GRACE_RATIO = 0.1;
export const TRANSACTION_GRACE_DAYS = 3;

export const PLAN_FEATURES: PlanFeatureKey[] = [
  "multi_outlet",
  "custom_roles",
  "profit_loss",
  "email_reports",
  "inventory_advanced",
  "remove_qr_branding",
  "audit_log",
  "priority_support",
];

export const PLAN_LIMIT_KEYS: PlanLimitKey[] = [
  "outlets",
  "employees",
  "products",
  "ingredients",
  "transactions",
];

const FALLBACK_FREE_PLAN: Plan = {
  id: "",
  slug: "free",
  name: "Free",
  description: null,
  price_monthly: 0,
  price_yearly: 0,
  max_outlets: 1,
  max_employees: 2,
  max_products: 30,
  max_ingredients: 10,
  max_transactions_month: 500,
  report_history_days: 30,
  email_reports_month: 5,
  storage_mb: 50,
  features: {},
  is_active: true,
  sort_order: 1,
  created_at: "",
  updated_at: "",
};

const LIMIT_COLUMN: Record<PlanLimitKey, keyof Plan> = {
  outlets: "max_outlets",
  employees: "max_employees",
  products: "max_products",
  ingredients: "max_ingredients",
  transactions: "max_transactions_month",
};

const LIMIT_TABLE: Record<PlanLimitKey, string> = {
  outlets: "outlets",
  employees: "users",
  products: "products",
  ingredients: "ingredients",
  transactions: "orders",
};

const LIMIT_LABEL: Record<PlanLimitKey, string> = {
  outlets: "outlet",
  employees: "karyawan",
  products: "produk",
  ingredients: "bahan baku",
  transactions: "transaksi bulan ini",
};

interface CompanyPlanRow {
  plan_id: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
  billing_cycle: string | null;
  plans: unknown;
}

export interface ResolvedPlan {
  plan: Plan;
  raw_plan: Plan | null;
  status: SubscriptionStatus;
  is_trial: boolean;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
  grace_ends_at: string | null;
  effective_slug: string;
}

function normalizePlan(value: unknown): Plan | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "object") return null;
  return raw as Plan;
}

function fallbackResolved(): ResolvedPlan {
  return {
    plan: FALLBACK_FREE_PLAN,
    raw_plan: null,
    status: "active",
    is_trial: false,
    trial_ends_at: null,
    plan_expires_at: null,
    grace_ends_at: null,
    effective_slug: "free",
  };
}

export async function getCompanyPlan(
  supabase: SupabaseClient,
  companyId: string
): Promise<ResolvedPlan> {
  const { data, error } = await supabase
    .from("companies")
    .select(
      "plan_id, subscription_status, trial_ends_at, plan_expires_at, billing_cycle, plans(*)"
    )
    .eq("id", companyId)
    .maybeSingle();

  if (error || !data) return fallbackResolved();

  const row = data as unknown as CompanyPlanRow;
  const rawPlan = normalizePlan(row.plans);
  const status = (row.subscription_status as SubscriptionStatus) || "active";
  const now = Date.now();

  let plan = rawPlan ?? FALLBACK_FREE_PLAN;
  let effectiveStatus: SubscriptionStatus = status;
  let graceEndsAt: string | null = null;

  if (status === "trial") {
    const trialEnd = row.trial_ends_at
      ? new Date(row.trial_ends_at).getTime()
      : null;
    if (trialEnd !== null && trialEnd <= now) {
      plan = FALLBACK_FREE_PLAN;
      effectiveStatus = "expired";
    }
  } else if (
    status === "active" ||
    status === "cancelled" ||
    status === "grace"
  ) {
    const expires = row.plan_expires_at
      ? new Date(row.plan_expires_at).getTime()
      : null;
    if (expires !== null && expires <= now) {
      const graceEnd = expires + GRACE_DAYS * 24 * 60 * 60 * 1000;
      if (now < graceEnd) {
        effectiveStatus = "grace";
        graceEndsAt = new Date(graceEnd).toISOString();
      } else {
        plan = FALLBACK_FREE_PLAN;
        effectiveStatus = "expired";
      }
    }
  } else if (status === "expired") {
    plan = FALLBACK_FREE_PLAN;
  }

  return {
    plan,
    raw_plan: rawPlan,
    status: effectiveStatus,
    is_trial: effectiveStatus === "trial",
    trial_ends_at: row.trial_ends_at,
    plan_expires_at: row.plan_expires_at,
    grace_ends_at: graceEndsAt,
    effective_slug: plan.slug,
  };
}

export function hasFeature(plan: Plan, feature: PlanFeatureKey): boolean {
  return Boolean(plan.features?.[feature]);
}

function startOfMonth(): Date {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function countMonthlyTransactions(
  supabase: SupabaseClient,
  companyId: string
): Promise<number> {
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "completed")
    .gte("created_at", startOfMonth().toISOString());

  return count ?? 0;
}

/**
 * Waktu mulai grace transaksi = created_at order ke-`max` bulan ini
 * (order yang membuat kuota penuh). Dipakai untuk batas grace 3 hari.
 */
async function getTransactionGraceStartedAt(
  supabase: SupabaseClient,
  companyId: string,
  max: number
): Promise<Date | null> {
  const index = Math.max(0, max - 1);

  const { data } = await supabase
    .from("orders")
    .select("created_at")
    .eq("company_id", companyId)
    .eq("status", "completed")
    .gte("created_at", startOfMonth().toISOString())
    .order("created_at", { ascending: true })
    .range(index, index)
    .maybeSingle();

  if (!data?.created_at) return null;
  return new Date(data.created_at as string);
}

function getTransactionGraceEndsAt(
  graceStartedAt: Date | null
): Date | null {
  if (!graceStartedAt) return null;
  return new Date(
    graceStartedAt.getTime() + TRANSACTION_GRACE_DAYS * 24 * 60 * 60 * 1000
  );
}

async function countResource(
  supabase: SupabaseClient,
  companyId: string,
  key: PlanLimitKey
): Promise<number> {
  if (key === "transactions") {
    return countMonthlyTransactions(supabase, companyId);
  }

  const { count } = await supabase
    .from(LIMIT_TABLE[key])
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  return count ?? 0;
}

export async function checkLimit(
  supabase: SupabaseClient,
  companyId: string,
  key: PlanLimitKey,
  delta = 1
): Promise<PlanCheck> {
  const resolved = await getCompanyPlan(supabase, companyId);
  const plan = resolved.plan;
  const max = Number(plan[LIMIT_COLUMN[key]] ?? 0);

  if (max < 0) return { allowed: true };

  const current = await countResource(supabase, companyId, key);

  if (key === "transactions") {
    const warning = current >= Math.floor(max * 0.8);

    if (current + delta <= max) {
      return { allowed: true, current, max, warning };
    }

    // Grace: tambahan 10% ATAU 3 hari (mana yang lebih dulu habis).
    const graceExtra = Math.floor(max * TRANSACTION_GRACE_RATIO);
    const withinAmount = current + delta <= max + graceExtra;
    const graceStartedAt = await getTransactionGraceStartedAt(
      supabase,
      companyId,
      max
    );
    const graceEndsAt = getTransactionGraceEndsAt(graceStartedAt);
    const withinTime =
      graceEndsAt !== null && Date.now() <= graceEndsAt.getTime();

    if (withinAmount && withinTime && graceEndsAt) {
      return {
        allowed: true,
        current,
        max,
        warning: true,
        grace: true,
        grace_ends_at: graceEndsAt.toISOString(),
      };
    }

    return {
      allowed: false,
      code: "PLAN_LIMIT",
      error: `Kuota ${max} transaksi bulan ini sudah habis. Upgrade paket untuk lanjut berjualan.`,
      feature: key,
      current,
      max,
      upgrade_url: "/subscription",
    };
  }

  if (current + delta <= max) {
    return { allowed: true, current, max };
  }

  return {
    allowed: false,
    code: "PLAN_LIMIT",
    error: `Paket ${plan.name} hanya mendukung ${max} ${LIMIT_LABEL[key]}. Upgrade untuk menambah ${LIMIT_LABEL[key]}.`,
    feature: key,
    current,
    max,
    upgrade_url: "/subscription",
  };
}

export async function checkFeature(
  supabase: SupabaseClient,
  companyId: string,
  feature: PlanFeatureKey
): Promise<PlanCheck> {
  const resolved = await getCompanyPlan(supabase, companyId);
  if (hasFeature(resolved.plan, feature)) return { allowed: true };

  return {
    allowed: false,
    code: "PLAN_LIMIT",
    error: "Fitur ini tersedia mulai paket Pro. Upgrade untuk mengaktifkan.",
    feature,
    upgrade_url: "/subscription",
  };
}

export async function getUsageSummary(
  supabase: SupabaseClient,
  companyId: string
): Promise<UsageSummary> {
  const resolved = await getCompanyPlan(supabase, companyId);
  const counts = await Promise.all(
    PLAN_LIMIT_KEYS.map((key) => countResource(supabase, companyId, key))
  );

  const usage = {} as Record<PlanLimitKey, number>;
  const limits = {} as Record<PlanLimitKey, number>;

  PLAN_LIMIT_KEYS.forEach((key, index) => {
    usage[key] = counts[index];
    limits[key] = Number(resolved.plan[LIMIT_COLUMN[key]] ?? 0);
  });

  let transactionGraceEndsAt: string | null = null;
  if (
    limits.transactions > 0 &&
    usage.transactions >= limits.transactions
  ) {
    const started = await getTransactionGraceStartedAt(
      supabase,
      companyId,
      limits.transactions
    );
    transactionGraceEndsAt =
      getTransactionGraceEndsAt(started)?.toISOString() ?? null;
  }

  return {
    plan: resolved.plan,
    status: resolved.status,
    is_trial: resolved.is_trial,
    trial_ends_at: resolved.trial_ends_at,
    plan_expires_at: resolved.plan_expires_at,
    grace_ends_at: resolved.grace_ends_at,
    transaction_grace_ends_at: transactionGraceEndsAt,
    usage,
    limits,
    features: resolved.plan.features ?? {},
  };
}
