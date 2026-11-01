import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { Buffer } from "node:buffer";
import { buildTemplateWorkbook } from "./import-excel";
import { preflightImportWorkbook } from "./import-preflight";

async function file(domain: "products" | "ingredients" | "employees" | "purchases", rows: Record<string, unknown[][]>, name = "upload.xlsx") {
  const bytes = await buildTemplateWorkbook(domain, ["Coffee"]), workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  for (const [sheet, values] of Object.entries(rows)) for (const row of values) workbook.getWorksheet(sheet)!.addRow(row);
  const output = Buffer.from(await workbook.xlsx.writeBuffer());
  return new File([output], name);
}

test("browser preflight catches basic product values before network but leaves database references to server", async () => {
  const bad = await file("products", { Produk: [["DUP-1", "Satu", "Coffee", 10000, ""], ["DUP-1", "Dua", "Coffee", -1, ""]], Komposisi: [] });
  const result = await preflightImportWorkbook(bad, "products");
  assert.ok(result.issues.some(issue => issue.field === "kode_produk" && /duplikat/i.test(issue.message)));
  assert.ok(result.issues.some(issue => issue.field === "harga" && /angka valid/i.test(issue.message)));
  const good = await file("products", { Produk: [["VALID-1", "Kopi", "Coffee", 10000.25, ""]], Komposisi: [] });
  assert.deepEqual((await preflightImportWorkbook(good, "products")).issues, []);
  const localized=await file("products",{Produk:[["VALID-2","Teh","Coffee","Rp 1.234,50",""]],Komposisi:[]});
  assert.deepEqual((await preflightImportWorkbook(localized,"products")).issues,[]);
});

test("browser preflight rejects malformed sheets and Excel formulas without uploading", async () => {
  const original=await file("ingredients",{"Bahan Baku":[]}),wrongBook=new ExcelJS.Workbook();
  await wrongBook.xlsx.load(Buffer.from(await original.arrayBuffer()) as unknown as Parameters<typeof wrongBook.xlsx.load>[0]);wrongBook.getWorksheet("Bahan Baku")!.getCell("A1").value="kode_salah";
  const wrong=new File([Buffer.from(await wrongBook.xlsx.writeBuffer())],"wrong.xlsx");
  assert.ok((await preflightImportWorkbook(wrong, "ingredients")).issues.some(issue => issue.row === 1 && /header/i.test(issue.message)));
  const formulaBook=new ExcelJS.Workbook(),purchaseBytes=await buildTemplateWorkbook("purchases");
  await formulaBook.xlsx.load(Buffer.from(purchaseBytes) as unknown as Parameters<typeof formulaBook.xlsx.load>[0]);
  formulaBook.getWorksheet("Pembelian")!.addRow(["BELI-1","2026-11-01","",""]);
  formulaBook.getWorksheet("Pembelian")!.getCell("D2").value={formula:"1+1",result:2};
  formulaBook.getWorksheet("Detail Pembelian")!.addRow(["BELI-1","BHN1",1,"gram",10]);
  const formula=new File([Buffer.from(await formulaBook.xlsx.writeBuffer())],"purchase-formula.xlsx");
  assert.ok((await preflightImportWorkbook(formula, "purchases")).issues.some(issue => /formula/i.test(issue.message)));
  await assert.rejects(() => preflightImportWorkbook(new File(["not excel"], "upload.xlsx"), "products"), /signature/i);
});
