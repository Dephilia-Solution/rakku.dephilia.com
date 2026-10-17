import type { DemoEntity, DemoState } from "./models";
import { DEMO_MENUS } from "./constants";
import { clone, fail, find } from "./business";

export function owner(state: DemoState): boolean { return state.session.authenticated && state.session.mode === "owner"; }
export function requireOwner(state: DemoState): void { if (!owner(state)) fail("Owner access required"); }
export function sessionMenus(state: DemoState): string[] {
  if (!state.session.authenticated) return [];
  if (owner(state)) return [...DEMO_MENUS];
  const employee = find(state.employees, state.session.employee_id);
  const outlet = find(state.outlets, state.session.outlet_id);
  if (!employee.is_active || !outlet.is_active || (!employee.all_outlets && !employee.outlet_ids.includes(outlet.id))) fail("Invalid cashier assignment");
  return find(state.roles, employee.role_id).menus;
}
export function requireMenu(state: DemoState, ...menus: string[]): void {
  if (!state.session.authenticated) fail("Authentication required");
  if (!owner(state) && !menus.some(m => sessionMenus(state).includes(m))) fail("Menu permission denied");
}
export function scope(state: DemoState, outletId: unknown, allowInactiveOwner = false): string {
  const outlet = find(state.outlets, outletId);
  if (!outlet.is_active && !(allowInactiveOwner && owner(state))) fail("Outlet inactive");
  if (!owner(state) && (!state.session.authenticated || outlet.id !== state.session.outlet_id)) fail("Outlet access denied");
  return outlet.id;
}
const entityMenus: Partial<Record<DemoEntity, string>> = { categories: "products", tiers: "products", products: "products", ingredients: "ingredients", tables: "tables", taxes: "tax-discounts", discounts: "tax-discounts", expenses: "expenses" };
export function entityAccess(state: DemoState, entity: DemoEntity): void {
  if (!["outlets", "employees", "roles", "categories", "tiers", "products", "ingredients", "tables", "taxes", "discounts", "expenses", "banks"].includes(entity)) fail("Invalid entity");
  const menu = entityMenus[entity]; if (menu) requireMenu(state, menu); else requireOwner(state);
}
export function validateSession(state: DemoState): void {
  if (state.session.mode !== "pos" || !state.session.authenticated) return;
  const employee = state.employees.find(e => e.id === state.session.employee_id);
  const outlet = state.outlets.find(o => o.id === state.session.outlet_id);
  if (!employee?.is_active || !outlet?.is_active || (!employee.all_outlets && !employee.outlet_ids.includes(outlet.id)) || !state.roles.some(r => r.id === employee.role_id)) {
    state.session.employee_id = null; state.session.authenticated = false;
  }
}
export function projectSnapshot(raw: DemoState): DemoState {
  const state = clone(raw);
  state.menus = sessionMenus(raw);
  if (owner(raw)) return state;
  const can = (...menus: string[]) => raw.session.authenticated && menus.some(m => state.menus.includes(m));
  const scoped = <T extends { outlet_id: string | null }>(rows: T[]): T[] => rows.filter(r => r.outlet_id === raw.session.outlet_id);
  state.company = { id: raw.company.id, name: raw.company.name, code: "", email: "", owner_name: "", password: "" };
  state.outlets = raw.session.authenticated ? state.outlets.filter(o => o.id === raw.session.outlet_id) : state.outlets.filter(o => o.is_active);
  // Login roster contains no PIN. Authenticated POS never sees owner employee/role entities.
  state.employees = raw.session.authenticated ? [] : state.employees.filter(e => e.is_active).map(e => ({ ...e, pin: "" }));
  state.roles = []; state.banks = []; state.withdrawals = []; state.ledger = []; state.balance = null; state.invoices = [];
  state.categories = can("products", "register") ? scoped(state.categories) : [];
  state.tiers = can("products", "register") ? scoped(state.tiers) : [];
  state.products = can("products", "register") ? scoped(state.products).map(p => ({ ...p, recipe: can("ingredients", "products") ? p.recipe : [] })) : [];
  state.ingredients = can("ingredients") ? scoped(state.ingredients) : [];
  state.tables = can("tables", "register") ? scoped(state.tables) : [];
  state.orders = can("orders", "register") ? scoped(state.orders) : [];
  state.payments = can("orders", "register") ? scoped(state.payments) : [];
  state.movements = can("ingredients") ? scoped(state.movements) : [];
  state.purchases = can("purchases") ? scoped(state.purchases) : [];
  state.expenses = can("expenses") ? scoped(state.expenses) : [];
  state.taxes = can("tax-discounts", "register") ? scoped(state.taxes) : [];
  state.discounts = can("tax-discounts", "register") ? scoped(state.discounts) : [];
  state.outbox = []; // Owner email addresses/report history never leak into POS.
  state.pricing_options = can("products", "register") ? scoped(state.pricing_options ?? []) : [];
  return state;
}
