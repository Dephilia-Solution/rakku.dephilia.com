import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import { uploadFile, deleteFile } from "@rakku/silos-client";
import type { OwnerSession } from "@rakku/shared-types";
import { processProductImage } from "@/lib/import/import-images";
import { readBoundedMultipart } from "@/lib/import/import-http";
export const runtime = "nodejs";

type OwnerWithCompany = OwnerSession & { company_id: string };

export async function POST(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const owner = session as OwnerWithCompany;

  let formData:FormData;
  try{formData=await readBoundedMultipart(request,2*1024*1024+256*1024,["file","productId"]);}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unggahan tidak valid."},{status:400});}
  const file = formData.get("file") as File | null;
  const productId = formData.get("productId") as string | null;

  if (!(file instanceof File) || !productId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(productId)) {
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
     .select("id,outlet_id")
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
      compressedBuffer = (await processProductImage(buffer,file.name)).bytes;
    } catch(error) {
      return NextResponse.json({error:error instanceof Error?error.message:"Gambar tidak valid."},{status:400});
    }

    const uploadedFile = await uploadFile({
      file: compressedBuffer,
      filename: `${productId}-${Date.now()}.webp`,
      contentType: "image/webp",
    });

    const { data:saved,error: updateError } = await supabase
      .from("products")
      .update({ image_url: uploadedFile.url, image_silo_id: uploadedFile.id })
      .eq("id", productId)
       .eq("company_id", owner.company_id).eq("outlet_id",product.outlet_id).select("id").maybeSingle();

    if (updateError || !saved) {
      await deleteFile(uploadedFile.id);
      return NextResponse.json({ error: updateError?.message??"Produk tidak ditemukan saat menyimpan gambar." }, { status: 500 });
    }

    return NextResponse.json({ url: uploadedFile.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload gagal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
