import { sql } from "drizzle-orm";
import type { DatabaseClient, QueryResult, Row } from "./query";
import { revokeSubjectSessions } from "./sessions";
export function checked<T>(result: QueryResult<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
export interface EmployeeWrite {
  companyId: string; employeeId?: string; name?: string; username?: string; pinHash?: string;
  roleId?: string; allOutlets?: boolean; outletIds?: string[];
}
export async function saveEmployee(db: DatabaseClient, input: EmployeeWrite) {
  return db.transaction(async tx => {
    const { companyId, employeeId } = input;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${companyId},0))`);
    if (employeeId) {
      const rows = await tx.execute(sql`select id from public.users where id=${employeeId} and company_id=${companyId} for update`);
      if (!rows.length) throw new Error("Karyawan tidak ditemukan");
    }
    if (input.roleId) {
      const role = checked(await tx.from("roles").select("id").eq("id", input.roleId).eq("company_id", companyId).maybeSingle());
      if (!role) throw new Error("Role tidak valid");
    }
    if (input.username !== undefined) {
      const query = tx.from("users").select("id").eq("company_id", companyId).eq("username", input.username);
      const duplicate = checked(await (employeeId ? query.neq("id", employeeId) : query).maybeSingle());
      if (duplicate) throw new Error("Username sudah dipakai");
    }
    const outlets = Array.from(new Set(input.outletIds ?? []));
    if (outlets.length) {
      const valid = checked(await tx.from("outlets").select("id").eq("company_id", companyId).in("id", outlets));
      if (valid.length !== outlets.length) throw new Error("Outlet tidak valid");
    }
    const values: Row = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.username !== undefined) values.username = input.username;
    if (input.roleId !== undefined) values.role_id = input.roleId;
    if (input.allOutlets !== undefined) values.all_outlets = input.allOutlets;
    if (input.pinHash !== undefined) values.pin_hash = input.pinHash;
    let user: Row;
    if (employeeId) {
      user = { id: employeeId };
      if (Object.keys(values).length) user = checked(await tx.from("users").update(values).eq("id", employeeId).eq("company_id", companyId).select("id").single());
      await revokeSubjectSessions(tx, "pos", employeeId);
    } else {
      user = checked(await tx.from("users").insert({ ...values, company_id: companyId, status: "active" }).select("id").single());
    }
    if (input.outletIds !== undefined) {
      checked(await tx.from("user_outlets").delete().eq("user_id", user.id));
      if (outlets.length) checked(await tx.from("user_outlets").insert(outlets.map(outlet_id => ({ user_id: user.id, outlet_id }))));
    }
    return { id: String(user.id) };
  });
}
export async function replaceProductTierPrices(db: DatabaseClient, companyId: string, productId: string, prices: { tier_id: string; price: number }[]) {
  return db.transaction(async tx => {
    const [product] = await tx.execute(sql`select id,outlet_id from public.products where id=${productId} and company_id=${companyId} for update`);
    if (!product) throw new Error("Produk tidak ditemukan");
    const ids = prices.map(p => p.tier_id);
    if (new Set(ids).size !== ids.length || prices.some(p => !Number.isFinite(p.price) || p.price < 0 || p.price > 99999999.99)) throw new Error("Harga tier tidak valid");
    if (ids.length) {
      const tiers = checked(await tx.from("pricing_tiers").select("id").eq("company_id", companyId).eq("outlet_id", product.outlet_id).in("id", ids));
      if (tiers.length !== ids.length) throw new Error("Tier tidak valid");
    }
    checked(await tx.from("product_tier_prices").delete().eq("product_id", productId));
    if (prices.length) checked(await tx.from("product_tier_prices").insert(prices.map(p => ({ ...p, product_id: productId }))));
  });
}
export async function replaceModifierTierPrices(db: DatabaseClient, companyId: string, modifierId: string, prices: { tier_id: string; price_delta: number }[]) {
  return db.transaction(async tx => {
    const [modifier] = await tx.execute(sql`select m.id,p.outlet_id from public.modifiers m
      join public.products p on p.id=m.product_id
      where m.id=${modifierId} and p.company_id=${companyId} for update of m`);
    if (!modifier) throw new Error("Modifier tidak ditemukan");
    const ids = prices.map(p => p.tier_id);
    if (new Set(ids).size !== ids.length || prices.some(p => !Number.isFinite(p.price_delta)
      || Math.abs(p.price_delta) > 99999999.99)) throw new Error("Harga tier modifier tidak valid");
    if (ids.length) {
      const tiers = checked(await tx.from("pricing_tiers").select("id").eq("company_id", companyId)
        .eq("outlet_id", modifier.outlet_id).in("id", ids));
      if (tiers.length !== ids.length) throw new Error("Tier tidak valid");
    }
    checked(await tx.from("modifier_tier_prices").delete().eq("modifier_id", modifierId));
    if (prices.length) checked(await tx.from("modifier_tier_prices").insert(prices.map(p => ({ ...p, modifier_id: modifierId }))));
  });
}
export async function deleteDraft(db: DatabaseClient, companyId: string, outletId: string, id: string) {
  const rows = await db.execute(sql`delete from public.orders where id=${id} and company_id=${companyId}
    and outlet_id=${outletId} and status='draft' and payment_status='unpaid' returning id`);
  return rows.length === 1;
}
export function validateSplits(splits: { amount: number; payment_method: string }[] | undefined, total: number) {
  if (!splits?.length) return;
  if (!Array.isArray(splits) || splits.length > 100 || splits.some(s => !Number.isFinite(s.amount) || s.amount <= 0
    || !["cash", "card", "qris"].includes(s.payment_method))) throw new Error("Pembayaran split tidak valid");
  if (Math.abs(splits.reduce((sum, s) => sum + Math.round(s.amount * 100), 0) - Math.round(total * 100)) > 0) throw new Error("Jumlah split harus sama dengan total tagihan");
}
