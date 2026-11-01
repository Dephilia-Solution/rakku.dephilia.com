import { IMPORT_MAX_REQUEST_BYTES } from "./import-spec";

// Below Vercel's request body limit; larger batches must be split before upload.
export const IMPORT_REQUEST_BYTES=IMPORT_MAX_REQUEST_BYTES;

/** Bound chunked requests as well as Content-Length before formData buffers any file. */
export async function readImportForm(request:Request):Promise<FormData> {
  return readBoundedMultipart(request,IMPORT_REQUEST_BYTES,["domain","file","outlet_id","images_zip"]);
}

export async function readBoundedMultipart(request:Request,maximum:number,allowedFields:readonly string[]):Promise<FormData> {
  const length=request.headers.get("content-length");
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maximum)) throw new Error(`Total unggahan maksimal ${maximum} byte termasuk overhead multipart.`);
  const type=request.headers.get("content-type")??"";
  if(!/^multipart\/form-data;/i.test(type)||!request.body) throw new Error("Gunakan multipart/form-data untuk unggahan Excel dan ZIP gambar.");
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>maximum){await reader.cancel();throw new Error("Total unggahan terlalu besar.");}chunks.push(value);}
  } finally {reader.releaseLock();}
  const form=await new Response(Buffer.concat(chunks),{headers:{"content-type":type}}).formData();
  const fields=new Set(allowedFields),seen=new Set<string>();
  for(const [name] of form){if(!fields.has(name)||seen.has(name))throw new Error(`Field multipart tidak dikenal/duplikat: ${name}.`);seen.add(name);}
  return form;
}
