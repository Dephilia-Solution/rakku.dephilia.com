import { DemoImportError, type DemoImportRow } from "./import-models";

/** Kept in sync with Owner import-images. This module has no Node, Sharp or provider imports. */
export const DEMO_IMPORT_IMAGE_LIMITS = {
  archiveBytes: 3 * 1024 * 1024, entries: 120, files: 100, expandedBytes: 32 * 1024 * 1024,
  fileBytes: 2 * 1024 * 1024, ratio: 100, pixels: 16_000_000, dimension: 8192,
  processedBytes: 12 * 1024 * 1024, concurrency: 2,
} as const;
function archivePath(raw: string): string {
  const path = raw.normalize("NFKC");
  if (!path || path.length > 240 || path !== path.trim() || /[\\:\x00-\x1f\x7f?#]/.test(path) || path.startsWith("/")
    || path.split("/").some(part => !part || part === "." || part === ".." || /[. ]$/.test(part))) throw new Error("gambar: gunakan path relatif ZIP yang aman (contoh foto/kopi.jpg), bukan URL/path komputer.");
  return path.toLocaleLowerCase("en-US");
}
export function normalizeDemoImageReference(raw: string): string {
  const path = archivePath(raw);
  if (!/\.(jpe?g|png|webp)$/i.test(path)) throw new Error("gambar: hanya JPG, PNG, atau WebP; arsip/workbook bertingkat tidak didukung.");
  return path;
}
const crcTable = Uint32Array.from({ length: 256 }, (_value, index) => {
  let crc = index; for (let i = 0; i < 8; i++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; return crc >>> 0;
});
function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, index) => byte === b[index]);
const ascii = (bytes: Uint8Array, offset: number, size: number) => String.fromCharCode(...bytes.subarray(offset, offset + size));
export type DemoImageInflater = (bytes: Uint8Array, maximum: number) => Promise<Uint8Array>;

/** Ordinary stored/deflated ZIP only. Central/local headers, CRC, contiguous ranges,
 * declared/actual expansion and all production archive budgets are checked. */
export async function readDemoImageZip(bytes: Uint8Array, inflateRaw: DemoImageInflater, active: () => void): Promise<Map<string, Uint8Array>> {
  const limits = DEMO_IMPORT_IMAGE_LIMITS;
  if (!bytes.length || bytes.length > limits.archiveBytes) throw new Error("ZIP gambar maksimal 3 MB.");
  const fail = (): never => { throw new Error("ZIP tidak valid/tidak aman (path, enkripsi, symlink, duplikat, nesting, ukuran atau kompresi)."); };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), u16 = (at: number) => view.getUint16(at, true), u32 = (at: number) => view.getUint32(at, true);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) if (u32(at) === 0x06054b50 && at + 22 + u16(at + 20) === bytes.length) { end = at; break; }
  if (end < 0) fail();
  const count = u16(end + 10), centralOffset = u32(end + 16);
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count || !count || count > limits.entries || centralOffset + u32(end + 12) !== end) fail();
  const paths = new Set<string>(), files = new Map<string, Uint8Array>(), ranges: [number, number][] = [];
  let cursor = centralOffset, expanded = 0;
  const extraFields = (start: number, size: number) => {
    const end = start + size;
    for (let at = start; at < end;) {
      if (at + 4 > end) fail(); const tag = u16(at), length = u16(at + 2);
      if (tag === 1 || tag === 0x7075 || at + 4 + length > end) fail(); at += 4 + length;
    }
  };
  for (let index = 0; index < count; index++) {
    active();
    if (cursor + 46 > end || u32(cursor) !== 0x02014b50) fail();
    const flags = u16(cursor + 8), method = u16(cursor + 10), crc = u32(cursor + 16), compressed = u32(cursor + 20), size = u32(cursor + 24);
    const nameLength = u16(cursor + 28), extraLength = u16(cursor + 30), commentLength = u16(cursor + 32), mode = (u32(cursor + 38) >>> 16) & 0xf000, local = u32(cursor + 42);
    if (cursor + 46 + nameLength + extraLength + commentLength > end || !nameLength || u16(cursor + 34) || (flags & ~0x080e) || flags & 1 || ![0, 8].includes(method)
      || size === 0xffffffff || compressed === 0xffffffff || local === 0xffffffff || mode && mode !== 0x8000 && mode !== 0x4000) fail();
    const rawName = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = new TextDecoder("utf-8", { fatal: true }).decode(rawName);
    if (!(flags & 0x800) && /[^\x00-\x7f]/.test(name)) fail();
    const directory = name.endsWith("/");
    let path: string;
    try { path = directory ? archivePath(name.slice(0, -1)) : normalizeDemoImageReference(name); } catch { return fail(); }
    if (paths.has(path)) fail(); paths.add(path);
    extraFields(cursor + 46 + nameLength, extraLength);
    if (directory && (size || compressed || mode === 0x8000) || size > limits.fileBytes || size && (!compressed || size / compressed > limits.ratio)) fail();
    expanded += size; if (expanded > limits.expandedBytes) fail();
    if (local + 30 > centralOffset || u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method) fail();
    const localNameLength = u16(local + 26), localExtraLength = u16(local + 28), dataOffset = local + 30 + localNameLength + localExtraLength, dataEnd = dataOffset + compressed;
    if (localNameLength !== nameLength || dataEnd > centralOffset || !same(bytes.subarray(local + 30, local + 30 + localNameLength), rawName)) fail();
    extraFields(local + 30 + localNameLength, localExtraLength);
    let rangeEnd = dataEnd;
    if (flags & 8) {
      const signed = dataEnd + 4 <= centralOffset && u32(dataEnd) === 0x08074b50, descriptor = dataEnd + (signed ? 4 : 0); rangeEnd = descriptor + 12;
      if (rangeEnd > centralOffset || u32(descriptor) !== crc || u32(descriptor + 4) !== compressed || u32(descriptor + 8) !== size) fail();
    } else if (u32(local + 14) !== crc || u32(local + 18) !== compressed || u32(local + 22) !== size) fail();
    ranges.push([local, rangeEnd]);
    if (!directory) {
      if (files.size >= limits.files || !size) fail();
      let decoded: Uint8Array;
      try { decoded = method === 0 ? bytes.slice(dataOffset, dataEnd) : await inflateRaw(bytes.subarray(dataOffset, dataEnd), Math.min(size, limits.fileBytes)); }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") throw error; return fail(); }
      active();
      if (decoded.length !== size || crc32(decoded) !== crc) fail();
      demoImageMetadata(decoded, path); files.set(path, decoded);
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== end) fail();
  ranges.sort((a, b) => a[0] - b[0]);
  if (ranges[0][0] !== 0 || ranges.some((range, i) => i > 0 && range[0] !== ranges[i - 1][1]) || ranges[ranges.length - 1][1] !== centralOffset) fail();
  return files;
}

