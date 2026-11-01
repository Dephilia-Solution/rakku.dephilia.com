import * as XLSX from "xlsx";
import { IMPORT_HEADERS, IMPORT_MAX_PURCHASE_LINES, IMPORT_MAX_RECIPE_ROWS, IMPORT_MAX_ROWS, IMPORT_METADATA_KEYS, IMPORT_METADATA_SHEET, tierHeader, type BackendImportDomain } from "./import-spec";

const UNITS = new Set(["gram", "ml", "pcs", "kg", "liter"]);

function numericCell(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let value=String(raw??"").trim().replace(/^(?:rp\.?\s*)/i,"").replace(/\s/g,"");
  if(!value||!/^[0-9.,]+$/.test(value))return null;
  const comma=value.lastIndexOf(","),dot=value.lastIndexOf(".");
  if(comma>=0&&dot>=0){const at=Math.max(comma,dot),digits=value.length-at-1;if(digits<1||digits>2)return null;value=`${value.slice(0,at).replace(/[.,]/g,"")}.${value.slice(at+1)}`;}
  else if(comma>=0){const digits=value.length-comma-1;if(digits===1||digits===2)value=`${value.slice(0,comma).replace(/,/g,"")}.${value.slice(comma+1)}`;else if(digits===3)value=value.replace(/,/g,"");else return null;}
  else if(dot>=0){const digits=value.length-dot-1;if(digits===3&&dot>0)value=value.replace(/\./g,"");else if(digits<1||digits>2)return null;}
  const result=Number(value);return Number.isFinite(result)?result:null;
}

export interface PreflightIssue { sheet: string; row: number; field?: string; message: string }
export interface PreflightResult { sheets: string[]; dataRows: number; issues: PreflightIssue[] }

