import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
type TenantScope = { company_id: string; outlet_id: string };

// product_recipes tidak punya kolom company_id/outlet_id — scoping
// diverifikasi lewat tabel products (dan ingredients untuk insert).
async function verifyTenantProduct(
  supabase: SupabaseAdmin,
  session: TenantScope,
  productId: string
) {
  const { data } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .single();
  return data !== null;
}

export async function GET(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id");

  if (!productId) {
    return NextResponse.json({ error: "product_id wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (!(await verifyTenantProduct(supabase, session, productId))) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("product_recipes")
    .select("*, ingredients(name, unit)")
    .eq("product_id", productId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { product_id, ingredient_id, quantity_used } = body;

  if (!product_id || !ingredient_id || quantity_used === undefined) {
    return NextResponse.json(
      { error: "Produk, bahan baku, dan jumlah wajib diisi" },
      { status: 400 }
    );
  }

  if (Number(quantity_used) <= 0) {
    return NextResponse.json({ error: "Jumlah harus lebih dari 0" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (!(await verifyTenantProduct(supabase, session, product_id))) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  const { data: ingredient } = await supabase
    .from("ingredients")
    .select("id")
    .eq("id", ingredient_id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .single();

  if (!ingredient) {
    return NextResponse.json({ error: "Bahan baku tidak ditemukan" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("product_recipes")
    .insert({ product_id, ingredient_id, quantity_used })
    .select("*, ingredients(name, unit)")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Bahan baku sudah ada di resep produk ini" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID resep wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Ambil product_id dulu untuk verifikasi tenant sebelum hapus.
  const { data: recipe } = await supabase
    .from("product_recipes")
    .select("product_id")
    .eq("id", id)
    .single();

  if (!recipe || !(await verifyTenantProduct(supabase, session, recipe.product_id))) {
    return NextResponse.json({ error: "Resep tidak ditemukan" }, { status: 404 });
  }

  const { error } = await supabase.from("product_recipes").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
