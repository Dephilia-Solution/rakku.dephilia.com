import type { Plan, PaymentIntent, Withdrawal } from "@rakku/shared-types";
import type { DemoOrder, DemoState } from "./models";
import { addSubscriptionPeriod, CASHIER_MENUS, DEMO_MENUS, QRIS_MDR_RATE } from "./constants";
import { addTime, deriveBalance, jakartaDate, quote, shiftedDate } from "./business";

export const DEMO_IDS = { company: "fixture:company", pusat: "fixture:pusat", taman: "fixture:taman", manager: "fixture:manager", cashier: "fixture:cashier" } as const;
export const fixtureId = (outlet: string, kind: string, key: string | number): string => `${outlet}:${kind}:${key}`;
const ingredientData = [
  ["Biji kopi", "gram", 6000, 4000, 500, 120], ["Susu full cream", "ml", 20000, 14000, 2000, 25],
  ["Sirup gula aren", "ml", 5000, 3500, 500, 35], ["Bubuk matcha", "gram", 150, 500, 200, 500],
  ["Bubuk cokelat", "gram", 2000, 1500, 200, 100], ["Teh", "gram", 500, 350, 100, 100],
  ["Simple syrup", "ml", 5000, 3000, 300, 20], ["Sirup lemon", "ml", 2000, 1500, 200, 50],
  ["Air mineral", "ml", 50000, 35000, 5000, 1], ["Es batu", "gram", 20000, 15000, 2000, 1],
  ["Croissant siap panggang", "pcs", 40, 6, 8, 8500], ["Kentang beku", "gram", 8000, 5000, 1000, 30],
  ["Minyak goreng", "ml", 5000, 3500, 500, 30], ["Saus tomat", "gram", 2000, 1500, 200, 35],
  ["Garam", "gram", 1000, 750, 100, 10],
] as const;
const productData = [
  ["Espresso", 18, 22, 0, [[0, 18], [8, 30]]],
  ["Americano", 22, 27, 0, [[0, 18], [8, 180]]],
  ["Cappuccino", 28, 34, 0, [[0, 18], [1, 150], [8, 30]]],
  ["Caffe Latte", 30, 36, 0, [[0, 18], [1, 180], [8, 30]]],
  ["Kopi Susu Gula Aren", 26, 32, 0, [[0, 18], [1, 150], [2, 25], [8, 30], [9, 100]]],
  ["Matcha Latte", 32, 39, 1, [[3, 6], [1, 180], [6, 15], [8, 30], [9, 100]]],
  ["Chocolate Latte", 28, 34, 1, [[4, 25], [1, 180], [6, 10], [8, 30], [9, 100]]],
  ["Lemon Tea", 20, 25, 1, [[5, 3], [8, 200], [6, 20], [7, 20], [9, 100]]],
  ["Butter Croissant", 24, 29, 2, [[10, 1]]],
  ["French Fries", 24, 29, 2, [[11, 150], [12, 15], [13, 20], [14, 2]]],
] as const;

// Catalog: active scripts/neon-seed.ts + db baseline defaults; also matches
// historical migration 025. These sources are never executed by the demo.
export function fixturePlans(now: string): Plan[] {
  const pro = { multi_outlet: true, custom_roles: true, profit_loss: true, email_reports: true, inventory_advanced: true, remove_qr_branding: true };
  return [
    { slug: "free", name: "Free", description: "Untuk kedai kecil yang baru mulai", price_monthly: 0, price_yearly: 0, max_outlets: 1, max_employees: 2, max_products: 30, max_ingredients: 10, max_transactions_month: 500, report_history_days: 30, email_reports_month: 5, storage_mb: 50, features: {} },
    { slug: "pro", name: "Pro", description: "Untuk cafe yang sedang berkembang", price_monthly: 99000, price_yearly: 990000, max_outlets: 3, max_employees: 15, max_products: 500, max_ingredients: -1, max_transactions_month: 5000, report_history_days: 365, email_reports_month: 100, storage_mb: 1024, features: pro },
    { slug: "business", name: "Business", description: "Untuk bisnis multi-cabang", price_monthly: 249000, price_yearly: 2490000, max_outlets: -1, max_employees: -1, max_products: -1, max_ingredients: -1, max_transactions_month: -1, report_history_days: -1, email_reports_month: -1, storage_mb: 5120, features: { ...pro, audit_log: true, priority_support: true } },
  ].map((p, i) => ({ ...p, id: `fixture:plan:${p.slug}`, is_active: true, sort_order: i + 1, created_at: now, updated_at: now }));
}

