import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import type { OwnerSession } from "@rakku/shared-types";
import { verifyOutletBelongsToCompany } from "@/lib/supabase/queries.data";

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
  const outletId = searchParams.get("outlet_id");

  if (!outletId) {
    return NextResponse.json({ error: "outlet_id wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("company_id", session.company_id)
    .eq("outlet_id", outletId)
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ categories: data ?? [] });
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
  const { outlet_id, name } = body ?? {};

  if (!outlet_id || !(await verifyOutletBelongsToCompany(String(outlet_id), session.company_id))) {
    return NextResponse.json({ error: "Outlet tidak valid" }, { status: 400 });
  }
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("categories")
    .select("sort_order")
    .eq("company_id", session.company_id)
    .eq("outlet_id", String(outlet_id))
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSort = ((existing?.[0]?.sort_order as number) ?? 0) + 1;

  const { data, error } = await supabase
    .from("categories")
    .insert({
      company_id: session.company_id,
      outlet_id: String(outlet_id),
      name: String(name).trim(),
      sort_order: nextSort,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
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
  const { id, name } = body ?? {};

  if (!id || !name || !String(name).trim()) {
    return NextResponse.json({ error: "ID dan nama wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ name: String(name).trim() })
    .eq("id", String(id))
    .eq("company_id", session.company_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const { orders } = body ?? {};

  if (!Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json({ error: "orders harus array of { id, sort_order }" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const promises = orders.map((o: { id: string; sort_order: number }) =>
    supabase
      .from("categories")
      .update({ sort_order: o.sort_order })
      .eq("id", o.id)
      .eq("company_id", session.company_id)
  );
  const results = await Promise.all(promises);
  const err = results.find((r) => r.error);
  if (err) {
    return NextResponse.json({ error: err.error!.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
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
    return NextResponse.json({ error: "ID kategori wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("company_id", session.company_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
