import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import sharp from "sharp";

const BUCKET = "product-images";
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

    const filePath = `${productId}/${Date.now()}.webp`;

    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, compressedBuffer, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload gagal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
