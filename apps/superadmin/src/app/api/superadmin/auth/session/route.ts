import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/require-superadmin";
export async function GET() {
  const user = await getAuthorizedUser();
  return NextResponse.json({ session_id: user?.id ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
