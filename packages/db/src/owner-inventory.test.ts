import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import { checked } from "./merchant";
import { runFinancialCommand } from "./financial-commands";
import { createOwnerIngredient, updateOwnerIngredient, deleteOwnerIngredient, type OwnerOutletScope } from "./owner-inventory";
import { saveOwnerProduct } from "./owner-products";
import { recordPurchase, adjustStock, deductStockForOrder } from "../../inventory/src/index";

const pg = new PGlite(); const dialect = new PgDialect(); let catalog: Catalog;
const executor = (connection: Pick<PGlite, "query">) => async (query: SQL): Promise<Row[]> => {
  const compiled = dialect.sqlToQuery(query);
  return (await connection.query<Row>(compiled.sql, compiled.params)).rows;
};
const execute = executor(pg);
const db = new DatabaseClient(execute, async () => catalog,
  work => pg.transaction(tx => work(new DatabaseClient(executor(tx), async () => catalog))));
let scope: OwnerOutletScope, foreign: OwnerOutletScope, categoryId: string, tierId: string;
before(async () => {
  for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
    await pg.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  catalog = await loadCatalog(execute);
  await execute(sql`select set_config('app.scope','platform',false)`);
  const makeScope = async (code: string) => {
    const owner = checked(await db.from("owners").insert({ email: `${code}@example.test`, name: code, password_hash: "hash" }).select().single());
    const company = checked(await db.from("companies").insert({ code, name: code, password_hash: "hash", owner_id: owner.id }).select().single());
    const outlet = checked(await db.from("outlets").insert({ company_id: company.id, name: "Pusat" }).select().single());
    return { companyId: String(company.id), outletId: String(outlet.id), ownerId: String(owner.id) };
  };
  scope = await makeScope("INV-A"); foreign = await makeScope("INV-B");
  categoryId = String(checked(await db.from("categories").insert({ company_id: scope.companyId, outlet_id: scope.outletId, name: "Minuman" }).select().single()).id);
  tierId = String(checked(await db.from("pricing_tiers").insert({ company_id: scope.companyId, outlet_id: scope.outletId, name: "Normal", slug: "normal" }).select().single()).id);
});
after(() => pg.close());
const ingredient = (name: string, stock = 1000) => createOwnerIngredient(db, scope, { name, unit: "gram", stock_quantity: stock, min_stock_alert: 10, cost_per_unit: 100 });
const current = async (id: string) => checked(await db.from("ingredients").select().eq("id", id).single());
const movements = (id: string) => db.execute(sql`select * from public.stock_movements where ingredient_id=${id} order by created_at,id`);

