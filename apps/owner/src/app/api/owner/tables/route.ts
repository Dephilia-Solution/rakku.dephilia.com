import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@rakku/shared-types";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

export async function GET(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const outletId = searchParams.get("outlet_id") || undefined;

  const supabase = createAdminClient();
  let query = supabase
    .from("dining_tables")
    .select("*, outlets!inner(name)")
    .eq("company_id", session.company_id)
    .order("name", { ascending: true });

  if (outletId) {
    query = query.eq("outlet_id", outletId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tables = (data ?? []).map((t) => ({
    ...t,
    outlet_name: (t.outlets as { name: string } | null)?.name ?? null,
    outlets: undefined,
  }));

  return NextResponse.json({ tables });
}

export async function POST(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { name, outlet_id } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Nama meja wajib diisi" }, { status: 400 });
  }

  if (!outlet_id || typeof outlet_id !== "string") {
    return NextResponse.json({ error: "Outlet wajib dipilih" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: outlet } = await supabase
    .from("outlets")
    .select("id")
    .eq("id", outlet_id)
    .eq("company_id", session.company_id)
    .maybeSingle();

  if (!outlet) {
    return NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("dining_tables")
    .insert({
      company_id: session.company_id,
      outlet_id,
      name: name.trim(),
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Gagal membuat meja" },
      { status: 500 }
    );
  }

  return NextResponse.json({ table: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { id, name, status } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID meja wajib diisi" }, { status: 400 });
  }

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return NextResponse.json({ error: "Nama meja wajib diisi" }, { status: 400 });
  }

  if (
    status !== undefined &&
    status !== "available" &&
    status !== "occupied"
  ) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (status !== undefined) updates.status = status;

  const { data, error } = await supabase
    .from("dining_tables")
    .update(updates)
    .eq("id", id)
    .eq("company_id", session.company_id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Gagal mengupdate meja" },
      { status: 500 }
    );
  }

  return NextResponse.json({ table: data });
}

export async function DELETE(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID meja wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("dining_tables")
    .delete()
    .eq("id", id)
    .eq("company_id", session.company_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}