import { inflateRawSync } from "node:zlib";
import sharp from "sharp";
import type { ParsedRow } from "./import-excel";
import { IMPORT_MAX_ZIP_BYTES } from "./import-spec";

export const IMAGE_LIMITS = {
  archiveBytes: IMPORT_MAX_ZIP_BYTES, entries: 120, files: 100, expandedBytes: 32 * 1024 * 1024,
  fileBytes: 2 * 1024 * 1024, ratio: 100, pixels: 16_000_000, dimension: 8192,
  processedBytes: 12 * 1024 * 1024, concurrency: 2,
} as const;

/** One canonical, case-insensitive archive path. No URL, OS path, dot segment or ambiguous separator. */
function normalizeArchivePath(raw: string): string {
  const path = raw.normalize("NFKC");
  if (!path || path.length > 240 || path !== path.trim() || /[\\:\x00-\x1f\x7f?#]/.test(path) || path.startsWith("/")
    || path.split("/").some(part => !part || part === "." || part === ".." || /[. ]$/.test(part))) throw new Error("gambar: gunakan path relatif ZIP yang aman (contoh foto/kopi.jpg), bukan URL/path komputer.");
  return path.toLocaleLowerCase("en-US");
}
export function normalizeImageReference(raw: string): string {
  const path=normalizeArchivePath(raw);
  if (!/\.(jpe?g|png|webp)$/i.test(path)) throw new Error("gambar: hanya JPG, PNG, atau WebP; arsip/workbook bertingkat tidak didukung.");
  return path;
}

const crcTable = Uint32Array.from({ length: 256 }, (_v, index) => {
  let crc = index; for (let i = 0; i < 8; i++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; return crc >>> 0;
});
function crc32(bytes: Buffer) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

/** Strict ordinary ZIP subset: stored/deflated, single disk, no ZIP64. Central/local headers
 * are reconciled, ranges cannot overlap, declared AND actual inflation are bounded.
 * This archive contains images only; the Excel workbook is a separate multipart file. */
export function readImageZip(bytes: Buffer): Map<string, Buffer> {
  if (!bytes.length || bytes.length > IMAGE_LIMITS.archiveBytes) throw new Error("ZIP gambar maksimal 3 MB; pecah gambar menjadi beberapa batch bila perlu.");
  const fail = (): never => { throw new Error("ZIP tidak valid/tidak aman (path, enkripsi, symlink, duplikat, nesting, ukuran atau kompresi)."); };
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) { end = offset; break; }
  }
  if (end < 0) fail();
  const count = bytes.readUInt16LE(end + 10), centralSize = bytes.readUInt32LE(end + 12), centralOffset = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count
    || !count || count > IMAGE_LIMITS.entries || centralOffset + centralSize !== end) fail();
  const paths = new Set<string>(), files = new Map<string, Buffer>(), ranges: [number,number][] = [];
  let cursor = centralOffset, expanded = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) fail();
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
    const crc = bytes.readUInt32LE(cursor + 16), compressed = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
    const disk = bytes.readUInt16LE(cursor + 34), attributes = bytes.readUInt32LE(cursor + 38), local = bytes.readUInt32LE(cursor + 42);
    if (cursor + 46 + nameLength + extraLength + commentLength > end || !nameLength || disk || (flags & ~0x080e) || flags & 1
      || ![0,8].includes(method) || size === 0xffffffff || compressed === 0xffffffff || local === 0xffffffff) fail();
    // Only regular files/directories from UNIX writers. Reject symlinks and special devices.
    const mode = (attributes >>> 16) & 0xf000;
    if (mode && mode !== 0x8000 && mode !== 0x4000) fail();
    const rawName = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = rawName.toString("utf8");
    if (!Buffer.from(name,"utf8").equals(rawName) || (!(flags & 0x800) && /[^\x00-\x7f]/.test(name))) fail();
    const directory = name.endsWith("/");
    let path: string;
    try { path = directory ? normalizeArchivePath(name.slice(0,-1)) : normalizeImageReference(name); } catch { fail(); }
    if (paths.has(path!)) fail(); paths.add(path!);
    // Extra fields can smuggle ZIP64 or Unicode path overrides; neither is needed here.
    let extra = cursor + 46 + nameLength; const extraEnd = extra + extraLength;
    while (extra < extraEnd) {
      if (extra + 4 > extraEnd) fail();
      const tag = bytes.readUInt16LE(extra), length = bytes.readUInt16LE(extra + 2);
      if (tag === 1 || tag === 0x7075 || extra + 4 + length > extraEnd) fail(); extra += 4 + length;
    }
    if (directory && (size || compressed || mode === 0x8000)) fail();
    if (size > IMAGE_LIMITS.fileBytes || (size && (!compressed || size / compressed > IMAGE_LIMITS.ratio))) fail();
    expanded += size; if (expanded > IMAGE_LIMITS.expandedBytes) fail();
    if (local + 30 > centralOffset || bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 6) !== flags || bytes.readUInt16LE(local + 8) !== method) fail();
    const localNameLength = bytes.readUInt16LE(local + 26), localExtraLength = bytes.readUInt16LE(local + 28);
    if (localNameLength !== nameLength || !bytes.subarray(local + 30, local + 30 + localNameLength).equals(rawName)) fail();
    const dataOffset = local + 30 + localNameLength + localExtraLength, dataEnd = dataOffset + compressed;
    if (dataEnd > centralOffset) fail();
    let rangeEnd = dataEnd;
    if (flags & 8) {
      const signed = dataEnd + 4 <= centralOffset && bytes.readUInt32LE(dataEnd) === 0x08074b50;
      const descriptor = dataEnd + (signed ? 4 : 0); rangeEnd = descriptor + 12;
      if (rangeEnd > centralOffset || bytes.readUInt32LE(descriptor) !== crc || bytes.readUInt32LE(descriptor + 4) !== compressed || bytes.readUInt32LE(descriptor + 8) !== size) fail();
    } else if (bytes.readUInt32LE(local + 14) !== crc || bytes.readUInt32LE(local + 18) !== compressed || bytes.readUInt32LE(local + 22) !== size) fail();
    ranges.push([local,rangeEnd]);
    if (!directory) {
      if (files.size >= IMAGE_LIMITS.files || !size) fail();
      let decoded: Buffer;
      try { decoded = method === 0 ? Buffer.from(bytes.subarray(dataOffset,dataEnd)) : inflateRawSync(bytes.subarray(dataOffset,dataEnd), { maxOutputLength: Math.min(size, IMAGE_LIMITS.fileBytes) }); } catch { fail(); }
      if (decoded!.length !== size || crc32(decoded!) !== crc) fail();
      try { signature(decoded!); } catch { fail(); }
      files.set(path!, decoded!);
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== end) fail();
  ranges.sort((a,b) => a[0]-b[0]);
  if (ranges[0][0] !== 0 || ranges.some((range,i) => i > 0 && range[0] !== ranges[i-1][1]) || ranges[ranges.length-1][1] !== centralOffset) fail();
  return files;
}

