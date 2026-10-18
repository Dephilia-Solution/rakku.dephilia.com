import type { DatabaseClient } from "@rakku/db";
import { checked } from "@rakku/db/merchant";
import { calculateTotals, discountFor, money } from "./money";
export class CheckoutError extends Error { readonly status = 400; }
export async function quoteOrder(db: DatabaseClient, scope: { company_id: string; outlet_id: string }, input: { items: any[]; pricingTierId?: string | null; tableId?: string | null }) {
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 200) throw new CheckoutError("Items tidak valid");
  const ids = Array.from(new Set(input.items.map(i => i?.product?.id ?? i?.product_id)));
  if (ids.some(id => typeof id !== "string")) throw new CheckoutError("Produk tidak valid");
  const scoped = (table: string) => db.from(table).select("*").eq("company_id", scope.company_id).eq("outlet_id", scope.outlet_id);
  const products = checked(await scoped("products").in("id", ids).eq("is_active", true));
  if (products.length !== ids.length) throw new CheckoutError("Produk tidak tersedia di outlet ini");
  const tierId = input.pricingTierId;
  if (tierId && !checked(await scoped("pricing_tiers").eq("id", tierId).eq("is_active", true).maybeSingle())) throw new CheckoutError("Tier tidak valid");
  if (input.tableId && !checked(await scoped("dining_tables").eq("id", input.tableId).maybeSingle())) throw new CheckoutError("Meja tidak valid");
  const modifiers = checked(await db.from("modifiers").select("*").in("product_id", ids));
  const prices = tierId ? checked(await db.from("product_tier_prices").select("*").eq("tier_id", tierId).in("product_id", ids)) : [];
  const modifierPrices = tierId ? checked(await db.from("modifier_tier_prices").select("*").eq("tier_id", tierId)) : [];
  const now = new Date().toISOString();
  const productDiscounts = checked(await scoped("product_discounts").eq("is_active", true).lte("start_date", now).gte("end_date", now).order("created_at").order("id"));
  const orderDiscounts = checked(await scoped("order_discounts").eq("is_active", true).lte("start_date", now).gte("end_date", now).order("created_at").order("id"));
  const taxes = checked(await scoped("taxes").eq("is_active", true).order("sort_order").order("id"));
  const items = input.items.map(raw => {
    const product = products.find(p => p.id === (raw.product?.id ?? raw.product_id))!;
    if (!Number.isSafeInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 10000) throw new CheckoutError("Jumlah produk harus bilangan bulat positif");
    const selected: string[] = raw.modifier_ids ?? raw.modifiers?.map((m: { id: string }) => m.id) ?? [];
    if (!Array.isArray(selected) || selected.length > 50 || new Set(selected).size !== selected.length) throw new CheckoutError("Modifier tidak valid");
    if (raw.modifier_label && !selected.length) throw new CheckoutError("Pilih ulang modifier pada draft lama sebelum membayar");
    const mods = selected.map(id => {
      const mod = modifiers.find(m => m.id === id && m.product_id === product.id);
      if (!mod) throw new CheckoutError("Modifier tidak sesuai produk");
      return { ...mod, price_delta: Number(modifierPrices.find(p => p.modifier_id === id)?.price_delta ?? mod.price_delta) };
    });
    const unit_price = money(Number(prices.find(p => p.product_id === product.id)?.price ?? product.price) + mods.reduce((sum, m) => sum + m.price_delta, 0));
    if (!Number.isFinite(unit_price) || unit_price < 0 || unit_price > 99999999.99) throw new CheckoutError("Harga produk tidak valid");
    const discount = productDiscounts.find(d => d.product_id === product.id) ?? null;
    const discounted_unit_price = money(unit_price - (discount ? discountFor(unit_price, discount) : 0));
    return { product, unit_price, quantity: raw.quantity, subtotal: money(discounted_unit_price * raw.quantity),
      modifier_ids: selected, modifiers: mods, modifier_label: mods.length ? mods.map(m => m.price_delta > 0 ? `${m.name} +${m.price_delta.toLocaleString("id-ID")}` : m.name).join(", ") : null,
      note: typeof raw.note === "string" ? raw.note.slice(0, 1000) : null, discount, discounted_unit_price };
  });
  const totals = calculateTotals(items, taxes, orderDiscounts[0] ?? null);
  if (!Number.isFinite(totals.total) || totals.total < 0 || totals.total > 99999999) throw new CheckoutError("Total order tidak valid");
  return { items, ...totals, discountAmount: money(totals.appliedDiscounts.reduce((sum, d) => sum + d.amount, 0)) };
}
