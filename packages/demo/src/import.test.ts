import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { createDemoSandbox, DEMO_IDS, fixtureId } from "../index";
import { createDemoImportService, createDemoRequestAdapter, prepareDemoImportImages, type DemoRequestAdapter, type DemoWorkbookService } from "./runtime";
import { readDemoImageZip, demoImageMetadata } from "./import-images";
import { importMetadata, type DemoImportDomain, type DemoImportRow } from "./import-models";
import { createOwnerDemoImportService } from "../../../apps/owner/src/lib/import/demo-import";

const NOW = new Date("2026-11-01T05:00:00Z"), P = DEMO_IDS.pusat, T = DEMO_IDS.taman;
const id = (kind: string, index = 0, outlet: string = P) => fixtureId(outlet, kind, index);
async function excel() { return import("../../../apps/owner/src/lib/import/import-excel"); }
function owner() {
  const sandbox = createDemoSandbox(NOW); sandbox.run({ type: "session.owner" });
  const imports = createOwnerDemoImportService(sandbox), request = createDemoRequestAdapter(sandbox, { app: "owner", importService: imports });
  return { sandbox, imports, request };
}
async function json(request: DemoRequestAdapter, path: string, body?: unknown) {
  const response = await request(`/api/owner/import/${path}`, body === undefined ? {} : { method: "POST", body: JSON.stringify(body) });
  return { response, data: await response.json() };
}
async function upload(request: DemoRequestAdapter, domain: DemoImportDomain, bytes: Uint8Array, images?: File, outlet: string = P) {
  const form = new FormData(); form.set("domain", domain); form.set("outlet_id", outlet); form.set("file", new File([new Uint8Array(bytes).buffer], "upload.xlsx"));
  if (images) form.set("images_zip", images);
  const response = await request("/api/owner/import/validate", { method: "POST", body: form });
  return { response, data: await response.json() };
}
const confirm = (request: DemoRequestAdapter, batch: string, conflict_mode = "skip", allow_new_categories = false) => json(request, "confirm", { batch_id: batch, conflict_mode, allow_new_categories });
async function workbook(domain: DemoImportDomain, sheets: Record<string, unknown[][]>, metadata?: ReturnType<typeof importMetadata>) {
  const bytes = await (await excel()).buildTemplateWorkbook(domain, ["Coffee", "Non-Coffee", "Food"], metadata);
  const { default: ExcelJS } = await import("../../../apps/owner/node_modules/exceljs");
  const book = new ExcelJS.Workbook(); await book.xlsx.load(new Uint8Array(bytes).buffer);
  for (const [name, rows] of Object.entries(sheets)) for (const row of rows) book.getWorksheet(name)!.addRow(row);
  return new Uint8Array(await book.xlsx.writeBuffer());
}
async function sample(request: DemoRequestAdapter, domain: DemoImportDomain, outlet: string = P, extra = "") {
  const response = await request(`/api/owner/import/template?domain=${domain}&outlet_id=${outlet}&sample=1${extra}`);
  assert.equal(response.status, 200, response.headers.get("Content-Type") ?? "");
  return new Uint8Array(await response.arrayBuffer());
}

