import { config } from "dotenv";
import postgres from "postgres";
import { normalizeDatabaseUrl } from "@rakku/db";

config({ path: process.env.NEON_ENV_FILE || ".env.local" });
export function connect(variable: string) {
  const value = process.env[variable];
  if (!value) throw new Error(`${variable} is required; see NEON_MIGRATION.md`);
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error(`${variable} must be a PostgreSQL connection string`);
  if (url.hostname.includes("-pooler") || url.port === "6543") throw new Error(`${variable} must be unpooled`);
  return postgres(normalizeDatabaseUrl(value), { max: 1, prepare: false, onnotice: () => {}, connection: { application_name: "rakku-migration", statement_timeout: 0, timezone: "UTC" } });
}
export const APPLICATION_TABLES = ["owners","plans","companies","outlets","menus","roles","role_menu_access",
  "users","user_outlets","categories","products","modifiers","pricing_options","pricing_tiers",
  "product_tier_prices","modifier_tier_prices","dining_tables","orders","order_items","split_payments",
  "taxes","product_discounts","order_discounts","ingredients","product_recipes","stock_movements",
  "ingredient_purchases","ingredient_purchase_items","expenses","auth_audit_logs","subscriptions",
  "subscription_invoices","notification_logs","merchant_balances","balance_transactions","payment_intents",
  "merchant_bank_accounts","withdrawals","settlement_reports"] as const;

export function quoteIdentifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error("Invalid identifier");
  return `"${value}"`;
}
