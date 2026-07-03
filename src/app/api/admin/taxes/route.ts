import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function GET() {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("taxes")
    .select("*")
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .order("sort_order", { ascending: true });

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
  const { name, type, value, sort_order } = body;

  if (!name || !type || value === undefined) {
    return NextResponse.json({ error: "Nama, tipe, dan nilai wajib diisi" }, { status: 400 });
  }

  if (!["percentage", "fixed"].includes(type)) {
    return NextResponse.json({ error: "Tipe harus percentage atau fixed" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("taxes")
    .insert({
      company_id: session.company_id,
      outlet_id: session.outlet_id,
      name,
      type,
      value,
      sort_order: sort_order ?? 0,
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
  const { id, name, type, value, is_active, sort_order } = body;

  if (!id) {
    return NextResponse.json({ error: "ID tax wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (value !== undefined) updates.value = value;
  if (is_active !== undefined) updates.is_active = is_active;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data, error } = await supabase
    .from("taxes")
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
    return NextResponse.json({ error: "ID tax wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("taxes")
    .delete()
    .eq("id", id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
