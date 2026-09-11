import { NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { getBalance, listBalanceTransactions } from "@rakku/ledger";

export async function GET() {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();
  const [balance, transactions] = await Promise.all([
    getBalance(supabase, session.company_id),
    listBalanceTransactions(supabase, session.company_id, { limit: 10 }),
  ]);

  return NextResponse.json({ balance, transactions });
}
