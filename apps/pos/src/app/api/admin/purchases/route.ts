import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { checkFeature } from "@rakku/plans";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

type JsonLike = Record<string, unknown>;

interface PurchaseItemInput {
  ingredient_id: string;
  quantity: number;
  unit_cost: number;
}

export async function GET() {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ingredient_purchases")
    .select(
      "*, ingredient_purchase_items(ingredient_id, quantity, unit_cost, subtotal, ingredients(name, unit))"
    )
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .order("purchase_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data as JsonLike[]) ?? []).map((p) => ({
    id: p.id as string,
    company_id: p.company_id as string,
    outlet_id: p.outlet_id as string,
    supplier_name: (p.supplier_name as string | null) ?? null,
    total_amount: Number(p.total_amount),
    purchase_date: p.purchase_date as string,
    note: (p.note as string | null) ?? null,
    created_by: (p.created_by as string | null) ?? null,
    created_at: p.created_at as string,
    items: ((p.ingredient_purchase_items as JsonLike[]) ?? []).map((i) => ({
      ingredient_id: i.ingredient_id as string,
      quantity: Number(i.quantity),
      unit_cost: Number(i.unit_cost),
      subtotal: Number(i.subtotal),
      ingredient_name:
        ((i.ingredients as JsonLike)?.name as string) ?? "Bahan",
      ingredient_unit:
        ((i.ingredients as JsonLike)?.unit as string) ?? "",
    })),
  }));

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { supplier_name, purchase_date, note, items } = body as {
    supplier_name?: string;
    purchase_date?: string;
    note?: string;
    items?: PurchaseItemInput[];
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Minimal satu bahan wajib diisi" }, { status: 400 });
  }

  for (const item of items) {
    if (!item.ingredient_id) {
      return NextResponse.json({ error: "Bahan wajib dipilih" }, { status: 400 });
    }
    if (typeof item.quantity !== "number" || item.quantity <= 0) {
      return NextResponse.json({ error: "Jumlah bahan harus lebih dari 0" }, { status: 400 });
    }
    if (typeof item.unit_cost !== "number" || item.unit_cost < 0) {
      return NextResponse.json({ error: "Harga beli tidak valid" }, { status: 400 });
    }
  }

  const supabase = createAdminClient();

  const feature = await checkFeature(
    supabase,
    session.company_id,
    "inventory_advanced"
  );
  if (!feature.allowed) {
    return NextResponse.json(feature, { status: 403 });
  }

  // 1. Insert header purchase
  const totalAmount = items.reduce(
    (sum, i) => sum + i.quantity * i.unit_cost,
    0
  );

  const { data: purchase, error: purchaseError } = await supabase
    .from("ingredient_purchases")
    .insert({
      company_id: session.company_id,
      outlet_id: session.outlet_id,
      supplier_name: supplier_name?.trim() || null,
      total_amount: totalAmount,
      purchase_date: purchase_date ?? new Date().toISOString(),
      note: note?.trim() || null,
      created_by: session.user_id ?? null,
    })
    .select("id")
    .single();

  if (purchaseError || !purchase) {
    return NextResponse.json(
      { error: purchaseError?.message ?? "Gagal menyimpan pembelian" },
      { status: 500 }
    );
  }

  const purchaseId = purchase.id as string;

  // 2. Insert detail items
  const itemRows = items.map((i) => ({
    purchase_id: purchaseId,
    ingredient_id: i.ingredient_id,
    quantity: i.quantity,
    unit_cost: i.unit_cost,
    subtotal: i.quantity * i.unit_cost,
  }));

  const { error: itemsError } = await supabase
    .from("ingredient_purchase_items")
    .insert(itemRows);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // 3. Update stok & cost (last cost) per ingredient
  //    Stok ditambah (pembelian = restock), cost pakai harga beli terakhir.
  const ingredientIds = items.map((i) => i.ingredient_id);
  const { data: currentRows, error: fetchError } = await supabase
    .from("ingredients")
    .select("id, stock_quantity")
    .in("id", ingredientIds)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id);

  if (fetchError) {
    console.error("[purchases] failed to fetch current stock:", fetchError);
  }

  const stockMap = new Map<string, number>();
  for (const r of (currentRows as JsonLike[] | null) ?? []) {
    stockMap.set(r.id as string, Number(r.stock_quantity ?? 0));
  }

  const stockUpdates = items.map((i) => {
    const current = stockMap.get(i.ingredient_id) ?? 0;
    return supabase
      .from("ingredients")
      .update({ stock_quantity: current + i.quantity, cost_per_unit: i.unit_cost })
      .eq("id", i.ingredient_id)
      .eq("company_id", session.company_id)
      .eq("outlet_id", session.outlet_id);
  });

  const stockResults = await Promise.all(stockUpdates);
  for (const result of stockResults) {
    if (result.error) {
      console.error("[purchases] failed to update ingredient stock:", result.error);
    }
  }

  // 4. Insert stock_movements type=purchase
  const movementRows = items.map((i) => ({
    company_id: session.company_id,
    outlet_id: session.outlet_id,
    ingredient_id: i.ingredient_id,
    type: "purchase",
    quantity_change: i.quantity,
    reference_id: purchaseId,
    note: supplier_name?.trim() || null,
    created_by: session.user_id ?? null,
  }));

  const { error: movementsError } = await supabase
    .from("stock_movements")
    .insert(movementRows);

  if (movementsError) {
    console.error("[purchases] failed to insert stock_movements:", movementsError);
  }

  return NextResponse.json({ success: true, id: purchaseId, total_amount: totalAmount }, { status: 201 });
}