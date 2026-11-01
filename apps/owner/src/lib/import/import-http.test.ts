import {test} from "node:test";
import assert from "node:assert/strict";
import {readImportForm,IMPORT_REQUEST_BYTES} from "./import-http";

test("multipart preserves current upload fields and accepts a separate optional image ZIP",async()=>{
  const form=new FormData();form.set("domain","products");form.set("outlet_id","outlet");form.set("file",new File(["xlsx"],"menu.xlsx"));form.set("images_zip",new File(["zip"],"images.zip"));
  const parsed=await readImportForm(new Request("https://owner.test/api",{method:"POST",body:form}));
  assert.equal(parsed.get("domain"),"products");assert.equal((parsed.get("file") as File).name,"menu.xlsx");assert.equal((parsed.get("images_zip") as File).name,"images.zip");
  form.append("domain","employees");await assert.rejects(()=>readImportForm(new Request("https://owner.test/api",{method:"POST",body:form})),/duplikat/);
});
test("multipart rejects oversized declared and chunked bodies before parsing, cancelling the source stream",async()=>{
  await assert.rejects(()=>readImportForm(new Request("https://owner.test/api",{method:"POST",headers:{"content-length":String(IMPORT_REQUEST_BYTES+1)},body:"x"})),/maksimal/);
  let cancelled=false;
  const stream=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array(1024*1024));},cancel(){cancelled=true;}});
  const request=new Request("https://owner.test/api",{method:"POST",headers:{"content-type":"multipart/form-data; boundary=test"},body:stream,duplex:"half"} as RequestInit);
  await assert.rejects(()=>readImportForm(request),/terlalu besar/);assert.equal(cancelled,true);
});
