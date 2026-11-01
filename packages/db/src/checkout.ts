import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./query";
export class RequestConflict extends Error { readonly status = 409; }
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function checkoutIdentity(key: unknown, body: unknown) {
  if (typeof key !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new RequestConflict("ID permintaan tidak valid. Muat ulang halaman.");
  return { checkout_key: key, checkout_hash: createHash("sha256").update(JSON.stringify(canonical(body))).digest("hex") };
}
export async function findCheckout(db: DatabaseClient, scope: { company_id: string; outlet_id: string }, identity: ReturnType<typeof checkoutIdentity>) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope.company_id},0))`);
  const rows = await db.execute(sql`select * from public.orders where company_id=${scope.company_id}
    and outlet_id=${scope.outlet_id} and checkout_key=${identity.checkout_key}::uuid`);
  if (rows[0] && rows[0].checkout_hash !== identity.checkout_hash) throw new RequestConflict("Permintaan ini sudah dipakai untuk keranjang berbeda. Periksa order sebelum melanjutkan.");
  return rows[0] ?? null;
}
