import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/auth/database";

const NUMERIC_FIELDS = [
  "price_monthly",
  "price_yearly",
  "max_outlets",
  "max_employees",
  "max_products",
  "max_ingredients",
  "max_transactions_month",
  "report_history_days",
  "email_reports_month",
  "storage_mb",
  "sort_order",
] as const;

function buildPayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  if (body.slug !== undefined) {
    payload.slug = String(body.slug).trim().toLowerCase();
  }
  if (body.name !== undefined) {
    payload.name = String(body.name).trim();
  }
  if (body.description !== undefined) {
    payload.description = body.description ? String(body.description) : null;
  }
  for (const field of NUMERIC_FIELDS) {
    if (body[field] !== undefined) {
      payload[field] = Number(body[field]) || 0;
    }
  }
  if (
    body.features !== undefined &&
    body.features !== null &&
    typeof body.features === "object"
  ) {
    payload.features = body.features;
  }
  if (body.is_active !== undefined) {
    payload.is_active = Boolean(body.is_active);
  }

  return payload;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const payload = buildPayload(body);

    if (!payload.slug || !payload.name) {
      return NextResponse.json(
        { error: "Slug dan nama plan harus diisi" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("plans")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const body = await request.json();
    const payload = buildPayload(body);

    const { error } = await supabase
      .from("plans")
      .update(payload)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const { count } = await supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", id);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Plan masih dipakai company. Pindahkan dulu company-nya." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