function signature(bytes: Buffer): "jpeg" | "png" | "webp" {
  if (bytes.length >= 8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP") return "webp";
  throw new Error("Gambar harus memiliki signature JPG, PNG, atau WebP yang valid.");
}

export async function processProductImage(bytes: Buffer, filename?: string) {
  if (!bytes.length || bytes.length > IMAGE_LIMITS.fileBytes) throw new Error("Ukuran gambar maksimal 2 MB.");
  const format = signature(bytes);
  if (filename && !new RegExp(format === "jpeg" ? "\\.jpe?g$" : `\\.${format}$`, "i").test(filename)) throw new Error("Ekstensi gambar tidak sesuai signature file.");
  try {
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: IMAGE_LIMITS.pixels, animated: true });
    const meta = await image.metadata();
    if (meta.format !== format || !meta.width || !meta.height || (meta.pages ?? 1) !== 1 || meta.width > IMAGE_LIMITS.dimension || meta.height > IMAGE_LIMITS.dimension
      || meta.width * meta.height > IMAGE_LIMITS.pixels) throw new Error("limits");
    const output = await image.rotate().resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    if (output.data.length > IMAGE_LIMITS.fileBytes) throw new Error("limits");
    return { bytes: output.data, width: output.info.width, height: output.info.height };
  } catch { throw new Error("Gambar rusak/animasi/terlalu besar: satu frame, maksimal 8192 px per sisi dan 16 juta piksel. Tidak ada fallback file mentah."); }
}

/** All workers settle before returning/throwing, so callers can reliably clean up their uploads. */
export async function boundedMap<T,R>(items: T[], work: (item:T) => Promise<R>, concurrency = IMAGE_LIMITS.concurrency): Promise<R[]> {
  const results: R[] = new Array(items.length); let next = 0, failure: unknown;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)}, async () => {
    while (!failure) { const index = next++; if (index >= items.length) return;
      try { results[index] = await work(items[index]); } catch (error) { failure ??= error; }
    }
  }));
  if (failure) throw failure; return results;
}

export async function prepareImageArchive(bytes: Buffer | null, rows: ParsedRow[]) {
  const files = bytes ? readImageZip(bytes) : new Map<string,Buffer>();
  const requested = new Set<string>();
  for (const row of rows) {
    if (!row.payload.image_reference) continue;
    try {
      const reference = normalizeImageReference(String(row.payload.image_reference));
      row.payload.image_reference_normalized = reference;
      if (!files.has(reference)) throw new Error(`gambar: file ${row.payload.image_reference} tidak ditemukan dalam ZIP gambar.`);
      requested.add(reference); row.payload.image_mapping = { reference, status: "matched" };
    } catch (error) { row.errors.push({field:"gambar",message:error instanceof Error ? error.message : "Gambar tidak valid."}); }
  }
  let processedBytes=0;
  const processed = await boundedMap([...files.keys()], async reference => {
    try {
      const image=await processProductImage(files.get(reference)!,reference);
      if(!requested.has(reference)) return null;
      processedBytes+=image.bytes.length;
      if(processedBytes>IMAGE_LIMITS.processedBytes) throw new Error("Total gambar WebP staging maksimal 12 MB.");
      return {reference,...image};
    }
    catch (error) {
      if(!requested.has(reference)) throw new Error(`ZIP: gambar ${reference} tidak valid (termasuk file yang tidak digunakan).`);
      for (const row of rows.filter(row => row.payload.image_reference_normalized === reference)) {
        row.errors.push({field:"gambar",message:error instanceof Error ? error.message : "Gambar tidak valid."}); row.payload.image_mapping = {reference,status:"invalid"};
      }
      return null;
    }
  });
  const assets = processed.filter((asset): asset is NonNullable<typeof asset> => asset !== null && requested.has(asset.reference));
  if (processedBytes > IMAGE_LIMITS.processedBytes) throw new Error("Total gambar WebP staging maksimal 12 MB.");
  for (const row of rows) {
    const asset = assets.find(asset => asset.reference === row.payload.image_reference_normalized);
    if (asset) row.payload.image_mapping = {reference:asset.reference,status:"ready",width:asset.width,height:asset.height,bytes:asset.bytes.length};
  }
  return {assets,summary:{files:files.size,matched:assets.length,unreferenced:[...files.keys()].filter(name => !requested.has(name)).length,
    rows:rows.filter(row => row.payload.image_reference).length,processed_bytes:assets.reduce((sum,asset) => sum+asset.bytes.length,0)}};
}
