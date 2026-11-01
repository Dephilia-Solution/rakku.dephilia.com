import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { createAdminClient as createPlatformClient } from "@rakku/db";
import { checkLimit } from "@rakku/plans";
import { createQrisIntent } from "@rakku/payments";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { requireAnySessionCapability } from "@/lib/auth/authorize";
import { isCheckoutPaused } from "@rakku/db/runtime-flags";
import { quoteOrder, CheckoutError } from "@rakku/pricing/quote";
import { checked } from "@rakku/db/merchant";
import { checkoutIdentity, findCheckout } from "@rakku/db/checkout";
import { sql } from "@rakku/db";
export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await isCheckoutPaused(createPlatformClient())) {
    return NextResponse.json({ error: "Checkout sedang dijeda sementara oleh operator.", code: "CHECKOUT_PAUSED" }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.customerName !== "string" || !body.customerName.trim()) return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
  try {
    if (body.draftOrderId) {
      // Converting an existing draft replaces its items and amount.
      await requireAnySessionCapability(session, [
        { menu: "register", capability: "can_edit" },
        { menu: "orders", capability: "can_edit" },
      ]);
    }
    const db = createAdminClient();
    const order = await db.transaction(async tx => {
      const identity = checkoutIdentity(body.requestId, body);
      const prior = await findCheckout(tx, session, identity);
      if (prior) return prior;
      const quote = await quoteOrder(tx, session, { items: body.items, pricingTierId: body.pricingTierId, tableId: body.tableId });
      if (Number(body.total) !== quote.total || quote.total <= 0) throw new CheckoutError("Nominal berubah atau tidak valid. Muat ulang katalog.");
      const limit = await checkLimit(tx, session.company_id, "transactions");
      if (!limit.allowed) throw Object.assign(new Error(limit.error ?? "Batas transaksi tercapai"), { status: 403 });
      const values = { ...identity, order_type: body.orderType, payment_method: "qris", payment_channel: "dynamic_qris",
        subtotal: quote.subtotal, tax_rate: 0, tax_amount: quote.totalTaxAmount, taxes: quote.appliedTaxes,
        discounts: quote.appliedDiscounts, discount_amount: quote.discountAmount, total_price: quote.total,
        rounding_amount: quote.roundingAmount, customer_name: body.customerName.trim(), table_id: body.tableId || null,
        note: typeof body.note === "string" ? body.note.slice(0, 1000) : null,
        status: "pending_payment", payment_status: "unpaid", company_id: session.company_id, outlet_id: session.outlet_id,
        cashier_id: session.user_id, cashier_name: session.user_name, pricing_tier_id: body.pricingTierId || null, split_bill: false };
      let saved;
      if (body.draftOrderId) {
        const [draft] = await tx.execute(sql`select id,status from public.orders where id=${body.draftOrderId} and company_id=${session.company_id} and outlet_id=${session.outlet_id} for update`);
        if (!draft || draft.status !== "draft") throw new CheckoutError("Draft tidak tersedia");
        checked(await tx.from("order_items").delete().eq("order_id", draft.id));
        saved = checked(await tx.from("orders").update(values).eq("id", draft.id).select().single());
      } else saved = checked(await tx.from("orders").insert(values).select().single());
      checked(await tx.from("order_items").insert(quote.items.map(item => ({ order_id: saved.id,
        product_id: item.product.id, product_name: item.product.name, unit_price: item.unit_price, quantity: item.quantity,
        modifier_label: item.modifier_label, modifier_ids: item.modifier_ids, note: item.note, subtotal: item.subtotal }))));
      return saved;
    });
    if (order.status === "completed") return NextResponse.json({ order, paid: true });
    const ownerBase = process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000";
    const result = await createQrisIntent(db, { companyId: session.company_id, outletId: session.outlet_id,
      orderId: order.id, amount: Number(order.total_price), callbackUrl: `${ownerBase}/api/webhooks/vessel`, createdBy: session.user_id });
    if ("error" in result) return NextResponse.json({ error: result.error, orderId: order.id }, { status: 502 });
    return NextResponse.json({ order, intent: result.intent }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat order" }, { status: Number((error as { status?: number }).status) || 500 });
  }
}
