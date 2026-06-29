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

    const { data: roles } = await supabase
      .from("roles")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");

    const { data: menus } = await supabase
      .from("menus")
      .select("*")
      .order("sort_order");

    const { data: access } = await supabase
      .from("role_menu_access")
      .select("*");

    return NextResponse.json({
      roles: roles ?? [],
      menus: menus ?? [],
      access: access ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await requireSuperadmin();
    const { role_id, menu_id, can_view } = await request.json();

    if (can_view) {
      const { error } = await supabase
        .from("role_menu_access")
        .upsert(
          { role_id, menu_id, can_view: true },
          { onConflict: "role_id, menu_id" }
        );
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { error } = await supabase
        .from("role_menu_access")
        .delete()
        .eq("role_id", role_id)
        .eq("menu_id", menu_id);
      if (error && error.code !== "PGRST116")
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