test("actual Owner bridge generates blank and filled workbooks for every domain and uses UUID-safe dynamic outlet metadata", async () => {
  const { sandbox, request } = owner(), parser = await excel();
  for (const domain of ["products", "ingredients", "employees", "purchases"] as const) {
    const empty = await request(`/api/owner/import/template?domain=${domain}&outlet_id=${P}`);
    assert.equal(empty.headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.equal(empty.headers.get("X-Rakku-Demo"), "local"); assert.equal(empty.headers.get("Set-Cookie"), null);
    const blank = parser.parseWorkbook(await empty.arrayBuffer(), domain); assert.equal(blank.headerOk, true); assert.equal(blank.rows.length, 0);
    const bytes = await sample(request, domain), validated = await upload(request, domain, bytes);
    assert.equal(validated.response.status, 200, JSON.stringify(validated.data)); assert.equal(validated.data.summary.can_confirm, true, JSON.stringify(validated.data));
    assert.equal(validated.data.summary.errors, 0); assert.ok(validated.data.expires_at); assert.ok(Array.isArray(validated.data.assets));
    if (domain === "products") {
      assert.equal(blank.schemaVersion, 2); assert.notEqual(blank.metadata!.company_id, DEMO_IDS.company); assert.equal(blank.metadata!.tiers.length, 4);
      assert.deepEqual(blank.metadata, validated.data.metadata); assert.equal(validated.data.summary.recipes, 1);
    }
    if (domain === "employees") assert.ok(!JSON.stringify(validated.data).includes("567890"));
    if (domain === "purchases") assert.equal(validated.data.summary.main_total, 2);
  }
  sandbox.run({ type: "entity.save", entity: "tiers", value: { outlet_id: T, name: "Delivery Baru", slug: "delivery-baru" } });
  const taman = parser.parseWorkbook(new Uint8Array(await sample(request, "products", T)).buffer, "products");
  assert.equal(taman.metadata!.tiers.length, 5); assert.notEqual(taman.metadata!.outlet_id, importMetadata(sandbox.getSnapshot(), P, sandbox.importIdentities).outlet_id);
  assert.equal(taman.headerLabels.at(-2), "harga_tier:delivery-baru");
});

test("sample and user-uploaded v1/v2 products confirm with recipe, category consent, decimal prices and merged tier prices", async () => {
  const { sandbox, request } = owner();
  const before = sandbox.getSnapshot().products.length, preview = await upload(request, "products", await sample(request, "products"));
  const saved = await confirm(request, preview.data.batch_id); assert.equal(saved.response.status, 200); assert.equal(saved.data.created, 1); assert.equal(saved.data.recipes, 1); assert.equal(saved.data.tier_prices, 2);
  assert.equal(sandbox.getSnapshot().products.length, before + 1);
  const metadata = importMetadata(sandbox.getSnapshot(), P, sandbox.importIdentities), old = sandbox.getSnapshot().products.find(row => row.id === id("product"))!;
  const description = "a".repeat(1500);
  const bytes = await workbook("products", { Produk: [[old.code, "Espresso Diimpor", "Kategori Baru", 17000.25, description, null, 12000.75, null, null, ""]], Komposisi: [[old.code, "BHN002", 25]] }, metadata);
  const validation = await upload(request, "products", bytes); assert.equal(validation.data.summary.can_confirm, true);
  assert.deepEqual(validation.data.summary.new_categories_for_update, ["Kategori Baru"]);
  const unchanged = sandbox.getSnapshot(), consent = await confirm(request, validation.data.batch_id, "update");
  assert.equal(consent.response.status, 409); assert.equal(consent.data.code, "IMPORT_CATEGORY_CONFIRMATION_REQUIRED"); assert.equal(sandbox.getSnapshot(), unchanged);
  const updated = await confirm(request, validation.data.batch_id, "update", true); assert.equal(updated.data.updated, 1); assert.equal(updated.data.categories_created, 1);
  const product = sandbox.getSnapshot().products.find(row => row.id === old.id)!;
  assert.equal(product.price, 17000.25); assert.equal(product.description, description); assert.equal(product.prices[id("tier", 0)], old.prices[id("tier", 0)]);
  assert.equal(product.prices[id("tier", 1)], 12000.75); assert.equal(product.prices[id("tier", 2)], old.prices[id("tier", 2)]);
  assert.deepEqual(product.recipe.map(row => [row.ingredient_id, row.quantity_used]), [[id("ingredient", 1), 25]]);
  const v1 = await upload(request, "products", await workbook("products", { Produk: [["USER-001", "Produk User", "Coffee", 12345.67, "Unggahan sendiri"]] }));
  assert.equal(v1.data.schema_version, 1); assert.equal((await confirm(request, v1.data.batch_id)).data.created, 1);
  assert.equal(sandbox.getSnapshot().products.find(row => row.code === "USER-001")!.price, 12345.67);
  const decimalProduct=sandbox.getSnapshot().products.find(row=>row.code==="USER-001")!;
  const quoted=sandbox.run({type:"order.quote",outlet_id:P,tier_id:id("tier"),items:[{product_id:decimalProduct.id,quantity:2}]}) as {subtotal:number;total:number};
  assert.equal(quoted.subtotal,24691.34);assert.equal(quoted.total,27160,"checkout retains cents until final whole-rupiah rounding");
  sandbox.run({type:"product.save",value:{id:decimalProduct.id,description:"Diedit setelah import"}});
  assert.equal(sandbox.getSnapshot().products.find(row=>row.id===decimalProduct.id)?.price,12345.67);
});

test("confirm commits exactly once, replays original counts/options across adapters, and history remains generation-private", async () => {
  const a = owner(), b = owner(); const preview = await upload(a.request, "ingredients", await sample(a.request, "ingredients"));
  let notifications = 0; const unsubscribe = a.sandbox.subscribe(() => notifications++);
  const first = await confirm(a.request, preview.data.batch_id); assert.equal(first.data.imported, 2); assert.equal(notifications, 1);
  const committed = a.sandbox.getSnapshot();
  const secondAdapter = createDemoRequestAdapter(a.sandbox, { app: "owner", importService: a.imports });
  const replay = await confirm(secondAdapter, preview.data.batch_id, "update", true);
  assert.deepEqual(replay.data, { ...first.data, replayed: true }); assert.deepEqual(a.sandbox.getSnapshot().ingredients, committed.ingredients);
  const history = await json(secondAdapter, `batches?batch_id=${preview.data.batch_id}`);
  assert.equal(history.data.batch.status, "confirmed"); assert.equal(history.data.batch.imported_rows, 2); assert.equal(history.data.batch.confirmation_options.conflict_mode, "skip");
  assert.deepEqual(history.data.batch.confirmation_result, first.data); assert.equal(history.data.rows[0].is_valid, true);
  assert.equal((await json(a.request, `batches?domain=ingredients&outlet_id=${P}`)).data.batches.length, 1);
  assert.equal((await confirm(b.request, preview.data.batch_id)).response.status, 404);
  assert.equal((await json(b.request, "batches")).data.batches.length, 0);
  assert.ok(!("import_batches" in a.sandbox.getSnapshot())); assert.ok(!JSON.stringify(a.sandbox.getSnapshot()).includes(preview.data.batch_id));
  unsubscribe();
});

test("ingredient update preserves actual stock, new ingredients create opening movements, and late failure rolls back all rows/history", async () => {
  const { sandbox, request } = owner(), old = sandbox.getSnapshot().ingredients.find(row => row.id === id("ingredient"))!;
  const initialMovements = sandbox.getSnapshot().movements.length;
  const bytes = await workbook("ingredients", { "Bahan Baku": [["NEW-OPEN", "Bahan Baru", "gram", 50, 10, 5], [old.code, "Biji Kopi Update", old.unit, 9999, 11.25, 6]] });
  const preview = await upload(request, "ingredients", bytes), saved = await confirm(request, preview.data.batch_id, "update");
  assert.deepEqual([saved.data.created, saved.data.updated], [1, 1]);
  assert.equal(sandbox.getSnapshot().ingredients.find(row => row.id === old.id)!.stock_quantity, old.stock_quantity);
  assert.equal(sandbox.getSnapshot().movements.length, initialMovements + 1); assert.equal(sandbox.getSnapshot().movements.at(-1)!.quantity_change, 50);
  const invalid = await upload(request, "ingredients", await workbook("ingredients", { "Bahan Baku": [["ROLLBACK-OPEN", "Tidak Tersimpan", "pcs", 10, 5, 1], [old.code, "Unit Terlarang", "kg", 0, 10, 1]] }));
  const before = sandbox.getSnapshot(), historyBefore = (await json(request, `batches?batch_id=${invalid.data.batch_id}`)).data;
  let notifications = 0; sandbox.subscribe(() => notifications++);
  const rejected = await confirm(request, invalid.data.batch_id, "update"); assert.equal(rejected.response.status, 400); assert.equal(sandbox.getSnapshot(), before); assert.equal(notifications, 0);
  assert.deepEqual((await json(request, `batches?batch_id=${invalid.data.batch_id}`)).data, historyBefore);
});

test("multiple purchases are atomic, preserve header execution order/WIB dates, and dedupe reference+payload across batches", async () => {
  const { sandbox, request } = owner(), original = sandbox.getSnapshot(), bytes = await sample(request, "purchases");
  const staged = await upload(request, "purchases", bytes), first = await confirm(request, staged.data.batch_id);
  assert.equal(first.response.status, 200, JSON.stringify(first.data)); assert.equal(first.data.created, 2); assert.equal(first.data.purchases.length, 2);
  const committed = sandbox.getSnapshot(); assert.equal(committed.purchases.length, original.purchases.length + 2); assert.equal(committed.movements.length, original.movements.length + 2);
  assert.equal(committed.ingredients[0].stock_quantity, original.ingredients[0].stock_quantity + 30); assert.equal(committed.ingredients[0].cost_per_unit, 150);
  assert.equal(committed.purchases.at(-1)!.purchase_date, "2026-11-01T00:00:00+07:00");
  assert.equal((await confirm(request, staged.data.batch_id)).data.replayed, true); assert.deepEqual(sandbox.getSnapshot().movements, committed.movements);
  const nextBatch = await upload(request, "purchases", bytes); assert.equal(nextBatch.data.summary.purchase_replays, 2);
  const replay = await confirm(request, nextBatch.data.batch_id, "update"); assert.equal(replay.data.created, 0); assert.equal(replay.data.skipped, 2); assert.ok(replay.data.purchases.every((row: { replayed: boolean }) => row.replayed));
  assert.deepEqual(sandbox.getSnapshot().purchases, committed.purchases); assert.deepEqual(sandbox.getSnapshot().ingredients, committed.ingredients);
  const changed = await upload(request, "purchases", await workbook("purchases", { Pembelian: [["DEMO-BELI-01", "2026-11-01", "Berbeda", ""]], "Detail Pembelian": [["DEMO-BELI-01", "BHN001", 10, "gram", 100]] }));
  assert.equal(changed.data.summary.can_confirm, false); assert.match(changed.data.rows[0].errors[0].message, /isi berbeda/);
  assert.equal((await confirm(request, changed.data.batch_id)).data.code, "IMPORT_LINKED_ERRORS");
});

test("purchase reference races and late invalid ingredient roll back purchases, stock, costs, movements and reference receipts", async () => {
  const { sandbox, request } = owner();
  const make = (cost: number, second = false) => workbook("purchases", { Pembelian: [["RACE-01", "2026-11-01", "", ""], ...(second ? [["RACE-02", "2026-10-31", "", ""]] : [])],
    "Detail Pembelian": [["RACE-01", "BHN001", 2, "gram", cost], ...(second ? [["RACE-02", "BHN002", 3, "ml", 12.34]] : [])] });
  const a = await upload(request, "purchases", await make(1)), b = await upload(request, "purchases", await make(2));
  assert.equal((await confirm(request, a.data.batch_id)).data.created, 1);
  const beforeRace = sandbox.getSnapshot(), race = await confirm(request, b.data.batch_id);
  assert.equal(race.data.code, "IMPORT_REFERENCE_INVALID"); assert.equal(sandbox.getSnapshot(), beforeRace);
  const pending = await upload(request, "purchases", await make(1, true));
  sandbox.run({ type: "entity.save", entity: "ingredients", value: { id: id("ingredient", 1), is_active: false } });
  const before = sandbox.getSnapshot(); assert.equal((await confirm(request, pending.data.batch_id)).data.code, "IMPORT_REFERENCE_INVALID"); assert.equal(sandbox.getSnapshot(), before);
  sandbox.run({ type: "entity.save", entity: "ingredients", value: { id: id("ingredient", 1), is_active: true } });
  const retry = await confirm(request, pending.data.batch_id); assert.equal(retry.data.skipped, 1); assert.equal(retry.data.created, 1);
});

test("strict tier snapshots reject add/rename/slug/deactivate/delete/outlet mismatch at validation and confirmation; reorder is safe", async () => {
  for (const mutation of ["add", "name", "slug", "inactive", "delete"] as const) {
    const { sandbox, request } = owner();
    const tier = sandbox.run({ type: "entity.save", entity: "tiers", value: { outlet_id: P, name: "Test Tier", slug: "test-tier" } }) as { id: string };
    const bytes = await sample(request, "products"), staged = await upload(request, "products", bytes);
    if (mutation === "add") sandbox.run({ type: "entity.save", entity: "tiers", value: { outlet_id: P, name: "New Tier", slug: "new-tier" } });
    else if (mutation === "delete") sandbox.run({ type: "entity.delete", entity: "tiers", id: tier.id });
    else sandbox.run({ type: "entity.save", entity: "tiers", value: { id: tier.id, ...(mutation === "inactive" ? { is_active: false } : mutation === "name" ? { name: "Renamed" } : { slug: "changed-slug" }) } });
    const before = sandbox.getSnapshot(); assert.equal((await confirm(request, staged.data.batch_id)).data.code, "IMPORT_TIERS_STALE", mutation); assert.equal(sandbox.getSnapshot(), before);
    const validation = await upload(request, "products", bytes); assert.equal(validation.response.status, 409); assert.equal(validation.data.code, "IMPORT_TIERS_STALE");
  }
  const a = owner(), b = owner(), bytes = await sample(a.request, "products");
  assert.equal((await upload(a.request, "products", bytes, undefined, T)).data.code, "IMPORT_TIERS_STALE");
  assert.equal((await upload(b.request, "products", bytes)).data.code, "IMPORT_TIERS_STALE");
  const preview = await upload(a.request, "products", bytes);
  a.sandbox.run({ type: "entity.reorder", entity: "tiers", ids: a.sandbox.getSnapshot().tiers.filter(row => row.outlet_id === P).map(row => row.id).reverse() });
  assert.equal((await confirm(a.request, preview.data.batch_id)).data.created, 1);
});

test("current quotas and purchase plan access are rechecked on confirm, and linked errors prevent partial commits", async () => {
  const { sandbox, request } = owner(); const staged = await upload(request, "ingredients", await sample(request, "ingredients"));
  const invoice = sandbox.run({ type: "subscription.checkout", plan: "free", billing_cycle: "monthly" }) as { id: string }; sandbox.run({ type: "subscription.transition", id: invoice.id, status: "success" });
  const before = sandbox.getSnapshot(), quota = await confirm(request, staged.data.batch_id); assert.equal(quota.response.status, 403); assert.equal(quota.data.code, "PLAN_LIMIT"); assert.equal(sandbox.getSnapshot(), before);
  const preview = await upload(request, "ingredients", await workbook("ingredients", { "Bahan Baku": [["OVER-QUOTA", "Kuota Baru", "pcs", 0, 1, 0], ["BHN001", "Existing", "gram", 0, 1, 0]] }));
  assert.equal(preview.data.summary.valid, 1); assert.equal(preview.data.summary.errors, 1); assert.equal(preview.data.summary.can_confirm, true);
  assert.equal((await confirm(request, preview.data.batch_id, "update")).data.updated, 1);
  const blocked = await json(request, `template?domain=purchases&outlet_id=${P}`); assert.equal(blocked.response.status, 403); assert.equal(blocked.data.code, "PLAN_LIMIT");
  const other = owner(); const purchase = await upload(other.request, "purchases", await sample(other.request, "purchases"));
  const free = other.sandbox.run({ type: "subscription.checkout", plan: "free", billing_cycle: "monthly" }) as { id: string }; other.sandbox.run({ type: "subscription.transition", id: free.id, status: "success" });
  assert.equal((await confirm(other.request, purchase.data.batch_id)).data.code, "PLAN_LIMIT");
  const invalid = await upload(other.request, "products", await workbook("products", { Produk: [["VALID-ROW", "Valid", "Coffee", 10000, ""]], Komposisi: [["VALID-ROW", "UNKNOWN", 1]] }));
  const unchanged = other.sandbox.getSnapshot(); assert.equal(invalid.data.summary.can_confirm, false); assert.equal((await confirm(other.request, invalid.data.batch_id)).data.code, "IMPORT_LINKED_ERRORS"); assert.equal(other.sandbox.getSnapshot(), unchanged);
});

test("employee PINs stay private in preview/history/snapshots while imported login and replay work", async () => {
  const { sandbox, request } = owner(), staged = await upload(request, "employees", await sample(request, "employees"));
  assert.ok(!JSON.stringify(staged.data).includes("567890")); assert.ok(!JSON.stringify((await json(request, `batches?batch_id=${staged.data.batch_id}`)).data).includes("567890"));
  const saved = await confirm(request, staged.data.batch_id); assert.equal(saved.data.created, 1);
  const employee = sandbox.getSnapshot().employees.find(row => row.username === "contoh_import")!; assert.equal(employee.pin, ""); assert.ok(!JSON.stringify(sandbox.getSnapshot()).includes("567890"));
  sandbox.run({ type: "session.cashier", outlet_id: T, employee_id: employee.id, pin: "567890" }); assert.equal(sandbox.getTenantSession().user_name, "Karyawan Contoh Import");
  sandbox.run({ type: "session.owner" }); assert.equal((await confirm(request, staged.data.batch_id)).data.replayed, true);
});

test("expired previews fail without mutation; cleanup is repeatable and history preserves the failed batch", async () => {
  const { sandbox, request } = owner(), staged = await upload(request, "ingredients", await sample(request, "ingredients"));
  sandbox.run({ type: "tick", now: "2026-11-02T05:00:00.001Z" });
  const before = sandbox.getSnapshot(), expired = await confirm(request, staged.data.batch_id);
  assert.equal(expired.data.code, "IMPORT_EXPIRED"); assert.equal(sandbox.getSnapshot(), before);
  assert.deepEqual((await json(request, "cleanup", {})).data, { batches: 1, delete_attempts: 0 });
  assert.deepEqual((await json(request, "cleanup", {})).data, { batches: 0, delete_attempts: 0 });
  assert.equal((await json(request, `batches?batch_id=${staged.data.batch_id}`)).data.batch.status, "failed");
});

test("binary response reads/clones/streams and async parse loads are generation/abort guarded without any real transport", async t => {
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("REAL TRANSPORT FORBIDDEN"); });
  const { sandbox, request } = owner();
  const bytes = await sample(request, "ingredients");
  const response = await request(`/api/owner/import/template?domain=ingredients&outlet_id=${P}`), cloned = response.clone(), stream = cloned.body!.getReader();
  sandbox.destroy();
  await assert.rejects(response.arrayBuffer(), { name: "AbortError" }); await assert.rejects(response.blob(), { name: "AbortError" });
  assert.throws(() => response.clone(), { name: "AbortError" }); await assert.rejects(stream.read(), { name: "AbortError" });
  const replacement = owner(); assert.equal((await json(replacement.request, "batches")).data.batches.length, 0);
  let release!: (value: DemoWorkbookService) => void, loadCount = 0;
  const pending = new Promise<DemoWorkbookService>(resolve => { release = resolve; });
  const imports = createDemoImportService(replacement.sandbox, { loadWorkbook: () => { loadCount++; return pending; } });
  const adapter = createDemoRequestAdapter(replacement.sandbox, { app: "owner", importService: imports });
  await json(adapter, "batches"); await json(adapter, "cleanup", {}); assert.equal(loadCount, 0);
  const abort = new AbortController(), form = new FormData(); form.set("file", new File([new Uint8Array(bytes).buffer], "file.xlsx")); form.set("domain", "ingredients"); form.set("outlet_id", P);
  const work = adapter("/api/owner/import/validate", { method: "POST", body: form, signal: abort.signal });
  abort.abort(); release(await excel()); await assert.rejects(work, { name: "AbortError" });
  assert.equal((await json(adapter, "batches")).data.batches.length, 0); assert.equal(loadCount, 1);
  const noService = createDemoRequestAdapter(replacement.sandbox, { app: "owner" }); assert.equal((await json(noService, "batches")).response.status, 501);
  const pos = createDemoRequestAdapter(replacement.sandbox, { app: "pos", importService: imports }); assert.equal((await json(pos, "batches")).response.status, 403);
  assert.equal((await adapter("https://example.invalid/api/owner/import/template")).status, 400);
  assert.equal(fetch.mock.callCount(), 0);
});

