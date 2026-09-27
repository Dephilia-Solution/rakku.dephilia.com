import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { deleteFile } from "@rakku/silos-client";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function DELETE(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");

  if (!productId) {
    return NextResponse.json(
      { error: "productId wajib diisi" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("id, company_id, image_silo_id")
    .eq("id", productId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  if (
    session.company_id &&
    product.company_id &&
    session.company_id !== product.company_id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (product.image_silo_id) {
    try {
      await deleteFile(product.image_silo_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hapus file gagal";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_silo_id: null, image_url: null })
    .eq("id", productId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
