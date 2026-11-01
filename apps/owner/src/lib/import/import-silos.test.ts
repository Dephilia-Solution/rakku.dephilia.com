import {test} from "node:test";
import assert from "node:assert/strict";
import {uploadFile,deleteFile} from "@rakku/silos-client";

test("Silos cleanup treats an already-deleted provider ID as success and bounds provider calls with AbortSignal",async()=>{
  const previousFetch=globalThis.fetch,previousUrl=process.env.SILOS_API_URL,previousKey=process.env.SILOS_API_KEY;
  process.env.SILOS_API_URL="https://mock-silos.test";process.env.SILOS_API_KEY="test-only";
  const requests:{url:string;method:string}[]=[];
  globalThis.fetch=async(input,init)=>{
    assert.ok(init?.signal instanceof AbortSignal);assert.equal((init?.headers as Record<string,string>).Authorization,"Bearer test-only");
    requests.push({url:String(input),method:init?.method??"GET"});
    if(init?.method==="DELETE")return new Response(null,{status:404});
    const form=init?.body as FormData;assert.equal((form.get("file") as File).type,"image/webp");
    return Response.json({success:true,data:{id:"mock-id",url:"https://images.test/mock.webp"}});
  };
  try{
    assert.equal((await uploadFile({file:Buffer.from("processed"),filename:"processed.webp",contentType:"image/webp"})).id,"mock-id");
    await deleteFile("mock/id");assert.equal(requests[1].url,"https://mock-silos.test/api/v1/files/mock%2Fid");assert.equal(requests.length,2);
  }finally{
    globalThis.fetch=previousFetch;
    if(previousUrl===undefined)delete process.env.SILOS_API_URL;else process.env.SILOS_API_URL=previousUrl;
    if(previousKey===undefined)delete process.env.SILOS_API_KEY;else process.env.SILOS_API_KEY=previousKey;
  }
});
