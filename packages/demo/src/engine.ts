import type { BalanceTransaction, PaymentIntent, PublicMenu, SubscriptionInvoice, UsageSummary, Withdrawal } from "@rakku/shared-types";
import type { DemoCommand, DemoNotificationType, DemoOrder, DemoPaymentMethod, DemoReport, DemoReportEmail, DemoSplit, DemoState } from "./models";
import { createFixture } from "./fixture";
import { addTime, calculateReport, clone, date, deepFreeze, deriveBalance, fail, find, instant, jakartaDate, list, money, number, optionalText, quote, recipeId, record, shiftedDate, text } from "./business";
import { owner, projectSnapshot, requireMenu, requireOwner, scope, sessionMenus, validateSession } from "./access";
import { deleteEntity, reorderEntity, saveEntity } from "./entities";
import { addSubscriptionPeriod, DEMO_IMAGE_MIME_TYPES, DRAFT_EXPIRY_HOURS, GRACE_DAYS, MAX_DEMO_IMAGE_BYTES, MAX_PENDING_WITHDRAWALS, MIN_WITHDRAWAL, ORDER_QR_EXPIRY_MINUTES, QRIS_MDR_RATE, TRANSACTION_GRACE_DAYS, TRANSACTION_GRACE_RATIO, WITHDRAWAL_DAILY_LIMIT, WITHDRAWAL_FEE } from "./constants";

/** One visitor's disposable domain. No network, timers, storage, or global instance. */
export class DemoSandbox {
  readonly generation: string;
  #state: DemoState;
  #snapshot: DemoState;
  #listeners = new Set<() => void>();
  #destroyed = false;
  #sequence = 0;
  #images = new Set<string>();
  #ownerPassword: string;

