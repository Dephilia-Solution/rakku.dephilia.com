import type { DemoEntity, DemoState } from "./models";
import { INGREDIENT_UNITS, DEMO_MENUS } from "./constants";
import { bool, date, discountDate, fail, find, jakartaDate, list, money, number, optionalText, recipeId, record, text, uniqueStrings } from "./business";
import { entityAccess, scope } from "./access";

export type NewId = (kind: string) => string;
type Row = { id: string; company_id: string; outlet_id?: string; [key: string]: unknown };
export function planLimit(state: DemoState, entity: DemoEntity): void {
  const columns = { outlets: "max_outlets", employees: "max_employees", products: "max_products", ingredients: "max_ingredients" } as const;
  if (!(entity in columns)) return;
  const column = columns[entity as keyof typeof columns];
  const max = state.plans.find(p => p.slug === state.plan)![column];
  if (max >= 0 && state[entity].length >= max) fail(`PLAN_LIMIT: ${entity}`);
}
export function saveEntity(state: DemoState, entity: DemoEntity, input: Record<string, unknown>, nextId: NewId, images: ReadonlySet<string>): unknown {
  entityAccess(state, entity);
  const value = record(input);
  const rows = state[entity] as unknown as Row[];
  const existing = value.id !== undefined && value.id !== "" ? find(rows, value.id) : undefined;
  if (value.company_id !== undefined && value.company_id !== state.company.id) fail("Invalid company scope");
  if (existing?.outlet_id) scope(state, existing.outlet_id, true);
  if (existing && value.outlet_id !== undefined && value.outlet_id !== existing.outlet_id) fail("Cannot move resource between outlets");
  const scopedEntity = !["outlets", "employees", "roles", "banks"].includes(entity);
  const outlet_id = scopedEntity ? scope(state, value.outlet_id ?? existing?.outlet_id ?? state.session.outlet_id, !!existing) : undefined;
  if (!scopedEntity && value.outlet_id !== undefined) fail("Unexpected outlet scope");
  if (!existing) {
    planLimit(state, entity);
    if (entity === "roles" && !state.plans.find(p => p.slug === state.plan)!.features.custom_roles) fail("PLAN_LIMIT: custom_roles");
  }
  // Merge only for reading known fields. Every stored row is explicitly constructed.
  const v = { ...existing, ...value };
  const id = existing?.id ?? nextId(entity);
  const base = { id, company_id: state.company.id };
  const scopedBase = { ...base, outlet_id: outlet_id! };
  const name = () => text(v.name, "name", 100);
  const sort_order = () => number(v.sort_order ?? rows.length + 1, "sort order", 0, true);
  const is_active = () => bool(v.is_active ?? true);
  const created_at = typeof existing?.created_at === "string" ? existing.created_at : state.now;
  let row: unknown;
  switch (entity) {
    case "outlets": row = { ...base, name: name(), address: optionalText(v.address, 500) ?? "", is_active: is_active() }; break;
    case "employees": {
      const role_id = find(state.roles, v.role_id).id;
      const username = text(v.username, "username", 50).toLowerCase();
      if (!/^[a-z0-9_\.\-]+$/.test(username) || state.employees.some(e => e.id !== id && e.username.toLowerCase() === username)) fail("Invalid or duplicate username");
      const pin = text(v.pin, "PIN", 6); if (!/^\d{6}$/.test(pin)) fail("PIN must have six digits");
      const all_outlets = bool(v.all_outlets ?? false);
      const outlet_ids = uniqueStrings(v.outlet_ids ?? []);
      if (!all_outlets && !outlet_ids.length) fail("Employee needs outlet assignment");
      for (const oid of outlet_ids) if (!find(state.outlets, oid).is_active) fail("Cannot assign inactive outlet");
      if (state.employees.some(e => e.id !== id && e.pin === pin && (all_outlets || e.all_outlets || e.outlet_ids.some(o => outlet_ids.includes(o))))) fail("PIN already used at assigned outlet");
      row = { ...base, name: name(), username, role_id, pin, outlet_ids, all_outlets, is_active: is_active() }; break;
    }
    case "roles": {
      const menus = uniqueStrings(v.menus); if (menus.some(m => !(DEMO_MENUS as readonly string[]).includes(m))) fail("Invalid menu slug");
      if (existing && JSON.stringify(menus) !== JSON.stringify(existing.menus) && !state.plans.find(p => p.slug === state.plan)!.features.custom_roles) fail("PLAN_LIMIT: custom_roles");
      row = { ...base, name: name(), menus }; break;
    }
    case "categories": row = { ...scopedBase, name: name(), sort_order: sort_order() }; break;
    case "tiers": {
      const slug = text(v.slug ?? name().toLowerCase().replace(/\s+/g, "-"), "tier slug", 60);
      if (!/^[a-z0-9-]+$/.test(slug) || state.tiers.some(t => t.id !== id && t.outlet_id === outlet_id && t.slug === slug)) fail("Invalid or duplicate tier slug");
      row = { ...scopedBase, name: name(), slug, is_active: is_active(), sort_order: sort_order() }; break;
    }
    case "products": {
      const category = find(state.categories, v.category_id); if (category.outlet_id !== outlet_id) fail("Invalid category scope");
      const prices = priceMap(state, outlet_id!, v.prices ?? {});
      const oldRecipe = existing ? find(state.products, id).recipe : [];
      const recipe = list(v.recipe ?? []).map(raw => {
        const r = record(raw), ingredient = find(state.ingredients, r.ingredient_id);
        const prior = oldRecipe.find(row => row.ingredient_id === ingredient.id);
        if (ingredient.outlet_id !== outlet_id || (!ingredient.is_active && !prior)) fail("Invalid recipe ingredient");
        if (r.id !== undefined && r.id !== prior?.id && !(prior && !prior.id && r.id === recipeId(id, ingredient.id))) fail("Invalid recipe ID");
        return { ingredient_id: ingredient.id, quantity_used: number(r.quantity_used, "recipe quantity", 0.000001), ...(prior?.id ? { id: prior.id, created_at: prior.created_at } : {}) };
      });
      if (new Set(recipe.map(r => r.ingredient_id)).size !== recipe.length) fail("Duplicate recipe ingredient");
      const oldModifiers = existing ? find(state.products, id).modifiers : [];
      const modifiers = list(v.modifiers ?? []).map(raw => {
        const m = record(raw);
        if (m.product_id !== undefined && m.product_id !== id) fail("Invalid modifier product");
        const mid = m.id !== undefined && m.id !== "" ? find(oldModifiers, m.id).id : nextId("modifier");
        return { id: mid, product_id: id, name: text(m.name, "modifier name", 100), group_name: optionalText(m.group_name, 100),
          price_delta: money(m.price_delta ?? 0), prices: priceMap(state, outlet_id!, m.prices ?? {}) };
      });
      if (new Set(modifiers.map(m => m.id)).size !== modifiers.length) fail("Duplicate modifiers");
      const image_url = optionalText(v.image_url, 1000);
      if (image_url && !/^\/demo-assets\/[\w/-]+\.(?:svg|png|webp|jpg)$/.test(image_url) && !(image_url.startsWith("blob:") && images.has(image_url))) fail("Image must be a local demo asset or a live image attached to this sandbox");
      row = { ...scopedBase, name: name(), price: money(v.price ?? 0), category_id: category.id, prices, recipe, modifiers, image_url,
        description: optionalText(v.description), is_active: is_active(), sort_order: sort_order() }; break;
    }
    case "ingredients": {
      const unit = text(v.unit, "unit"); if (!(INGREDIENT_UNITS as readonly string[]).includes(unit)) fail("Invalid ingredient unit");
      if (existing && unit !== existing.unit && state.products.some(p => p.recipe.some(r => r.ingredient_id === id))) fail("Cannot change unit used by recipe");
      const stock_quantity = number(v.stock_quantity ?? 0, "stock", existing ? -Infinity : 0);
      if (existing && stock_quantity !== existing.stock_quantity) fail("Use stock.adjust for stock changes");
      row = { ...scopedBase, name: name(), unit, stock_quantity, min_stock_alert: number(v.min_stock_alert ?? 0, "minimum stock"),
        cost_per_unit: number(v.cost_per_unit ?? 0, "unit cost"), is_active: is_active(), created_at, updated_at: state.now }; break;
    }
    case "tables": {
      const status = v.status ?? "available"; if (status !== "available" && status !== "occupied") fail("Invalid table status");
      if (status === "available" && state.orders.some(o => o.table_id === id && ["draft", "pending_payment"].includes(o.status))) fail("Table has an open order");
      row = { ...scopedBase, name: name(), status, created_at }; break;
    }
    case "taxes": {
      const type = rateType(v.type), value = rateValue(v.value, type);
      row = { ...scopedBase, name: name(), type, value, is_active: is_active(), sort_order: sort_order(), created_at }; break;
    }
    case "discounts": {
      const type = rateType(v.type), value = rateValue(v.value, type), start_date = discountDate(v.start_date), end_date = discountDate(v.end_date);
      if (Date.parse(start_date.length === 10 ? `${start_date}T00:00:00+07:00` : start_date) > Date.parse(end_date.length === 10 ? `${end_date}T23:59:59.999+07:00` : end_date)) fail("Discount ends before start");
      const product_id = v.product_id ? find(state.products, v.product_id).id : null;
      if (product_id && find(state.products, product_id).outlet_id !== outlet_id) fail("Invalid discount product");
      row = { ...scopedBase, name: name(), type, value, start_date, end_date, product_id, is_active: is_active(), created_at }; break;
    }
    case "expenses": {
      const expense_date = date(v.expense_date ?? jakartaDate(state.now)); if (expense_date > jakartaDate(state.now)) fail("Future expense date");
      row = { ...scopedBase, category: text(v.category, "expense category", 100), amount: money(v.amount), description: optionalText(v.description), expense_date,
        created_by: existing?.created_by ?? state.session.employee_id, created_at }; break;
    }
    case "banks": {
      const account_number = text(v.account_number, "account number", 30); if (!/^\d{6,30}$/.test(account_number)) fail("Invalid account number");
      const status = v.status ?? "active"; if (status !== "active" && status !== "inactive") fail("Invalid bank status");
      if (state.banks.some(b => b.id !== id && b.account_number === account_number && b.bank_name === v.bank_name)) fail("Duplicate bank account");
      const is_default = bool(v.is_default ?? false); if (is_default && status !== "active") fail("Default bank must be active");
      if (is_default) for (const bank of state.banks) bank.is_default = false;
      row = { ...base, bank_name: text(v.bank_name, "bank name", 100), account_number, account_holder: text(v.account_holder, "account holder", 100), status, is_default, created_at }; break;
    }
  }
  if (existing) rows[rows.indexOf(existing)] = row as Row; else rows.push(row as Row);
  if (entity === "ingredients" && !existing) {
    const ingredient = find(state.ingredients, id);
    state.movements.push({ id: nextId("movement"), company_id: state.company.id, outlet_id: outlet_id!, ingredient_id: id, type: "adjustment", quantity_change: ingredient.stock_quantity,
      reference_id: null, note: "Opening stock", created_by: state.session.employee_id, created_at: state.now });
  }
  if (entity === "outlets" && !existing) {
    for (const [index, tier] of [{ name: "Dine In", slug: "dine-in" }, { name: "Take Away", slug: "take-away" }].entries()) state.tiers.push({ id: nextId("tier"), company_id: state.company.id, outlet_id: id, ...tier, is_active: true, sort_order: index + 1 });
  }
  return row;
}
function priceMap(state: DemoState, outletId: string, raw: unknown): Record<string, number> {
  return Object.fromEntries(Object.entries(record(raw)).map(([id, price]) => {
    if (find(state.tiers, id).outlet_id !== outletId) fail("Invalid price tier scope");
    return [id, money(price, "tier price")];
  }));
}
function rateType(value: unknown): "percentage" | "fixed" { if (value !== "percentage" && value !== "fixed") fail("Invalid rate type"); return value; }
function rateValue(value: unknown, type: string): number { const n = type === "fixed" ? money(value) : number(value, "percentage"); if (type === "percentage" && n > 100) fail("Percentage exceeds 100"); return n; }

