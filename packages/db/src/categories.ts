import { sql } from "drizzle-orm";
import type { DatabaseClient, Row } from "./query";

export async function ensureOutletCategory(db: DatabaseClient, input: { companyId: string; outletId: string; name: string }): Promise<{ category: Row; created: boolean }> {
  const name = input.name.normalize("NFKC").trim();
  if (!name || name.length > 60) throw new Error("Nama kategori wajib diisi, maksimal 60 karakter.");
  const normalized = name.toLocaleLowerCase("id-ID");
  return db.transaction(async tx => {
    // Serialize category creation from Owner, POS and workbook import by outlet+normalized label.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`category:${input.companyId}:${input.outletId}:${normalized}`},0))`);
    const [existing] = await tx.execute(sql`select id,company_id,outlet_id,name,sort_order from public.categories where company_id=${input.companyId}
      and outlet_id=${input.outletId} and lower(btrim(name))=${normalized} order by id limit 1 for update`);
    if (existing) return { category: existing, created: false };
    const [last] = await tx.execute(sql`select coalesce(max(sort_order),0)::int as sort_order from public.categories
      where company_id=${input.companyId} and outlet_id=${input.outletId}`);
    const [category] = await tx.execute(sql`insert into public.categories(company_id,outlet_id,name,sort_order)
      values(${input.companyId},${input.outletId},${name},${Number(last?.sort_order ?? 0)+1}) returning id,company_id,outlet_id,name,sort_order`);
    return { category, created: true };
  });
}
