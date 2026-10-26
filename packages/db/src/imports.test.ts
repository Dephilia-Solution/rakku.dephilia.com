import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import { confirmImport, stageImport, ImportError, type StagedImportRow, type ImportDomain } from "./imports";
import { buildTemplateWorkbook, parseWorkbook, validateRows } from "../../../apps/owner/src/lib/import/import-excel";

const pg = new PGlite();
const dialect = new PgDialect();
let catalog: Catalog;
const executor = (connection: Pick<PGlite, "query">) => async (query: SQL): Promise<Row[]> => {
  const compiled = dialect.sqlToQuery(query);
  return (await connection.query<Row>(compiled.sql, compiled.params)).rows;
};
const execute = executor(pg);
const db = new DatabaseClient(execute, async () => catalog,
  work => pg.transaction(tx => work(new DatabaseClient(executor(tx), async () => catalog))));
let companyId: string, outletId: string, otherCompany: string, ownerId: string, otherOutlet: string;
before(async () => {
  for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
    await pg.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  catalog = await loadCatalog(execute);
  await execute(sql`select set_config('app.scope','platform',false)`);
  companyId = String((await execute(sql`insert into public.companies(code,name,password_hash) values('IMP-A','Import A','hash') returning id`))[0].id);
  otherCompany = String((await execute(sql`insert into public.companies(code,name,password_hash) values('IMP-B','Import B','hash') returning id`))[0].id);
  outletId = String((await execute(sql`insert into public.outlets(company_id,name) values(${companyId},'Pusat') returning id`))[0].id);
  otherOutlet = String((await execute(sql`insert into public.outlets(company_id,name) values(${otherCompany},'Other') returning id`))[0].id);
  ownerId = String((await execute(sql`insert into public.owners(email,name,password_hash) values('import-owner@example.test','Owner','hash') returning id`))[0].id);
  await execute(sql`update public.companies set owner_id=${ownerId} where id=${companyId}`);
});
after(() => pg.close());
const product = (name: string, price = 25000): StagedImportRow => ({ rowNumber: 2, payload: { name, category_name: "Minuman", price }, errors: [] });
const stage = (rows: StagedImportRow[], domain: ImportDomain = "products") => stageImport(db, { companyId, domain,
  outletId: domain !== "employees" ? outletId : null, fileName: "test.xlsx", rows });
const confirm = (batchId: string, allowed = true) => confirmImport(db, { companyId, ownerId, batchId, checkQuota: async () => allowed });

