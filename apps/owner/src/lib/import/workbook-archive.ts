import { Unzip, UnzipInflate } from "fflate";

const MAX_EXPANDED = 32 * 1024 * 1024;
const MAX_ENTRY = 8 * 1024 * 1024;

/** XLSX is itself a ZIP. Bound actual inflation before handing any XML to SheetJS.
 * Streaming 4KiB compressed chunks also bounds a single decoder allocation. Works in demo browsers. */
export function validateWorkbookArchive(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  const fail = (): never => { throw new Error("Workbook tidak aman/rusak: batas ZIP/XML, path, enkripsi, objek eksternal, atau ukuran ekstraksi tidak valid."); };
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) {
    if (view.getUint32(at, true) === 0x06054b50 && at + 22 + view.getUint16(at + 20, true) === bytes.length) { end = at; break; }
  }
  if (end < 0) fail();
  const count = view.getUint16(end + 10, true), start = view.getUint32(end + 16, true);
  if (!count || count > 200 || view.getUint16(end+4,true) || view.getUint16(end+6,true) || view.getUint16(end+8,true)!==count || start+view.getUint32(end+12,true)!==end) fail();
  const entries = new Map<string, number>(); let cursor = start, declared = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let index=0;index<count;index++) {
    if (cursor+46>end || view.getUint32(cursor,true)!==0x02014b50) fail();
    const flags=view.getUint16(cursor+8,true), method=view.getUint16(cursor+10,true), compressed=view.getUint32(cursor+20,true), size=view.getUint32(cursor+24,true);
    const nameLength=view.getUint16(cursor+28,true), extra=view.getUint16(cursor+30,true), comment=view.getUint16(cursor+32,true), offset=view.getUint32(cursor+42,true);
    if (cursor+46+nameLength+extra+comment>end || flags&1 || ![0,8].includes(method) || size>MAX_ENTRY || offset>=start || compressed>bytes.length || size && (!compressed || size/compressed>1000)) fail();
    const path=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLength));
    if (!path || /[\\\x00-\x1f:]/.test(path) || path.startsWith("/") || path.split("/").some(part=>part===".."||part===".")
      || /(?:vbaProject|embeddings\/|activeX\/|externalLinks\/)/i.test(path) || entries.has(path.toLowerCase())) fail();
    if (view.getUint32(offset,true)!==0x04034b50 || view.getUint16(offset+6,true)!==flags || view.getUint16(offset+8,true)!==method) fail();
    const localNameLength=view.getUint16(offset+26,true), localExtra=view.getUint16(offset+28,true);
    if (offset+30+localNameLength+localExtra+compressed>start || decoder.decode(bytes.subarray(offset+30,offset+30+localNameLength))!==path) fail();
    declared+=size; if(declared>MAX_EXPANDED)fail(); entries.set(path.toLowerCase(),size);
    cursor+=46+nameLength+extra+comment;
  }
  if(cursor!==end || !entries.has("[content_types].xml") || !entries.has("xl/workbook.xml")) fail();
  let expanded=0, finished=0; const seen=new Set<string>();
  const unzip=new Unzip(file=>{
    const key=file.name.toLowerCase(), expected=entries.get(key);
    if(expected===undefined || seen.has(key))fail(); seen.add(key);
    let size=0; const xml=/\.(?:xml|rels)$/i.test(file.name); const chunks:Uint8Array[]=[];
    file.ondata=(error,data,final)=>{
      if(error)fail(); size+=data.byteLength; expanded+=data.byteLength;
      if(size>expected! || size>MAX_ENTRY || expanded>MAX_EXPANDED)fail();
      if(xml)chunks.push(data);
      if(final){
        if(size!==expected)fail(); finished++;
        if(xml){const joined=new Uint8Array(size);let at=0;for(const chunk of chunks){joined.set(chunk,at);at+=chunk.length;}
          const text=decoder.decode(joined);if(/<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External["']/i.test(text))fail();}
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for(let at=0;at<bytes.length;at+=4096)unzip.push(bytes.subarray(at,Math.min(bytes.length,at+4096)),at+4096>=bytes.length);
  if(finished!==count || seen.size!==entries.size)fail();
}
