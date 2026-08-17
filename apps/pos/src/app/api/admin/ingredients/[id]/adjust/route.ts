import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ingredientId = params.id;
  const body = await request.json();
  const { stock_quantity, note } = body;

  if (typeof stock_quantity !== "number" || Number.isNaN(stock_quantity)) {
    return NextResponse.json({ error: "Stok baru wajib berupa angka" }, { status: 400 });
  }

  if (stock_quantity < 0) {
    return NextResponse.json(
      { error: "Stok tidak boleh negatif" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Ambil stok saat ini (scoped company+outlet)
  const { data: current, error: fetchError } = await supabase
    .from("ingredients")
    .select("id, stock_quantity")
    .eq("id", ingredientId)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!current) {
    return NextResponse.json(
      { error: "Bahan baku tidak ditemukan" },
      { status: 404 }
    );
  }

  const currentStock = Number((current as { stock_quantity: number }).stock_quantity ?? 0);
  const quantityChange = stock_quantity - currentStock;

  // Update stok
  const { error: updateError } = await supabase
    .from("ingredients")
    .update({ stock_quantity })
    .eq("id", ingredientId)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Catat stock_movement type=adjustment
  const { error: movementError } = await supabase.from("stock_movements").insert({
    company_id: session.company_id,
    outlet_id: session.outlet_id,
    ingredient_id: ingredientId,
    type: "adjustment",
    quantity_change: quantityChange,
    reference_id: null,
    note: note ?? null,
    created_by: session.user_id ?? null,
  });

  if (movementError) {
    console.error("[stock] failed to insert adjustment movement:", movementError);
  }

  return NextResponse.json({
    success: true,
    previous_stock: currentStock,
    new_stock: stock_quantity,
    quantity_change: quantityChange,
  });
}