// Small valid PNG; archive fixtures are built here to exercise the ordinary ZIP subset.
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII=", "base64"));
function zip(entries: [string, Uint8Array][], deflated = false) {
  const local: Buffer[] = [], central: Buffer[] = []; let offset = 0;
  for (const [name, raw] of entries) {
    let crc = 0xffffffff;
    for (const byte of raw) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
    crc = (crc ^ 0xffffffff) >>> 0;
    const filename = Buffer.from(name), bytes = deflated ? deflateRawSync(raw) : Buffer.from(raw), header = Buffer.alloc(30), directory = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(deflated ? 8 : 0, 8); header.writeUInt32LE(crc, 14); header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(raw.length, 22); header.writeUInt16LE(filename.length, 26);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(deflated ? 8 : 0, 10); directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(bytes.length, 20); directory.writeUInt32LE(raw.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    local.push(header, filename, bytes); central.push(directory, filename); offset += header.length + filename.length + bytes.length;
  }
  const directories = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directories.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, directories, end]));
}
const inflater = async (bytes: Uint8Array, maximum: number) => new Uint8Array(inflateRawSync(bytes, { maxOutputLength: maximum }));
const imageRow = (reference: string): DemoImportRow => ({ rowNumber: 2, payload: { kind: "product", image_reference: reference }, errors: [], warnings: [] });

