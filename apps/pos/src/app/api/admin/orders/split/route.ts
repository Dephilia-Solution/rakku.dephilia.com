import { NextResponse } from "next/server";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { AccessDeniedError, assertApiAccess } from "@/lib/auth/authorize";
export async function POST() {
  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertApiAccess(session, "/api/admin/orders/split", "POST");
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  return NextResponse.json({ error: "Split pembayaran harus disimpan bersamaan saat checkout atau penyelesaian draft." }, { status: 409 });
}
