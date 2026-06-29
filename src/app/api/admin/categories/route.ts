import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