test("bounded browser-safe ZIP parser rejects path attacks, duplicates, CRC corruption, ZIP64, pixel bombs and animated images", async () => {
  for (const deflated of [false, true]) assert.equal((await readDemoImageZip(zip([["Foto/Kopi.PNG", png]], deflated), inflater, () => {})).size, 1);
  for (const name of ["../kopi.png", "/kopi.png", "C:\\kopi.png", "foto//kopi.png", "foto/./kopi.png", "data.xlsx", "nested.zip", "https://host/x.png"]) await assert.rejects(readDemoImageZip(zip([[name, png]]), inflater, () => {}));
  await assert.rejects(readDemoImageZip(zip([["Kopi.png", png], ["kopi.PNG", png]]), inflater, () => {}));
  const corrupt = zip([["kopi.png", png]]); corrupt[38] ^= 1; await assert.rejects(readDemoImageZip(corrupt, inflater, () => {}));
  const zip64 = zip([["kopi.png", png]]); new DataView(zip64.buffer).setUint32(zip64.length - 6, 0xffffffff, true); await assert.rejects(readDemoImageZip(zip64, inflater, () => {}));
  const bomb = png.slice(); new DataView(bomb.buffer).setUint32(16, 9000); assert.throws(() => demoImageMetadata(bomb, "kopi.png"), /terlalu besar/);
  const animated = png.slice(); animated.set(new TextEncoder().encode("acTL"), 37); assert.throws(() => demoImageMetadata(animated, "kopi.png"), /animasi/);
  assert.throws(() => demoImageMetadata(png, "kopi.jpg"), /signature/);
  await assert.rejects(readDemoImageZip(zip([["kopi.png", png]], true), async () => new Uint8Array(3_000_000), () => {}));
});

