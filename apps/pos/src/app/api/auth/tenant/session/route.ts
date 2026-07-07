import { NextResponse } from "next/server";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function GET() {
  const session = await getTenantSessionFromCookies();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user_id: session.user_id,
    company_id: session.company_id,
    outlet_id: session.outlet_id,
    role_id: session.role_id,
    user_name: session.user_name,
    company_name: session.company_name,
    outlet_name: session.outlet_name,
  });
}
