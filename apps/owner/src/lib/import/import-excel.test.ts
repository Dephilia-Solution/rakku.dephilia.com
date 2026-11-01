import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { buildTemplateWorkbook, parseWorkbook, validateRows, applyPlanBudget, IMPORT_HEADERS, IMPORT_MAX_FILE_BYTES } from "./import-excel";
import { tierHeader,type ProductImportMetadata } from "./import-spec";

function toArrayBuffer(value: Uint8Array): ArrayBuffer { return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer; }
function xlsx(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
const productBook = (products: unknown[][] = [["PRD001","Nasi","Makanan",18000,""]], recipes: unknown[][] = []) =>
  xlsx({ Produk: [[...IMPORT_HEADERS.products], ...products], Komposisi: [[...IMPORT_HEADERS.recipes], ...recipes] });

test("Bahan Baku template has exactly one sheet, exact six ordered headers, and no sample rows", async () => {
  const bytes = await buildTemplateWorkbook("ingredients");
  const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer" });
  assert.deepEqual(workbook.SheetNames, ["Bahan Baku"]);
  const sheet = workbook.Sheets["Bahan Baku"];
  assert.deepEqual(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0], [...IMPORT_HEADERS.ingredients]);
  assert.equal(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }).length, 1);
  assert.equal(parseWorkbook(toArrayBuffer(bytes), "ingredients").rows.length, 0);
  const opened = new ExcelJS.Workbook(); await opened.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof opened.xlsx.load>[0]);
  const unitDropdown = opened.getWorksheet("Bahan Baku")!.getCell("C2").dataValidation;
  assert.equal(unitDropdown.type, "list"); assert.notEqual(unitDropdown.showErrorMessage, true);
});

test("Produk template has exactly two visible sheets; category dropdown points to live hidden values and allows manual typing", async () => {
  const bytes = await buildTemplateWorkbook("products", ["Makanan","Minuman"]);
  const book = XLSX.read(Buffer.from(bytes), {type:"buffer"});
  assert.deepEqual(book.SheetNames.filter(name => book.Workbook!.Sheets!.find(sheet => sheet.name === name)?.Hidden !== 2), ["Produk","Komposisi"]);
  assert.deepEqual(XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Produk,{header:1})[0],[...IMPORT_HEADERS.products]);
  assert.deepEqual(XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Komposisi,{header:1})[0],[...IMPORT_HEADERS.recipes]);
  assert.equal(XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Produk,{header:1}).length,1);
  const opened=new ExcelJS.Workbook(); await opened.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof opened.xlsx.load>[0]);
  const dropdown=opened.getWorksheet("Produk")!.getCell("C2").dataValidation;
  assert.equal(dropdown.type,"list"); assert.equal(dropdown.formulae[0],"=OutletCategories"); assert.notEqual(dropdown.showErrorMessage,true);
});

test("exact sheet count, sheet names, header count, order and casing are required", () => {
  for (const workbook of [
    xlsx({ "Bahan Baku": [[...IMPORT_HEADERS.ingredients]], Ekstra: [["foo"]] }),
    xlsx({ "Bahan Baku": [["nama",...IMPORT_HEADERS.ingredients.slice(1)]] }),
    xlsx({ "Bahan Baku": [[...IMPORT_HEADERS.ingredients.slice(0,5)]] }),
    xlsx({ Produk: [[...IMPORT_HEADERS.products]], Komposisi: [[...IMPORT_HEADERS.recipes]], Kategori: [["foo"]] }),
    xlsx({ produk: [[...IMPORT_HEADERS.products]], Komposisi: [[...IMPORT_HEADERS.recipes]] }),
    xlsx({ Produk: [["nama",...IMPORT_HEADERS.products.slice(1)]], Komposisi: [[...IMPORT_HEADERS.recipes]] }),
  ]) {
    const domain = XLSX.read(workbook,{type:"array"}).SheetNames[0] === "Bahan Baku" ? "ingredients" : "products";
    assert.equal(parseWorkbook(workbook,domain).headerOk,false);
  }
});