test("local image mapping is per workbook reference, all decoders settle, missing images are row errors and unused corrupt images fail", async () => {
  const rows = [imageRow("Foto/Kopi.PNG"), imageRow("foto/kopi.png"), imageRow("missing.png")];
  let decodes = 0;
  const prepared = await prepareDemoImportImages(new File([zip([["foto/kopi.png", png], ["unused.png", png]], true).buffer as ArrayBuffer], "images.zip"), rows, () => {}, {
    inflateRaw: inflater, decode: async () => { decodes++; return { file: new File(["webp-output"], "kopi.webp", { type: "image/webp" }), width: 1, height: 1 }; },
  });
  assert.equal(decodes, 2); assert.equal(prepared.assets.length, 1); assert.equal(prepared.summary.unreferenced, 1); assert.equal(rows[2].errors.length, 1); assert.equal((rows[0].payload.image_mapping as { status: string }).status, "ready");
  let settled = 0;
  await assert.rejects(prepareDemoImportImages(new File([zip([["one.png", png], ["two.png", png]]).buffer as ArrayBuffer], "images.zip"), [], () => {}, {
    inflateRaw: inflater, decode: async () => { await new Promise(resolve => setTimeout(resolve, 1)); settled++; throw new Error("invalid image"); },
  })); assert.equal(settled, 2);
});

