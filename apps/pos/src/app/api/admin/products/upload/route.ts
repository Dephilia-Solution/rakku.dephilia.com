import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { uploadFile } from "@rakku/silos-client";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import sharp from "sharp";

const MAX_WIDTH = 800;
const WEBP_QUALITY = 80;

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const productId = formData.get("productId") as string | null;

  if (!file || !productId) {
    return NextResponse.json({ error: "File dan productId wajib diisi" }, { status: 400 });
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "Format file harus JPG, PNG, atau WebP" }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Ukuran file maksimal 2MB" }, { status: 400 });
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

    const supabase = createAdminClient();
    const uploadedFile = await uploadFile({
      file: compressedBuffer,
      filename: `${productId}-${Date.now()}.webp`,
      contentType: "image/webp",
    });

    const { error: updateError } = await supabase
      .from("products")
      .update({ image_url: uploadedFile.url, image_silo_id: uploadedFile.id })
      .eq("id", productId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ url: uploadedFile.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload gagal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
