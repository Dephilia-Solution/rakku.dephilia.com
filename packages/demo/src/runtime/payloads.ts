import type { DemoCustomModifier, DemoOrder, DemoOrderInput, DemoSplit, DemoState } from "../models";
import { fail, find, list, money, optionalText, record, text, uniqueStrings } from "../business";

export function orderPayload(state: DemoState, body: Record<string, unknown>, existing?: DemoOrder): DemoOrderInput {
  const outlet_id = text(body.outletId ?? body.outlet_id ?? existing?.outlet_id ?? state.session.outlet_id, "outlet ID");
  const tier_id = text(body.pricingTierId ?? body.pricing_tier_id ?? body.tier_id ?? existing?.tier_id ?? state.tiers.find(row => row.outlet_id === outlet_id && row.is_active)?.id, "tier ID");
  const input: DemoOrderInput = { outlet_id, tier_id, items: [] };
  input.customer_name = text(body.customerName ?? body.customer_name ?? existing?.customer_name, "customer name", 100);
  input.order_type = (body.orderType ?? body.order_type ?? existing?.order_type ?? "dine_in") as DemoOrderInput["order_type"];
  input.table_id = (body.tableId !== undefined ? body.tableId : body.table_id !== undefined ? body.table_id : existing?.table_id ?? null) as string | null;
  input.note = optionalText(body.note === undefined ? existing?.note : body.note);
  if (body.items === undefined && existing) {
    input.items = existing.items.map(row => ({ product_id: row.product_id, quantity: row.quantity, modifier_ids: row.modifier_ids, custom_modifiers: row.custom_modifiers, cart_item_id: row.cart_item_id, note: row.note })); return input;
  }
  input.items = list(body.items).map((raw, index) => {
    const row = record(raw), embedded = row.product === undefined ? null : record(row.product);
    const product = find(state.products, row.product_id ?? embedded?.id);
    if ((row.product_id !== undefined && embedded?.id !== undefined && row.product_id !== embedded.id) || (embedded?.company_id !== undefined && embedded.company_id !== state.company.id) || (embedded?.outlet_id !== undefined && embedded.outlet_id !== outlet_id)) fail("Invalid embedded product scope");
    const modifier_ids = uniqueStrings(row.modifier_ids ?? []), custom: DemoCustomModifier[] = [];
    for (const rawModifier of list(row.modifiers ?? [])) {
      const modifier = record(rawModifier), mid = text(modifier.id, "modifier ID");
      if (modifier.product_id !== undefined && modifier.product_id !== product.id) fail("Invalid modifier product");
      if (mid.startsWith("custom-")) custom.push({ id: mid, product_id: product.id, name: text(modifier.name, "custom modifier name", 100), group_name: optionalText(modifier.group_name, 100), price_delta: money(modifier.price_delta ?? 0) });
      else { find(product.modifiers, mid); modifier_ids.push(mid); }
    }
    for (const rawModifier of list(row.custom_modifiers ?? [])) {
      const modifier = record(rawModifier); custom.push({ id: text(modifier.id, "custom modifier ID"), product_id: text(modifier.product_id, "custom modifier product"), name: text(modifier.name, "custom modifier name", 100), group_name: optionalText(modifier.group_name, 100), price_delta: money(modifier.price_delta) });
    }
    if (!modifier_ids.length && !custom.length && row.modifier_label) {
      const previous = existing?.items.find(item => item.product_id === product.id && item.modifier_label === row.modifier_label);
      if (previous) { modifier_ids.push(...previous.modifier_ids ?? []); custom.push(...previous.custom_modifiers ?? []); }
      else for (const label of text(row.modifier_label, "modifier label", 1000).split(", ")) {
        const modifier = product.modifiers.find(item => label === item.name || label.startsWith(`${item.name} +`));
        if (!modifier) fail("Custom modifier metadata required"); modifier_ids.push(modifier.id);
      }
    }
    return { product_id: product.id, quantity: row.quantity as number, modifier_ids: [...new Set(modifier_ids)], custom_modifiers: custom,
      cart_item_id: text(row.cart_item_id ?? row.id ?? existing?.items[index]?.cart_item_id ?? `cart-${index}`, "cart item ID"), note: optionalText(row.note) };
  });
  return input;
}
export function splitPayload(body: Record<string, unknown>): DemoSplit[] | undefined {
  const rows = body.splitPayments ?? body.split_payments ?? body.splits;
  if (rows === undefined) return undefined;
  return list(rows).map(raw => { const row = record(raw), method = row.method ?? row.payment_method;
    return { method: (method === "qris" ? "qris_manual" : method) as DemoSplit["method"], amount: row.amount as number,
      ...(row.customer_name !== undefined ? { customer_name: optionalText(row.customer_name, 100) } : {}), ...(row.items !== undefined ? { items: list(row.items) as NonNullable<DemoSplit["items"]> } : {}) };
  });
}
