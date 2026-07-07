import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";
import bcrypt from "bcryptjs";

function requireSuperadmin() {
  const supabase = createClient();
  return supabase.then((s) => s.auth.getUser()).then(({ data }) => {
    if (!data?.user) throw new Error("Unauthorized");
  });
}

export async function GET() {
  try {
    await requireSuperadmin();
    const supabase = await createClient();
    const { data } = await supabase.from("companies").select("*").order("name");
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperadmin();
    const { code, name, password } = await request.json();
    const password_hash = await bcrypt.hash(password, 10);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("companies")
      .insert({ code: code.toUpperCase(), name, password_hash })
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
    if (body.code) updates.code = body.code.toUpperCase();
    if (body.status) updates.status = body.status;
    if (body.password) updates.password_hash = await bcrypt.hash(body.password, 10);

    const supabase = await createClient();
    const { error } = await supabase.from("companies").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
