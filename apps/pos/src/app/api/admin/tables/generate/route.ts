import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const count = body?.count;

  if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
    return NextResponse.json({ error: "Jumlah meja harus bilangan bulat >= 1" }, { status: 400 });
  }

  if (count > 100) {
    return NextResponse.json({ error: "Maksimal 100 meja per generate" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("dining_tables")
    .select("name")
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let maxNumber = 0;
  for (const row of existing ?? []) {
    const match = /^Meja (\d+)$/.exec((row.name ?? "").trim());
    if (match) {
      const num = Number(match[1]);
      if (num > maxNumber) maxNumber = num;
    }
  }

  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      company_id: session.company_id,
      outlet_id: session.outlet_id,
      name: `Meja ${maxNumber + i + 1}`,
    });
  }

  const { data, error } = await supabase
    .from("dining_tables")
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], { status: 201 });
}
