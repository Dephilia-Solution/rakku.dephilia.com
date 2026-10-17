import type { Menu, OwnerDashboardEmployee, OwnerDashboardOutlet } from "@rakku/shared-types";
import type { DemoSandbox } from "../engine";
import { clone, deepFreeze, discountActive, fail, find } from "../business";
import { DEMO_MENUS } from "../constants";

const menuNames = ["Kasir", "Pesanan", "Laporan", "Produk", "Pajak & Diskon", "Bahan Baku", "Meja", "Pengeluaran", "Pembelian"];
const menuIcons = ["ShoppingCart", "ClipboardList", "BarChart3", "Package", "Percent", "Boxes", "Grid3X3", "Wallet", "ShoppingBag"];
export const demoMenuId = (slug: string) => `fixture:menu:${slug}`;
export function demoMenus(_app: "owner" | "pos" = "owner"): Menu[] {
  return deepFreeze(DEMO_MENUS.map((slug, index) => ({ id: demoMenuId(slug), slug, name: menuNames[index], icon: menuIcons[index], path: `/${slug}`, sort_order: index + 1 })));
}

/** A content cache belongs to one projection instance, never to a tenant service. */
export function createDemoProjections(sandbox: DemoSandbox) {
  const opened = sandbox.getSnapshot().now;
  const cache = new Map<string, { key: string; value: unknown }>();
  const stable = <T>(name: string, value: T): T => {
    const key = JSON.stringify(value), previous = cache.get(name);
    if (previous?.key === key) return previous.value as T;
    const result = deepFreeze(clone(value)); cache.set(name, { key, value: result }); return result;
  };
  const read = () => {
    const s = sandbox.getSnapshot(), isOwner = s.session.mode === "owner" && s.session.authenticated;
    const company = stable("company", { id: s.company.id, name: s.company.name, code: s.company.code, slug: "rakku-demo-cafe", logo_url: s.company.logo_url ?? null, status: "active", created_at: opened });
    const outlets = stable<OwnerDashboardOutlet[]>("outlets", s.outlets.map(row => ({ id: row.id, name: row.name, address: row.address, status: row.is_active ? "active" : "inactive", created_at: opened,
      qr_menu_slug: row.id === "fixture:pusat" ? "pusat" : row.id === "fixture:taman" ? "taman" : row.id,
      employee_count: s.employees.filter(e => (e.all_outlets && e.is_active) || (!e.all_outlets && e.outlet_ids.includes(row.id))).length })));
    const employees = stable<OwnerDashboardEmployee[]>("employees", s.employees.map(row => ({ id: row.id, name: row.name, username: row.username, role_id: row.role_id,
      role_name: s.roles.find(role => role.id === row.role_id)?.name ?? "", all_outlets: row.all_outlets ?? false, status: row.is_active ? "active" : "inactive", avatar_url: null,
      outlets: row.outlet_ids.map(id => { const outlet = find(s.outlets, id); return { id, name: outlet.name }; }), created_at: opened })));
    const categories = stable("categories", s.categories);
    const products = stable("products", s.products.map(row => ({ ...row, category_name: s.categories.find(c => c.id === row.category_id)?.name ?? "", created_at: opened })));
    const activeProducts = stable("activeProducts", products.filter(row => row.is_active));
    const tiers = stable("tiers", s.tiers);
    const productTierPrices = stable("productTierPrices", products.flatMap(row => Object.entries(row.prices).map(([tier_id, price]) => ({ id: `${row.id}:price:${tier_id}`, product_id: row.id, tier_id, price }))));
    const modifiers = stable("modifiers", products.flatMap(row => row.modifiers.map(mod => { const tier_prices = Object.entries(mod.prices).map(([tier_id, price_delta]) => ({ id: `${mod.id}:price:${tier_id}`, modifier_id: mod.id, tier_id, price_delta })); return { ...mod, tier_prices, modifier_tier_prices: tier_prices }; })));
    const taxes = stable("taxes", s.taxes), activeTaxes = stable("activeTaxes", s.taxes.filter(row => row.is_active));
    const productDiscounts = stable("productDiscounts", s.discounts.filter((row): row is typeof row & { product_id: string } => row.product_id !== null)), orderDiscounts = stable("orderDiscounts", s.discounts.filter(row => !row.product_id));
    const activeProductDiscounts = stable("activeProductDiscounts", productDiscounts.filter(row => discountActive(row, s.now)));
    const activeOrderDiscounts = stable("activeOrderDiscounts", s.discounts.filter(row => !row.product_id && discountActive(row, s.now)));
    const orders = stable("orders", s.orders.map(row => ({ ...row, payment_method: row.payment_method === "qris_manual" ? "qris" as const : row.payment_method,
      outlet_name: s.outlets.find(o => o.id === row.outlet_id)?.name ?? "", table_name: s.tables.find(table => table.id === row.table_id)?.name ?? null, order_items: row.items,
      split_payments: row.splits.map((split, index) => ({ id: `${row.id}:split:${index}`, order_id: row.id, payment_method: split.method === "qris_manual" ? "qris" as const : split.method, amount: split.amount,
        status: "paid" as const, customer_name: split.customer_name ?? null, items: split.items ?? [], created_at: row.completed_at ?? row.created_at })) })));
    const ingredients = stable("ingredients", s.ingredients), expenses = stable("expenses", s.expenses), tables = stable("tables", s.tables.map(row => ({ ...row, outlet_name: s.outlets.find(o => o.id === row.outlet_id)?.name ?? null })));
    const canPurchase = isOwner || s.menus.includes("purchases");
    const purchases = stable("purchases", s.session.authenticated && canPurchase ? sandbox.getPurchases() : []);
    const usage = stable("usage", s.session.authenticated ? sandbox.getUsageSummary() : null);
    const owner = stable("owner", sandbox.getOwnerSession());
    const tenant = stable("tenant", s.session.authenticated && s.session.mode === "pos" ? sandbox.getTenantSession() : null);
    const menus = stable("menus", demoMenus(s.session.mode).filter(menu => s.menus.includes(menu.slug)));
    const roles = stable("roles", s.roles.map(row => ({ id: row.id, name: row.name, company_id: row.company_id })));
    const invoices = stable("invoices", s.invoices.map(row => ({ ...row, plans: { name: s.plans.find(plan => plan.id === row.plan_id)?.name ?? "" } })));
    const balance = stable("balance", s.balance), banks = stable("banks", s.banks), withdrawals = stable("withdrawals", s.withdrawals), transactions = stable("transactions", [...s.ledger].reverse());
    const register = stable("register", { products: activeProducts, categories, modifiers, initialPricingTiers: tiers.filter(row => row.is_active), initialProductTierPrices: productTierPrices,
      initialActiveTaxes: activeTaxes, initialActiveProductDiscounts: activeProductDiscounts, initialActiveOrderDiscounts: activeOrderDiscounts, initialDraftCount: orders.filter(row => row.status === "draft").length });
    return { state: s, company, owner, session: owner ?? tenant, tenant, outlets, employees, roles, menus, allMenus: stable("allMenus", demoMenus()), usage, summary: usage, plans: stable("plans", s.plans), pricingOptions: stable("pricingOptions", s.pricing_options ?? []),
      products, productsWithCategory: products, activeProducts, categories, tiers, pricingTiers: tiers, modifiers, productTierPrices, taxes, activeTaxes, productDiscounts, orderDiscounts,
      activeProductDiscounts, activeOrderDiscounts, draftCount: register.initialDraftCount, register, orders, ingredients, purchases, purchasesWithItems: purchases, expenses, tables, invoices, balance,
      banks, bankAccounts: banks, withdrawals, transactions, outbox: s.outbox };
  };
  return { read, stable };
}
const projectors = new WeakMap<DemoSandbox, ReturnType<typeof createDemoProjections>>();
export function demoViewData(sandbox: DemoSandbox) {
  let projector = projectors.get(sandbox); if (!projector) { projector = createDemoProjections(sandbox); projectors.set(sandbox, projector); }
  return projector.read();
}
export function getOwnerDashboardData(sandbox: DemoSandbox) {
  const view = demoViewData(sandbox); if (!view.owner) fail("Owner access required");
  const completed = view.orders.filter(row => row.status === "completed");
  return { owner: view.owner, session: view.owner, outlets: view.outlets, employees: view.employees, totalRevenue: completed.reduce((sum, row) => sum + row.total_price, 0), totalTransactions: completed.length,
    activeOutlets: view.outlets.filter(row => row.status === "active").length, activeEmployees: view.employees.filter(row => row.status === "active").length };
}
export type DemoViewData = ReturnType<typeof demoViewData>;
