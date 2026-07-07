import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";
import bcrypt from "bcryptjs";

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Unauthorized");
  return supabase;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await requireSuperadmin();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("company_id");
    if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });

    const { data } = await supabase
      .from("users")
      .select("*, roles(name), companies(name)")
      .eq("company_id", companyId)
      .order("name");
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await requireSuperadmin();
    const { company_id, role_id, name, username, pin, all_outlets, outlet_ids } = await request.json();

    const pin_hash = await bcrypt.hash(pin, 10);

    const { data: user, error } = await supabase
      .from("users")
      .insert({ company_id, role_id, name, username, pin_hash, all_outlets: all_outlets ?? false })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (outlet_ids && outlet_ids.length > 0) {
      const assignments = outlet_ids.map((oid: string) => ({ user_id: user.id, outlet_id: oid }));
      const { error: outletError } = await supabase.from("user_outlets").insert(assignments);
      if (outletError) return NextResponse.json({ error: outletError.message }, { status: 400 });
    }

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await requireSuperadmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name) updates.name = body.name;
    if (body.username) updates.username = body.username;
    if (body.role_id) updates.role_id = body.role_id;
    if (body.status) updates.status = body.status;
    if (body.all_outlets !== undefined) updates.all_outlets = body.all_outlets;
    if (body.pin) updates.pin_hash = await bcrypt.hash(body.pin, 10);

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from("users").update(updates).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (body.outlet_ids) {
      await supabase.from("user_outlets").delete().eq("user_id", id);
      if (body.outlet_ids.length > 0) {
        const assignments = body.outlet_ids.map((oid: string) => ({ user_id: id, outlet_id: oid }));
        const { error } = await supabase.from("user_outlets").insert(assignments);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
