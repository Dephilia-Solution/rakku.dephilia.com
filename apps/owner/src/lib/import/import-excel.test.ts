import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildTemplateWorkbook, parseWorkbook, validateRows, applyPlanBudget, finalizeLinkedRows } from "./import-excel";

function workbook(rows: unknown[][]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Data");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
test("all generated templates roundtrip with linked data even when instructions are first", () => {
  for (const domain of ["products", "employees", "ingredients"] as const) {
    const bytes = buildTemplateWorkbook(domain);
    const wb = XLSX.read(bytes, { type: "array" });
    wb.SheetNames.reverse();
    const parsed = parseWorkbook(XLSX.write(wb, { type: "array", bookType: "xlsx" }), domain);
    assert.equal(parsed.headerOk, true);
    assert.equal(parsed.rows.length, domain === "products" ? 9 : 2);
    validateRows(domain, parsed.rows, {});
    assert.ok(parsed.rows.every(row => !row.errors.length));
    assert.equal(new Set(parsed.rows.map(row => row.rowNumber)).size, parsed.rows.length);
    if (domain === "products") {
      assert.equal(parsed.rows.filter(row => row.payload.kind === "recipe").length, 4);
      assert.equal(parsed.rows.find(row => row.payload.kind === "recipe")?.payload.sheet_row, 2);
    }
  }
});
test("blank Excel rows retain source row numbers; description is optional", () => {
  const parsed = parseWorkbook(workbook([["nama", "kategori", "harga"], [], ["Kopi", "Minuman", 22000]]), "products");
  assert.equal(parsed.rows[0].rowNumber, 3);
  assert.equal(parsed.rows[0].payload.price, 22000);
});
test("prices are never silently rewritten from invalid text, negatives or thousands separators", () => {
  const parsed = parseWorkbook(workbook([["nama", "kategori", "harga"],
    ...["-25000", "Rp 25000", "25.000", "1e4", "100000000", "abc"].map((price, i) => [`Kopi ${i}`, "Minuman", price]),
    ["Gratis", "Minuman", 0], ["Desimal", "Minuman", 12.5]]), "products");
  assert.ok(parsed.rows.slice(0, 6).every(row => row.errors.some(error => error.field === "harga")));
  assert.deepEqual(parsed.rows.slice(6).map(row => row.payload.price), [0, 12.5]);
});
test("text PINs preserve leading zeroes and validation rejects duplicates, unknown roles and outlets", () => {
  const parsed = parseWorkbook(workbook([["nama", "username", "pin", "role", "outlets"],
    ["Ana", "ana", "001234", "Kasir", "Pusat"], ["Ana 2", "ana", "123456", "Unknown", "Cabang"]]), "employees");
  assert.equal(parsed.rows[0].payload.pin, "001234");
  validateRows("employees", parsed.rows, { roleNameMap: new Map([["kasir", { id: "role", name: "Kasir" }]]),
    outletNameMap: new Map([["pusat", { id: "outlet", name: "Pusat" }]]) });
  assert.deepEqual(parsed.rows[0].errors, []);
  assert.equal(parsed.rows[1].errors.length, 3);
});
test("quota budget counts only valid rows", () => {
  const parsed = parseWorkbook(workbook([["nama", "kategori", "harga"], ["Invalid", "", 10], ["A", "X", 10], ["B", "X", 20]]), "products");
  applyPlanBudget("products", parsed.rows, 1);
  assert.equal(parsed.rows[1].errors.length, 0);
  assert.match(parsed.rows[2].errors[0].message, /kuota/);
});
test("oversized sheets fail explicitly rather than silently truncating data", () => {
  assert.throws(() => parseWorkbook(workbook([["nama", "kategori", "harga"], ...Array.from({ length: 501 }, (_, i) => [`P${i}`, "X", 1])]), "products"), /Maksimal 500/);
});

const ingredientHeaders = ["kode_bahan", "nama", "satuan", "stok_awal", "biaya_per_satuan", "stok_minimum", "id_bahan"];
const recipeHeaders = ["kode_produk", "kode_bahan", "jumlah_per_porsi", "id_bahan", "satuan"];
const ref = { id: "00000000-0000-0000-0000-000000000001", name: "Kopi", unit: "gram" };
function sheets(values: Record<string, unknown[][]>) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(values)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
function linked(ingredients: unknown[][] = [["B1", "Kopi", "gram", 1000, 100, 100]], recipes: unknown[][] = [["P1", "B1", 18]]) {
  return parseWorkbook(sheets({ Produk: [["nama", "kategori", "harga", "kode_produk"], ["Latte", "Minuman", 22000, "P1"]],
    BahanBaku: [ingredientHeaders, ...ingredients], Komposisi: [recipeHeaders, ...recipes] }), "products");
}
test("existing name+unit and explicit IDs resolve only in supplied outlet references without restocking", () => {
  for (const id of ["", ref.id]) {
    const parsed = linked([["B1", "Kopi", "gram", "", 0, "", id]]);
    validateRows("products", parsed.rows, { existingIngredients: [ref] });
    assert.ok(parsed.rows.every(row => !row.errors.length));
    const ingredient = parsed.rows.find(row => row.payload.kind === "ingredient")!;
    assert.equal(ingredient.payload.ingredient_mode, "existing");
    assert.equal(ingredient.payload.resolved_ingredient_id, ref.id);
    applyPlanBudget("ingredients", parsed.rows, 0);
    assert.equal(ingredient.errors.length, 0, "existing references use no ingredient quota");
  }
  const restock = linked([["B1", "Kopi", "gram", 100, 100, 0, ref.id]]);
  validateRows("products", restock.rows, { existingIngredients: [ref] });
  assert.match(restock.rows.find(row => row.payload.kind === "ingredient")!.errors.map(error => error.message).join(" "), /referensi/);
});
test("explicit id_bahan can be used directly in recipes after an ingredient-only import", () => {
  const parsed = parseWorkbook(sheets({ Produk: [["nama", "kategori", "harga", "kode_produk"], ["Latte", "Minuman", 22000, "P1"]],
    Komposisi: [recipeHeaders, ["P1", "", 18, ref.id, "gram"]] }), "products");
  validateRows("products", parsed.rows, { existingIngredients: [ref] });
  assert.ok(parsed.rows.every(row => !row.errors.length));
  assert.equal(parsed.rows[1].payload.resolved_ingredient_id, ref.id);
  assert.equal(parsed.rows[1].payload.resolved_unit, "gram");
  const wrongTenant = structuredClone(parsed.rows);
  validateRows("products", wrongTenant, { existingIngredients: [] });
  assert.match(wrongTenant[1].errors.map(error => error.message).join(" "), /outlet tujuan/);
});
test("recipe references reject explicit unit conversion and conflicting code/ID selectors", () => {
  for (const line of [["P1", "B1", 18, "", "kg"], ["P1", "B1", 18, ref.id, "gram"], ["P1", "", 18, "", "gram"]]) {
    const parsed = linked(undefined, [line]);
    validateRows("products", parsed.rows, { existingIngredients: [] });
    assert.ok(parsed.rows.find(row => row.payload.kind === "recipe")!.errors.length);
  }
});
test("ambiguous matches, mismatched units, unknown and inactive IDs block linked products", () => {
  const cases = [
    { ingredients: [["B1", "Kopi", "gram", 0, 0, 0]], refs: [ref, { ...ref, id: "00000000-0000-0000-0000-000000000002" }], message: /ambigu/ },
    { ingredients: [["B1", "Kopi", "kg", 0, 0, 0]], refs: [ref], message: /satuan berbeda/ },
    { ingredients: [["B1", "Kopi", "kg", 0, 0, 0, ref.id]], refs: [ref], message: /Satuan tidak cocok/ },
    { ingredients: [["B1", "Kopi", "gram", 0, 0, 0, ref.id]], refs: [], message: /outlet tujuan/ },
    { ingredients: [["B1", "Kopi", "gram", 0, 0, 0, ref.id]], refs: [{ ...ref, is_active: false }], message: /tidak aktif/ },
  ];
  for (const c of cases) {
    const parsed = linked(c.ingredients);
    validateRows("products", parsed.rows, { existingIngredients: c.refs });
    assert.match(parsed.rows.find(row => row.payload.kind === "ingredient")!.errors.map(error => error.message).join(" "), c.message);
    assert.ok(parsed.rows[0].errors.length, "product gets linked recipe error");
  }
});
test("linked references reject unknown products/ingredients and duplicate canonical recipe pairs", () => {
  for (const recipes of [[["Missing", "B1", 1]], [["P1", "Missing", 1]], [["P1", "B1", 1], ["P1", "B1", 2]]]) {
    const parsed = linked(undefined, recipes);
    validateRows("products", parsed.rows, {});
    assert.ok(parsed.rows.filter(row => row.payload.kind === "recipe").some(row => row.errors.length));
  }
  const alias = linked([["B1", "Kopi", "gram", 0, 0, 0]], [["P1", "B1", 1], ["P1", "", 2, ref.id]]);
  validateRows("products", alias.rows, { existingIngredients: [ref] });
  assert.ok(alias.rows.filter(row => row.payload.kind === "recipe").every(row => row.errors.some(error => /duplikat/.test(error.message))));
});
test("duplicate ingredient/product codes and ingredient identities fail on both source rows", () => {
  for (const ingredients of [
    [["B1", "Kopi", "gram", 1, 1, 0], ["B1", "Susu", "ml", 1, 1, 0]],
    [["B1", "Kopi", "gram", 1, 1, 0], ["B2", " kopi ", "gram", 1, 1, 0]],
  ]) {
    const parsed = linked(ingredients);
    validateRows("products", parsed.rows, {});
    assert.ok(parsed.rows.filter(row => row.payload.kind === "ingredient").every(row => row.errors.length));
  }
  const parsed = parseWorkbook(sheets({ Produk: [["nama", "kategori", "harga", "kode_produk"], ["A", "X", 1, "P"], ["B", "X", 1, "p"]] }), "products");
  validateRows("products", parsed.rows, {});
  assert.ok(parsed.rows.every(row => row.errors.some(error => error.field === "kode_produk")));
});
test("ingredient and recipe quantities reject nonfinite, negative, overprecision, overflow and zero recipes", () => {
  for (const value of ["NaN", "Infinity", -1, 0.001, "1e2", "1,000", 10000000000]) {
    const parsed = linked([["B1", "Kopi", "gram", value, 1, 0]], [["P1", "B1", value]]);
    assert.ok(parsed.rows.find(row => row.payload.kind === "ingredient")!.errors.some(error => error.field === "stok_awal"));
    assert.ok(parsed.rows.find(row => row.payload.kind === "recipe")!.errors.some(error => error.field === "jumlah_per_porsi"));
  }
  const parsed = linked([["B1", "Kopi", "gram", 0, 0, 0]], [["P1", "B1", 0]]);
  assert.equal(parsed.rows.find(row => row.payload.kind === "ingredient")!.errors.length, 0);
  assert.ok(parsed.rows.find(row => row.payload.kind === "recipe")!.errors.length);
});
test("new ingredients require explicit opening values and quota failures propagate to recipes", () => {
  const missing = linked([["B1", "Kopi", "gram", "", "", ""]]);
  validateRows("products", missing.rows, {});
  assert.equal(missing.rows.find(row => row.payload.kind === "ingredient")!.errors.length, 3);
  const parsed = linked();
  validateRows("products", parsed.rows, {});
  applyPlanBudget("ingredients", parsed.rows, 0);
  finalizeLinkedRows(parsed.rows);
  assert.ok(parsed.rows[0].errors.length);
  assert.ok(parsed.rows.find(row => row.payload.kind === "ingredient")!.errors.some(error => /kuota/.test(error.message)));
});
test("auxiliary sheet limits, bad headers, file size, and source locations are enforced", () => {
  assert.throws(() => linked(Array.from({ length: 501 }, (_, i) => [`B${i}`, `Bahan ${i}`, "gram", 0, 0, 0])), /Maksimal 500.*BahanBaku/);
  assert.throws(() => linked(undefined, Array.from({ length: 2001 }, () => ["P1", "B1", 1])), /Maksimal 2000.*Komposisi/);
  assert.throws(() => parseWorkbook(new ArrayBuffer(2 * 1024 * 1024 + 1), "products"), /2 MB/);
  const parsed = parseWorkbook(sheets({ Produk: [["nama", "kategori", "harga"], ["A", "X", 1]], Komposisi: [["wrong"]] }), "products");
  assert.equal(parsed.headerOk, true);
  assert.equal(parsed.rows[1].payload.sheet_name, "Komposisi");
  assert.equal(parsed.rows[1].payload.sheet_row, 1);
  assert.equal(parsed.rows[1].errors.length, 1);
});
test("contextual template reference sheet does not become an ingredient declaration", () => {
  const bytes = buildTemplateWorkbook("ingredients", [ref]);
  const wb = XLSX.read(bytes, { type: "array" });
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.ReferensiBahan).length, 1);
  const parsed = parseWorkbook(bytes.buffer as ArrayBuffer, "ingredients");
  assert.equal(parsed.rows.length, 2);
});
test("header-only optional sheets preserve plain product valid-rows-only compatibility", () => {
  const parsed = parseWorkbook(sheets({ Produk: [["nama", "kategori", "harga"], ["Good", "X", 1], ["Bad", "", 1]],
    BahanBaku: [ingredientHeaders], Komposisi: [recipeHeaders] }), "products");
  assert.equal(parsed.linked, false);
  assert.ok(parsed.rows.every(row => !row.payload.linked_workbook));
  assert.equal(parsed.rows.filter(row => !row.errors.length).length, 1);
});
