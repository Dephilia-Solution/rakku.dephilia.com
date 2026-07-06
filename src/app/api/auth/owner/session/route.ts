import { NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerWithCompany } from "@/lib/supabase/queries.owner";

export async function GET() {
  const session = await getOwnerSessionFromCookies();

  if (!session) {
    return NextResponse.json({ owner: null }, { status: 200 });
  }

  // Ambil data company terbaru (mungkin baru saja onboarding)
  const owner = await getOwnerWithCompany(session.owner_id);

  if (!owner) {
    return NextResponse.json({ owner: null }, { status: 200 });
  }

  return NextResponse.json({
    owner: {
      id: owner.id,
      email: owner.email,
      name: owner.name,
      phone: owner.phone,
      company_id: owner.company_id,
      company_name: owner.company_name,
      company_slug: owner.company_slug,
      company_code: owner.company_code,
      has_company: !!owner.company_id,
    },
  });
}
