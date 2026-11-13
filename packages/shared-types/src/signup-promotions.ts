import { jakartaDateKey } from "./reporting";

export interface PublicSignupPromotion {
  id: string;
  name: string;
  plan_name: string;
  duration_months: number;
  starts_on: string;
  ends_on: string;
  terms: string;
}

export interface SignupPromotion extends PublicSignupPromotion {
  plan_id: string;
  is_active: boolean;
  revision: string;
  created_at: string;
  updated_at: string;
  recipient_count: number;
}

export interface SignupPromotionInput {
  name: string;
  plan_id: string;
  duration_months: number;
  starts_on: string;
  ends_on: string;
  terms: string;
  is_active: boolean;
}

export interface SignupPromotionRecipient {
  owner_id: string;
  owner_name: string;
  company_id: string | null;
  company_name: string | null;
  benefit_starts_at: string;
  benefit_ends_at: string;
  applied_at: string | null;
  plan_name: string;
  duration_months: number;
}

export interface SignupPromotionAudit {
  id: string;
  actor_id: string;
  created_at: string;
  before_config: unknown;
  after_config: unknown;
}

export function isPromotionDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && value >= "2000-01-01" && value <= "2100-12-31"
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Three months means calendar months in WIB, clamping to the target month end. */
export function addSignupCalendarMonths(value: Date | string, months: number): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.getTime()) || !Number.isInteger(months) || months < 1 || months > 24) throw new Error("Tanggal/durasi promo tidak valid");
  const offset = 7 * 3600_000;
  const local = new Date(instant.getTime() + offset);
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + months);
  const last = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(day, last));
  return new Date(local.getTime() - offset).toISOString();
}

export function isSignupPromotionOpen(promotion: Pick<PublicSignupPromotion, "starts_on" | "ends_on">, now: Date | string = new Date()): boolean {
  const instant = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(instant.getTime())) return false;
  const date = jakartaDateKey(instant);
  return date >= promotion.starts_on && date <= promotion.ends_on;
}

export function formatPromotionDate(value: string): string {
  return new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
}