/** Inspect dimensions and animation flags BEFORE the browser allocates a decoded bitmap. */
export function demoImageMetadata(bytes: Uint8Array, filename: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), limits = DEMO_IMPORT_IMAGE_LIMITS;
  let width = 0, height = 0, format = "", animated = false;
  if (bytes.length >= 24 && same(bytes.subarray(0, 8), Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    format = "png";
    if (ascii(bytes, 12, 4) !== "IHDR" || view.getUint32(8) !== 13) throw new Error("PNG tidak valid.");
    width = view.getUint32(16); height = view.getUint32(20);
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset), type = ascii(bytes, offset + 4, 4);
      if (offset + length + 12 > bytes.length) throw new Error("PNG terpotong.");
      if (type === "acTL") animated = true; offset += length + 12;
    }
  } else if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    format = "webp";
    if (view.getUint32(4, true) + 8 !== bytes.length) throw new Error("WebP terpotong.");
    const u24 = (at: number) => bytes[at] + (bytes[at + 1] << 8) + (bytes[at + 2] << 16);
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = ascii(bytes, offset, 4), length = view.getUint32(offset + 4, true), start = offset + 8;
      if (start + length > bytes.length) throw new Error("WebP terpotong.");
      if (type === "VP8X" && length >= 10) { animated ||= Boolean(bytes[start] & 2); width = u24(start + 4) + 1; height = u24(start + 7) + 1; }
      if (type === "ANIM" || type === "ANMF") animated = true;
      if (!width && type === "VP8 " && length >= 10 && bytes[start + 3] === 0x9d && bytes[start + 4] === 1 && bytes[start + 5] === 0x2a) { width = view.getUint16(start + 6, true) & 0x3fff; height = view.getUint16(start + 8, true) & 0x3fff; }
      if (!width && type === "VP8L" && length >= 5 && bytes[start] === 0x2f) { const bits = view.getUint32(start + 1, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; }
      offset = start + length + (length & 1);
    }
  } else if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    format = "jpeg";
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset++] !== 255) throw new Error("JPEG tidak valid.");
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) throw new Error("JPEG terpotong.");
      // Multi-picture JPEG (MPO) is outside the single-image import contract.
      if (marker === 0xe2 && ascii(bytes, offset + 2, 4) === "MPF\0") animated = true;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && size >= 8) { height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); }
      offset += size;
    }
  }
  if (!format || !new RegExp(format === "jpeg" ? "\\.jpe?g$" : `\\.${format}$`, "i").test(filename)) throw new Error("Ekstensi gambar tidak sesuai signature JPG, PNG, atau WebP.");
  if (!width || !height || animated || width > limits.dimension || height > limits.dimension || width * height > limits.pixels) throw new Error("Gambar rusak/animasi/terlalu besar: satu frame, maksimal 8192 px per sisi dan 16 juta piksel.");
  return { width, height, format };
}
export interface DemoImageDecoder {
  inflateRaw: DemoImageInflater;
  decode(bytes: Uint8Array, filename: string): Promise<{ file: File; width: number; height: number }>;
}
export async function prepareDemoImportImages(zip: File | null, rows: DemoImportRow[], active: () => void, decoder: DemoImageDecoder) {
  try {
    const files = zip ? await readDemoImageZip(new Uint8Array(await zip.arrayBuffer()), decoder.inflateRaw, active) : new Map<string, Uint8Array>();
    active();
    const requested = new Set<string>();
    for (const row of rows) if (row.payload.image_reference) {
      try {
        const reference = normalizeDemoImageReference(String(row.payload.image_reference)); row.payload.image_reference_normalized = reference;
        if (!files.has(reference)) throw new Error(`gambar: file ${row.payload.image_reference} tidak ditemukan dalam ZIP gambar.`);
        requested.add(reference); row.payload.image_mapping = { reference, status: "matched" };
      } catch (error) { row.errors.push({ field: "gambar", message: error instanceof Error ? error.message : "Gambar tidak valid." }); }
    }
    let next = 0, processedBytes = 0, failure: unknown;
    const entries = [...files], assets: { reference: string; file: File; width: number; height: number; content_hash: string }[] = [];
    // All workers settle before returning or throwing. No object URL exists during decoding.
    await Promise.all(Array.from({ length: Math.min(DEMO_IMPORT_IMAGE_LIMITS.concurrency, entries.length) }, async () => {
      while (!failure) {
        const index = next++; if (index >= entries.length) return;
        const [reference, bytes] = entries[index];
        try {
          active(); const image = await decoder.decode(bytes, reference); active();
          if (!image.file.size || image.file.size > DEMO_IMPORT_IMAGE_LIMITS.fileBytes || image.file.type !== "image/webp" || image.width < 1 || image.height < 1 || image.width > 800 || image.height > 800) throw new Error("Decoder wajib menghasilkan WebP maksimal 800 px dan 2 MB; tidak ada fallback file mentah.");
          if (!requested.has(reference)) continue;
          processedBytes += image.file.size;
          if (processedBytes > DEMO_IMPORT_IMAGE_LIMITS.processedBytes) throw new Error("Total gambar WebP staging maksimal 12 MB.");
          const digest = await crypto.subtle.digest("SHA-256", await image.file.arrayBuffer()); active();
          assets.push({ reference, ...image, content_hash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("") });
          for (const row of rows.filter(row => row.payload.image_reference_normalized === reference)) row.payload.image_mapping = { reference, status: "ready", width: image.width, height: image.height, bytes: image.file.size };
        } catch (error) {
          if (!requested.has(reference) || error instanceof DOMException && error.name === "AbortError") { failure ??= error; continue; }
          for (const row of rows.filter(row => row.payload.image_reference_normalized === reference)) {
            row.errors.push({ field: "gambar", message: error instanceof Error ? error.message : "Gambar tidak valid." }); row.payload.image_mapping = { reference, status: "invalid" };
          }
        }
      }
    }));
    if (failure) throw failure;
    if (processedBytes > DEMO_IMPORT_IMAGE_LIMITS.processedBytes) throw new Error("Total gambar WebP staging maksimal 12 MB.");
    return { assets, summary: { files: files.size, matched: assets.length, unreferenced: [...files.keys()].filter(name => !requested.has(name)).length,
      rows: rows.filter(row => row.payload.image_reference).length, processed_bytes: assets.reduce((sum, asset) => sum + asset.file.size, 0) } };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new DemoImportError(error instanceof Error ? error.message : "ZIP gambar tidak valid.", 400, "IMPORT_IMAGES_INVALID");
  }
}
