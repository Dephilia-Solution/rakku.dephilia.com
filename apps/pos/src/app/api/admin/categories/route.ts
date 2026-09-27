import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, company_id, outlet_id } = body;

  if (!name || !company_id || !outlet_id) {
    return NextResponse.json({ error: "Nama, company_id, dan outlet_id harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: max } = await supabase
    .from("categories")
    .select("sort_order")
    .eq("company_id", company_id)
    .eq("outlet_id", outlet_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from("categories")
    .insert({ name, sort_order: (max?.sort_order ?? 0) + 1, company_id, outlet_id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, name } = body;

  if (!id || !name) {
    return NextResponse.json({ error: "ID dan nama kategori harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("categories").update({ name }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { orders } = body;

  if (!Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json({ error: "orders harus array of { id, sort_order }" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const promises = orders.map((o: { id: string; sort_order: number }) =>
    supabase.from("categories").update({ sort_order: o.sort_order }).eq("id", o.id)
  );
  const results = await Promise.all(promises);
  const err = results.find((r) => r.error);
  if (err) {
    return NextResponse.json({ error: err.error!.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID kategori harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
