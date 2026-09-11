import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { listBalanceTransactions } from "@rakku/ledger";

export async function GET(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const supabase = createAdminClient();
  const transactions = await listBalanceTransactions(supabase, session.company_id, {
    limit,
    offset,
  });

  return NextResponse.json({ transactions, limit, offset });
}
