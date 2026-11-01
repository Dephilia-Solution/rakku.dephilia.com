import { createDemoImportService, prepareDemoImportImages, demoImageMetadata, type DemoImageDecoder, type DemoWorkbookService } from "@rakku/demo/runtime";
import type { DemoSandbox } from "@rakku/demo";

/** Importing this bridge does not load XLSX/ExcelJS. Only template/validate requests do. */
export function createOwnerDemoImportService(sandbox: DemoSandbox) {
  return createDemoImportService(sandbox, {
    loadWorkbook: async () => {
      const excel = await import("./import-excel");
      const service: DemoWorkbookService = { ...excel, async fillSample(bytes, sheets) {
        const { default: ExcelJS } = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
        for (const [name, rows] of Object.entries(sheets)) for (const row of rows) workbook.getWorksheet(name)!.addRow(row);
        return new Uint8Array(await workbook.xlsx.writeBuffer());
      } };
      return service;
    },
    prepareImages: (file, rows, active) => prepareDemoImportImages(file, rows, active, browserImageDecoder),
  });
}

const browserImageDecoder: DemoImageDecoder = {
  async inflateRaw(bytes, maximum) {
    // Bounded streaming inflation, never Response.arrayBuffer() on an unbounded stream.
    let stream: DecompressionStream;
    try { stream = new DecompressionStream("deflate-raw" as CompressionFormat); }
    catch { throw new Error("Browser ini belum mendukung ZIP deflate lokal. Gunakan ZIP tanpa kompresi atau browser terbaru."); }
    const reader = new Blob([new Uint8Array(bytes).buffer]).stream().pipeThrough(stream).getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > maximum) { await reader.cancel(); throw new Error("Batas dekompresi ZIP gambar terlampaui."); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const result = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  },
  async decode(bytes, filename) {
    const metadata = demoImageMetadata(bytes, filename);
    if (typeof createImageBitmap !== "function") throw new Error("Browser ini belum mendukung decoder gambar demo lokal.");
    const image = await createImageBitmap(new Blob([new Uint8Array(bytes).buffer], { type: `image/${metadata.format}` }), { imageOrientation: "from-image" });
    try {
      if (image.width > 8192 || image.height > 8192 || image.width * image.height > 16_000_000) throw new Error("Dimensi gambar terlalu besar.");
      const scale = Math.min(1, 800 / image.width, 800 / image.height), width = Math.max(1, Math.round(image.width * scale)), height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas gambar lokal tidak tersedia.");
      context.drawImage(image, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value?.type === "image/webp" ? resolve(value) : reject(new Error("Browser tidak mendukung output WebP; tidak ada fallback gambar mentah.")), "image/webp", 0.8));
      return { file: new File([blob], filename.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }), width, height };
    } finally { image.close(); }
  },
};
