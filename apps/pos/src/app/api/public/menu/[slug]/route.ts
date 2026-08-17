import { NextResponse } from "next/server";
import { getPublicMenuBySlug } from "@/lib/supabase/queries.server";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;

  if (!slug || !slug.trim()) {
    return NextResponse.json({ error: "Slug wajib diisi" }, { status: 400 });
  }

  const menu = await getPublicMenuBySlug(slug);

  if (!menu) {
    return NextResponse.json({ error: "Menu tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(menu);
}