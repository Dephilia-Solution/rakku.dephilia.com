import type {
  Category, Product, Modifier, PricingTier, Ingredient, DiningTable, Order,
  OrderItem, OrderType, StockMovement, IngredientPurchase, IngredientPurchaseItem,
  Expense, Tax, Plan, PlanSlug, BillingCycle, Subscription, SubscriptionStatus, SubscriptionInvoice, PaymentIntent,
  BalanceTransaction, MerchantBalance, MerchantBankAccount, Withdrawal, Role, PricingOption,
} from "@rakku/shared-types";
export type { PublicMenu, PricingTier, Ingredient, DiningTable, StockMovement, Expense, Plan, Subscription, SubscriptionStatus, BillingCycle, SubscriptionInvoice } from "@rakku/shared-types";

export interface DemoCompany { id: string; name: string; code: string; email: string; owner_name: string; password: string; logo_url?: string | null }
export interface DemoOutlet { id: string; name: string; address: string; is_active: boolean; company_id: string }
export interface DemoEmployee { id: string; name: string; username: string; role_id: string; pin: string; is_active: boolean; outlet_ids: string[]; company_id: string; all_outlets?: boolean }
export interface DemoRole extends Role { menus: string[] }
export interface DemoCategory extends Category { company_id: string; outlet_id: string }
export interface DemoModifier extends Modifier { prices: Record<string, number> }
export interface DemoProduct extends Product {
  company_id: string; outlet_id: string; sort_order: number;
  prices: Record<string, number>;
  recipe: { ingredient_id: string; quantity_used: number; id?: string; created_at?: string }[];
  modifiers: DemoModifier[];
}
export interface DemoDiscount {
  id: string; company_id: string; outlet_id: string; product_id: string | null;
  name: string; type: "percentage" | "fixed"; value: number; start_date: string;
  end_date: string; is_active: boolean; created_at: string;
}
export type DemoPaymentMethod = "cash" | "card" | "qris_manual" | "qris";
export interface DemoCustomModifier { id: string; product_id: string; name: string; price_delta: number; group_name: string | null }
export interface DemoOrderItem extends OrderItem { modifier_ids?: string[]; custom_modifiers?: DemoCustomModifier[]; cart_item_id?: string }
export interface DemoSplit { method: Exclude<DemoPaymentMethod, "qris">; amount: number; customer_name?: string | null; items?: { cart_item_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number }[] }
export interface DemoOrder extends Omit<Order, "payment_method"> {
  company_id: string; outlet_id: string; payment_method: DemoPaymentMethod | "later";
  cashier_id: string | null;
  tier_id: string; total: number; items: DemoOrderItem[];
  amount_paid: number; change: number; splits: DemoSplit[]; completed_at: string | null;
}
export interface DemoPurchase extends IngredientPurchase { items: IngredientPurchaseItem[] }
export type DemoNotificationType = "withdrawal_requested" | "withdrawal_processing" | "withdrawal_completed" | "withdrawal_rejected" | "subscription_success";
interface DemoOutboxBase { id: string; to: string; subject: string; body: string; status: "simulated"; created_at: string }
export interface DemoReportEmail extends DemoOutboxBase { kind: "report"; report: DemoReport; notification_type: null; reference_id: null }
export interface DemoSystemEmail extends DemoOutboxBase { kind: "system"; report: null; notification_type: DemoNotificationType; reference_id: string }
export type DemoOutbox = DemoReportEmail | DemoSystemEmail;
export interface DemoSession { mode: "owner" | "pos"; outlet_id: string; employee_id: string | null; authenticated: boolean; company_verified?: boolean }
export interface DemoReport {
  revenue: number; cogs: number; expenses: number; grossProfit: number; netProfit: number; orders: number;
  subtotal: number; tax: number; discounts: number; averageOrder: number;
  from: string; to: string; outlet_id: string | null;
  daily: { date: string; revenue: number; cogs: number; expenses: number; orders: number }[];
  products: { product_id: string; name: string; quantity: number; revenue: number; cogs: number }[];
}
export interface DemoState {
  generation: string; company: DemoCompany; outlets: DemoOutlet[]; employees: DemoEmployee[];
  roles: DemoRole[]; categories: DemoCategory[]; tiers: PricingTier[]; products: DemoProduct[];
  ingredients: Ingredient[]; tables: DiningTable[]; orders: DemoOrder[]; movements: StockMovement[];
  purchases: DemoPurchase[]; expenses: Expense[]; taxes: Tax[]; discounts: DemoDiscount[];
  payments: PaymentIntent[]; ledger: BalanceTransaction[]; balance: MerchantBalance | null;
  withdrawals: Withdrawal[]; banks: MerchantBankAccount[]; invoices: SubscriptionInvoice[];
  outbox: DemoOutbox[]; plan: PlanSlug; plans: Plan[]; now: string; session: DemoSession; menus: string[];
  subscription: Subscription; subscription_status: SubscriptionStatus; billing_cycle: BillingCycle; plan_expires_at: string | null;
  pricing_options?: PricingOption[];
}
export type DemoEntity = "outlets" | "employees" | "roles" | "categories" | "tiers" | "products" | "ingredients" | "tables" | "taxes" | "discounts" | "expenses" | "banks";
export interface DemoOrderInput {
  outlet_id: string; tier_id: string;
  items: { product_id: string; quantity: number; modifier_ids?: string[]; custom_modifiers?: DemoCustomModifier[]; cart_item_id?: string; note?: string | null }[];
  customer_name?: string; table_id?: string | null; order_type?: OrderType; note?: string | null;
}
export type DemoEmailPreviewCommand = {
  type: "email.preview"; subject?: string; outlet_id?: string; from?: string;
} & (
  // Filtered form: email is the recipient; to is the optional range end.
  | { email: string; to?: string }
  // Existing callers: to remains the recipient, with the default range end.
  | { email?: never; to: string }
);
export type DemoCommand =
  | { type: "entity.save"; entity: DemoEntity; value: Record<string, unknown> }
  | { type: "entity.delete"; entity: DemoEntity; id: string }
  | { type: "entity.reorder"; entity: DemoEntity; ids: string[] }
  | { type: "session.owner" }
  | { type: "session.owner.login"; email: string; password: string }
  | { type: "session.company"; code: string; password: string }
  | { type: "session.logout"; mode: "owner" | "pos" }
  | { type: "session.cashier"; outlet_id: string; employee_id: string; pin: string }
  | { type: "session.selectOutlet"; outlet_id: string }
  | { type: "session.switchUser" }
  | { type: "company.save"; value: Record<string, unknown> }
  | { type: "company.password"; current?: string; password: string }
  | { type: "company.adminPassword"; password: string }
  | { type: "ingredient.update"; id: string; value: Record<string, unknown>; note?: string }
  | { type: "product.prices"; product_id: string; prices: Record<string, number> }
  | { type: "modifier.save"; product_id: string; value: Record<string, unknown> }
  | { type: "modifier.delete"; id: string }
  | { type: "recipe.save"; product_id: string; ingredient_id: string; quantity_used: number }
  | { type: "recipe.delete"; id: string }
  | { type: "pricingOption.save"; value: Record<string, unknown> }
  | { type: "pricingOption.delete"; id: string }
  | ({ type: "order.quote" } & DemoOrderInput)
  | ({ type: "order.create"; status: "draft" | "completed" | "pending"; payment_method: DemoPaymentMethod; amount_paid?: number; splits?: DemoSplit[] } & DemoOrderInput)
  | ({ type: "order.qris.create" } & DemoOrderInput)
  | { type: "order.draft.update"; id: string; value: Partial<DemoOrderInput>; status?: "draft" | "completed"; payment_method?: DemoPaymentMethod; amount_paid?: number; splits?: DemoSplit[] }
  | { type: "order.splits"; id: string; splits: DemoSplit[] }
  | { type: "order.complete"; id: string; payment_method: DemoPaymentMethod; amount_paid?: number; splits?: DemoSplit[] }
  | { type: "order.updateDraft"; id: string; input: DemoOrderInput }
  | { type: "order.cancel"; id: string }
  | { type: "stock.adjust"; ingredient_id: string; quantity: number; note: string }
  | { type: "purchase.create"; outlet_id: string; supplier_name: string; note: string; purchase_date?: string; items: { ingredient_id: string; quantity: number; unit_cost: number }[] }
  | { type: "tables.generate"; outlet_id: string; count: number; prefix?: string }
  | { type: "payment.create"; order_id: string }
  | { type: "payment.transition"; id: string; status: PaymentIntent["status"] }
  | { type: "payment.retry"; id: string }
  | { type: "withdrawal.create"; bank_id: string; amount: number; note?: string }
  | { type: "withdrawal.transition"; id: string; status: "processing" | "completed" | "rejected"; note?: string }
  | { type: "subscription.checkout"; plan: PlanSlug; billing_cycle: BillingCycle }
  | { type: "subscription.transition"; id: string; status: Exclude<SubscriptionInvoice["status"], "pending"> }
  | { type: "subscription.retry"; id: string }
  | DemoEmailPreviewCommand
  | { type: "tick"; now?: string };