test("business codes remain text, normalize casing, and never accept UUID or numeric-cell identifiers", () => {
  const parsed = parseWorkbook(xlsx({"Bahan Baku": [[...IMPORT_HEADERS.ingredients], ["bhn001","Beras","gram",1200,16,100], [2,"Telur","pcs",100,2500,10]]}),"ingredients");
  assert.equal(parsed.rows[0].payload.code,"BHN001");
  assert.ok(parsed.rows[1].errors.some(issue=>issue.field==="kode_bahan"&&/teks/.test(issue.message)));
  const uuid = parseWorkbook(productBook([["00000000-0000-0000-0000-000000000001","Nasi","Makanan",18000,""]]),"products");
  assert.ok(uuid.rows[0].errors.some(issue=>issue.field==="kode_produk"&&/UUID/.test(issue.message)));
});

test("manual categories produce warnings, and new product codes are unique only within the current outlet lookup", () => {
  const parsed=parseWorkbook(productBook([["PRD001","Nasi","Paket Baru",18000,"Nasi ayam"]]),"products");
  validateRows("products",parsed.rows,{existingCategories:new Map([["makanan",{id:"internal-id",name:"Makanan"}]])});
  assert.equal(parsed.rows[0].errors.length,0); assert.equal(parsed.rows[0].warnings.length,1); assert.equal(parsed.rows[0].payload.category_is_new,true);
  const conflict=parseWorkbook(productBook([["prd001","Nasi Baru","Makanan",20000,""]] ),"products");
  validateRows("products",conflict.rows,{existingProductCodes:new Map([["prd001",{id:"hidden-uuid",code:"PRD001",name:"Nasi Lama"}]]),existingCategories:new Map([["makanan",{id:"c",name:"Makanan"}]])});
  assert.equal(conflict.rows[0].payload.conflict,true); assert.equal(conflict.rows[0].errors.length,0); assert.ok(conflict.rows[0].warnings.length>0);
});

test("only product and ingredient codes resolve composition, duplicates and foreign codes report source cells", () => {
  const parsed=parseWorkbook(productBook([["P1","Nasi","Makanan",18000,""]],[["P1","B1",150],["p1","b1",200],["P1","MISSING",5]]),"products");
  validateRows("products",parsed.rows,{existingIngredientCodes:new Map([["b1",{id:"database-id",code:"B1",name:"Beras",unit:"gram"}]]),existingCategories:new Map([["makanan",{id:"category",name:"Makanan"}]])});
  const composition=parsed.rows.filter(row=>row.payload.kind==="recipe");
  assert.equal(composition.length,3); assert.equal(composition[0].errors.length,0);
  assert.ok(composition[1].errors.some(issue=>/duplikat/.test(issue.message)));
  assert.ok(composition[2].errors.some(issue=>issue.field==="kode_bahan"&&/B1|MISSING/.test(issue.message)));
  assert.equal(composition[2].payload.sheet_row,4);
});

test("ingredient/product code conflicts remain valid while plan budgets apply only to new business codes", () => {
  const ingredients=parseWorkbook(xlsx({"Bahan Baku":[[...IMPORT_HEADERS.ingredients],["B1","Existing","gram",100,10,10],["B2","New","gram",100,10,10]]}),"ingredients");
  validateRows("ingredients",ingredients.rows,{existingIngredientCodes:new Map([["b1",{id:"db",code:"B1",name:"Existing",unit:"gram"}]])});
  applyPlanBudget("ingredients",ingredients.rows,0);
  assert.equal(ingredients.rows[0].errors.length,0); assert.ok(ingredients.rows[1].errors.some(issue=>/kuota/i.test(issue.message)));
  const products=parseWorkbook(productBook([["P1","Old","Makanan",100,""]]),"products");
  validateRows("products",products.rows,{existingProductCodes:new Map([["p1",{id:"db",code:"P1",name:"Old"}]])});
  applyPlanBudget("products",products.rows,0); assert.equal(products.rows[0].errors.length,0);
});

