import { sql } from "@rakku/db";
import { adjustStock } from "@rakku/inventory";
import { checked } from "@rakku/db/merchant";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { checkLimit, checkFeature } from "@rakku/plans";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

const VALID_UNITS = ["gram", "ml", "pcs", "kg", "liter"];

export async function GET() {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, unit, stock_quantity, min_stock_alert, cost_per_unit } = body;

  if (!name || !unit) {
    return NextResponse.json({ error: "Nama dan satuan wajib diisi" }, { status: 400 });
  }

  if (!VALID_UNITS.includes(unit)) {
    return NextResponse.json(
      { error: "Satuan harus gram, ml, pcs, kg, atau liter" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const limit = await checkLimit(supabase, session.company_id, "ingredients");
  if (!limit.allowed) {
    return NextResponse.json(limit, { status: 403 });
  }

  const { data, error } = await supabase
    .from("ingredients")
    .insert({
      company_id: session.company_id,
      outlet_id: session.outlet_id,
      name,
      unit,
      stock_quantity: stock_quantity ?? 0,
      min_stock_alert: min_stock_alert ?? 0,
      cost_per_unit: cost_per_unit ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, unit, stock_quantity, min_stock_alert, cost_per_unit, is_active } = body;

  if (!id) {
    return NextResponse.json({ error: "ID bahan baku wajib diisi" }, { status: 400 });
  }

  if (unit !== undefined && !VALID_UNITS.includes(unit)) {
    return NextResponse.json(
      { error: "Satuan harus gram, ml, pcs, kg, atau liter" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if ((min_stock_alert !== undefined && (!Number.isFinite(min_stock_alert) || min_stock_alert < 0))
    || (cost_per_unit !== undefined && (!Number.isFinite(cost_per_unit) || cost_per_unit < 0))) return NextResponse.json({ error: "Biaya dan batas stok harus angka nonnegatif" }, { status: 400 });
  try {
    const data = await supabase.transaction(async tx => {
      const [previous] = await tx.execute(sql`select stock_quantity from public.ingredients where id=${id}
        and company_id=${session.company_id} and outlet_id=${session.outlet_id} for update`);
      if (!previous) throw new Error("Bahan baku tidak ditemukan");
      if (stock_quantity !== undefined && Number(stock_quantity) !== Number(previous.stock_quantity)) {
        if (!Number.isFinite(stock_quantity) || stock_quantity < 0) throw new Error("Stok harus angka nonnegatif");
        const feature = await checkFeature(tx, session.company_id, "inventory_advanced");
        if (!feature.allowed) throw Object.assign(new Error("Perubahan stok memerlukan fitur inventori lanjutan"), { status: 403 });
        await adjustStock(tx, { companyId: session.company_id, outletId: session.outlet_id, ingredientId: id,
          userId: session.user_id, quantity: stock_quantity, note: "Perubahan stok melalui data bahan" });
      }
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (unit !== undefined) updates.unit = unit;
      if (min_stock_alert !== undefined) updates.min_stock_alert = min_stock_alert;
      if (cost_per_unit !== undefined) updates.cost_per_unit = cost_per_unit;
      if (is_active !== undefined) updates.is_active = is_active;
      if (Object.keys(updates).length) checked(await tx.from("ingredients").update(updates).eq("id", id));
      return checked(await tx.from("ingredients").select().eq("id", id).single());
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memperbarui bahan" }, { status: Number((error as { status?: number }).status) || 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID bahan baku wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("ingredients")
    .delete()
    .eq("id", id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
