import type { DemoSandbox } from "../engine";
import type { DemoCommand, DemoEntity, DemoOrder, DemoPaymentMethod, DemoReportEmail, DemoState } from "../models";
import { clone, date, deepFreeze, fail, find, jakartaDate, list, number, optionalText, record, shiftedDate, text } from "../business";
import { createDemoProjections, demoMenuId, demoMenus, type DemoViewData } from "./projections";
import { orderPayload, splitPayload } from "./payloads";

export interface DemoRequestOptions { app: "owner" | "pos"; active?: () => boolean; publicMenuBaseUrl?: string }
export type DemoRequestAdapter = typeof fetch & {
  readonly request: typeof fetch;
  getViewData(): DemoViewData;
  getLastPreview(): DemoReportEmail | null;
  destroy(): void;
};
class HttpError extends Error { constructor(message: string, readonly status: number) { super(message); } }
const denyMethod = (): never => { throw new HttpError("Method not allowed", 405); };
const unknown = (): never => { throw new HttpError("Local demo endpoint not found", 404); };
const allowed = (method: string, methods: string[]) => { if (!methods.includes(method)) denyMethod(); };
const select = (body: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter(key => body[key] !== undefined).map(key => [key, body[key]]));

/** Fetch-compatible local dispatcher. Strings must be relative /api paths. No fallback. */
export function createDemoRequestAdapter(sandbox: DemoSandbox, options: DemoRequestOptions): DemoRequestAdapter {
  if (!["owner", "pos"].includes(options.app)) fail("Invalid demo application");
  const app = options.app, generation = sandbox.generation, projector = createDemoProjections(sandbox);
  let disposed = false, lastPreview: DemoReportEmail | null = null;
  const active = (signal?: AbortSignal | null) => {
    try { if (disposed || signal?.aborted || (options.active && !options.active()) || sandbox.generation !== generation) throw new Error("inactive"); sandbox.getSnapshot(); }
    catch { throw new DOMException("Demo request scope is no longer active", "AbortError"); }
  };
  const response = (data: unknown, status = 200, signal?: AbortSignal | null, location?: string): Response => {
    active(signal);
    const result = new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Rakku-Demo": "local", ...(location ? { Location: location } : {}) } });
    for (const method of ["json", "text", "arrayBuffer", "blob", "formData"] as const) {
      const consume = result[method].bind(result);
      Object.defineProperty(result, method, { value: async () => { active(signal); const value = await consume(); active(signal); return value; } });
    }
    Object.defineProperty(result, "clone", { value: () => response(data, status, signal, location) });
    return result;
  };
  const run = (command: DemoCommand) => { active(); const value = sandbox.run(command, generation); active(); return value; };
  const view = () => { active(); return projector.read(); };
  const guard = (s: DemoState, ...menus: string[]) => {
    if (!s.session.authenticated) throw new HttpError("Authentication required", 401);
    if (s.session.mode !== app) throw new HttpError("Application session access denied", 403);
    if (app === "pos" && !menus.some(menu => s.menus.includes(menu))) throw new HttpError("Menu permission denied", 403);
  };
  const scope = (s: DemoState, outlet: unknown) => { const row = find(s.outlets, outlet); if (app === "pos" && row.id !== s.session.outlet_id) throw new HttpError("Outlet access denied", 403); return row.id; };
  const references = (s: DemoState, body: Record<string, unknown>, query: URLSearchParams) => {
    for (const key of ["company_id", "companyId"]) if (body[key] !== undefined && body[key] !== s.company.id) throw new HttpError("Invalid company scope", 403);
    if (query.has("company_id") && query.get("company_id") !== s.company.id) throw new HttpError("Invalid company scope", 403);
    for (const key of ["outlet_id", "outletId"]) if (body[key] !== undefined) scope(s, body[key]);
    if (query.has("outlet_id")) scope(s, query.get("outlet_id"));
    if (app === "pos") for (const key of ["cashierId", "cashier_id", "created_by"]) if (body[key] !== undefined && body[key] !== s.session.employee_id) throw new HttpError("Invalid cashier scope", 403);
  };
  const dates = (s: DemoState, range: unknown, from?: unknown, to?: unknown): [string, string] => {
    if (from !== undefined || to !== undefined) return [from === undefined ? shiftedDate(s.now, -29) : date(from), to === undefined ? jakartaDate(s.now) : date(to)];
    const name = range ?? "month"; if (!["today", "yesterday", "week", "month", "all"].includes(String(name))) fail("Invalid report date range");
    const until = name === "yesterday" ? shiftedDate(s.now, -1) : jakartaDate(s.now);
    const first = name === "today" || name === "yesterday" ? until : name === "week" ? shiftedDate(s.now, -6) : name === "all" ? s.orders.reduce((min, row) => jakartaDate(row.created_at) < min ? jakartaDate(row.created_at) : min, until) : shiftedDate(s.now, -29);
    return [first, until];
  };
  const dispatch = (path: string, method: string, query: URLSearchParams, body: Record<string, unknown>, form: FormData | null): { data: unknown; status?: number; location?: string } => {
    const result = (data: unknown, status = 200, location?: string) => ({ data, status, location });
    if (path.startsWith("/api/auth/")) {
      const prefix = app === "owner" ? "/api/auth/owner/" : "/api/auth/tenant/";
      if (!path.startsWith(prefix)) throw new HttpError("Application auth route denied", 403);
      const auth = path.slice(prefix.length);
      const context = sandbox.getSnapshot();
      for (const key of ["company_id", "companyId"]) if ((body[key] !== undefined && body[key] !== context.company.id) || (query.has(key) && query.get(key) !== context.company.id)) throw new HttpError("Invalid company scope", 403);
      if (auth === "session") { allowed(method, ["GET"]); return result(app === "owner" ? { owner: sandbox.getOwnerSession() } : sandbox.getTenantSession()); }
      if (auth === "login" && app === "owner") { allowed(method, ["POST"]); run({ type: "session.owner.login", email: body.email as string, password: body.password as string }); const owner = sandbox.getOwnerSession()!; return result({ owner: { id: owner.id, email: owner.email, name: owner.name }, redirect: "/" }); }
      if (auth === "company" && app === "pos") { allowed(method, ["POST"]); run({ type: "session.company", code: body.code as string, password: body.password as string }); const login = sandbox.getLoginContext(); return result({ company_id: login.company_id, company_name: login.company_name }); }
      if (auth === "outlet" && app === "pos") {
        allowed(method, ["GET", "POST"]);
        if (method === "POST") run({ type: "session.selectOutlet", outlet_id: text(body.outlet_id, "outlet ID") });
        const login = sandbox.getLoginContext(); return result(method === "GET" ? { outlets: login.outlets, company_name: login.company_name } : { outlet_id: login.outlet_id, outlet_name: login.outlet_name });
      }
      if (auth === "accounts" && app === "pos") { allowed(method, ["GET"]); const login = sandbox.getLoginContext(query.get("outlet_id") ?? undefined); return result({ accounts: login.accounts, outlet_name: login.outlet_name }); }
      if (auth === "verify-pin" && app === "pos") {
        allowed(method, ["POST"]); const s = sandbox.getSnapshot(); run({ type: "session.cashier", outlet_id: s.session.outlet_id, employee_id: text(body.user_id, "user ID"), pin: body.pin as string });
        const slug = sandbox.getSnapshot().menus[0] ?? "register"; return result({ redirect: `/${slug}` });
      }
      if (auth === "switch-user" && app === "pos") { allowed(method, ["POST"]); sandbox.getTenantSession(); run({ type: "session.switchUser" }); return result({ success: true, redirect: "/login/select-user" }, 303, "/login/select-user"); }
      if (auth === "logout") { allowed(method, ["POST"]); run({ type: "session.logout", mode: app }); return result({ success: true, redirect: "/login" }, 303, "/login"); }
      if (["register", "forgot-password", "reset-password", "resend-verification", "verify-email"].includes(auth)) throw new HttpError("Only fixture login is available in the local demo", 501);
      return unknown();
    }
    const s = sandbox.getSnapshot();
    const prefix = app === "owner" ? "/api/owner/" : "/api/admin/";
    const emailRoute = app === "owner" ? "/api/owner/reports/send-email" : "/api/reports/send-email";
    if (path === emailRoute) {
      allowed(method, ["POST"]); guard(s, "reports"); references(s, body, query);
      const [from, to] = dates(s, body.dateRange ?? body.date_range, body.from, body.to);
      const mail = run({ type: "email.preview", email: body.email as string, subject: body.subject as string | undefined, outlet_id: body.outlet_id as string | undefined, from, to }) as DemoReportEmail;
      lastPreview = mail; return result({ success: true, message: "Simulasi laporan dibuat; email tidak dikirim", preview: mail.body });
    }
    if (!path.startsWith(prefix)) throw new HttpError("Application API route denied", 403);
    const pieces = path.slice(prefix.length).split("/").map(piece => { const value = decodeURIComponent(piece); if (!value || /[\/\\]/.test(value)) fail("Invalid route segment"); return value; });
    const [name, resourceId, action] = pieces;
    const endpoints = app === "owner" ? ["products", "categories", "pricing-tiers", "product-tier-prices", "modifiers", "ingredients", "recipes", "taxes", "discounts", "orders", "tables", "outlets", "employees", "roles", "menus", "settings", "menu-qr", "subscription", "balance", "bank-accounts", "withdrawals", "reports"]
      : ["products", "categories", "pricing-tiers", "product-tier-prices", "modifiers", "modifier-tier-prices", "pricing-options", "ingredients", "recipes", "expenses", "tables", "taxes", "discounts", "orders", "purchases", "subscription"];
    if (!endpoints.includes(name)) return unknown();
    const entityMap: Record<string, DemoEntity> = { products: "products", categories: "categories", "pricing-tiers": "tiers", ingredients: "ingredients", expenses: "expenses", tables: "tables", taxes: "taxes", discounts: "discounts", outlets: "outlets", employees: "employees", roles: "roles", "bank-accounts": "banks" };
    const menuMap: Record<string, string[]> = { products: ["products", "register"], categories: ["products", "register"], "pricing-tiers": ["products", "register"], "product-tier-prices": ["products", "register"], modifiers: ["products", "register"], "modifier-tier-prices": ["products", "register"], "pricing-options": ["products", "register"],
      ingredients: ["ingredients"], expenses: ["expenses"], tables: ["tables", "register"], taxes: ["tax-discounts", "register"], discounts: ["tax-discounts", "register"], recipes: ["products", "ingredients"], orders: ["register", "orders"], purchases: ["purchases"], reports: ["reports"], subscription: s.menus };
    if (app === "pos" && name === "subscription") { if (!s.session.authenticated || s.session.mode !== "pos") throw new HttpError("Authentication required", 401); }
    else guard(s, ...(Object.hasOwn(menuMap, name) ? menuMap[name] : []));
    references(s, body, query);
    const v = view(), entity = Object.hasOwn(entityMap, name) ? entityMap[name] : undefined;
    const outlet = query.has("outlet_id") ? scope(s, query.get("outlet_id")) : undefined;
    const filter = <T extends { outlet_id: string }>(rows: T[]) => outlet ? rows.filter(row => row.outlet_id === outlet) : rows;
    const routeId = resourceId ?? body.id ?? query.get("id");
    const save = (kind: DemoEntity, value: Record<string, unknown>) => run({ type: "entity.save", entity: kind, value });
    const remove = (kind: DemoEntity, id: unknown) => run({ type: "entity.delete", entity: kind, id: text(id, "resource ID") });
    if (name === "menus" && pieces.length === 1) { allowed(method, ["GET"]); return result({ menus: demoMenus() }); }
    if (name === "settings" && pieces.length === 1) {
      allowed(method, ["GET", "PUT"]); if (method === "GET") return result({ company: v.company });
      if (body.new_company_password !== undefined) return result(run({ type: "company.adminPassword", password: body.new_company_password as string }));
      run({ type: "company.save", value: select(body, ["name", "logo_url"]) }); return result({ company: view().company });
    }
    if (name === "menu-qr" && pieces.length === 1) {
      allowed(method, ["GET"]);
      const base = options.publicMenuBaseUrl ? new URL(options.publicMenuBaseUrl).origin : "";
      return result({ posBaseUrl: base, outlets: v.outlets.filter(row => row.qr_menu_slug === "pusat" || row.qr_menu_slug === "taman").map(row => ({ id: row.id, name: row.name, qr_menu_slug: row.qr_menu_slug, menu_url: `${base}/demo/menu/${row.qr_menu_slug}` })) });
    }
    if (name === "subscription") {
      if (pieces.length === 1) { allowed(method, ["GET"]); return result(app === "owner" ? { summary: v.usage, plans: v.plans, invoices: v.invoices } : { summary: v.usage }); }
      if (app !== "owner") return unknown();
      if (resourceId === "checkout" && pieces.length === 2) { allowed(method, ["POST"]); if (body.plan_slug === "free") fail("Paket Free tidak memerlukan pembayaran"); return result({ invoice: run({ type: "subscription.checkout", plan: body.plan_slug as "pro" | "business", billing_cycle: body.billing_cycle === undefined ? "monthly" : body.billing_cycle as "monthly" | "yearly" }) }, 201); }
      if (resourceId === "invoices") {
        if (pieces.length === 2) { allowed(method, ["GET"]); return result({ invoices: v.invoices }); }
        if (pieces.length === 3 || (pieces.length === 4 && pieces[3] === "sync")) { allowed(method, pieces.length === 3 ? ["GET"] : ["POST"]); return result({ invoice: find(v.invoices, action), activated: false }); }
      }
      return unknown();
    }
    if (name === "balance") {
      if (pieces.length === 1) { allowed(method, ["GET"]); return result({ balance: v.balance }); }
      if (resourceId === "transactions" && pieces.length === 2) { allowed(method, ["GET"]); const limit = number(Number(query.get("limit") ?? 20), "limit", 1, true), offset = number(Number(query.get("offset") ?? 0), "offset", 0, true); if (limit > 100) fail("Pagination limit exceeds 100"); return result({ transactions: v.transactions.slice(offset, offset + limit), total: v.transactions.length, limit, offset }); }
      return unknown();
    }
    if (name === "withdrawals" && pieces.length === 1) { allowed(method, ["GET", "POST"]); return result(method === "GET" ? { withdrawals: v.withdrawals } : { withdrawal: run({ type: "withdrawal.create", bank_id: text(body.bank_account_id, "bank account ID"), amount: body.amount as number, note: body.note as string | undefined }) }, method === "POST" ? 201 : 200); }
    if (name === "reports" && resourceId === "profit-loss" && pieces.length === 2) {
      allowed(method, ["GET"]); const [from, to] = dates(s, query.get("date_range") ?? "all", query.get("from") ?? undefined, query.get("to") ?? undefined), report = sandbox.report(outlet, from, to);
      return result({ totalRevenue: report.revenue, totalHpp: report.cogs, grossProfit: report.grossProfit, totalExpenses: report.expenses, netProfit: report.netProfit, totalTransactions: report.orders });
    }
    if (name === "products" && resourceId === "upload" && pieces.length === 2) {
      allowed(method, ["POST"]); if (!form) fail("Multipart file required"); const id = text(form.get("productId"), "product ID"); find(s.products, id);
      active(); const url = sandbox.attachImage(form.get("file") as File); try { run({ type: "entity.save", entity: "products", value: { id, image_url: url } }); } catch (error) { sandbox.removeImage(url); throw error; }
      return result({ url });
    }
    if (name === "products" && resourceId === "image" && pieces.length === 2 && app === "pos") { allowed(method, ["DELETE"]); const id = text(body.productId ?? query.get("productId") ?? body.id, "product ID"), product = find(s.products, id); save("products", { id, image_url: null }); if (product.image_url) sandbox.removeImage(product.image_url); return result({ success: true }); }
    if (name === "product-tier-prices" && pieces.length === 1) {
      allowed(method, ["GET", "POST"]);
      if (method === "GET") { const productId = query.get("product_id"); if (productId) find(s.products, productId); const rows = v.productTierPrices.filter(row => (!productId || row.product_id === productId) && (!outlet || find(s.tiers, row.tier_id).outlet_id === outlet)); return result(app === "owner" ? { prices: rows } : rows); }
      const prices = priceMap(body.prices, "price"); run({ type: "product.prices", product_id: text(body.productId ?? body.product_id, "product ID"), prices }); return result({ success: true });
    }
    if (name === "modifier-tier-prices" && pieces.length === 1) {
      allowed(method, ["POST"]); const mod = find(v.modifiers, body.modifierId); const saved = run({ type: "modifier.save", product_id: mod.product_id, value: { id: mod.id, prices: priceMap(body.prices, "price_delta") } }); return result(list(body.prices).length ? view().modifiers.find(row => row.id === mod.id)!.tier_prices : saved && { success: true });
    }
    if (name === "modifiers" && pieces.length === 1) {
      allowed(method, ["GET", "POST", "PATCH", "DELETE"]);
      if (method === "GET") { const productId = text(query.get("product_id"), "product ID"); find(s.products, productId); const rows = v.modifiers.filter(row => row.product_id === productId); return result(app === "owner" ? { modifiers: rows } : rows); }
      if (method === "DELETE") return result(run({ type: "modifier.delete", id: text(routeId, "modifier ID") }));
      const existing = method === "PATCH" ? find(v.modifiers, body.id) : null;
      const value = select(body, ["id", "name", "group_name", "price_delta"]); if (body.prices !== undefined) value.prices = priceMap(body.prices, "price_delta");
      const saved = run({ type: "modifier.save", product_id: text(body.product_id ?? existing?.product_id, "product ID"), value }); return result(method === "PATCH" && app === "owner" ? { success: true } : saved, method === "POST" ? 201 : 200);
    }
    if (name === "recipes" && pieces.length === 1) {
      allowed(method, ["GET", "POST", "DELETE"]);
      if (method === "GET") return result(sandbox.getRecipes(text(query.get("product_id"), "product ID")));
      if (method === "DELETE") return result(run({ type: "recipe.delete", id: text(routeId, "recipe ID") }));
      const productId = text(body.product_id, "product ID"); if (sandbox.getRecipes(productId).some(row => row.ingredient_id === body.ingredient_id)) fail("Ingredient already exists in recipe");
      const created = run({ type: "recipe.save", product_id: productId, ingredient_id: text(body.ingredient_id, "ingredient ID"), quantity_used: body.quantity_used as number }) as { id: string };
      return result(find(sandbox.getRecipes(productId), created.id), 201);
    }
    if (name === "pricing-options" && pieces.length === 1) {
      allowed(method, ["GET", "POST", "PATCH", "DELETE"]);
      if (method === "GET") { const id = query.get("product_id"); if (id) find(s.products, id); return result(filter(v.pricingOptions).filter(row => !id || row.product_id === id)); }
      if (method === "DELETE") return result(run({ type: "pricingOption.delete", id: text(routeId, "pricing option ID") }));
      return result(run({ type: "pricingOption.save", value: body }), method === "POST" ? 201 : 200);
    }
    if (name === "purchases" && pieces.length === 1) {
      allowed(method, ["GET", "POST"]); if (method === "GET") return result(filter(v.purchases));
      const purchase = run({ type: "purchase.create", outlet_id: s.session.outlet_id, supplier_name: optionalText(body.supplier_name) ?? "", note: optionalText(body.note) ?? "", purchase_date: body.purchase_date as string | undefined, items: list(body.items) as Extract<DemoCommand, { type: "purchase.create" }>["items"] }) as { id: string; total_amount: number };
      return result({ success: true, id: purchase.id, total_amount: purchase.total_amount }, 201);
    }
    if (name === "orders") {
      if (pieces.length === 1) {
        allowed(method, app === "owner" ? ["GET"] : ["GET", "POST"]); if (method === "GET") return result(app === "owner" ? { orders: filter(v.orders) } : v.orders);
        const status = body.status ?? "completed"; if (!["draft", "completed", "pending_payment"].includes(String(status))) fail("Invalid order status");
        const created = run({ type: "order.create", ...orderPayload(s, body), status: status === "pending_payment" ? "pending" : status as "draft" | "completed", payment_method: methodFor(body.paymentMethod ?? "cash"), amount_paid: body.amount_paid as number | undefined, splits: splitPayload(body) }) as DemoOrder;
        return result(find(view().orders, created.id), 201);
      }
      if (app !== "pos") return unknown();
      if (resourceId === "draft" && pieces.length === 2) {
        allowed(method, ["GET", "POST", "PATCH", "DELETE"]); if (method === "GET") return result(v.orders.filter(row => row.status === "draft"));
        const draftId = body.id ?? query.get("id");
        if (method === "DELETE" || body.status === "cancelled") return result(run({ type: "order.cancel", id: text(draftId, "order ID") }));
        if (method === "POST") { const created = run({ type: "order.create", ...orderPayload(s, body), status: "draft", payment_method: "cash" }) as DemoOrder; return result(find(view().orders, created.id), 201); }
        const existing = find(s.orders, draftId), updated = run({ type: "order.draft.update", id: existing.id, value: orderPayload(s, body, existing), status: body.status as "draft" | "completed" | undefined,
          payment_method: methodFor(body.payment_method ?? "cash"), amount_paid: body.amount_paid as number | undefined, splits: splitPayload(body) }) as DemoOrder;
        return result(find(view().orders, updated.id));
      }
      if (resourceId === "split" && pieces.length === 2) { allowed(method, ["POST"]); const order = run({ type: "order.splits", id: text(body.orderId, "order ID"), splits: splitPayload(body) ?? [] }) as DemoOrder; return result(find(view().orders, order.id).split_payments); }
      if (resourceId === "qris") {
        if (pieces.length === 2) { allowed(method, ["POST"]); return result(run({ type: "order.qris.create", ...orderPayload(s, body) }), 201); }
        const order = find(s.orders, action), intent = s.payments.filter(row => row.order_id === order.id).at(-1) ?? fail("Resource not found: payment");
        if (pieces.length === 3) { allowed(method, ["GET"]); return result({ order: find(v.orders, order.id), intent }); }
        if (pieces.length === 4 && pieces[3] === "retry") { allowed(method, ["POST"]); return result({ intent: run({ type: "payment.retry", id: intent.id }) }); }
        if (pieces.length === 4 && pieces[3] === "cancel") { allowed(method, ["POST"]); run({ type: "order.cancel", id: order.id }); return result({ success: true }); }
      }
      return unknown();
    }
    if (entity) {
      if (pieces.length > 2) return unknown();
      if (name === "ingredients" && resourceId && pieces.length === 2) return unknown();
      if (["taxes", "discounts"].includes(name) && resourceId === "active") {
        allowed(method, ["GET"]); return result(name === "taxes" ? v.activeTaxes : { productDiscounts: v.activeProductDiscounts, orderDiscounts: v.activeOrderDiscounts });
      }
      if (name === "tables" && resourceId === "generate") { allowed(method, ["POST"]); return result(run({ type: "tables.generate", outlet_id: s.session.outlet_id, count: body.count as number, prefix: body.prefix as string | undefined }), 201); }
      if (resourceId && !(app === "owner" && ["outlets", "employees", "roles", "pricing-tiers", "taxes", "discounts", "bank-accounts"].includes(name) && ["PATCH", "DELETE"].includes(method))) return unknown();
      if (method === "GET") {
        if (resourceId) denyMethod();
        const rows = entity === "products" ? filter(v.products) : entity === "categories" ? filter(v.categories) : entity === "tiers" ? filter(v.tiers) : entity === "ingredients" ? filter(v.ingredients) : entity === "tables" ? filter(v.tables) : entity === "taxes" ? filter(v.taxes) : entity === "discounts" ? filter(s.discounts) : entity === "expenses" ? filter(v.expenses) : entity === "outlets" ? v.outlets : entity === "employees" ? v.employees : entity === "roles" ? v.roles : v.banks;
        if (app === "owner" && ["products", "categories", "ingredients"].includes(name) && !outlet) fail("outlet_id is required");
        if (entity === "discounts") { const products = (rows as typeof s.discounts).filter(row => row.product_id), orders = (rows as typeof s.discounts).filter(row => !row.product_id), type = query.get("type"); return result(app === "pos" && type ? type === "product" ? products : type === "order" ? orders : fail("Invalid discount scope") : { productDiscounts: products, orderDiscounts: orders }); }
        if (app === "owner") { const key = name === "bank-accounts" ? "bank_accounts" : name === "pricing-tiers" ? "tiers" : name; return result(entity === "ingredients" ? rows : { [key]: rows }); }
        return result(rows);
      }
      allowed(method, ["POST", "PATCH", "PUT", "DELETE"]);
      if (app === "owner" && entity === "ingredients") return denyMethod();
      if (method === "DELETE") return result(remove(entity, routeId));
      if (method === "PUT" && ["categories", "pricing-tiers"].includes(name)) {
        const ordered = list(body.orders).map(raw => record(raw)).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
        for (const row of ordered) number(row.sort_order, "sort order", 0, true);
        return result(run({ type: "entity.reorder", entity, ids: ordered.map(row => text(row.id, "resource ID")) }));
      }
      const value = { ...body };
      if (entity === "expenses" && body.amount !== undefined && Number(body.amount) <= 0) fail("Expense amount must be positive");
      if (app === "owner" && method === "POST" && ["taxes", "discounts"].includes(name) && Number(body.value) <= 0) fail("Value must be positive");
      if (method !== "POST") value.id = text(routeId, "resource ID");
      if (entity === "employees") {
        const existing = method !== "POST" ? find(s.employees, value.id) : null;
        if (body.toggle_status === true) { const row = save(entity, { id: existing!.id, is_active: !existing!.is_active }) as { is_active: boolean }; return result({ status: row.is_active ? "active" : "inactive" }); }
        if (body.reset_pin === true) { save(entity, { id: existing!.id, pin: body.new_pin }); return result({ success: true }); }
        const employee = save(entity, { ...select(body, ["name", "username", "pin"]), ...(existing ? { id: existing.id } : {}), ...(body.roleId !== undefined ? { role_id: body.roleId } : {}),
          ...(body.allOutlets !== undefined ? { all_outlets: body.allOutlets } : {}), ...(body.outletIds !== undefined ? { outlet_ids: body.outletIds } : {}) });
        return result(method === "POST" ? { employee: { id: (employee as { id: string }).id } } : { success: true }, method === "POST" ? 201 : 200);
      }
      if (entity === "outlets" && body.toggle_status === true) { const old = find(s.outlets, value.id), saved = save(entity, { id: old.id, is_active: !old.is_active }) as { is_active: boolean }; return result({ status: saved.is_active ? "active" : "inactive" }); }
      if (entity === "roles" && method === "POST") value.menus = [];
      if (entity === "discounts") {
        const kind = body.scope ?? query.get("scope") ?? "product"; if (!["product", "order"].includes(String(kind))) fail("Invalid discount scope");
        if (method !== "POST") { const old = find(s.discounts, value.id); if ((kind === "product") !== Boolean(old.product_id)) fail("Invalid discount resource scope"); }
        if (kind === "order") value.product_id = null; else if (method === "POST") text(body.product_id, "product ID");
      }
      if (entity === "banks" && body.account_number !== undefined) { const digits = text(body.account_number, "account number").replace(/\D/g, ""); if (digits.length < 8 || digits.length > 20) fail("Invalid account number"); value.account_number = digits; }
      if (entity === "banks" && body.status === "inactive") value.is_default = false;
      const saved = entity === "ingredients" && method !== "POST" ? run({ type: "ingredient.update", id: text(value.id, "ingredient ID"), value }) : save(entity, value);
      if (app === "owner") {
        if (method !== "POST" && ["outlets", "roles", "pricing-tiers", "taxes", "discounts"].includes(name)) return result({ success: true });
        const wrappers: Record<string, string> = { outlets: "outlet", roles: "role", "pricing-tiers": "tier", taxes: "tax", discounts: "discount", tables: "table", "bank-accounts": "bank_account" };
        return result(wrappers[name] ? { [wrappers[name]]: saved } : saved, method === "POST" ? 201 : 200);
      }
      return result(saved, method === "POST" ? 201 : 200);
    }
    return unknown();
  };
  const request = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal; active(signal);
    try {
      if (typeof input !== "string" || !input.startsWith("/api/") || /[\\#]/.test(input) || /(?:^|\/)\.\.?\//.test(input) || input.includes("//")) throw new HttpError("Only relative local API paths are allowed", 400);
      const url = new URL(input, "https://demo.invalid"), method = (init?.method ?? "GET").toUpperCase();
      let body: Record<string, unknown> = {}, form: FormData | null = null;
      if (init?.body !== undefined && init.body !== null) {
        if (init.body instanceof FormData) form = init.body;
        else if (typeof init.body === "string") { try { body = record(JSON.parse(init.body)); } catch { throw new HttpError("Invalid JSON body", 400); } }
        else throw new HttpError("Unsupported local request body", 400);
      }
      active(signal);
      // Precise extra routes, before the general resource dispatcher.
      let value: { data: unknown; status?: number; location?: string };
      const roleAccess = app === "owner" && url.pathname.match(/^\/api\/owner\/roles\/([^/]+)\/access$/);
      const stockAdjust = app === "pos" && url.pathname.match(/^\/api\/admin\/ingredients\/([^/]+)\/adjust$/);
      if (roleAccess) {
        const s = sandbox.getSnapshot(); guard(s); references(s, body, url.searchParams); allowed(method, ["GET", "POST"]); const role = find(s.roles, decodeURIComponent(roleAccess[1]));
        if (method === "GET") value = { data: { menu_access: role.menus.map(demoMenuId) } };
        else { if (!s.plans.find(row => row.slug === s.plan)!.features.custom_roles) fail("PLAN_LIMIT: custom_roles"); const menu = find(demoMenus(), body.menuId); if (typeof body.canView !== "boolean") fail("Invalid canView");
          run({ type: "entity.save", entity: "roles", value: { id: role.id, menus: body.canView ? [...new Set([...role.menus, menu.slug])] : role.menus.filter(slug => slug !== menu.slug) } }); value = { data: { message: "Akses menu diupdate" } }; }
      } else if (stockAdjust) {
        const s = sandbox.getSnapshot(); guard(s, "ingredients"); references(s, body, url.searchParams); allowed(method, ["POST"]);
        value = { data: { success: true, ...record(run({ type: "stock.adjust", ingredient_id: decodeURIComponent(stockAdjust[1]), quantity: body.stock_quantity as number, note: optionalText(body.note) ?? "" })) } };
      } else value = dispatch(url.pathname, method, url.searchParams, body, form);
      active(signal); return response(value.data, value.status, signal, value.location);
    } catch (error) {
      active(signal); if (error instanceof DOMException && error.name === "AbortError") throw error;
      const message = error instanceof Error ? error.message : "Local request failed";
      const plan = message.startsWith("PLAN_LIMIT:"), status = error instanceof HttpError ? error.status : plan || /permission|access denied|Owner access|scope|assignment|inactive/i.test(message) ? 403 : /Authentication|credentials|PIN/i.test(message) ? 401 : /Resource not found/i.test(message) ? 404 : 400;
      let details: Record<string, unknown> = {};
      if (plan) { const key = message.slice("PLAN_LIMIT:".length).trim(); try { const summary = sandbox.getUsageSummary(); if (key in summary.usage) details = { current: summary.usage[key as keyof typeof summary.usage], max: summary.limits[key as keyof typeof summary.limits] }; } catch { /* no private data in unauthenticated errors */ } }
      return response({ error: message, ...(plan ? { code: "PLAN_LIMIT", ...details } : {}) }, status, signal);
    }
  }) as DemoRequestAdapter;
  Object.defineProperty(request, "request", { value: request });
  request.getViewData = () => view(); request.getLastPreview = () => { active(); return lastPreview; }; request.destroy = () => { disposed = true; lastPreview = null; };
  return request;
}
function priceMap(raw: unknown, key: string): Record<string, number> {
  const entries = list(raw).map(value => { const row = record(value); return [text(row.tier_id, "tier ID"), row[key]] as const; });
  if (new Set(entries.map(([id]) => id)).size !== entries.length) fail("Duplicate price tier"); return Object.fromEntries(entries) as Record<string, number>;
}
function methodFor(raw: unknown): DemoPaymentMethod { return (raw === "qris" ? "qris_manual" : raw) as DemoPaymentMethod; }