export function deleteEntity(state: DemoState, entity: DemoEntity, id: string): void {
  entityAccess(state, entity);
  const rows = state[entity] as unknown as Row[], row = find(rows, id);
  if (row.outlet_id) scope(state, row.outlet_id);
  let linked = false;
  switch (entity) {
    case "outlets": linked = state.outlets.length <= 1 || state.employees.some(e => e.outlet_ids.includes(id)) || [state.products, state.ingredients, state.tables, state.orders, state.expenses, state.taxes, state.discounts].some(rs => rs.some(r => r.outlet_id === id)); break;
    case "roles": linked = state.employees.some(e => e.role_id === id); break;
    case "categories": linked = state.products.some(p => p.category_id === id); break;
    case "products": linked = state.orders.some(o => o.items.some(i => i.product_id === id)) || state.discounts.some(d => d.product_id === id); break;
    case "ingredients": linked = state.products.some(p => p.recipe.some(r => r.ingredient_id === id)) || state.purchases.some(p => p.items.some(i => i.ingredient_id === id)) || state.movements.some(m => m.ingredient_id === id && m.note !== "Opening stock"); break;
    case "tiers": linked = state.orders.some(o => o.tier_id === id); break;
    case "tables": linked = state.orders.some(o => o.table_id === id); break;
    case "banks": linked = state.withdrawals.some(w => w.bank_account_id === id && ["requested", "processing"].includes(w.status)); break;
  }
  if (linked) fail("Resource is referenced; deactivate instead");
  rows.splice(rows.indexOf(row), 1);
  if (entity === "ingredients") state.movements = state.movements.filter(m => m.ingredient_id !== id);
  if (entity === "products") state.pricing_options = (state.pricing_options ?? []).filter(row => row.product_id !== id);
  if (entity === "banks") for (const withdrawal of state.withdrawals) if (withdrawal.bank_account_id === id) withdrawal.bank_account_id = null;
  if (entity === "outlets") { state.tiers = state.tiers.filter(row => row.outlet_id !== id); state.categories = state.categories.filter(row => row.outlet_id !== id); }
  if (entity === "tiers") for (const p of state.products) { delete p.prices[id]; for (const m of p.modifiers) delete m.prices[id]; }
  if (entity === "outlets" && state.session.outlet_id === id) state.session.outlet_id = state.outlets.find(o => o.is_active)?.id ?? "";
}
export function reorderEntity(state: DemoState, entity: DemoEntity, ids: string[]): void {
  entityAccess(state, entity);
  const rows = state[entity] as unknown as Row[], keys = uniqueStrings(ids);
  if (!keys.length) fail("Reorder IDs required");
  const ordered = keys.map(id => find(rows, id));
  const outlet = ordered[0].outlet_id;
  if (ordered.some(r => r.outlet_id !== outlet)) fail("Reorder must target one outlet");
  if (outlet) scope(state, outlet);
  const target = outlet ? rows.filter(r => r.outlet_id === outlet) : rows;
  if (target.length !== keys.length) fail("Reorder must include every scoped resource once");
  const reordered = ordered.map((r, i) => "sort_order" in r ? { ...r, sort_order: i + 1 } : r);
  let i = 0; const output = rows.map(r => target.includes(r) ? reordered[i++] : r);
  rows.splice(0, rows.length, ...output);
}
