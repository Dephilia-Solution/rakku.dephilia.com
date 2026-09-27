import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";

function requireSuperadmin() {
  return createClient().then((s) => s.auth.getUser()).then(({ data }) => {
    if (!data?.user) throw new Error("Unauthorized");
  });
}

export async function GET() {
  try {
    await requireSuperadmin();
    const supabase = await createClient();
    const { data } = await supabase.from("menus").select("*").order("sort_order");
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperadmin();
    const { slug, name, icon, path, sort_order } = await request.json();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("menus")
      .insert({ slug, name, icon: icon || null, path, sort_order: sort_order ?? 0 })
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
    const supabase = await createClient();
    const { error } = await supabase.from("menus").update(body).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireSuperadmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from("menus").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