export function createFixture(now: string, generation: string): DemoState {
  const company_id = DEMO_IDS.company;
  const plan_expires_at = addSubscriptionPeriod(now, "monthly");
  const state: DemoState = {
    generation, now, company: { id: company_id, name: "Rakku Demo Cafe", code: "DEMO_CAFE", owner_name: "Owner Demo Rakku", email: "owner@rakku.invalid", password: "DemoCafe2026!" },
    outlets: [
      { id: DEMO_IDS.pusat, company_id, name: "Rakku Demo Cafe — Pusat", address: "Jl. Contoh Raya No. 10", is_active: true },
      { id: DEMO_IDS.taman, company_id, name: "Rakku Demo Cafe — Taman", address: "Jl. Contoh Taman No. 25", is_active: true },
    ], employees: [], roles: [
      { id: DEMO_IDS.manager, company_id, name: "Manager Outlet", menus: [...DEMO_MENUS] },
      { id: DEMO_IDS.cashier, company_id, name: "Kasir", menus: [...CASHIER_MENUS] },
    ], categories: [], tiers: [], products: [], ingredients: [], tables: [], orders: [], movements: [], purchases: [], expenses: [], taxes: [], discounts: [], payments: [], ledger: [], balance: null,
    withdrawals: [], banks: [], invoices: [], outbox: [], plan: "business", plans: fixturePlans(now), menus: [],
    subscription: { id: "fixture:subscription:business", company_id, plan_id: "fixture:plan:business", status: "active", started_at: now,
      current_period_start: now, current_period_end: plan_expires_at, cancelled_at: null, created_at: now },
    subscription_status: "active", billing_cycle: "monthly", plan_expires_at,
    session: { mode: "owner", authenticated: false, outlet_id: DEMO_IDS.pusat, employee_id: null },
  };
  [["Rani", "rani_pusat", DEMO_IDS.manager, "111111", DEMO_IDS.pusat], ["Bima", "bima_pusat", DEMO_IDS.cashier, "222222", DEMO_IDS.pusat],
    ["Dita", "dita_taman", DEMO_IDS.manager, "333333", DEMO_IDS.taman], ["Raka", "raka_taman", DEMO_IDS.cashier, "444444", DEMO_IDS.taman]].forEach(([name, username, role_id, pin, outlet]) => {
    state.employees.push({ id: `fixture:${username}`, company_id, name, username, role_id, pin, is_active: true, outlet_ids: [outlet] });
  });
  for (const [outletIndex, outlet] of state.outlets.entries()) {
    const fid = (kind: string, key: string | number) => fixtureId(outlet.id, kind, key);
    ["Coffee", "Non-Coffee", "Food"].forEach((name, i) => state.categories.push({ id: fid("category", i), company_id, outlet_id: outlet.id, name, sort_order: i + 1 }));
    ["Dine In", "Take Away", "Gojek", "Grab"].forEach((name, i) => state.tiers.push({ id: fid("tier", i), company_id, outlet_id: outlet.id, name, slug: ["dine-in", "take-away", "gojek", "grab"][i], is_active: true, sort_order: i + 1 }));
    ingredientData.forEach(([name, unit, pusat, taman, min, cost], i) => state.ingredients.push({ id: fid("ingredient", i), company_id, outlet_id: outlet.id,
      name, unit, stock_quantity: outletIndex ? taman : pusat, min_stock_alert: min, cost_per_unit: cost, is_active: true, created_at: now, updated_at: now }));
    productData.forEach(([name, base, online, category, recipe], i) => {
      const id = fid("product", i);
      state.products.push({ id, company_id, outlet_id: outlet.id, name, price: base * 1000, category_id: fid("category", category), sort_order: i + 1,
        image_url: `/demo-assets/${["cafe", "cafe", "cafe", "cafe", "cafe", "latte", "chocolate", "tea", "food", "fries"][i]}.svg`, is_active: true, description: ["Espresso pekat dari biji kopi pilihan, disajikan hangat.", "Espresso dengan air mineral, ringan dan aromatik.", "Espresso dengan susu hangat dan foam lembut.", "Kopi susu creamy dengan espresso dan susu full cream.", "Kopi susu dingin dengan sirup gula aren dan es batu.", "Matcha lembut dengan susu full cream dan es batu.", "Cokelat creamy dengan susu full cream, disajikan dingin.", "Teh lemon segar dengan simple syrup dan es batu.", "Croissant mentega hangat dengan lapisan renyah.", "Kentang goreng renyah dengan saus tomat."][i],
        prices: Object.fromEntries([base, base, online, online].map((p, t) => [fid("tier", t), p * 1000])),
        recipe: recipe.map(([ingredient, quantity_used]) => ({ ingredient_id: fid("ingredient", ingredient), quantity_used })),
        modifiers: (category === 0 ? [["Extra Shot", 5000], ["Extra Susu", 3000]] : category === 1 && i !== 7 ? [["Extra Susu", 3000]] : []).map(([name, delta], m) => ({ id: fid(`modifier:${i}`, m), product_id: id,
          name: String(name), group_name: "Tambahan", price_delta: Number(delta), prices: Object.fromEntries([0, 1, 2, 3].map(t => [fid("tier", t), Number(delta) + (t > 1 ? 1000 : 0)])) })),
      });
    });
    for (let i = 1; i <= 8; i++) state.tables.push({ id: fid("table", i), company_id, outlet_id: outlet.id, name: `Meja ${i}`, status: i <= 3 ? "occupied" : "available", created_at: now });
    state.taxes.push({ id: fid("tax", 0), company_id, outlet_id: outlet.id, name: "Pajak Demo", type: "percentage", value: 10, is_active: true, sort_order: 1, created_at: now },
      { id: fid("tax", 1), company_id, outlet_id: outlet.id, name: "Service Demo", type: "fixed", value: 1000, is_active: false, sort_order: 2, created_at: now });
    state.discounts.push(
      { id: fid("discount", 0), company_id, outlet_id: outlet.id, product_id: fid("product", 5), name: "Matcha Latte 10%", type: "percentage", value: 10, start_date: shiftedDate(now, -30), end_date: shiftedDate(now, 7), is_active: true, created_at: now },
      { id: fid("discount", 1), company_id, outlet_id: outlet.id, product_id: null, name: "Promo Demo", type: "fixed", value: 5000, start_date: shiftedDate(now, -7), end_date: shiftedDate(now, 7), is_active: false, created_at: now },
      { id: fid("discount", 2), company_id, outlet_id: outlet.id, product_id: null, name: "Promo lampau", type: "percentage", value: 20, start_date: shiftedDate(now, -60), end_date: shiftedDate(now, -31), is_active: true, created_at: now },
    );
    for (let i = 0; i < 60; i++) {
      const daysAgo = Math.floor(i / 2);
      const start = Date.parse(`${shiftedDate(now, -daysAgo)}T00:00:00+07:00`);
      const created_at = new Date(daysAgo ? start + (10 + i % 8) * 3600_000 : start + (Date.parse(now) - start) * (i ? 0.7 : 0.9)).toISOString();
      const savedNow = state.now, savedSession = state.session; state.now = created_at;
      const employee = state.employees.filter(e => e.outlet_ids.includes(outlet.id))[i % 2];
      state.session = { mode: "pos", authenticated: true, outlet_id: outlet.id, employee_id: employee.id };
      const modifier = state.products.find(p => p.id === fid("product", i % 10))!.modifiers[0];
      const order = quote(state, { outlet_id: outlet.id, tier_id: fid("tier", i % 4), customer_name: `Tamu Demo ${i + 1}`,
        order_type: (["dine_in", "take_away", "gojek", "grab"] as const)[i % 4], table_id: i % 4 === 0 ? fid("table", 1 + i % 8) : null,
        items: [{ product_id: fid("product", i % 10), quantity: 1 + i % 3, modifier_ids: i % 5 === 0 && modifier ? [modifier.id] : [] }, { product_id: fid("product", (i + 3) % 10), quantity: 1 }] }, fid("order", i));
      state.now = savedNow; state.session = savedSession;
      order.status = "completed"; order.payment_status = "paid"; order.payment_method = i % 3 === 0 ? "qris" : i % 3 === 1 ? "cash" : "card";
      order.completed_at = created_at; order.amount_paid = order.total;
      state.orders.push(order);
      seedDeductions(state, order);
      if (order.payment_method === "qris") {
        order.payment_channel = "dynamic_qris";
        const payment = seedPayment(state, order, fid("payment", i), "success"); state.payments.push(payment);
        const fee = Math.round(order.total * QRIS_MDR_RATE);
        seedLedger(state, "sale_credit", order.total - fee, 0, payment.id, created_at, fee, outlet.id, "payment_intent");
      }
    }
    for (let i = 0; i < 4; i++) {
      const employee = state.employees.filter(e => e.outlet_ids.includes(outlet.id))[i % 2];
      const savedSession = state.session;
      state.session = { mode: "pos", authenticated: true, outlet_id: outlet.id, employee_id: employee.id };
      const order = quote(state, { outlet_id: outlet.id, tier_id: fid("tier", 0), items: [{ product_id: fid("product", i + 2), quantity: 2 }],
        table_id: i < 3 ? fid("table", i + 1) : null, customer_name: ["Nadia Demo", "Tono Demo", "Sari Demo", "Batal Demo"][i] }, fid("open-order", i));
      state.session = savedSession;
      order.status = i < 2 ? "draft" : i === 2 ? "pending_payment" : "cancelled";
      order.reserved_until = i < 2 ? addTime(now, 24 * 3600_000) : null;
      if (i === 2) { order.payment_method = "qris"; order.payment_channel = "dynamic_qris"; state.payments.push(seedPayment(state, order, fid("pending-payment", 0), "pending")); }
      state.orders.push(order);
    }
    for (let i = 0; i < 4; i++) {
      const id = fid("purchase", i); const purchase_date = shiftedDate(now, -i * 7);
      const created_at = new Date(Math.min(Date.parse(now), Date.parse(`${purchase_date}T03:00:00.000Z`))).toISOString();
      const items = [0, 1, 2].map((ingredient, k) => ({ id: `${id}:item:${k}`, purchase_id: id, ingredient_id: fid("ingredient", ingredient), quantity: [1000, 2000, 500][k], unit_cost: ingredientData[ingredient][5], subtotal: [1000, 2000, 500][k] * ingredientData[ingredient][5] }));
      state.purchases.push({ id, company_id, outlet_id: outlet.id, supplier_name: ["Koperasi Kopi Fiktif", "CV Susu Contoh"][i % 2], note: "Restock kopi, susu, dan sirup cafe · simulasi", total_amount: items.reduce((s, r) => s + r.subtotal, 0), purchase_date, items, created_by: null, created_at });
      for (const item of items) state.movements.push({ id: `${item.id}:movement`, company_id, outlet_id: outlet.id, ingredient_id: item.ingredient_id, type: "purchase", quantity_change: item.quantity, reference_id: id, note: "Pembelian simulasi", created_by: null, created_at });
    }
    for (let i = 0; i < 6; i++) state.expenses.push({ id: fid("expense", i), company_id, outlet_id: outlet.id,
      category: ["Operasional", "Transportasi", "Kebersihan"][i % 3], amount: 25000 + i * 15000, description: ["Listrik dan air cafe", "Transportasi pengambilan bahan", "Bahan kebersihan cafe", "Internet operasional", "Kemasan take away", "Perawatan mesin kopi"][i], expense_date: shiftedDate(now, -i * 4), created_by: null, created_at: now });
    for (let i = 0; i < 2; i++) state.movements.push({ id: fid("opname", i), company_id, outlet_id: outlet.id, ingredient_id: fid("ingredient", i), type: "adjustment", quantity_change: [-30, 50][i], reference_id: null, note: "Stock opname simulasi", created_by: null, created_at: now });
    // Exactly one opening entry per ingredient, computed from the desired final
    // stock minus ALL sales/purchases/opname movements; never a second opening.
    for (const ingredient of state.ingredients.filter(g => g.outlet_id === outlet.id)) {
      const other = state.movements.filter(m => m.ingredient_id === ingredient.id).reduce((s, m) => s + m.quantity_change, 0);
      state.movements.push({ id: `${ingredient.id}:opening`, company_id, outlet_id: outlet.id, ingredient_id: ingredient.id, type: "adjustment", quantity_change: ingredient.stock_quantity - other,
        reference_id: null, note: "Opening stock", created_by: null, created_at: `${shiftedDate(now, -30)}T00:00:00+07:00` });
    }
  }
  state.banks = ["Bank Demo Nusantara", "Bank Demo Sentosa"].map((bank_name, i) => ({ id: `fixture:bank:${i}`, company_id, bank_name, account_number: `000000000${i + 1}`, account_holder: "Owner Demo Rakku", is_default: i === 0, status: "active", created_at: now }));
  ["completed", "rejected", "requested"].forEach((status, i) => {
    const id = `fixture:withdrawal:${i}`, amount = [150000, 50000, 75000][i], requested_at = addTime(now, -(3 - i) * 86400_000);
    const bank = state.banks[0];
    state.withdrawals.push({ id, company_id, bank_account_id: bank.id, amount, fee: 0, net_amount: amount, bank_name: bank.bank_name,
      account_number: bank.account_number, account_holder: bank.account_holder, status: status as Withdrawal["status"], note: "Pencairan simulasi", reject_reason: status === "rejected" ? "Contoh penolakan simulasi" : null,
      transfer_proof_url: null, reference_number: status === "completed" ? "DEMO-TRANSFER-001" : null, requested_by: "demo-owner", processed_by: status === "requested" ? null : "demo-system", requested_at, processed_at: status === "requested" ? null : requested_at, updated_at: requested_at });
    seedLedger(state, "withdrawal_hold", -amount, amount, id, requested_at);
    if (status === "completed") seedLedger(state, "withdrawal", 0, -amount, id, requested_at);
    if (status === "rejected") seedLedger(state, "withdrawal_refund", amount, -amount, id, requested_at);
  });
  state.invoices.push({ id: "fixture:invoice:business", company_id, plan_id: "fixture:plan:business", billing_cycle: "monthly", invoice_number: "DEMO-SUB-001", amount: 249000,
    provider: "demo", provider_transaction_id: null, qr_string: null, status: "success", expired_at: null, paid_at: now, raw_payload: null, created_at: now, updated_at: now });
  state.ledger.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  let available = 0; for (const entry of state.ledger) { available += entry.amount; entry.balance_after = available; }
  state.balance = deriveBalance(state.ledger, company_id, now);
  return state;
}
function seedDeductions(state: DemoState, order: DemoOrder): void {
  const quantities = new Map<string, number>();
  for (const item of order.items) for (const r of state.products.find(p => p.id === item.product_id)!.recipe) quantities.set(r.ingredient_id, (quantities.get(r.ingredient_id) ?? 0) + r.quantity_used * item.quantity);
  for (const [ingredient_id, quantity] of quantities) state.movements.push({ id: `${order.id}:deduction:${ingredient_id}`, company_id: state.company.id, outlet_id: order.outlet_id, ingredient_id, type: "sale_deduction", quantity_change: -quantity, reference_id: order.id, note: "Penjualan simulasi", created_by: order.cashier_id, created_at: order.created_at });
}
function seedPayment(state: DemoState, order: DemoOrder, id: string, status: "pending" | "success"): PaymentIntent {
  return { id, company_id: state.company.id, outlet_id: order.outlet_id, order_id: order.id, provider: "demo", provider_transaction_id: null,
    invoice_number: `DEMO-${id}`, amount: order.total, qr_string: `RAKKU-DEMO-NOT-PAYABLE:${id}:${order.total}`, status,
    expired_at: addTime(order.created_at, 15 * 60_000), paid_at: status === "success" ? order.created_at : null,
    raw_payload: null, created_by: order.cashier_id, created_at: order.created_at, updated_at: order.created_at };
}
function seedLedger(state: DemoState, type: DemoState["ledger"][number]["type"], amount: number, pending_delta: number, reference_id: string, created_at: string, fee_amount = 0, outlet_id: string | null = null, reference_type = "withdrawal"): void {
  state.ledger.push({ id: `fixture:ledger:${reference_id}:${type}`, company_id: state.company.id, outlet_id, type, amount, pending_delta, fee_amount, balance_after: 0, reference_id, reference_type, note: "Ledger simulasi", created_by: null, created_at });
}