test("localized numeric text, invalid units, employee compatibility and oversized workbooks are explicit", async () => {
  const ingredients=parseWorkbook(xlsx({"Bahan Baku":[[...IMPORT_HEADERS.ingredients],["B1","Beras","kilogram","1.200","Rp 16.000","100,5"],["B2","Minyak","ml",2500,20,500]]}),"ingredients");
  assert.ok(ingredients.rows[0].errors.some(issue=>issue.field==="satuan"));
  assert.equal(ingredients.rows[0].payload.stock_quantity,1200); assert.equal(ingredients.rows[0].payload.cost_per_unit,16000); assert.equal(ingredients.rows[0].payload.min_stock_alert,100.5);
  assert.deepEqual(await getTemplateEmployeeRows(),[]);
  assert.throws(()=>parseWorkbook(xlsx({"Bahan Baku":[[...IMPORT_HEADERS.ingredients,...Array(501).fill(0)]]}),"ingredients"),/6 kolom/);
  assert.throws(()=>parseWorkbook(new ArrayBuffer(IMPORT_MAX_FILE_BYTES+1),"products"),/2 MB/);
});

function getTemplateEmployeeRows() {
  return buildTemplateWorkbook("employees").then(bytes=>{
    const workbook=XLSX.read(Buffer.from(bytes),{type:"buffer"});
    assert.deepEqual(workbook.SheetNames,["Karyawan"]);
    return parseWorkbook(toArrayBuffer(bytes),"employees").rows;
  });
}

