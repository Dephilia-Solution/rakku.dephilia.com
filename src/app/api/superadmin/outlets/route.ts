import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function requireSuperadmin() {
  return createClient().then((s) => s.auth.getUser()).then(({ data }) => {
    if (!data?.user) throw new Error("Unauthorized");
  });
}

export async function GET() {
  try {
    await requireSuperadmin();
    const supabase = await createClient();
    const { data } = await supabase
      .from("outlets")
      .select("*, companies(name)")
      .order("name");
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperadmin();
    const { company_id, name, address } = await request.json();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("outlets")
      .insert({ company_id, name, address: address || null })
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
    await requireSuperadmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.name) updates.name = body.name;
    if (body.address !== undefined) updates.address = body.address;
    if (body.status) updates.status = body.status;

    const supabase = await createClient();
    const { error } = await supabase.from("outlets").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