test("opening inventory records the real owner and refuses foreign ownership or duplicate ingredients", async () => {
  const item = await ingredient("Opening");
  const [movement] = await movements(item.id);
  assert.equal(Number(movement.quantity_change), 1000);
  assert.equal(movement.created_by, null);
  assert.equal(movement.created_by_owner_id, scope.ownerId);
  await assert.rejects(() => ingredient("Opening"), /sudah ada/);
  await assert.rejects(() => createOwnerIngredient(db, { ...scope, ownerId: foreign.ownerId }, { name: "Forged", unit: "gram", stock_quantity: 1, min_stock_alert: 0, cost_per_unit: 0 }), /owner/);
  await assert.rejects(() => db.execute(sql`insert into public.stock_movements(company_id,outlet_id,ingredient_id,type,quantity_change,created_by_owner_id)
    values(${scope.companyId},${scope.outletId},${item.id},'adjustment',1,${foreign.ownerId})`), /INVENTORY_OWNER_MISMATCH/);
});
test("metadata edits preserve negative stock and block destructive unit changes or history deletion", async () => {
  const item = await ingredient("Metadata");
  checked(await db.from("ingredients").update({ stock_quantity: -5 }).eq("id", item.id));
  await updateOwnerIngredient(db, scope, item.id, { name: "Metadata renamed", cost_per_unit: 101 });
  assert.equal((await current(item.id)).stock_quantity, -5);
  await assert.rejects(() => updateOwnerIngredient(db, scope, item.id, { stock_quantity: 10 }), /opname/);
  await assert.rejects(() => updateOwnerIngredient(db, scope, item.id, { unit: "kg" }), /Satuan/);
  await assert.rejects(() => db.execute(sql`update public.ingredients set unit='kg' where id=${item.id}`), /INGREDIENT_UNIT_IN_USE/);
  await assert.rejects(() => deleteOwnerIngredient(db, scope, item.id), /Nonaktifkan/);
  assert.equal((await updateOwnerIngredient(db, scope, item.id, { is_active: false })).is_active, false);
  const unused = await ingredient("Unused", 0);
  await updateOwnerIngredient(db, scope, unused.id, { unit: "kg" });
  assert.equal((await deleteOwnerIngredient(db, scope, unused.id)).success, true);
});
test("purchase and absolute opname retries retain one owner-attributed movement and exact money rounding", async () => {
  const item = await ingredient("Purchase", 0);
  const values = { ...scope, userId: null, supplier: "Supplier", items: [{ ingredient_id: item.id, quantity: 0.15, unit_cost: 0.1 }] };
  const requestId = randomUUID();
  const purchase = () => runFinancialCommand(db, { companyId: scope.companyId, requestId, command: "purchase", payload: values, execute: tx => recordPurchase(tx, values) });
  const first = await purchase(); assert.equal(first.total_amount, 0.02);
  assert.deepEqual(await purchase(), first);
  assert.equal((await current(item.id)).stock_quantity, 0.15);
  assert.equal((await current(item.id)).cost_per_unit, 0.1);
  assert.equal((await movements(item.id)).length, 1);
  const adjust = { ...scope, userId: null, ingredientId: item.id, quantity: 0.1, note: "Hitung fisik" };
  const adjustId = randomUUID();
  const opname = () => runFinancialCommand(db, { companyId: scope.companyId, requestId: adjustId, command: "adjust", payload: adjust, execute: tx => adjustStock(tx, adjust) });
  await opname(); await opname();
  assert.equal((await current(item.id)).stock_quantity, 0.1);
  assert.equal((await movements(item.id)).length, 2);
  assert.ok((await movements(item.id)).every(row => row.created_by_owner_id === scope.ownerId));
  await assert.rejects(() => recordPurchase(db, { ...values, items: [values.items[0], values.items[0]] }), /duplikat/);
  await assert.rejects(() => recordPurchase(db, { ...values, items: [{ ...values.items[0], quantity: 0.001 }] }), /desimal/);
});
test("purchase failure rolls back last cost, stock, purchase header and all movements", async () => {
  const item = await ingredient("Atomic purchase");
  await pg.exec(`create function public.fail_owner_purchase() returns trigger language plpgsql as $$ begin
    if NEW.type='purchase' then raise exception 'injected purchase failure'; end if; return NEW; end $$;
    create trigger fail_owner_purchase before insert on public.stock_movements for each row execute function public.fail_owner_purchase();`);
  try {
    await assert.rejects(() => recordPurchase(db, { ...scope, userId: null, supplier: "Atomic", items: [{ ingredient_id: item.id, quantity: 10, unit_cost: 200 }] }), /injected/);
    assert.equal((await current(item.id)).stock_quantity, 1000);
    assert.equal((await current(item.id)).cost_per_unit, 100);
    assert.equal((await movements(item.id)).length, 1);
    assert.equal((await execute(sql`select count(*)::int as n from public.ingredient_purchases where supplier_name='Atomic'`))[0].n, 0);
  } finally { await pg.exec("drop trigger fail_owner_purchase on public.stock_movements; drop function public.fail_owner_purchase();"); }
});
test("product prices and composition commit together; clearing recipes and partial legacy updates work", async () => {
  const item = await ingredient("Recipe coffee");
  const values = { name: "Kopi lengkap", category_id: categoryId, price: 20000, prices: [{ tier_id: tierId, price: 22000 }], recipes: [{ ingredient_id: item.id, quantity_used: 18 }] };
  const product = await saveOwnerProduct(db, scope, values);
  assert.equal((await current(item.id)).stock_quantity, 1000, "saving a recipe does not consume stock");
  await saveOwnerProduct(db, scope, { is_active: false }, { productId: product.id });
  assert.equal(checked(await db.from("product_recipes").select().eq("product_id", product.id)).length, 1);
  const originalPrice = checked(await db.from("product_tier_prices").select().eq("product_id", product.id));
  await pg.exec(`create function public.fail_owner_recipe() returns trigger language plpgsql as $$ begin
    if NEW.quantity_used=6.66 then raise exception 'injected recipe failure'; end if; return NEW; end $$;
    create trigger fail_owner_recipe before insert on public.product_recipes for each row execute function public.fail_owner_recipe();`);
  try {
    await assert.rejects(() => saveOwnerProduct(db, scope, { name: "Should rollback", prices: [{ tier_id: tierId, price: 1 }], recipes: [{ ingredient_id: item.id, quantity_used: 6.66 }] }, { productId: product.id }), /injected/);
    assert.equal(checked(await db.from("products").select().eq("id", product.id).single()).name, values.name);
    assert.deepEqual(checked(await db.from("product_tier_prices").select().eq("product_id", product.id)), originalPrice);
    assert.equal(checked(await db.from("product_recipes").select().eq("product_id", product.id))[0].quantity_used, 18);
  } finally { await pg.exec("drop trigger fail_owner_recipe on public.product_recipes; drop function public.fail_owner_recipe();"); }
  await saveOwnerProduct(db, scope, { recipes: [] }, { productId: product.id });
  assert.equal(checked(await db.from("product_recipes").select().eq("product_id", product.id)).length, 0);
});
test("composition ownership, duplicate quantities, quota failures and product-create replay fail closed", async () => {
  const item = await ingredient("Scoped");
  const foreignIngredient = await createOwnerIngredient(db, foreign, { name: "Foreign", unit: "gram", stock_quantity: 0, min_stock_alert: 0, cost_per_unit: 1 });
  const base = { name: "Scoped product", category_id: categoryId, price: 1000 };
  await assert.rejects(() => saveOwnerProduct(db, scope, { ...base, recipes: [{ ingredient_id: foreignIngredient.id, quantity_used: 1 }] }), /outlet/);
  await assert.rejects(() => saveOwnerProduct(db, scope, { ...base, recipes: [{ ingredient_id: item.id, quantity_used: 1 }, { ingredient_id: item.id, quantity_used: 2 }] }), /duplikat/);
  await assert.rejects(() => saveOwnerProduct(db, scope, { ...base, recipes: [{ ingredient_id: item.id, quantity_used: 0.001 }] }), /desimal/);
  await assert.rejects(() => saveOwnerProduct(db, scope, base, { checkQuota: async () => false }), /Kuota/);
  const requestId = randomUUID();
  const create = () => runFinancialCommand(db, { companyId: scope.companyId, requestId, command: "product", payload: base, execute: tx => saveOwnerProduct(tx, scope, base) });
  assert.equal((await create()).id, (await create()).id);
});
test("a product saved with composition deducts once after a sale and retains historical COGS", async () => {
  const item = await ingredient("Sale coffee");
  const product = await saveOwnerProduct(db, scope, { name: "Kopi Penjualan", category_id: categoryId, price: 20000, recipes: [{ ingredient_id: item.id, quantity_used: 18 }] });
  const order = checked(await db.from("orders").insert({ company_id: scope.companyId, outlet_id: scope.outletId, subtotal: 40000, tax_amount: 0, total_price: 40000 }).select().single());
  checked(await db.from("order_items").insert({ order_id: order.id, product_id: product.id, product_name: product.name, unit_price: 20000, quantity: 2, subtotal: 40000 }));
  await deductStockForOrder(db, order.id, scope.companyId, scope.outletId);
  await saveOwnerProduct(db, scope, { recipes: [{ ingredient_id: item.id, quantity_used: 30 }] }, { productId: product.id });
  await deductStockForOrder(db, order.id, scope.companyId, scope.outletId);
  assert.equal((await current(item.id)).stock_quantity, 964);
  assert.equal(checked(await db.from("order_items").select().eq("order_id", order.id).single()).cogs_amount, 3600);
});