const meta:ProductImportMetadata={schema_version:2,domain:"products",company_id:"00000000-0000-0000-0000-000000000001",outlet_id:"00000000-0000-0000-0000-000000000002",tiers:[
  {id:"00000000-0000-0000-0000-000000000003",name:"Dine In",slug:"dine-in",header:tierHeader("dine-in")},
  {id:"00000000-0000-0000-0000-000000000004",name:"Delivery",slug:"delivery",header:tierHeader("delivery")},
]};
test("v2 template binds dynamic headers to UUID metadata and previews blank preservation/base fallback",async()=>{
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await buildTemplateWorkbook("products",["Food"],meta)) as never);
  const products=workbook.getWorksheet("Produk")!;
  products.addRow(["P1","Nasi","Food",0.29,"Lunch",null,12.34,"foto/Nasi.JPG"]);
  const parsed=parseWorkbook(toArrayBuffer(new Uint8Array(await workbook.xlsx.writeBuffer())),"products");
  assert.equal(parsed.headerOk,true);assert.equal(parsed.schemaVersion,2);assert.deepEqual(parsed.metadata,meta);
  assert.deepEqual(parsed.headerLabels,[...IMPORT_HEADERS.products,...meta.tiers.map(tier=>tier.header),"gambar"]);
  validateRows("products",parsed.rows,{metadata:parsed.metadata,companyId:meta.company_id,outletId:meta.outlet_id,tiers:[...meta.tiers].reverse(),
    existingProductCodes:new Map([["p1",{id:"existing",code:"P1",name:"Old"}]]),existingTierPrices:new Map([[`existing:${meta.tiers[0].id}`,5.67]])});
  const prices=parsed.rows[0].payload.tier_prices as {price:number|null;existing_price:number|null;effective_price:number;action:string}[];
  assert.deepEqual(prices.map(item=>[item.price,item.effective_price,item.action]),[[null,5.67,"preserve"],[12.34,12.34,"set"]]);
  assert.equal(parsed.rows[0].payload.price,0.29);assert.equal(parsed.rows[0].errors.length,0);
  const fresh=parseWorkbook(toArrayBuffer(new Uint8Array(await workbook.xlsx.writeBuffer())),"products");
  validateRows("products",fresh.rows,{metadata:meta,companyId:meta.company_id,outletId:meta.outlet_id,tiers:meta.tiers});
  assert.equal((fresh.rows[0].payload.tier_prices as typeof prices)[0].action,"base_price_fallback");
  for(const tiers of [meta.tiers.slice(0,1),[...meta.tiers.slice(0,1),{...meta.tiers[1],name:"Renamed"}],meta.tiers.map(tier=>({...tier,id:"00000000-0000-0000-0000-000000000009"}))]) {
    assert.throws(()=>validateRows("products",fresh.rows,{metadata:meta,companyId:meta.company_id,outletId:meta.outlet_id,tiers}),/tier berubah/);
  }
  assert.throws(()=>validateRows("products",fresh.rows,{metadata:meta,companyId:meta.company_id,outletId:"other",tiers:meta.tiers}),/outlet lain/);
});
test("malformed secondary headers, metadata formulas/extra sheets and stale renamed columns block the entire structure",async()=>{
  const invalid=parseWorkbook(xlsx({Produk:[[...IMPORT_HEADERS.products],["P1","Nasi","Food",1,""]],Komposisi:[["bad","kode_bahan","jumlah_per_porsi"]]}),"products");
  assert.equal(invalid.headerOk,false);assert.ok(invalid.structuralErrors.length);
  for(const mutate of [
    (book:ExcelJS.Workbook)=>{book.getWorksheet("_rakku_import")!.getCell("B1").value={formula:"1+1",result:2};},
    (book:ExcelJS.Workbook)=>{book.getWorksheet("_rakku_import")!.state="hidden";},
    (book:ExcelJS.Workbook)=>{book.getWorksheet("Produk")!.getCell("F1").value="harga_tier:renamed";},
    (book:ExcelJS.Workbook)=>{book.addWorksheet("Extra",{state:"veryHidden"});},
  ]) {
    const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await buildTemplateWorkbook("products",[],meta)) as never);mutate(book);
    assert.equal(parseWorkbook(toArrayBuffer(new Uint8Array(await book.xlsx.writeBuffer())),"products").headerOk,false);
  }
});
test("product description bounds, formula errors and decimal tolerance agree with manual product policy",()=>{
  const parsed=parseWorkbook(productBook([["P1","Nasi","Food",0.29,"x".repeat(5001)],["P2","Soup","Food",1.234,""]]),"products");
  assert.ok(parsed.rows[0].errors.some(issue=>issue.field==="deskripsi"));assert.equal(parsed.rows[0].payload.price,0.29);
  assert.ok(parsed.rows[1].errors.some(issue=>issue.field==="harga"));
});
const purchaseBook=(headers:unknown[][],lines:unknown[][])=>xlsx({Pembelian:[[...IMPORT_HEADERS.purchases],...headers],"Detail Pembelian":[[...IMPORT_HEADERS.purchaseLines],...lines]});
test("purchases use explicit local WIB dates, scoped active ingredients, exact units and distinct bounded detail lines",async()=>{
  const empty=await buildTemplateWorkbook("purchases");assert.deepEqual(parseWorkbook(toArrayBuffer(empty),"purchases").visibleSheets,["Pembelian","Detail Pembelian"]);
  const parsed=parseWorkbook(purchaseBook([["PO1","2026-02-28","Supplier","Note"],["PO2","2026-02-30","",""]],[
    ["PO1","B1",0.29,"gram",12.34],["PO1","B1",1,"kg",5],["UNKNOWN","B2",1,"pcs",1],
  ]),"purchases");
  validateRows("purchases",parsed.rows,{existingIngredientCodes:new Map([["b1",{id:"i1",code:"B1",name:"Rice",unit:"gram",is_active:true}],
    ["b2",{id:"i2",code:"B2",name:"Old",unit:"pcs",is_active:false}]])});
  assert.equal(parsed.headerOk,true);assert.equal(parsed.linked,true);assert.equal(parsed.rows[0].payload.date,"2026-02-28T00:00:00+07:00");
  assert.ok(parsed.rows[1].errors.some(issue=>issue.field==="tanggal"));assert.ok(parsed.rows[1].errors.some(issue=>/1–100/.test(issue.message)));
  const lines=parsed.rows.filter(row=>row.payload.kind==="purchase_line");
  assert.equal(lines[0].errors.length,0);assert.equal(lines[0].payload.quantity,0.29);assert.equal(lines[0].payload.ingredient_name,"Rice");
  assert.ok(lines[1].errors.some(issue=>/duplikat/.test(issue.message)));assert.ok(lines[1].errors.some(issue=>issue.field==="satuan"));
  assert.ok(lines[2].errors.some(issue=>issue.field==="kode_pembelian"));assert.ok(lines[2].errors.some(issue=>issue.field==="kode_bahan"));
  const serial=parseWorkbook(purchaseBook([["PO3",46000,"",""]],[["PO3","B1",1,"gram",1]]),"purchases");assert.ok(serial.rows[0].errors.some(issue=>issue.field==="tanggal"));
  const tooMany=parseWorkbook(purchaseBook([["PO4","2026-01-01","",""]],Array.from({length:101},(_,i)=>["PO4",`B${i}`,1,"gram",1])),"purchases");
  validateRows("purchases",tooMany.rows,{});assert.ok(tooMany.rows[0].errors.some(issue=>/1–100/.test(issue.message)));
});
