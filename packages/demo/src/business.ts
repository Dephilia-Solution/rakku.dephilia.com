import type { BalanceTransaction, MerchantBalance } from "@rakku/shared-types";
import type { DemoOrder, DemoOrderInput, DemoProduct, DemoReport, DemoState } from "./models";

export function fail(message: string): never { throw new Error(message); }
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Expected record");
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max = 300): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(`Invalid ${label}`);
  return value.trim();
}
export function optionalText(value: unknown, max = 1000): string | null {
  if (value === undefined || value === null || value === "") return null;
  return text(value, "text", max);
}
export function number(value: unknown, label: string, min = 0, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > 1e12 || (integer && !Number.isSafeInteger(value))) fail(`Invalid ${label}`);
  return value;
}
export function money(value: unknown, label = "amount"): number { return number(value, label, 0, true); }
export function bool(value: unknown): boolean { if (typeof value !== "boolean") fail("Invalid boolean"); return value; }
export function list(value: unknown): unknown[] { if (!Array.isArray(value)) fail("Expected array"); return value; }
export function uniqueStrings(value: unknown): string[] {
  const result = list(value).map(v => text(v, "id"));
  if (new Set(result).size !== result.length) fail("Duplicate IDs");
  return result;
}
export function find<T extends { id: string }>(rows: T[], id: unknown): T {
  const key = text(id, "resource ID"); return rows.find(r => r.id === key) ?? fail(`Resource not found: ${key}`);
}
export function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
export function instant(value: unknown): string {
  const s = text(value, "timestamp");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s) || !Number.isFinite(Date.parse(s))) fail("Invalid timestamp");
  date(s.slice(0, 10));
  return new Date(s).toISOString();
}
export function date(value: unknown): string {
  const s = text(value, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) fail("Invalid calendar date");
  return s;
}
export function discountDate(value: unknown): string {
  const s = text(value, "discount date");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return date(s);
  // datetime-local values are interpreted in the same Jakarta calendar as the demo.
  const zoned = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(s) ? `${s.length === 16 ? `${s}:00` : s}+07:00` : s;
  return instant(zoned);
}
export function discountActive(d: { is_active: boolean; start_date: string; end_date: string }, now: string): boolean {
  const start = d.start_date.length === 10 ? Date.parse(`${d.start_date}T00:00:00+07:00`) : Date.parse(d.start_date);
  const end = d.end_date.length === 10 ? Date.parse(`${d.end_date}T23:59:59.999+07:00`) : Date.parse(d.end_date);
  return d.is_active && start <= Date.parse(now) && Date.parse(now) <= end;
}
export const recipeId = (productId: string, ingredientId: string): string => `recipe:${productId}~${ingredientId}`;
export function jakartaDate(now: string | Date): string { return new Date(new Date(now).getTime() + 7 * 3600_000).toISOString().slice(0, 10); }
export function shiftedDate(now: string, days: number): string { return jakartaDate(new Date(Date.parse(now) + days * 86400_000)); }
export function addTime(now: string, ms: number): string { return new Date(Date.parse(now) + ms).toISOString(); }
export function productCost(product: DemoProduct, state: Pick<DemoState, "ingredients">): number {
  return product.recipe.reduce((sum, r) => sum + r.quantity_used * find(state.ingredients, r.ingredient_id).cost_per_unit, 0);
}
export function deriveBalance(ledger: BalanceTransaction[], company_id: string, now: string): MerchantBalance {
  return {
    company_id, available_balance: ledger.reduce((s, t) => s + t.amount, 0),
    pending_balance: ledger.reduce((s, t) => s + t.pending_delta, 0),
    total_credited: ledger.filter(t => t.type === "sale_credit").reduce((s, t) => s + t.amount, 0),
    total_fees: ledger.reduce((s, t) => s + t.fee_amount, 0),
    total_withdrawn: ledger.filter(t => t.type === "withdrawal").reduce((s, t) => s - t.pending_delta, 0),
    updated_at: ledger.at(-1)?.created_at ?? now,
  };
}
function discount(price: number, d: { type: "percentage" | "fixed"; value: number }): number {
  return Math.min(price, Math.round(d.type === "percentage" ? price * d.value / 100 : d.value));
}
export function quote(state: DemoState, input: DemoOrderInput, id: string): DemoOrder {
  const outlet = find(state.outlets, input.outlet_id);
  if (!outlet.is_active) fail("Outlet inactive");
  const tier = find(state.tiers, input.tier_id);
  if (!tier.is_active || tier.outlet_id !== outlet.id) fail("Invalid outlet tier");
  const order_type = input.order_type ?? "dine_in";
  if (!["dine_in", "take_away", "delivery", "gojek", "grab", "shopee"].includes(order_type)) fail("Invalid order type");
  if (input.table_id) {
    const table = find(state.tables, input.table_id);
    if (table.outlet_id !== outlet.id || order_type !== "dine_in") fail("Invalid order table");
  }
  const active = state.discounts.filter(d => d.outlet_id === outlet.id && discountActive(d, state.now));
  const discounts: NonNullable<DemoOrder["discounts"]> = [];
  const items = list(input.items).map((raw, index) => {
    const item = record(raw);
    const product = find(state.products, item.product_id);
    if (!product.is_active || product.outlet_id !== outlet.id) fail("Invalid order product");
    const quantity = number(item.quantity, "quantity", 1, true);
    if (quantity > 10000) fail("Quantity too large");
    const modifiers = uniqueStrings(item.modifier_ids ?? []).map(mid => find(product.modifiers, mid));
    const custom = list(item.custom_modifiers ?? []).map(raw => {
      const m = record(raw), mid = text(m.id, "custom modifier ID");
      if (!/^custom-[\w-]+$/.test(mid) || m.product_id !== product.id) fail("Invalid custom modifier scope");
      return { id: mid, product_id: product.id, name: text(m.name, "custom modifier name", 100), group_name: optionalText(m.group_name, 100), price_delta: money(m.price_delta, "custom modifier price") };
    });
    if (new Set(custom.map(m => m.id)).size !== custom.length) fail("Duplicate custom modifier");
    const unit_price = money((product.prices[tier.id] ?? product.price) + modifiers.reduce((s, m) => s + (m.prices[tier.id] ?? m.price_delta ?? 0), 0) + custom.reduce((sum, m) => sum + m.price_delta, 0));
    const d = active.find(d => d.product_id === product.id);
    const amount = d ? discount(unit_price, d) * quantity : 0;
    if (d) discounts.push({ name: d.name, type: d.type, value: d.value, amount });
    return { id: `${id}:item:${index}`, order_id: id, product_id: product.id, product_name: product.name,
      quantity, unit_price, subtotal: money(unit_price * quantity - amount),
      modifier_label: modifiers.length || custom.length ? [...modifiers.map(m => `${m.name} +${m.prices[tier.id] ?? m.price_delta ?? 0}`), ...custom.map(m => `${m.name} +${m.price_delta}`)].join(", ") : null,
      modifier_ids: modifiers.map(m => m.id), custom_modifiers: custom, cart_item_id: optionalText(item.cart_item_id, 300) ?? `${id}:item:${index}`,
      note: optionalText(item.note) };
  });
  if (!items.length || items.length > 100) fail("Order needs 1–100 items");
  const subtotal = money(items.reduce((s, i) => s + i.subtotal, 0));
  let taxable = subtotal;
  // Existing POS cart applies the first active order discount only.
  for (const d of active.filter(d => !d.product_id).slice(0, 1)) {
    const amount = discount(taxable, d); taxable -= amount;
    discounts.push({ name: d.name, type: d.type, value: d.value, amount });
  }
  const taxes = state.taxes.filter(t => t.outlet_id === outlet.id && t.is_active).map(t => ({ name: t.name, type: t.type, value: t.value,
    amount: t.type === "fixed" ? t.value : Math.round(taxable * t.value / 100) }));
  const tax_amount = money(taxes.reduce((s, t) => s + t.amount, 0));
  const total = money(taxable + tax_amount);
  return { id, company_id: state.company.id, outlet_id: outlet.id,
    order_number: Math.max(0, ...state.orders.map(o => o.order_number)) + 1,
    order_type, payment_method: "later", subtotal, tax_rate: state.taxes.filter(t => t.outlet_id === outlet.id && t.is_active && t.type === "percentage").reduce((s, t) => s + t.value, 0),
    tax_amount, total, total_price: total, note: optionalText(input.note), customer_name: optionalText(input.customer_name, 100) ?? "Pelanggan Demo",
    cashier_id: state.session.employee_id,
    cashier_name: state.session.employee_id ? find(state.employees, state.session.employee_id).name : state.company.owner_name,
    table_id: input.table_id ?? null, status: "draft", payment_status: "unpaid", reserved_until: null,
    pricing_tier_id: tier.id, tier_id: tier.id, split_bill: false,
    discount_amount: discounts.reduce((s, d) => s + d.amount, 0), taxes, discounts, items,
    payment_channel: null, created_at: state.now, completed_at: null, amount_paid: 0, change: 0, splits: [] };
}
export function calculateReport(state: DemoState, outletId?: string, from = shiftedDate(state.now, -29), to = jakartaDate(state.now), includeCosts = true): DemoReport {
  date(from); date(to); if (from > to) fail("Invalid report range");
  const orders = state.orders.filter(o => o.status === "completed" && (!outletId || o.outlet_id === outletId) && jakartaDate(o.created_at) >= from && jakartaDate(o.created_at) <= to);
  const expenses = includeCosts ? state.expenses.filter(e => (!outletId || e.outlet_id === outletId) && e.expense_date >= from && e.expense_date <= to) : [];
  const products = new Map<string, DemoReport["products"][number]>();
  const daily = new Map<string, DemoReport["daily"][number]>();
  const day = (date: string) => { if (!daily.has(date)) daily.set(date, { date, revenue: 0, cogs: 0, expenses: 0, orders: 0 }); return daily.get(date)!; };
  let cogs = 0;
  for (const o of orders) {
    const d = day(jakartaDate(o.created_at)); d.revenue += o.total; d.orders++;
    for (const item of o.items) {
      const cost = includeCosts ? productCost(find(state.products, item.product_id), state) * item.quantity : 0;
      cogs += cost; d.cogs += cost;
      const p = products.get(item.product_id) ?? { product_id: item.product_id, name: item.product_name, quantity: 0, revenue: 0, cogs: 0 };
      p.quantity += item.quantity; p.revenue += item.subtotal; p.cogs += cost; products.set(item.product_id, p);
    }
  }
  for (const e of expenses) day(e.expense_date).expenses += e.amount;
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  return { revenue, cogs, expenses: expenseTotal, grossProfit: includeCosts ? revenue - cogs : 0, netProfit: includeCosts ? revenue - cogs - expenseTotal : 0,
    orders: orders.length, subtotal: orders.reduce((s, o) => s + o.subtotal, 0), tax: orders.reduce((s, o) => s + o.tax_amount, 0),
    discounts: orders.reduce((s, o) => s + o.discount_amount, 0), averageOrder: orders.length ? revenue / orders.length : 0,
    from, to, outlet_id: outletId ?? null, daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)), products: [...products.values()] };
}
