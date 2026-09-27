import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";
import { listBalanceTransactions } from "@rakku/ledger";

function requireSuperadmin() {
  const supabase = createClient();
  return supabase.then((s) => s.auth.getUser()).then(({ data }) => {
    if (!data?.user) throw new Error("Unauthorized");
  });
}

interface BalanceRow {
  available_balance: number;
  pending_balance: number;
  total_credited: number;
  total_fees: number;
  total_withdrawn: number;
}

function embedded<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperadmin();
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("company_id");
    const supabase = await createClient();

    if (companyId) {
      const transactions = await listBalanceTransactions(supabase, companyId, {
        limit: 50,
      });
      return NextResponse.json({ transactions });
    }

    const { data, error } = await supabase
      .from("companies")
      .select("id, name, code, merchant_balances(*)")
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const balances = (data ?? []).map((company) => {
      const balance = embedded(company.merchant_balances as unknown) as
        | BalanceRow
        | null;
      return {
        company_id: company.id as string,
        name: company.name as string,
        code: company.code as string,
        available_balance: Number(balance?.available_balance ?? 0),
        pending_balance: Number(balance?.pending_balance ?? 0),
        total_credited: Number(balance?.total_credited ?? 0),
        total_fees: Number(balance?.total_fees ?? 0),
        total_withdrawn: Number(balance?.total_withdrawn ?? 0),
      };
    });

    const totals = balances.reduce(
      (acc, row) => ({
        available: acc.available + row.available_balance,
        pending: acc.pending + row.pending_balance,
        credited: acc.credited + row.total_credited,
        fees: acc.fees + row.total_fees,
        withdrawn: acc.withdrawn + row.total_withdrawn,
      }),
      { available: 0, pending: 0, credited: 0, fees: 0, withdrawn: 0 }
    );

    return NextResponse.json({ balances, totals });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