  constructor(now: Date = new Date()) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("Invalid sandbox date");
    this.generation = globalThis.crypto?.randomUUID?.() ?? `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    Object.defineProperty(this, "generation", { writable: false, configurable: false });
    this.#state = deepFreeze(createFixture(now.toISOString(), this.generation));
    this.#ownerPassword = this.#state.company.password;
    this.#snapshot = deepFreeze(projectSnapshot(this.#state));
  }

  getSnapshot = (): DemoState => { this.alive(); return this.#snapshot; };
  subscribe = (listener: () => void): (() => void) => {
    this.alive(); if (typeof listener !== "function") fail("Invalid listener");
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  };
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true; this.#listeners.clear();
    for (const url of this.#images) URL.revokeObjectURL(url);
    this.#images.clear();
  }
  private alive(): void { if (this.#destroyed) fail("Demo sandbox destroyed"); }

  getLoginContext(outletId?: string) {
    this.alive(); const outlet = outletId === undefined ? this.#state.outlets.find(row => row.id === this.#state.session.outlet_id && row.is_active) ?? this.#state.outlets.find(row => row.is_active) : find(this.#state.outlets, outletId);
    if (outlet && !outlet.is_active) fail("Outlet inactive");
    return deepFreeze({ company_id: this.#state.company.id, company_name: this.#state.company.name, outlet_id: outlet?.id ?? "", outlet_name: outlet?.name ?? "",
      outlets: this.#state.outlets.filter(row => row.is_active).map(row => ({ id: row.id, name: row.name, address: row.address, status: "active", company_id: row.company_id })),
      accounts: this.#state.employees.filter(row => outlet && row.is_active && (row.all_outlets || row.outlet_ids.includes(outlet.id))).map(row => ({ id: row.id, name: row.name, username: row.username, avatar_url: null,
        role_id: row.role_id, role_name: find(this.#state.roles, row.role_id).name, status: "active" })) });
  }

  getTenantSession() {
    this.alive(); if (this.#state.session.mode !== "pos" || !this.#state.session.authenticated) fail("Authentication required");
    sessionMenus(this.#state);
    const employee = find(this.#state.employees, this.#state.session.employee_id), outlet = find(this.#state.outlets, this.#state.session.outlet_id);
    return deepFreeze({ user_id: employee.id, company_id: this.#state.company.id, outlet_id: outlet.id, role_id: employee.role_id, user_name: employee.name,
      role_name: find(this.#state.roles, employee.role_id).name, company_name: this.#state.company.name, outlet_name: outlet.name });
  }

  getOwnerSession() {
    this.alive(); if (!owner(this.#state)) return null;
    return deepFreeze({ id: `demo-owner:${this.generation}`, owner_id: `demo-owner:${this.generation}`, email: this.#state.company.email, name: this.#state.company.owner_name, phone: null,
      company_id: this.#state.company.id, company_name: this.#state.company.name, company_code: this.#state.company.code, company_slug: "rakku-demo-cafe", company_logo_url: this.#state.company.logo_url ?? null, has_company: true });
  }

  getUsageSummary(): UsageSummary {
    this.alive(); if (!this.#state.session.authenticated) fail("Authentication required"); sessionMenus(this.#state);
    const s = this.#state, plan = s.plans.find(row => row.slug === s.plan)!;
    const monthly = s.orders.filter(row => row.status === "completed" && jakartaDate(row.created_at).slice(0, 7) === jakartaDate(s.now).slice(0, 7)).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const start = plan.max_transactions_month > 0 ? monthly[plan.max_transactions_month - 1]?.created_at : undefined;
    return deepFreeze(clone({ plan, status: s.subscription_status, is_trial: false, trial_ends_at: null, plan_expires_at: s.plan_expires_at,
      grace_ends_at: s.subscription_status === "grace" && s.plan_expires_at ? addTime(s.plan_expires_at, GRACE_DAYS * 86400_000) : null,
      transaction_grace_ends_at: start ? addTime(start, TRANSACTION_GRACE_DAYS * 86400_000) : null,
      usage: { outlets: s.outlets.length, employees: s.employees.length, products: s.products.length, ingredients: s.ingredients.length, transactions: monthly.length },
      limits: { outlets: plan.max_outlets, employees: plan.max_employees, products: plan.max_products, ingredients: plan.max_ingredients, transactions: plan.max_transactions_month }, features: plan.features }));
  }
  getRecipes(productId: string) {
    this.alive(); requireMenu(this.#state, "products", "ingredients"); const product = find(this.#state.products, productId); scope(this.#state, product.outlet_id);
    return deepFreeze(product.recipe.map(row => { const ingredient = find(this.#state.ingredients, row.ingredient_id); return { id: row.id ?? recipeId(product.id, row.ingredient_id), product_id: product.id,
      ingredient_id: ingredient.id, quantity_used: row.quantity_used, created_at: row.created_at ?? ingredient.created_at, ingredients: { name: ingredient.name, unit: ingredient.unit }, ingredient_name: ingredient.name, ingredient_unit: ingredient.unit }; }));
  }
  getPurchases() {
    this.alive(); requireMenu(this.#state, "purchases");
    return deepFreeze(clone(this.#state.purchases.filter(row => owner(this.#state) || row.outlet_id === this.#state.session.outlet_id).map(row => ({ ...row, items: row.items.map(item => {
      const ingredient = find(this.#state.ingredients, item.ingredient_id); return { ...item, ingredient_name: ingredient.name, ingredient_unit: ingredient.unit, ingredients: { name: ingredient.name, unit: ingredient.unit } };
    }) }))));
  }

  attachImage(file: File): string {
    this.alive(); requireMenu(this.#state, "products");
    if (typeof File === "undefined" || !(file instanceof File)) fail("Image attachment requires a File");
    if (!(DEMO_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) fail("Invalid image type: use JPG, PNG, or WebP");
    if (file.size <= 0 || file.size > MAX_DEMO_IMAGE_BYTES) fail("Image must contain data and be at most 2 MiB");
    const url = URL.createObjectURL(file);
    this.#images.add(url); return url;
  }

  removeImage(url: string): void {
    this.alive(); text(url, "image URL", 1000);
    // Cleanup is permitted even after switching users. It cannot alter records
    // or revoke another visitor's URL, or one still referenced by any product.
    if (!this.#images.has(url) || this.#state.products.some(product => product.image_url === url)) return;
    URL.revokeObjectURL(url); this.#images.delete(url);
  }

  run(command: DemoCommand, generation?: string): unknown {
    this.alive();
    if (generation !== undefined && generation !== this.generation) fail("Stale demo generation");
    record(command);
    // Clone-on-write makes every command atomic, including multi-item validation.
    const state = clone(this.#state), oldSequence = this.#sequence;
    const nextId = (kind: string) => `${this.generation}:${kind}:${++this.#sequence}`;
    let result: unknown;
    try {
      result = this.dispatch(state, command, nextId);
      validateSession(state);
      state.menus = sessionMenus(state);
      state.balance = deriveBalance(state.ledger, state.company.id, state.now);
      if (state.balance.available_balance < 0 || state.balance.pending_balance < 0) fail("Negative merchant balance");
    } catch (error) { this.#sequence = oldSequence; throw error; }
    if (JSON.stringify(state) !== JSON.stringify(this.#state)) {
      this.#state = deepFreeze(state);
      this.#snapshot = deepFreeze(projectSnapshot(state));
      // Subscribers observe a committed snapshot. A bad subscriber cannot roll back
      // a completed transaction or prevent other subscribers from being notified.
      for (const listener of [...this.#listeners]) { if (this.#destroyed) break; try { listener(); } catch { /* independent subscribers */ } }
    }
    return result === undefined ? undefined : deepFreeze(clone(result));
  }

  publicMenu(outletId: string): PublicMenu {
    this.alive();
    const outlet = find(this.#state.outlets, outletId);
    if (!outlet.is_active) fail("Outlet inactive");
    // Explicitly public: never project recipe, costs, tenant credentials, or orders.
    return deepFreeze({ outletName: outlet.name,
      categories: this.#state.categories.filter(c => c.outlet_id === outlet.id).sort((a, b) => a.sort_order - b.sort_order).map(c => ({ id: c.id, name: c.name,
        products: this.#state.products.filter(p => p.outlet_id === outlet.id && p.category_id === c.id && p.is_active).sort((a, b) => a.sort_order - b.sort_order)
          .map(p => ({ id: p.id, name: p.name, price: p.price, description: p.description, image_url: p.image_url })) })) });
  }

  report(outletId?: string, from?: string, to?: string): DemoReport {
    this.alive(); return deepFreeze(this.readReport(this.#state, outletId, from, to, true));
  }

  salesReport(outletId?: string, from?: string, to?: string): DemoReport {
    this.alive(); return deepFreeze(this.readReport(this.#state, outletId, from, to));
  }

  private readReport(state: DemoState, outletId?: string, from?: string, to?: string, requireProfit = false): DemoReport {
    requireMenu(state, "reports");
    const selected = outletId ?? (owner(state) ? undefined : state.session.outlet_id);
    if (selected !== undefined) scope(state, selected, true);
    const plan = state.plans.find(p => p.slug === state.plan)!;
    if (requireProfit && !plan.features.profit_loss) fail("PLAN_LIMIT: profit_loss");
    const start = from ?? shiftedDate(state.now, -29), end = to ?? jakartaDate(state.now);
    date(start); date(end);
    if (plan.report_history_days >= 0 && start < shiftedDate(state.now, -(plan.report_history_days - 1))) fail("PLAN_LIMIT: report_history_days");
    return calculateReport(state, selected, start, end, Boolean(plan.features.profit_loss));
  }

  private dispatch(state: DemoState, command: DemoCommand, nextId: (kind: string) => string): unknown {
    switch (command.type) {
      case "session.owner": state.session = { mode: "owner", outlet_id: state.session.outlet_id || state.outlets.find(o => o.is_active)?.id || "", employee_id: null, authenticated: true }; return state.session;
      case "session.owner.login": {
        if (validEmail(command.email).toLowerCase() !== state.company.email.toLowerCase() || command.password !== this.#ownerPassword) fail("Invalid owner credentials");
        return this.dispatch(state, { type: "session.owner" }, nextId);
      }
      case "session.company": {
        if (text(command.code, "company code").toUpperCase() !== state.company.code || command.password !== state.company.password) fail("Invalid company credentials");
        state.session = { mode: "pos", outlet_id: state.outlets.find(row => row.is_active)?.id ?? "", employee_id: null, authenticated: false, company_verified: true }; return state.session;
      }
      case "session.logout": if (!["owner", "pos"].includes(command.mode)) fail("Invalid session mode"); state.session = { mode: command.mode, outlet_id: state.session.outlet_id, employee_id: null, authenticated: false, company_verified: false }; return state.session;
      case "session.cashier": {
        const outlet = find(state.outlets, command.outlet_id), employee = find(state.employees, command.employee_id);
        if (!outlet.is_active || !employee.is_active || (!employee.all_outlets && !employee.outlet_ids.includes(outlet.id)) || employee.pin !== command.pin) fail("Invalid employee, PIN, or outlet assignment");
        find(state.roles, employee.role_id);
        state.session = { mode: "pos", outlet_id: outlet.id, employee_id: employee.id, authenticated: true }; return state.session;
      }
      case "session.selectOutlet": {
        const outlet = find(state.outlets, command.outlet_id); if (!outlet.is_active) fail("Outlet inactive");
        state.session.outlet_id = outlet.id;
        validateSession(state); return state.session;
      }
      case "session.switchUser": state.session = { mode: "pos", outlet_id: state.session.outlet_id, employee_id: null, authenticated: false, company_verified: true }; return state.session;
      case "company.save": {
        requireOwner(state); const v = record(command.value);
        if (v.id !== undefined && v.id !== state.company.id) fail("Invalid company ID");
        if (v.company_id !== undefined && v.company_id !== state.company.id) fail("Invalid company scope");
        if (v.password !== undefined) fail("Use company.password");
        const code = text(v.code ?? state.company.code, "company code", 30).toUpperCase(); if (!/^[A-Z0-9_]+$/.test(code)) fail("Invalid company code");
        const email = validEmail(v.email ?? state.company.email);
        const logo_url = optionalText(v.logo_url === undefined ? state.company.logo_url : v.logo_url);
        if (logo_url && !/^\/demo-assets\/[\w/-]+\.(svg|png|webp|jpg)$/.test(logo_url) && !this.#images.has(logo_url)) fail("Invalid company logo");
        state.company = { id: state.company.id, name: text(v.name ?? state.company.name, "company name", 100), code, email,
          owner_name: text(v.owner_name ?? state.company.owner_name, "owner name", 100), password: state.company.password, ...(v.logo_url !== undefined || state.company.logo_url !== undefined ? { logo_url } : {}) }; return state.company;
      }
      case "company.password": {
        requireOwner(state);
        if (command.current !== undefined && command.current !== state.company.password) fail("Current password incorrect");
        const password = text(command.password, "password", 128); if (password.length < 6) fail("Password needs at least 6 characters");
        state.company.password = password; return { success: true };
      }
      case "company.adminPassword": {
        requireOwner(state); const password = text(command.password, "company password", 128); if (password.length < 6) fail("Company password needs at least 6 characters");
        state.company.password = password; return { success: true, updated: "password" };
      }
      case "ingredient.update": {
        requireMenu(state, "ingredients"); const ingredient = find(state.ingredients, command.id); scope(state, ingredient.outlet_id);
        const value = record(command.value); if (value.id !== undefined && value.id !== ingredient.id) fail("Invalid ingredient ID");
        const previous = ingredient.stock_quantity, target = value.stock_quantity === undefined ? previous : number(value.stock_quantity, "stock", previous < 0 && value.stock_quantity === previous ? -Infinity : 0);
        const updated = saveEntity(state, "ingredients", { ...value, id: ingredient.id, stock_quantity: previous }, nextId, this.#images);
        if (target !== previous) { this.movement(state, ingredient.id, target - previous, "adjustment", null, optionalText(command.note) ?? "Perubahan stok melalui form", nextId); find(state.ingredients, ingredient.id).stock_quantity = target; }
        return updated;
      }
      case "product.prices": return saveEntity(state, "products", { id: command.product_id, prices: command.prices }, nextId, this.#images);
      case "modifier.save": {
        requireMenu(state, "products"); const product = find(state.products, command.product_id); scope(state, product.outlet_id); const value = record(command.value);
        const existing = value.id ? find(product.modifiers, value.id) : null;
        const modifiers = existing ? product.modifiers.map(row => row.id === existing.id ? { ...row, ...value } : row) : [...product.modifiers, value];
        saveEntity(state, "products", { id: product.id, modifiers }, nextId, this.#images);
        const saved = find(state.products, product.id); return existing ? find(saved.modifiers, existing.id) : saved.modifiers.at(-1);
      }
      case "modifier.delete": {
        requireMenu(state, "products"); const product = state.products.find(row => row.modifiers.some(mod => mod.id === command.id)) ?? fail("Resource not found: modifier"); scope(state, product.outlet_id);
        saveEntity(state, "products", { id: product.id, modifiers: product.modifiers.filter(row => row.id !== command.id) }, nextId, this.#images); return { success: true };
      }
      case "recipe.save": {
        requireMenu(state, "products", "ingredients"); const product = find(state.products, command.product_id); scope(state, product.outlet_id);
        const ingredient = find(state.ingredients, command.ingredient_id); if (ingredient.outlet_id !== product.outlet_id) fail("Invalid recipe scope");
        const quantity_used = number(command.quantity_used, "recipe quantity", 0.000001);
        const prior = product.recipe.find(row => row.ingredient_id === ingredient.id), id = prior?.id ?? (prior ? recipeId(product.id, ingredient.id) : nextId("recipe")), created_at = prior?.created_at ?? (prior ? ingredient.created_at : state.now);
        product.recipe = [...product.recipe.filter(row => row.ingredient_id !== ingredient.id), { ingredient_id: ingredient.id, quantity_used, id, created_at }];
        return { id, product_id: product.id, ingredient_id: ingredient.id, quantity_used, created_at };
      }
      case "recipe.delete": {
        requireMenu(state, "products", "ingredients"); const product = state.products.find(row => row.recipe.some(r => (r.id ?? recipeId(row.id, r.ingredient_id)) === command.id)) ?? fail("Resource not found: recipe"); scope(state, product.outlet_id);
        product.recipe = product.recipe.filter(row => (row.id ?? recipeId(product.id, row.ingredient_id)) !== command.id); return { success: true };
      }
      case "pricingOption.save": {
        requireMenu(state, "products"); const v = record(command.value), rows = state.pricing_options ?? (state.pricing_options = []);
        const existing = v.id ? find(rows, v.id) : null, product = find(state.products, v.product_id ?? existing?.product_id); scope(state, product.outlet_id);
        if ((v.company_id !== undefined && v.company_id !== state.company.id) || (v.outlet_id !== undefined && v.outlet_id !== product.outlet_id) || (existing && existing.product_id !== product.id)) fail("Invalid pricing option scope");
        const is_active = v.is_active === undefined ? existing?.is_active ?? true : v.is_active; if (typeof is_active !== "boolean") fail("Invalid boolean");
        const value = { id: existing?.id ?? nextId("pricing-option"), product_id: product.id, company_id: state.company.id, outlet_id: product.outlet_id,
          name: text(v.name ?? existing?.name, "pricing option name", 100), price: money(v.price ?? existing?.price), is_active,
          sort_order: number(v.sort_order ?? existing?.sort_order ?? rows.length + 1, "sort order", 0, true), created_at: existing?.created_at ?? state.now };
        if (existing) rows[rows.indexOf(existing)] = value; else rows.push(value); return value;
      }
      case "pricingOption.delete": {
        requireMenu(state, "products"); const rows = state.pricing_options ?? [], row = find(rows, command.id); scope(state, row.outlet_id); rows.splice(rows.indexOf(row), 1); return { success: true };
      }
      case "entity.save": return saveEntity(state, command.entity, command.value, nextId, this.#images);
      case "entity.delete": deleteEntity(state, command.entity, command.id); return { success: true };
      case "entity.reorder": reorderEntity(state, command.entity, command.ids); return { success: true };
      case "order.quote": requireMenu(state, "register"); scope(state, command.outlet_id); return quote(state, command, `${this.generation}:quote`);
      case "order.create": {
        requireMenu(state, "register"); scope(state, command.outlet_id);
        if (!["draft", "completed", "pending"].includes(command.status)) fail("Invalid create status");
        paymentMethod(command.payment_method);
        if (command.splits !== undefined) list(command.splits);
        if (command.amount_paid !== undefined) money(command.amount_paid, "amount paid");
        if (command.status === "pending" && (command.payment_method !== "qris" || command.splits?.length || command.amount_paid !== undefined)) fail("Pending orders require unpaid unsplit dynamic QRIS");
        if (command.status === "completed" && command.payment_method === "qris") fail("Dynamic QRIS requires payment success");
        if (command.status === "draft" && (command.splits?.length || command.amount_paid !== undefined)) fail("Draft cannot be paid");
        const order = quote(state, command, nextId("order"));
        if (order.table_id && find(state.tables, order.table_id).status === "occupied") fail("Table occupied");
        order.reserved_until = addTime(state.now, DRAFT_EXPIRY_HOURS * 3600_000);
        state.orders.push(order);
        if (order.table_id) find(state.tables, order.table_id).status = "occupied";
        if (command.status === "pending") { this.pendingOrder(state, order); }
        else if (command.status === "completed") this.completeOrder(state, order, command.payment_method, command.amount_paid, command.splits, nextId);
        return order;
      }
      case "order.qris.create": {
        const order = this.dispatch(state, { ...command, type: "order.create", status: "pending", payment_method: "qris" }, nextId) as DemoOrder;
        return { order, intent: this.createPayment(state, order, nextId) };
      }
      case "order.draft.update": {
        requireMenu(state, "register", "orders"); const previous = this.scopedOrder(state, command.id);
        if (previous.status === "completed") return previous;
        if (previous.status !== "draft" || (previous.reserved_until && previous.reserved_until <= state.now)) fail("Order is not a valid draft");
        const value = record(command.value); if (value.outlet_id !== undefined && value.outlet_id !== previous.outlet_id) fail("Cannot move order between outlets");
        const normalized = quote(state, { outlet_id: previous.outlet_id, tier_id: value.tier_id as string ?? previous.tier_id,
          items: value.items as DemoOrder["items"] ?? previous.items.map(row => ({ product_id: row.product_id, quantity: row.quantity, modifier_ids: row.modifier_ids, custom_modifiers: row.custom_modifiers, cart_item_id: row.cart_item_id, note: row.note })),
          customer_name: value.customer_name as string ?? previous.customer_name, table_id: value.table_id === undefined ? previous.table_id : value.table_id as string | null,
          order_type: value.order_type as DemoOrder["order_type"] ?? previous.order_type, note: value.note === undefined ? previous.note : value.note as string | null }, previous.id);
        if (normalized.table_id && normalized.table_id !== previous.table_id && find(state.tables, normalized.table_id).status === "occupied") fail("Table occupied");
        normalized.created_at = previous.created_at; normalized.order_number = previous.order_number; normalized.reserved_until = previous.reserved_until;
        state.orders[state.orders.indexOf(previous)] = normalized;
        if (previous.table_id && previous.table_id !== normalized.table_id && !state.orders.some(row => row.id !== previous.id && row.table_id === previous.table_id && ["draft", "pending_payment"].includes(row.status))) find(state.tables, previous.table_id).status = "available";
        if (normalized.table_id) find(state.tables, normalized.table_id).status = "occupied";
        if (command.status === "completed") this.completeOrder(state, normalized, command.payment_method ?? "cash", command.amount_paid, command.splits, nextId);
        else if (command.status !== undefined && command.status !== "draft") fail("Invalid draft status");
        return normalized;
      }
      case "order.splits": {
        requireMenu(state, "register", "orders"); const order = this.scopedOrder(state, command.id); if (order.status !== "completed") fail("Split payments require completed order");
        order.splits = this.normalizeSplits(order, command.splits); if (!order.splits.length) fail("Split payments required"); order.split_bill = true; return order;
      }
      case "order.complete": {
        requireMenu(state, "register", "orders"); const order = this.scopedOrder(state, command.id);
        paymentMethod(command.payment_method);
        if (command.splits !== undefined) list(command.splits);
        if (command.amount_paid !== undefined) money(command.amount_paid, "amount paid");
        if (order.status === "completed") return order;
        if (order.status === "cancelled") fail("Order cancelled");
        if (order.status === "draft" && order.reserved_until && order.reserved_until <= state.now) fail("Draft expired");
        if (command.payment_method === "qris") {
          if (order.status === "draft") fail("Draft cannot use dynamic QRIS; complete with a manual method or create a separate pending order");
          if (command.splits?.length || command.amount_paid !== undefined) fail("Dynamic QRIS cannot be split or paid manually");
          this.pendingOrder(state, order);
        } else this.completeOrder(state, order, command.payment_method, command.amount_paid, command.splits, nextId);
        return order;
      }
      case "order.cancel": {
        requireMenu(state, "orders", "register"); const order = this.scopedOrder(state, command.id);
        if (order.status === "completed") fail("Completed order cannot be cancelled");
        this.cancelOrder(state, order); return order;
      }
      case "order.updateDraft": {
        requireMenu(state, "register", "orders"); const order = this.scopedOrder(state, command.id);
        if (order.status !== "draft") fail("Only drafts can be updated");
        if (command.input.outlet_id !== order.outlet_id) fail("Cannot move draft between outlets");
        const updated = quote(state, { ...command.input, table_id: command.input.table_id ?? order.table_id }, order.id);
        updated.order_number = order.order_number; updated.created_at = order.created_at;
        updated.status = "draft"; updated.payment_status = "unpaid"; updated.reserved_until = addTime(state.now, DRAFT_EXPIRY_HOURS * 3600_000);
        state.orders[state.orders.indexOf(order)] = updated;
        return updated;
      }
      case "stock.adjust": {
        requireMenu(state, "ingredients"); this.feature(state, "inventory_advanced");
        const ingredient = find(state.ingredients, command.ingredient_id); scope(state, ingredient.outlet_id);
        const quantity = number(command.quantity, "absolute stock"), note = optionalText(command.note), previous_stock = ingredient.stock_quantity;
        this.movement(state, ingredient.id, quantity - previous_stock, "adjustment", null, note, nextId);
        ingredient.stock_quantity = quantity;
        return { previous_stock, new_stock: quantity, quantity_change: quantity - previous_stock };
      }
      case "purchase.create": {
        requireMenu(state, "purchases"); this.feature(state, "inventory_advanced");
        const outlet_id = scope(state, command.outlet_id), id = nextId("purchase");
        const purchase_date = date(command.purchase_date ?? jakartaDate(state.now)); if (purchase_date > jakartaDate(state.now)) fail("Future purchase date");
        const supplier_name = optionalText(command.supplier_name, 100), note = optionalText(command.note);
        const items = list(command.items).map(raw => {
          const r = record(raw), ingredient = find(state.ingredients, r.ingredient_id);
          if (ingredient.outlet_id !== outlet_id || !ingredient.is_active) fail("Invalid purchase ingredient");
          const quantity = number(r.quantity, "purchase quantity", 0.000001), unit_cost = number(r.unit_cost, "unit cost");
          return { id: nextId("purchase-item"), purchase_id: id, ingredient_id: ingredient.id, quantity, unit_cost, subtotal: money(Math.round(quantity * unit_cost)) };
        });
        if (!items.length || items.length > 100 || new Set(items.map(i => i.ingredient_id)).size !== items.length) fail("Invalid or duplicate purchase items");
        const purchase = { id, company_id: state.company.id, outlet_id, supplier_name, note, purchase_date, total_amount: money(items.reduce((s, i) => s + i.subtotal, 0)), items, created_by: state.session.employee_id, created_at: state.now };
        state.purchases.push(purchase);
        for (const item of items) {
          find(state.ingredients, item.ingredient_id).cost_per_unit = item.unit_cost;
          this.movement(state, item.ingredient_id, item.quantity, "purchase", id, note, nextId);
        }
        return purchase;
      }
      case "tables.generate": {
        requireMenu(state, "tables"); const outlet_id = scope(state, command.outlet_id), count = number(command.count, "table count", 1, true);
        if (count > 100) fail("At most 100 tables per command");
        const prefix = text(command.prefix ?? "Meja", "table prefix", 80), output = [];
        let i = 1;
        while (output.length < count) {
          const name = `${prefix} ${i++}`; if (state.tables.some(t => t.outlet_id === outlet_id && t.name === name)) continue;
          const table = { id: nextId("table"), company_id: state.company.id, outlet_id, name, status: "available" as const, created_at: state.now };
          state.tables.push(table); output.push(table);
        }
        return output;
      }
      case "payment.create": {
        requireMenu(state, "register", "orders"); return this.createPayment(state, this.scopedOrder(state, command.order_id), nextId);
      }
      case "payment.transition": {
        requireMenu(state, "register", "orders"); const payment = find(state.payments, command.id), order = this.scopedOrder(state, payment.order_id);
        intentStatus(command.status);
        if (payment.status === command.status) return payment;
        if (payment.status !== "pending") fail("Payment already final");
        if (command.status === "success") {
          if (!payment.expired_at || Date.parse(payment.expired_at) <= Date.parse(state.now)) fail("Payment expired");
          if (order.status !== "pending_payment" || order.split_bill || order.total !== payment.amount || order.payment_method !== "qris") fail("Invalid payment order");
          this.completeOrder(state, order, "qris", order.total, undefined, nextId, true);
          const fee = Math.round(payment.amount * QRIS_MDR_RATE);
          this.ledger(state, "sale_credit", payment.amount - fee, 0, fee, "payment_intent", payment.id, nextId, order.outlet_id);
          payment.paid_at = state.now;
        }
        payment.status = command.status; payment.updated_at = state.now; return payment;
      }
      case "payment.retry": {
        requireMenu(state, "register", "orders"); const old = find(state.payments, command.id), order = this.scopedOrder(state, old.order_id);
        if (old.status === "success" || order.status !== "pending_payment") fail("Cannot retry final order payment");
        const latest = state.payments.filter(p => p.order_id === order.id).at(-1);
        if (latest?.id !== old.id) fail("Stale payment attempt");
        if (old.status === "pending") { old.status = "cancelled"; old.updated_at = state.now; }
        return this.createPayment(state, order, nextId);
      }
      case "withdrawal.create": {
        requireOwner(state); const bank = find(state.banks, command.bank_id); if (bank.status !== "active") fail("Bank inactive");
        const amount = money(command.amount); if (amount < MIN_WITHDRAWAL) fail("Minimum withdrawal is 50000");
        if (state.withdrawals.filter(w => ["requested", "processing"].includes(w.status)).length >= MAX_PENDING_WITHDRAWALS) fail("A withdrawal is pending");
        const daily = state.withdrawals.filter(w => jakartaDate(w.requested_at) === jakartaDate(state.now) && ["requested", "processing", "completed"].includes(w.status)).reduce((s, w) => s + w.amount, 0);
        if (daily + amount > WITHDRAWAL_DAILY_LIMIT) fail("Daily withdrawal limit exceeded");
        if (deriveBalance(state.ledger, state.company.id, state.now).available_balance < amount) fail("Insufficient balance");
        const withdrawal: Withdrawal = { id: nextId("withdrawal"), company_id: state.company.id, bank_account_id: bank.id, amount, fee: WITHDRAWAL_FEE, net_amount: amount - WITHDRAWAL_FEE,
          bank_name: bank.bank_name, account_number: bank.account_number, account_holder: bank.account_holder, status: "requested", note: optionalText(command.note), reject_reason: null, transfer_proof_url: null,
          reference_number: null, requested_by: "demo-owner", processed_by: null, requested_at: state.now, processed_at: null, updated_at: state.now };
        state.withdrawals.push(withdrawal);
        this.ledger(state, "withdrawal_hold", -amount, amount, 0, "withdrawal", withdrawal.id, nextId);
        this.notifySystem(state, "withdrawal_requested", withdrawal.id, "Pengajuan pencairan diterima",
          `Pengajuan Rp ${withdrawal.amount} ke ${withdrawal.bank_name} ${withdrawal.account_number} (${withdrawal.account_holder}) diterima. Saldo dipindahkan ke saldo pending.`, nextId);
        return withdrawal;
      }
      case "withdrawal.transition": {
        requireOwner(state); const withdrawal = find(state.withdrawals, command.id);
        if (!["processing", "completed", "rejected"].includes(command.status)) fail("Invalid withdrawal status");
        if (withdrawal.status === command.status) return withdrawal;
        if (!["requested", "processing"].includes(withdrawal.status)) fail("Withdrawal already final");
        const note = optionalText(command.note);
        if (command.status === "completed") {
          this.ledger(state, "withdrawal", 0, -withdrawal.amount, withdrawal.fee, "withdrawal", withdrawal.id, nextId);
          withdrawal.reference_number = `DEMO-TRANSFER-${withdrawal.id}`;
        } else if (command.status === "rejected") {
          this.ledger(state, "withdrawal_refund", withdrawal.amount, -withdrawal.amount, 0, "withdrawal", withdrawal.id, nextId);
          withdrawal.reject_reason = note ?? "Ditolak dalam simulasi";
        }
        withdrawal.status = command.status; withdrawal.note = note ?? withdrawal.note; withdrawal.updated_at = state.now;
        withdrawal.processed_by = "demo-system"; withdrawal.processed_at = state.now;
        const subject = command.status === "processing" ? "Pencairan saldo sedang diproses" : command.status === "completed" ? "Pencairan saldo selesai" : "Pengajuan pencairan ditolak";
        const outcome = command.status === "completed" ? `Nomor referensi: ${withdrawal.reference_number}. Saldo pending sudah dicairkan.`
          : command.status === "rejected" ? `Alasan: ${withdrawal.reject_reason}. Saldo dikembalikan ke saldo tersedia.` : `Saldo tetap pending.${note ? ` Catatan: ${note}` : ""}`;
        this.notifySystem(state, `withdrawal_${command.status}`, withdrawal.id, subject,
          `Pencairan Rp ${withdrawal.amount} ke ${withdrawal.bank_name} ${withdrawal.account_number} (${withdrawal.account_holder}). ${outcome}`, nextId);
        return withdrawal;
      }
      case "subscription.checkout": requireOwner(state); return this.checkout(state, command.plan, command.billing_cycle, nextId);
      case "subscription.transition": {
        requireOwner(state); const invoice = find(state.invoices, command.id);
        intentStatus(command.status); if (String(command.status) === "pending") fail("Invalid subscription transition");
        if (invoice.status === command.status) return invoice;
        if (invoice.status !== "pending") fail("Invoice already final");
        if (command.status === "success") {
          if (!invoice.expired_at || Date.parse(invoice.expired_at) <= Date.parse(state.now)) fail("Invoice expired");
          const plan = find(state.plans, invoice.plan_id);
          // Match owner activation: renew the raw plan's future expiry, even
          // though state.plan may otherwise be an effective Free fallback.
          const start = state.subscription.plan_id === invoice.plan_id && state.plan_expires_at && Date.parse(state.plan_expires_at) > Date.parse(state.now)
            ? state.plan_expires_at : state.now;
          const end = addSubscriptionPeriod(start, invoice.billing_cycle);
          state.subscription = { id: nextId("subscription"), company_id: state.company.id, plan_id: invoice.plan_id, status: "active",
            started_at: state.now, current_period_start: start, current_period_end: end, cancelled_at: null, created_at: state.now };
          state.subscription_status = "active"; state.billing_cycle = invoice.billing_cycle; state.plan_expires_at = end;
          state.plan = plan.slug as DemoState["plan"]; invoice.paid_at = state.now;
          this.notifySystem(state, "subscription_success", invoice.id, `Pembayaran diterima — Paket ${plan.name} aktif`,
            `Paket ${plan.name} aktif sampai ${jakartaDate(end)} (WIB). Invoice ${invoice.invoice_number} sebesar Rp ${invoice.amount} untuk siklus ${invoice.billing_cycle} sudah diterima.`, nextId);
        }
        invoice.status = command.status; invoice.updated_at = state.now; return invoice;
      }
      case "subscription.retry": {
        requireOwner(state); const old = find(state.invoices, command.id);
        if (old.status === "success") fail("Cannot retry successful invoice");
        if (state.invoices.at(-1)?.id !== old.id) fail("Stale invoice attempt");
        if (old.status === "pending") { old.status = "cancelled"; old.updated_at = state.now; }
        return this.checkout(state, find(state.plans, old.plan_id).slug as DemoState["plan"], old.billing_cycle, nextId);
      }
      case "email.preview": {
        requireMenu(state, "reports"); this.feature(state, "email_reports");
        const to = validEmail(command.email !== undefined ? command.email : command.to), plan = state.plans.find(p => p.slug === state.plan)!;
        const outletId = command.outlet_id === undefined ? undefined : text(command.outlet_id, "outlet ID");
        const from = command.from === undefined ? undefined : date(command.from);
        const rangeEnd = command.email !== undefined ? command.to : undefined;
        const until = rangeEnd === undefined ? undefined : date(rangeEnd);
        const report = this.readReport(state, outletId, from, until);
        const used = state.outbox.filter(m => m.kind === "report" && jakartaDate(m.created_at).slice(0, 7) === jakartaDate(state.now).slice(0, 7)).length;
        if (plan.email_reports_month >= 0 && used >= plan.email_reports_month) fail("PLAN_LIMIT: email_reports_month");
        const profit = plan.features.profit_loss ? `\nHPP: Rp ${report.cogs}\nPengeluaran: Rp ${report.expenses}\nLaba bersih: Rp ${report.netProfit}` : "";
        const outbox: DemoReportEmail = { id: nextId("email"), to, subject: optionalText(command.subject, 200) ?? `Laporan Demo — ${state.company.name}`, status: "simulated", kind: "report", report, notification_type: null, reference_id: null,
          body: `SIMULASI — tidak dikirim\n${report.from} sampai ${report.to}\nTransaksi: ${report.orders}\nPendapatan: Rp ${report.revenue}${profit}`, created_at: state.now };
        state.outbox.push(outbox); return outbox;
      }
      case "tick": {
        const now = command.now === undefined ? addTime(state.now, 1000) : instant(command.now);
        if (Date.parse(now) < Date.parse(state.now)) fail("Clock cannot move backwards");
        state.now = now;
        for (const p of state.payments) if (p.status === "pending" && p.expired_at && Date.parse(p.expired_at) <= Date.parse(now)) { p.status = "expired"; p.updated_at = now; }
        for (const invoice of state.invoices) if (invoice.status === "pending" && invoice.expired_at && Date.parse(invoice.expired_at) <= Date.parse(now)) { invoice.status = "expired"; invoice.updated_at = now; }
        for (const order of state.orders) if (order.status === "draft" && order.reserved_until && Date.parse(order.reserved_until) <= Date.parse(now)) this.cancelOrder(state, order);
        this.resolveSubscription(state);
        return { now };
      }
      default: return fail("Unknown demo command");
    }
  }

  private scopedOrder(state: DemoState, id: string): DemoOrder { const order = find(state.orders, id); scope(state, order.outlet_id); return order; }
  private pendingOrder(state: DemoState, order: DemoOrder): void {
    this.transactionLimit(state);
    order.status = "pending_payment"; order.payment_status = "unpaid"; order.payment_method = "qris"; order.payment_channel = "dynamic_qris"; order.reserved_until = null;
  }
  private completeOrder(state: DemoState, order: DemoOrder, method: DemoPaymentMethod, amountPaid: number | undefined, splits: DemoSplit[] | undefined, nextId: (kind: string) => string, dynamicSuccess = false): void {
    if (order.status === "completed") return;
    this.transactionLimit(state); paymentMethod(method);
    if (method === "qris" && !dynamicSuccess) fail("Dynamic QRIS requires success transition");
    const normalized = this.normalizeSplits(order, splits);
    if (normalized.length && amountPaid !== undefined) fail("Split amounts replace amount_paid");
    const paid = normalized.length ? order.total : money(amountPaid ?? order.total, "amount paid");
    if (paid < order.total || (!normalized.length && method !== "cash" && paid !== order.total)) fail("Invalid amount paid");
    // One aggregated movement per ingredient/order, independent of split count.
    const deductions = new Map<string, number>();
    for (const item of order.items) for (const recipe of find(state.products, item.product_id).recipe) deductions.set(recipe.ingredient_id, (deductions.get(recipe.ingredient_id) ?? 0) + recipe.quantity_used * item.quantity);
    for (const [ingredientId, quantity] of deductions) {
      const ingredient = find(state.ingredients, ingredientId); if (ingredient.outlet_id !== order.outlet_id) fail("Invalid deduction scope");
      if (!state.movements.some(m => m.type === "sale_deduction" && m.reference_id === order.id && m.ingredient_id === ingredientId)) this.movement(state, ingredientId, -quantity, "sale_deduction", order.id, "Penjualan demo", nextId);
    }
    order.status = "completed"; order.payment_status = "paid"; order.payment_method = method; order.completed_at = state.now;
    order.amount_paid = paid; order.change = paid - order.total; order.splits = normalized; order.split_bill = normalized.length > 0; order.reserved_until = null;
    order.payment_channel = method === "qris" ? "dynamic_qris" : method === "qris_manual" ? "manual_qris" : null;
    if (order.table_id) find(state.tables, order.table_id).status = "occupied";
    if (!dynamicSuccess) for (const p of state.payments) if (p.order_id === order.id && p.status === "pending") { p.status = "cancelled"; p.updated_at = state.now; }
  }
  private cancelOrder(state: DemoState, order: DemoOrder): void {
    order.status = "cancelled"; order.reserved_until = null;
    for (const p of state.payments) if (p.order_id === order.id && p.status === "pending") { p.status = "cancelled"; p.updated_at = state.now; }
    // A completed historical order may still reference a table that was manually
    // released and reused. Only another live reservation prevents this release.
    if (order.table_id && !state.orders.some(o => o.id !== order.id && o.table_id === order.table_id && ["draft", "pending_payment"].includes(o.status))) find(state.tables, order.table_id).status = "available";
  }
  private normalizeSplits(order: DemoOrder, splits: DemoSplit[] | undefined): DemoSplit[] {
    const allocated = new Map<string, number>();
    const normalized = splits === undefined ? [] : list(splits).map(raw => {
      const s = record(raw); paymentMethod(s.method); if (s.method === "qris") fail("Dynamic QRIS split is unsupported");
      const items = s.items === undefined ? undefined : list(s.items).map(rawItem => {
        const item = record(rawItem), cart_item_id = text(item.cart_item_id, "cart item ID");
        const line = order.items.find(row => (row.cart_item_id ?? row.id) === cart_item_id) ?? fail("Invalid split allocation");
        const quantity = number(item.quantity, "split quantity", 1, true), total = (allocated.get(cart_item_id) ?? 0) + quantity;
        if (total > line.quantity) fail("Split quantity exceeds order quantity"); allocated.set(cart_item_id, total);
        return { cart_item_id, product_name: line.product_name, quantity, unit_price: line.unit_price, subtotal: Math.round(line.subtotal * quantity / line.quantity) };
      });
      return { method: s.method as DemoSplit["method"], amount: money(s.amount), ...(s.customer_name !== undefined ? { customer_name: optionalText(s.customer_name, 100) } : {}), ...(items ? { items } : {}) };
    });
    if (normalized.length && (normalized.length < 2 || normalized.length > 20 || normalized.some(row => !row.amount) || normalized.reduce((sum, row) => sum + row.amount, 0) !== order.total)) fail("Split amounts must exactly cover total");
    return normalized;
  }
  private movement(state: DemoState, ingredientId: string, quantity_change: number, type: DemoState["movements"][number]["type"], reference_id: string | null, note: string | null, nextId: (kind: string) => string): void {
    const ingredient = find(state.ingredients, ingredientId);
    ingredient.stock_quantity += quantity_change; ingredient.updated_at = state.now;
    state.movements.push({ id: nextId("movement"), company_id: state.company.id, outlet_id: ingredient.outlet_id, ingredient_id: ingredient.id, type, quantity_change, reference_id, note, created_by: state.session.employee_id, created_at: state.now });
  }
  private transactionLimit(state: DemoState): void {
    const plan = state.plans.find(p => p.slug === state.plan)!, max = plan.max_transactions_month;
    if (max < 0) return;
    const completed = state.orders.filter(o => o.status === "completed" && jakartaDate(o.created_at).slice(0, 7) === jakartaDate(state.now).slice(0, 7)).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (completed.length + 1 <= max) return;
    const started = completed[max - 1]?.created_at;
    if (completed.length + 1 <= max + Math.floor(max * TRANSACTION_GRACE_RATIO) && started && Date.parse(state.now) <= Date.parse(started) + TRANSACTION_GRACE_DAYS * 86400_000) return;
    fail("PLAN_LIMIT: transactions");
  }
  private feature(state: DemoState, key: "inventory_advanced" | "email_reports"): void {
    if (!state.plans.find(p => p.slug === state.plan)!.features[key]) fail(`PLAN_LIMIT: ${key}`);
  }
  private resolveSubscription(state: DemoState): void {
    const rawPlan = find(state.plans, state.subscription.plan_id);
    const expiry = state.plan_expires_at === null ? null : Date.parse(state.plan_expires_at);
    let status = state.subscription.status;
    if (["active", "grace", "cancelled"].includes(status) && expiry !== null && expiry <= Date.parse(state.now)) {
      status = Date.parse(state.now) < expiry + GRACE_DAYS * 86400_000 ? "grace" : "expired";
    }
    state.subscription.status = status; state.subscription_status = status;
    state.plan = status === "expired" ? "free" : rawPlan.slug as DemoState["plan"];
    // Retain the original plan ID, period, expiry and billing cycle for renewal.
  }
  private notifySystem(state: DemoState, notification_type: DemoNotificationType, reference_id: string, subject: string, body: string, nextId: (kind: string) => string): void {
    if (state.outbox.some(mail => mail.kind === "system" && mail.notification_type === notification_type && mail.reference_id === reference_id)) return;
    state.outbox.push({ id: nextId("notification"), to: state.company.email, subject, body: `SIMULASI — tidak dikirim\n${body}`,
      status: "simulated", kind: "system", report: null, notification_type, reference_id, created_at: state.now });
  }
  private createPayment(state: DemoState, order: DemoOrder, nextId: (kind: string) => string): PaymentIntent {
    if (order.status !== "pending_payment" || order.split_bill || order.payment_method !== "qris" || order.total <= 0) fail("Payment requires positive unsplit pending QRIS order");
    const existing = state.payments.find(p => p.order_id === order.id && p.status === "pending");
    if (existing) {
      if (existing.expired_at && Date.parse(existing.expired_at) <= Date.parse(state.now)) fail("Retry expired intent");
      return existing;
    }
    const id = nextId("payment");
    const payment: PaymentIntent = { id, company_id: state.company.id, outlet_id: order.outlet_id, order_id: order.id, provider: "demo", provider_transaction_id: null, invoice_number: `DEMO-ORDER-${id}`,
      amount: order.total, expired_at: addTime(state.now, ORDER_QR_EXPIRY_MINUTES * 60_000), qr_string: `RAKKU-DEMO-NOT-PAYABLE:${id}:${order.total}`, status: "pending", paid_at: null,
      raw_payload: null, created_by: state.session.employee_id, created_at: state.now, updated_at: state.now };
    state.payments.push(payment); return payment;
  }
  private ledger(state: DemoState, type: BalanceTransaction["type"], amount: number, pending_delta: number, fee_amount: number, reference_type: string, reference_id: string, nextId: (kind: string) => string, outlet_id: string | null = null): void {
    if (state.ledger.some(t => t.type === type && t.reference_type === reference_type && t.reference_id === reference_id)) return;
    const balance = deriveBalance(state.ledger, state.company.id, state.now);
    if (balance.available_balance + amount < 0 || balance.pending_balance + pending_delta < 0) fail("Insufficient ledger balance");
    state.ledger.push({ id: nextId("ledger"), company_id: state.company.id, outlet_id, type, amount, pending_delta, fee_amount,
      balance_after: balance.available_balance + amount, reference_type, reference_id, note: "Transaksi saldo simulasi", created_by: state.session.employee_id, created_at: state.now });
  }
  private checkout(state: DemoState, slug: string, cycle: string, nextId: (kind: string) => string): SubscriptionInvoice {
    const plan = state.plans.find(p => p.slug === slug && p.is_active) ?? fail("Invalid plan");
    if (cycle !== "monthly" && cycle !== "yearly") fail("Invalid billing cycle");
    for (const invoice of state.invoices) if (invoice.status === "pending") { invoice.status = "cancelled"; invoice.updated_at = state.now; }
    const id = nextId("invoice"), amount = cycle === "monthly" ? plan.price_monthly : plan.price_yearly;
    const invoice: SubscriptionInvoice = { id, company_id: state.company.id, plan_id: plan.id, billing_cycle: cycle, invoice_number: `DEMO-SUB-${id}`, amount, provider: "demo",
      provider_transaction_id: null, qr_string: `RAKKU-DEMO-NOT-PAYABLE:${id}:${amount}`, status: "pending", expired_at: addTime(state.now, 15 * 60_000), paid_at: null, raw_payload: null, created_at: state.now, updated_at: state.now };
    state.invoices.push(invoice); return invoice;
  }
}
function paymentMethod(value: unknown): asserts value is DemoPaymentMethod { if (typeof value !== "string" || !["cash", "card", "qris_manual", "qris"].includes(value)) fail("Invalid payment method"); }
function intentStatus(value: unknown): void { if (typeof value !== "string" || !["pending", "success", "failed", "expired", "cancelled"].includes(value)) fail("Invalid intent status"); }
function validEmail(value: unknown): string { const email = text(value, "email", 254); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Invalid email"); return email; }
export function createDemoSandbox(now?: Date): DemoSandbox { return new DemoSandbox(now); }