/** Fast browser-side checks for bad workbooks. Database references, quotas and final validation remain server-authoritative. */
export async function preflightImportWorkbook(file: File, domain: BackendImportDomain): Promise<PreflightResult> {
  if (!file.size || file.size > 2 * 1024 * 1024) throw new Error("File Excel harus berukuran 1 byte–2 MiB.");
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Pilih workbook .xlsx; CSV dan file Excel lama tidak didukung.");
  const bytes = await file.arrayBuffer();
  if (new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength)).join(",") !== "80,75,3,4") throw new Error("File tidak memiliki signature workbook XLSX.");
  const workbook = XLSX.read(bytes, { type: "array", sheetRows: IMPORT_MAX_PURCHASE_LINES + 3, cellFormula: true });
  const hidden = new Map((workbook.Workbook?.Sheets ?? []).map(sheet => [sheet.name, sheet.Hidden ?? 0]));
  const visible = workbook.SheetNames.filter(name => hidden.get(name) !== 1 && hidden.get(name) !== 2);
  const expected = domain === "products" ? ["Produk", "Komposisi"] : domain === "purchases" ? ["Pembelian", "Detail Pembelian"]
    : [domain === "ingredients" ? "Bahan Baku" : "Karyawan"];
  const issues: PreflightIssue[] = [];
  const add = (sheet: string, row: number, message: string, field?: string) => issues.push({ sheet, row, message, ...(field ? { field } : {}) });
  if (visible.length !== expected.length || visible.some((name,index)=>name!==expected[index])) {
    add("Workbook",1,`Sheet terlihat harus tepat dan berurutan: ${expected.join(", ")}.`);
    return { sheets: visible, dataRows: 0, issues };
  }
  const extras = workbook.SheetNames.filter(name => !expected.includes(name) && !(domain === "products" && ["_kategori",IMPORT_METADATA_SHEET].includes(name) && hidden.get(name)===2));
  for(const name of extras)add(name,1,"Sheet tambahan harus dihapus atau diunduh ulang dari template terbaru.");
  const mainRows: Record<string,number> = {};
  for(const sheetName of expected){
    const sheet=workbook.Sheets[sheetName];
    const rangeRef=sheet["!ref"] ?? sheet["!fullref"];
    if(!rangeRef){add(sheetName,1,"Sheet kosong; header wajib belum tersedia.");continue;}
    const range=XLSX.utils.decode_range(rangeRef);
    const grid=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:null,blankrows:true});
    let headers=[...(domain === "products" && sheetName === "Produk" ? IMPORT_HEADERS.products : domain === "purchases" ? sheetName === "Pembelian" ? IMPORT_HEADERS.purchases : IMPORT_HEADERS.purchaseLines : sheetName === "Komposisi" ? IMPORT_HEADERS.recipes : domain === "ingredients" ? IMPORT_HEADERS.ingredients : ["nama","username","pin","role","outlets"])];
    if(domain==="products" && sheetName==="Produk" && workbook.Sheets[IMPORT_METADATA_SHEET]){
      try{
        const metaSheet=workbook.Sheets[IMPORT_METADATA_SHEET],meta=XLSX.utils.sheet_to_json<unknown[]>(metaSheet,{header:1,defval:null,blankrows:true});
        if(hidden.get(IMPORT_METADATA_SHEET)!==2 || meta.length!==IMPORT_METADATA_KEYS.length || meta.some((row,index)=>row.length!==2||row[0]!==IMPORT_METADATA_KEYS[index]||hasFormula(metaSheet,index,0)||hasFormula(metaSheet,index,1)))throw new Error("Metadata tersembunyi tidak sesuai template v2.");
        const values=Object.fromEntries(meta.map(row=>[String(row[0]),row[1]])),tiers=JSON.parse(String(values.tiers));
        if(String(values.schema_version)!=="2"||values.domain!=="products"||!Array.isArray(tiers)||tiers.length>100||tiers.some(tier=>!tier||tier.header!==tierHeader(String(tier.slug))))throw new Error("Identitas tier template tidak valid.");
        headers=[...headers,...tiers.map(tier=>String(tier.header))];
        if(grid[0]?.[grid[0].length-1]==="gambar")headers.push("gambar");
      }catch(error){add(IMPORT_METADATA_SHEET,1,error instanceof Error?error.message:"Metadata v2 tidak valid.");}
    } else if(domain==="products"&&sheetName==="Produk"&&grid[0]?.includes("gambar"))headers.push("gambar");
    if(range.e.c+1!==headers.length||grid[0]?.length!==headers.length||headers.some((header,index)=>grid[0]?.[index]!==header))add(sheetName,1,`Header/urutan kolom tidak sama dengan template: ${headers.join(", ")}.`);
    const max=sheetName==="Komposisi"?IMPORT_MAX_RECIPE_ROWS:sheetName==="Detail Pembelian"?IMPORT_MAX_PURCHASE_LINES:IMPORT_MAX_ROWS[domain];
    let populated=0;
    const codes=new Set<string>();
    for(let index=1;index<grid.length;index++){
      const cells=grid[index]??[];if(!cells.some(cell=>String(cell??"").trim()))continue;populated++;
      const sourceRow=index+1;
      if(populated>max){add(sheetName,sourceRow,`Batas ${max.toLocaleString("id-ID")} baris terlampaui.`);break;}
      for(let column=0;column<headers.length;column++)if(hasFormula(sheet,index,column))add(sheetName,sourceRow,"Formula Excel tidak didukung; tempel nilai akhirnya sebagai data.",headers[column]);
      const codeColumn=headers.indexOf(sheetName==="Komposisi"?"kode_produk":sheetName==="Detail Pembelian"?"kode_pembelian":domain==="products"?"kode_produk":domain==="ingredients"?"kode_bahan":domain==="purchases"?"kode_pembelian":"username");
      if(codeColumn>=0){const raw=cells[codeColumn];if(typeof raw==="number")add(sheetName,sourceRow,"Kode bisnis harus disimpan sebagai teks agar nol di depan tidak hilang.",headers[codeColumn]);
        else if(raw!==null&&raw!==undefined&&String(raw).trim()&&!/^[A-Z0-9][A-Z0-9._-]{0,63}$/i.test(String(raw).normalize("NFKC").trim()))add(sheetName,sourceRow,"Kode bisnis berisi karakter yang tidak didukung.",headers[codeColumn]);}
      const required=domain==="products"&&sheetName==="Produk"?["kode_produk","nama","kategori","harga"]:sheetName==="Komposisi"?["kode_produk","kode_bahan","jumlah_per_porsi"]
        :domain==="ingredients"?["kode_bahan","nama","satuan","stok_awal","biaya_per_satuan(Rp)","stok_minimum"]:domain==="employees"?["nama","username","pin","role","outlets"]
        :sheetName==="Pembelian"?["kode_pembelian","tanggal"]:["kode_pembelian","kode_bahan","jumlah","satuan","biaya_per_satuan(Rp)"];
      for(const field of required){const column=headers.indexOf(field);if(column>=0&&(cells[column]===null||cells[column]===undefined||String(cells[column]).trim()===""))add(sheetName,sourceRow,"Kolom wajib belum diisi.",field);}
      const numericFields=sheetName==="Produk"?["harga",...headers.filter(header=>header.startsWith("harga_tier:"))]
        :sheetName==="Bahan Baku"?["stok_awal","biaya_per_satuan(Rp)","stok_minimum"]
        :sheetName==="Komposisi"?["jumlah_per_porsi"]:sheetName==="Detail Pembelian"?["jumlah","biaya_per_satuan(Rp)"]:[];
      for(const field of numericFields){const column=headers.indexOf(field),raw=cells[column];if(raw===null||raw===undefined||raw==="")continue;
        const value=numericCell(raw);
        if(value===null||value<0||Math.abs(value*100-Math.round(value*100))>0.001||["jumlah_per_porsi","jumlah"].includes(field)&&value<=0)add(sheetName,sourceRow,"Nilai harus berupa angka valid, nonnegatif, dan maksimal dua desimal (jumlah harus lebih dari nol).",field);
      }
      if(sheetName==="Bahan Baku"||sheetName==="Detail Pembelian"){const column=headers.indexOf("satuan"),unit=String(cells[column]??"").trim().toLocaleLowerCase("id-ID");if(unit&&!UNITS.has(unit))add(sheetName,sourceRow,"Satuan harus gram, ml, pcs, kg, atau liter.","satuan");}
      if(sheetName==="Pembelian"){const column=headers.indexOf("tanggal"),date=String(cells[column]??"").trim();if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))add(sheetName,sourceRow,"Tanggal harus berupa teks YYYY-MM-DD (00:00 WIB).","tanggal");}
      const duplicateKey=sheetName==="Detail Pembelian"?`line:${sourceRow}`:String(cells[codeColumn]??"").trim().toLocaleUpperCase("id-ID");
      if(codeColumn>=0&&duplicateKey&&codes.has(duplicateKey)&&sheetName!=="Komposisi")add(sheetName,sourceRow,"Kode bisnis duplikat pada sheet ini.",headers[codeColumn]);
      if(codeColumn>=0&&duplicateKey)codes.add(duplicateKey);
    }
    mainRows[sheetName]=populated;
  }
  if(domain==="products"&&mainRows.Produk===0&&mainRows.Komposisi===0||domain==="purchases"&&mainRows.Pembelian===0&&mainRows["Detail Pembelian"]===0)add("Workbook",1,"Isi setidaknya satu baris data sebelum validasi.");
  return {sheets:visible,dataRows:Object.values(mainRows).reduce((sum,value)=>sum+value,0),issues};
}

function hasFormula(sheet:XLSX.WorkSheet,row:number,column:number){return Boolean(sheet[XLSX.utils.encode_cell({r:row,c:column})]?.f);}