test("image object URLs attach atomically, failures revoke previews, retries recreate URLs, and cleanup/reset revoke unused resources", async t => {
  const created: string[] = [], revoked: string[] = [];
  t.mock.method(URL, "createObjectURL", () => { const url = `blob:demo-${created.length}`; created.push(url); return url; });
  t.mock.method(URL, "revokeObjectURL", (url: string) => { revoked.push(url); });
  const sandbox = createDemoSandbox(NOW); sandbox.run({ type: "session.owner" });
  const imports = createDemoImportService(sandbox, { loadWorkbook: excel, prepareImages: async (_file, rows) => {
    rows[0].payload.image_reference_normalized = "kopi.png";
    return { assets: [{ reference: "kopi.png", file: new File(["webp"], "kopi.webp", { type: "image/webp" }), width: 1, height: 1, content_hash: "local" }], summary: { files: 1, matched: 1, unreferenced: 0, rows: 1, processed_bytes: 4 } };
  } });
  const request = createDemoRequestAdapter(sandbox, { app: "owner", importService: imports }), metadata = importMetadata(sandbox.getSnapshot(), P, sandbox.importIdentities);
  const bytes = await workbook("products", { Produk: [["IMAGE-001", "Kopi Gambar", "New Category", 10000, "", null, null, null, null, "kopi.png"]] }, metadata);
  const preview = await upload(request, "products", bytes); assert.equal(preview.data.assets[0].preview_url, created[0]);
  // Maintenance must not revoke a still-valid preview.
  await json(request, "cleanup", {}); assert.equal(revoked.length, 0);
  const before = sandbox.getSnapshot(); assert.equal((await confirm(request, preview.data.batch_id)).data.code, "IMPORT_CATEGORY_CONFIRMATION_REQUIRED"); assert.equal(sandbox.getSnapshot(), before); assert.deepEqual(revoked, [created[0]]);
  const saved = await confirm(request, preview.data.batch_id, "skip", true); assert.equal(saved.data.images, 1); assert.equal(created.length, 2); assert.equal(sandbox.getSnapshot().products.find(row => row.code === "IMAGE-001")!.image_url, created[1]);
  assert.ok(!revoked.includes(created[1]));
  const next = await upload(request, "products", bytes); assert.equal(created.length, 3);
  sandbox.run({ type: "tick", now: "2026-11-02T05:00:00.001Z" });
  assert.equal((await json(request, "cleanup", {})).data.batches, 1); assert.ok(revoked.includes(created[2]));
  assert.equal((await json(request, `batches?batch_id=${next.data.batch_id}`)).data.batch.status, "failed");
  imports.destroy(); sandbox.destroy(); assert.ok(revoked.includes(created[1]));
});
