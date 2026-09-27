import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { uploadFile } from "@rakku/silos-client";
import type { OwnerSession } from "@rakku/shared-types";
import sharp from "sharp";

const MAX_WIDTH = 800;
const WEBP_QUALITY = 80;

type OwnerWithCompany = OwnerSession & { company_id: string };

export async function POST(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const owner = session as OwnerWithCompany;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const productId = formData.get("productId") as string | null;

  if (!file || !productId) {
    return NextResponse.json(
      { error: "File dan productId wajib diisi" },
      { status: 400 }
    );
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json(
      { error: "Format file harus JPG, PNG, atau WebP" },
      { status: 400 }
    );
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Ukuran file maksimal 2MB" },
      { status: 400 }
    );
  }

  // Pastikan produk milik perusahaan owner
  const supabase = createAdminClient();
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("company_id", owner.company_id)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let compressedBuffer: Buffer;
    try {
      compressedBuffer = await sharp(buffer)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch {
      compressedBuffer = buffer;
    }

    const uploadedFile = await uploadFile({
      file: compressedBuffer,
      filename: `${productId}-${Date.now()}.webp`,
      contentType: "image/webp",
    });

    const { error: updateError } = await supabase
      .from("products")
      .update({ image_url: uploadedFile.url, image_silo_id: uploadedFile.id })
      .eq("id", productId)
      .eq("company_id", owner.company_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ url: uploadedFile.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload gagal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
