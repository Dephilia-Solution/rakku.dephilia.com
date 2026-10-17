import type { BillingCycle } from "@rakku/shared-types";

// Source-audited browser values; parity tests read production source without
// loading its DB/provider dependencies.
// packages/ledger/src/index.ts; packages/payments/src/index.ts; orders/draft route.
export const QRIS_MDR_RATE = 0.007;
export const ORDER_QR_EXPIRY_MINUTES = 15;
export const DRAFT_EXPIRY_HOURS = 24;
// apps/owner/src/lib/billing/withdrawals.ts
export const MIN_WITHDRAWAL = 50_000;
export const WITHDRAWAL_FEE = 0;
export const WITHDRAWAL_DAILY_LIMIT = 10_000_000;
export const MAX_PENDING_WITHDRAWALS = 1;
// packages/plans/src/index.ts
export const GRACE_DAYS = 7;
export const TRANSACTION_GRACE_RATIO = 0.1;
export const TRANSACTION_GRACE_DAYS = 3;
// Existing POS menu slugs (scripts/neon-seed.ts, POS db permission map).
export const DEMO_MENUS = ["register", "orders", "reports", "products", "tax-discounts", "ingredients", "tables", "expenses", "purchases"] as const;
export const CASHIER_MENUS = ["register", "orders", "reports", "tax-discounts"] as const;
export const INGREDIENT_UNITS = ["gram", "ml", "pcs", "kg", "liter"] as const;
// apps/{owner,pos}/src/app/api/{owner,admin}/products/upload/route.ts
export const DEMO_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_DEMO_IMAGE_BYTES = 2 * 1024 * 1024;

/** The owner's addPeriod contract, using Jakarta calendar time on every host.
 * JS month/year overflow is intentional (Jan 31 + month can end in March).
 */
export function addSubscriptionPeriod(base: string, cycle: BillingCycle): string {
  const offset = 7 * 3600_000;
  const end = new Date(Date.parse(base) + offset);
  if (cycle === "yearly") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return new Date(end.getTime() - offset).toISOString();
}
