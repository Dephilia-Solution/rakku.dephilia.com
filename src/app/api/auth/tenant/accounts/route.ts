import { NextResponse } from "next/server";
import { getPendingLoginFromCookies } from "@/lib/auth/pending-login";
import { getAccountsForOutlet } from "@/lib/auth/company";

export async function GET() {
  const pending = await getPendingLoginFromCookies();

  if (!pending || !pending.outlet_id) {
    return NextResponse.json({ error: "Sesi login tidak ditemukan" }, { status: 401 });
  }

  const accounts = await getAccountsForOutlet(pending.company_id, pending.outlet_id);

  return NextResponse.json({ accounts, outlet_name: pending.outlet_name });
}
