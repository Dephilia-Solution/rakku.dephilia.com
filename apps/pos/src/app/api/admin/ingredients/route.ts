import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
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

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (unit !== undefined) updates.unit = unit;
  if (stock_quantity !== undefined) updates.stock_quantity = stock_quantity;
  if (min_stock_alert !== undefined) updates.min_stock_alert = min_stock_alert;
  if (cost_per_unit !== undefined) updates.cost_per_unit = cost_per_unit;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabase
    .from("ingredients")
    .update(updates)
    .eq("id", id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
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