test("confirm creates products/categories once and replays without duplicate writes", async () => {
  const batchId = await stage([product("Replay")]);
  assert.equal((await confirm(batchId)).imported, 1);
  assert.equal((await confirm(batchId)).replayed, true);
  assert.equal((await execute(sql`select count(*)::int as n from public.products where name='Replay'`))[0].n, 1);
  assert.equal((await execute(sql`select name from public.categories where outlet_id=${outletId}`))[0].name, "Minuman");
});
test("another company cannot confirm a batch", async () => {
  const batchId = await stage([product("Tenant")]);
  await assert.rejects(() => confirmImport(db, { companyId: otherCompany, batchId, checkQuota: async () => true }),
    (e: unknown) => e instanceof ImportError && e.status === 404);
});
test("quota is checked again at confirmation and a rejected batch can safely retry", async () => {
  const batchId = await stage([product("Quota")]);
  await assert.rejects(() => confirm(batchId, false), (e: unknown) => e instanceof ImportError && e.code === "PLAN_LIMIT");
  assert.equal((await execute(sql`select status from app_private.import_batches where id=${batchId}`))[0].status, "validated");
  assert.equal((await confirm(batchId)).imported, 1);
});
test("a failed batch rolls back even the first product chunk and all new categories", async () => {
  const rows = Array.from({ length: 101 }, (_, i) => ({ ...product(`Rollback ${i}`), rowNumber: i + 2 }));
  const batchId = await stage(rows);
  // Inject a database failure on the second chunk to exercise real transaction rollback.
  await pg.exec(`create function public.reject_last_import() returns trigger language plpgsql as $$ begin
    if NEW.name = 'Rollback 100' then raise exception 'injected write failure'; end if; return NEW; end $$;
    create trigger reject_last_import before insert on public.products for each row execute function public.reject_last_import();`);
  await assert.rejects(() => confirm(batchId));
  assert.equal((await execute(sql`select count(*)::int as n from public.products where name like 'Rollback %'`))[0].n, 0);
  assert.equal((await execute(sql`select status from app_private.import_batches where id=${batchId}`))[0].status, "validated");
  await pg.exec("drop trigger reject_last_import on public.products; drop function public.reject_last_import();");
});
test("employees get hashed PINs and complete assignments atomically; hashes are removed after success", async () => {
  await execute(sql`insert into public.roles(company_id,name) values(${companyId},'Kasir')`);
  const batchId = await stage([{ rowNumber: 2, payload: { name: "Ana", username: "ana", pin_hash: "hashed-pin",
    role_name: "Kasir", outlet_names: ["Pusat"] }, errors: [] }], "employees");
  assert.equal((await confirm(batchId)).imported, 1);
  const [user] = await execute(sql`select id,pin_hash from public.users where company_id=${companyId} and username='ana'`);
  assert.equal(user.pin_hash, "hashed-pin");
  assert.equal((await execute(sql`select outlet_id from public.user_outlets where user_id=${user.id}`))[0].outlet_id, outletId);
  const [row] = await execute(sql`select payload from app_private.import_rows where batch_id=${batchId}`);
  assert.equal(row.payload.pin_hash, undefined);
  const invalidBatch = await stage([{ rowNumber: 2, payload: { name: "Bob", username: "bob", pin_hash: "hash",
    role_name: "Kasir", outlet_names: ["Pusat", "Deleted"] }, errors: [] }], "employees");
  await assert.rejects(() => confirm(invalidBatch), /Outlet/);
  assert.equal((await execute(sql`select count(*)::int as n from public.users where username='bob'`))[0].n, 0);
});

const ingredient = (name: string, code = "B1"): StagedImportRow => ({ rowNumber: 100002,
  payload: { kind: "ingredient", sheet_name: "BahanBaku", sheet_row: 2, linked_workbook: true, ingredient_code: code,
    ingredient_mode: "new", name, unit: "gram", stock_quantity: 1000, cost_per_unit: 180, min_stock_alert: 100 }, errors: [] });
const recipe = (quantity = 18): StagedImportRow => ({ rowNumber: 200002,
  payload: { kind: "recipe", sheet_name: "Komposisi", sheet_row: 2, linked_workbook: true,
    product_code: "P1", ingredient_code: "B1", quantity_used: quantity, unit: "gram" }, errors: [] });
const linkedProduct = (name: string): StagedImportRow => ({ ...product(name), payload: {
  ...product(name).payload, kind: "product", sheet_name: "Produk", sheet_row: 2, linked_workbook: true, product_code: "P1" } });
const bundle = (name: string, quantity = 18) => [linkedProduct(name), ingredient(`${name} bahan`), recipe(quantity)];
const count = async (query: SQL) => Number((await execute(query))[0].n);

