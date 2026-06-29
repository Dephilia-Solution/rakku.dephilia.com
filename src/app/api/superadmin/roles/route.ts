import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      .from("roles")
      .select("*")
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
    const { company_id, name } = await request.json();
    const { data, error } = await supabase
      .from("roles")
      .insert({ company_id, name })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
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

    const { name } = await request.json();
    const { error } = await supabase.from("roles").update({ name }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await requireSuperadmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { error } = await supabase.from("roles").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
