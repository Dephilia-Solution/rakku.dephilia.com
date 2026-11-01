import { NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";

export async function GET() {
  const session = await getOwnerSessionFromCookies();

  if (!session) {
    return NextResponse.json({ owner: null }, { headers: { "Cache-Control": "private, no-store" } });
  }

  return NextResponse.json({
    owner: {
      session_id: session.session_id,
      id: session.owner_id,
      email: session.email,
      name: session.name,
      phone: session.phone,
      company_id: session.company_id,
      company_name: session.company_name,
      company_slug: session.company_slug,
      company_code: session.company_code,
      has_company: !!session.company_id,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
