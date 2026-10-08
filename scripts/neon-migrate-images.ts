import { connect } from "./lib/neon-config";
import { uploadFile, deleteFile } from "@rakku/silos-client";

// Run against SOURCE before the final snapshot, so source/target checksums stay
// identical and the final app does not depend on Supabase Storage URLs.
async function main() {
  const source = connect("SOURCE_DATABASE_URL");
  try {
    const images = await source<{ id: string; image_url: string }[]>`
      select id,image_url from public.products where image_url like 'https://%.supabase.co/%'`;
    for (const product of images) {
      const url = new URL(product.image_url);
      if (!url.hostname.endsWith(".supabase.co") || !url.pathname.startsWith("/storage/v1/object/")) {
        throw new Error("Unexpected legacy image endpoint");
      }
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Legacy image fetch failed for product ${product.id}`);
      const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
      if (!contentType.startsWith("image/") || Number(response.headers.get("content-length")) > 20 * 1024 * 1024) throw new Error("Invalid legacy image response");
      const data = await response.arrayBuffer();
      if (data.byteLength > 20 * 1024 * 1024) throw new Error("Legacy image exceeds 20 MB");
      const uploaded = await uploadFile({ file: Buffer.from(data), filename: `product-${product.id}.${contentType.split("/")[1]}`, contentType });
      try {
        const updated = await source`update public.products set image_url=${uploaded.url}, image_silo_id=${uploaded.id}
          where id=${product.id} and image_url=${product.image_url} returning id`;
        if (!updated.length) await deleteFile(uploaded.id);
      } catch (error) { await deleteFile(uploaded.id).catch(() => {}); throw error; }
      console.log(`Migrated image for ${product.id}`);
    }
    console.log(`${images.length} legacy images processed.`);
  } finally { await source.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
