import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import type { OwnerSession } from "@rakku/shared-types";

type OwnerWithCompany = OwnerSession & { company_id: string };

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

// product_recipes tidak punya kolom company_id/outlet_id — scoping
// diverifikasi lewat tabel products (dan ingredients untuk insert),
// konsisten dengan pola /api/admin/recipes di apps/pos.
async function verifyTenantProduct(
  supabase: SupabaseAdmin,
  session: OwnerWithCompany,
  productId: string
) {
  const { data } = await supabase
    .from("products")
    .select("id, outlet_id")
    .eq("id", productId)
    .eq("company_id", session.company_id)
    .single();
  return data ? { product: true, outlet_id: (data as { outlet_id: string }).outlet_id } : { product: false, outlet_id: null };
}

export async function GET(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Anda belum memiliki perusahaan" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id");

  if (!productId) {
    return NextResponse.json({ error: "product_id wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: recipes, error } = await supabase
    .from("product_recipes")
    .select("*, ingredients(name, unit), products!inner(company_id)")
    .eq("product_id", productId)
    .eq("products.company_id", session.company_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(recipes ?? []);
}

export async function POST(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Anda belum memiliki perusahaan" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

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

  const tenant = await verifyTenantProduct(supabase, session, String(product_id));
  if (!tenant.product || !tenant.outlet_id) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  const { data: ingredient } = await supabase
    .from("ingredients")
    .select("id")
    .eq("id", ingredient_id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", tenant.outlet_id)
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
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Anda belum memiliki perusahaan" }, { status: 403 });
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

  if (!recipe) {
    return NextResponse.json({ error: "Resep tidak ditemukan" }, { status: 404 });
  }

  const tenant = await verifyTenantProduct(
    supabase,
    session,
    (recipe as { product_id: string }).product_id
  );
  if (!tenant.product) {
    return NextResponse.json({ error: "Resep tidak ditemukan" }, { status: 404 });
  }

  const { error } = await supabase.from("product_recipes").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
