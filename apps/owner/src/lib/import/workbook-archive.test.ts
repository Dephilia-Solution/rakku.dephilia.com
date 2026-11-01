import assert from "node:assert/strict";
import { test } from "node:test";
import { zipSync, strToU8 } from "fflate";
import { validateWorkbookArchive } from "./workbook-archive";

const validate = (files: Record<string, Uint8Array>) => { const bytes=zipSync(files);validateWorkbookArchive(new Uint8Array(bytes).buffer); };
const base = { "[Content_Types].xml":strToU8("<Types/>"), "xl/workbook.xml":strToU8("<workbook/>") };
test("workbook ZIP guard accepts bounded XML and rejects disguised/non-workbook packages",()=>{
  validate(base); assert.throws(()=>validate({"x.xml":strToU8("<x/>")}),/Workbook/);
  assert.throws(()=>validate({...base,"../payload.xml":strToU8("<x/>")}),/Workbook/);
  assert.throws(()=>validate({...base,"xl/externalLinks/link.xml":strToU8("<x/>")}),/Workbook/);
});
test("workbook ZIP guard rejects expansion, external entities and external relationships before parsing",()=>{
  assert.throws(()=>validate({...base,"xl/worksheets/huge.xml":new Uint8Array(9*1024*1024)}),/Workbook/);
  assert.throws(()=>validate({...base,"xl/worksheets/data.xml":strToU8('<!DOCTYPE x [<!ENTITY a "boom">]><x/>')}),/Workbook/);
  assert.throws(()=>validate({...base,"xl/_rels/workbook.xml.rels":strToU8('<Relationship TargetMode="External" Target="https://evil.test"/>')}),/Workbook/);
});
