import { NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets, generateSlug } from "@/lib/supabase/queries.owner";

function slugSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function GET() {
  const session = await getOwnerSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.company_id) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();
  const outlets = await getOwnerOutlets(session.company_id);

  const posBaseUrl =
    (process.env.NEXT_PUBLIC_POS_URL ?? "http://localhost:3001").replace(/\/$/, "");

  const result: {
    id: string;
    name: string;
    qr_menu_slug: string;
    menu_url: string;
  }[] = [];

  for (const outlet of outlets) {
    let slug = outlet.qr_menu_slug;

    if (!slug) {
      const base = generateSlug(outlet.name) || "menu";
      slug = `${base}-${slugSuffix()}`;
      const { data: updated, error } = await supabase
        .from("outlets")
        .update({ qr_menu_slug: slug })
        .eq("id", outlet.id)
        .eq("company_id", session.company_id)
        .select("qr_menu_slug")
        .single();

      if (error || !updated?.qr_menu_slug) {
        continue;
      }
      slug = updated.qr_menu_slug;
    }

    const finalSlug = slug as string;
    result.push({
      id: outlet.id,
      name: outlet.name,
      qr_menu_slug: finalSlug,
      menu_url: `${posBaseUrl}/menu/${finalSlug}`,
    });
  }

  return NextResponse.json({ posBaseUrl, outlets: result });
}