import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function GET() {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: tiers, error: tiersError } = await supabase
    .from("pricing_tiers")
    .select("*")
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .order("sort_order", { ascending: true });

  if (tiersError) {
    return NextResponse.json({ error: tiersError.message }, { status: 500 });
  }

  const tierIds = tiers?.map((t) => t.id) ?? [];

  let productTierPrices: { id: string; product_id: string; tier_id: string; price: number }[] = [];
  let modifierTierPrices: { id: string; modifier_id: string; tier_id: string; price_delta: number }[] = [];
  if (tierIds.length > 0) {
    const { data: ptp, error: ptpError } = await supabase
      .from("product_tier_prices")
      .select("*")
      .in("tier_id", tierIds);

    if (ptpError) {
      return NextResponse.json({ error: ptpError.message }, { status: 500 });
    }

    productTierPrices = ptp ?? [];

    const { data: mtp, error: mtpError } = await supabase
      .from("modifier_tier_prices")
      .select("*")
      .in("tier_id", tierIds);

    if (mtpError) {
      return NextResponse.json({ error: mtpError.message }, { status: 500 });
    }

    modifierTierPrices = mtp ?? [];
  }

  return NextResponse.json({
    tiers: tiers ?? [],
    productTierPrices,
    modifierTierPrices,
  });
}

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, slug, sort_order } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Nama dan slug wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("pricing_tiers")
    .insert({
      company_id: session.company_id,
      outlet_id: session.outlet_id,
      name,
      slug,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-insert product_tier_prices for all active products at this outlet
  const { data: products } = await supabase
    .from("products")
    .select("id, price")
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .eq("is_active", true);

  if (products && products.length > 0) {
    const tierPrices = products.map((p) => ({
      product_id: p.id,
      tier_id: data.id,
      price: p.price,
    }));

    await supabase.from("product_tier_prices").insert(tierPrices);
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, slug, is_active, sort_order } = body;

  if (!id) {
    return NextResponse.json({ error: "ID tier wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (slug !== undefined) updates.slug = slug;
  if (is_active !== undefined) updates.is_active = is_active;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data, error } = await supabase
    .from("pricing_tiers")
    .update(updates)
    .eq("id", id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID tier wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("pricing_tiers")
    .delete()
    .eq("id", id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