test("ingredient import uses owner service for opening stock and replays without restocking", async () => {
  const batchId = await stage([ingredient("Opening import")], "ingredients");
  const result = await confirm(batchId);
  assert.equal(result.imported, 1);
  assert.equal(result.new_ingredients, 1);
  const [row] = await execute(sql`select * from public.ingredients where name='Opening import' and outlet_id=${outletId}`);
  assert.equal(Number(row.stock_quantity), 1000);
  assert.equal(Number(row.cost_per_unit), 180);
  const movements = await execute(sql`select * from public.stock_movements where ingredient_id=${row.id}`);
  assert.equal(movements.length, 1);
  assert.equal(Number(movements[0].quantity_change), 1000);
  assert.equal(movements[0].created_by, null, "owner must not be written as a POS user");
  assert.equal((await confirm(batchId)).replayed, true);
  assert.equal(await count(sql`select count(*)::int as n from public.stock_movements where ingredient_id=${row.id}`), 1);
});
test("workbook parser-to-database roundtrip creates products, recipes and audited opening ingredients", async () => {
  const bytes = buildTemplateWorkbook("products");
  const parsed = parseWorkbook(bytes.buffer as ArrayBuffer, "products");
  validateRows("products", parsed.rows, {});
  assert.ok(parsed.rows.every(row => !row.errors.length));
  const batchId = await stage(parsed.rows);
  const result = await confirm(batchId);
  assert.equal(result.imported, 2);
  assert.equal(result.new_ingredients, 3);
  assert.equal(result.recipes, 4);
  const recipes = await execute(sql`select p.name, i.name as ingredient, i.unit, r.quantity_used from public.product_recipes r
    join public.products p on p.id=r.product_id join public.ingredients i on i.id=r.ingredient_id
    where p.outlet_id=${outletId} and p.name in ('Kopi Susu Gula Aren','Americano')`);
  assert.equal(recipes.length, 4);
  assert.equal(Number(recipes.find(row => row.unit === "ml" && row.ingredient === "Susu segar")!.quantity_used), 150);
  assert.equal((await confirm(batchId)).replayed, true);
  assert.equal(await count(sql`select count(*)::int as n from public.products where outlet_id=${outletId} and name='Americano'`), 1);
});
test("ingredient quota checks actual company counts at confirm including product workbooks", async () => {
  const existing = await count(sql`select count(*)::int as n from public.ingredients where company_id=${companyId}`);
  const batchId = await stage(bundle("Ingredient quota"));
  // Another write consumes the last slot after this workbook was staged.
  await execute(sql`insert into public.ingredients(company_id,outlet_id,name,unit) values(${companyId},${outletId},'Concurrent quota slot','gram')`);
  const checks: { domain: string; count: number }[] = [];
  await assert.rejects(() => confirmImport(db, { companyId, ownerId, batchId, checkQuota: async (tx, domain, added) => {
    checks.push({ domain, count: added });
    if (domain !== "ingredients") return true;
    const [row] = await tx.execute(sql`select count(*)::int as n from public.ingredients where company_id=${companyId}`);
    return Number(row.n) + added <= existing + 1;
  } }), (error: unknown) => error instanceof ImportError && error.code === "PLAN_LIMIT");
  assert.deepEqual(checks, [{ domain: "products", count: 1 }, { domain: "ingredients", count: 1 }]);
  assert.equal(await count(sql`select count(*)::int as n from public.products where name='Ingredient quota'`), 0);
  assert.equal(await count(sql`select count(*)::int as n from public.ingredients where company_id=${companyId}`), existing + 1);
  assert.equal((await confirm(batchId)).imported, 1, "quota failure can safely retry");
  const standalone = await stage([ingredient("Standalone quota")], "ingredients");
  await assert.rejects(() => confirm(standalone, false), (error: unknown) => error instanceof ImportError && error.code === "PLAN_LIMIT");
});
test("recipe write failure rolls back products, categories, ingredients, opening movements and batch status", async () => {
  const rows = bundle("Atomic linked", 6.66);
  rows[0].payload.category_name = "Atomic category";
  const batchId = await stage(rows);
  const movementsBefore = await count(sql`select count(*)::int as n from public.stock_movements`);
  await pg.exec(`create function public.reject_import_recipe() returns trigger language plpgsql as $$ begin
    if NEW.quantity_used=6.66 then raise exception 'injected recipe failure'; end if; return NEW; end $$;
    create trigger reject_import_recipe before insert on public.product_recipes for each row execute function public.reject_import_recipe();`);
  try {
    await assert.rejects(() => confirm(batchId), /injected recipe failure/);
    assert.equal(await count(sql`select count(*)::int as n from public.products where name='Atomic linked'`), 0);
    assert.equal(await count(sql`select count(*)::int as n from public.ingredients where name='Atomic linked bahan'`), 0);
    assert.equal(await count(sql`select count(*)::int as n from public.categories where name='Atomic category'`), 0);
    assert.equal(await count(sql`select count(*)::int as n from public.stock_movements`), movementsBefore);
    assert.equal((await execute(sql`select status from app_private.import_batches where id=${batchId}`))[0].status, "validated");
  } finally { await pg.exec("drop trigger reject_import_recipe on public.product_recipes; drop function public.reject_import_recipe();"); }
  assert.equal((await confirm(batchId)).imported, 1);
  assert.equal((await confirm(batchId)).replayed, true);
});
test("existing ingredient references preserve stock/cost/minimum and use no ingredient quota", async () => {
  const [existing] = await execute(sql`select * from public.ingredients where outlet_id=${outletId} and name='Opening import'`);
  for (const explicit of [false, true]) {
    const rows = [linkedProduct(`Existing reference ${explicit}`), ingredient("Opening import"), recipe()];
    Object.assign(rows[1].payload, { ingredient_mode: "existing", resolved_ingredient_id: existing.id,
      ...(explicit ? { ingredient_id: existing.id } : {}), stock_quantity: null, cost_per_unit: 0, min_stock_alert: null });
    const batchId = await stage(rows);
    await confirmImport(db, { companyId, batchId, checkQuota: async (_tx, domain) => {
      assert.equal(domain, "products", "reference-only recipe must not consume ingredient quota"); return true;
    } });
    const [after] = await execute(sql`select * from public.ingredients where id=${existing.id}`);
    assert.deepEqual(after, existing);
  }
  const direct = recipe();
  Object.assign(direct.payload, { ingredient_code: "", ingredient_id: existing.id });
  await confirm(await stage([linkedProduct("Direct ingredient ID"), direct]));
  assert.equal(await count(sql`select count(*)::int as n from public.stock_movements where ingredient_id=${existing.id}`), 1);
});
test("unknown, cross-outlet, and cross-company ingredient IDs cannot enter recipes", async () => {
  const ownOtherOutlet = String((await execute(sql`insert into public.outlets(company_id,name) values(${companyId},'Isolated') returning id`))[0].id);
  for (const [company, outlet] of [[otherCompany, otherOutlet], [companyId, ownOtherOutlet]]) {
    const [foreign] = await execute(sql`insert into public.ingredients(company_id,outlet_id,name,unit) values(${company},${outlet},'Foreign','gram') returning id`);
    const line = recipe(); Object.assign(line.payload, { ingredient_code: "", ingredient_id: foreign.id });
    await assert.rejects(() => stage([linkedProduct(`Foreign recipe ${outlet}`), line]).then(confirm), /outlet tujuan/);
    const declaration = ingredient("Foreign"); Object.assign(declaration.payload, { ingredient_mode: "existing", resolved_ingredient_id: foreign.id,
      ingredient_id: foreign.id, stock_quantity: 0, cost_per_unit: 0, min_stock_alert: 0 });
    await assert.rejects(() => stage([declaration], "ingredients").then(confirm), /outlet tujuan/);
  }
  const line = recipe(); Object.assign(line.payload, { ingredient_code: "", ingredient_id: "00000000-0000-0000-0000-000000000099" });
  await assert.rejects(() => stage([linkedProduct("Unknown recipe"), line]).then(confirm), /outlet tujuan/);
});
test("invalid linked rows block the entire workbook while plain products still import valid rows", async () => {
  const rows = bundle("Blocked linked"); rows[2].errors = [{ field: "kode_bahan", message: "Unknown code" }];
  const batchId = await stage(rows);
  await assert.rejects(() => confirm(batchId), (error: unknown) => error instanceof ImportError && error.code === "IMPORT_LINKED_ERRORS");
  assert.equal(await count(sql`select count(*)::int as n from public.products where name='Blocked linked'`), 0);
  const good = product("Plain valid"); const bad = { ...product("Plain invalid"), rowNumber: 3, errors: [{ field: "harga", message: "Invalid" }] };
  assert.equal((await confirm(await stage([good, bad]))).imported, 1);
});
test("confirm rechecks linked references, decimals, units and duplicate canonical ingredients", async () => {
  for (const quantity of [0, -1, 0.001, 10000000000]) {
    await assert.rejects(() => stage(bundle(`Bad qty ${quantity}`, quantity)).then(confirm), /Jumlah per porsi/);
  }
  const wrongUnit = bundle("Wrong unit"); wrongUnit[2].payload.unit = "kg";
  await assert.rejects(() => stage(wrongUnit).then(confirm), /Satuan/);
  const unknownCode = bundle("Unknown code"); unknownCode[2].payload.ingredient_code = "Missing";
  await assert.rejects(() => stage(unknownCode).then(confirm), /Bahan aktif/);
  const unknownProduct = bundle("Unknown product"); unknownProduct[2].payload.product_code = "Missing";
  await assert.rejects(() => stage(unknownProduct).then(confirm), /Kode produk/);
  const duplicate = bundle("Duplicate recipe"); duplicate.push({ ...recipe(2), rowNumber: 200003 });
  await assert.rejects(() => stage(duplicate).then(confirm), /duplikat/);
  const [existing] = await execute(sql`select * from public.ingredients where name='Opening import' and outlet_id=${outletId}`);
  const overwrite = ingredient("Opening import"); Object.assign(overwrite.payload, { ingredient_mode: "existing", ingredient_id: existing.id, resolved_ingredient_id: existing.id });
  await assert.rejects(() => stage([overwrite], "ingredients").then(confirm), /hanya referensi/);
  const race = ingredient("Appeared after preview"); const batchId = await stage([race], "ingredients");
  await execute(sql`insert into public.ingredients(company_id,outlet_id,name,unit) values(${companyId},${outletId},'Appeared after preview','gram')`);
  await assert.rejects(() => confirm(batchId), /sudah ada/);
  const [unitRef] = await execute(sql`insert into public.ingredients(company_id,outlet_id,name,unit)
    values(${companyId},${outletId},'Unit snapshot','gram') returning id`);
  const unitLine = recipe(); Object.assign(unitLine.payload, { ingredient_code: "", ingredient_id: unitRef.id, unit: null, resolved_unit: "gram" });
  const unitBatch = await stage([linkedProduct("Changed ingredient unit"), unitLine]);
  await execute(sql`update public.ingredients set unit='kg' where id=${unitRef.id}`);
  await assert.rejects(() => confirm(unitBatch), /Satuan resep/);
});
test("ingredient creation requires a scoped owner and a valid batch outlet", async () => {
  const batchId = await stage([ingredient("Owner required")], "ingredients");
  await assert.rejects(() => confirmImport(db, { companyId, batchId, checkQuota: async () => true }), /owner/);
  const [otherOwner] = await execute(sql`insert into public.owners(email,name,password_hash) values('other-import@example.test','Other','hash') returning id`);
  await assert.rejects(() => confirmImport(db, { companyId, batchId, ownerId: String(otherOwner.id), checkQuota: async () => true }));
  assert.equal(await count(sql`select count(*)::int as n from public.ingredients where name='Owner required'`), 0);
  const foreignBatch = await stageImport(db, { companyId, outletId: otherOutlet, domain: "ingredients", fileName: "foreign.xlsx", rows: [ingredient("Wrong outlet")] });
  await assert.rejects(() => confirm(foreignBatch), /Outlet tujuan/);
});
test("staging defensively strips raw PIN values even from invalid employee rows", async () => {
  const batchId = await stage([{ rowNumber: 2, payload: { name: "Invalid PIN", pin: "123456" }, errors: [{ field: "username", message: "Missing" }] }], "employees");
  const [row] = await execute(sql`select payload from app_private.import_rows where batch_id=${batchId}`);
  assert.equal(row.payload.pin, undefined);
});
