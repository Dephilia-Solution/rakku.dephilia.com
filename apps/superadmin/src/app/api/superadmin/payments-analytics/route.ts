import { NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";

function requireSuperadmin() {
  const supabase = createClient();
  return supabase.then((s) => s.auth.getUser()).then(({ data }) => {
    if (!data?.user) throw new Error("Unauthorized");
    return data.user;
  });
}

export async function GET() {
  try {
    await requireSuperadmin();
    const supabase = await createClient();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const fourteenDaysAgo = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const [
      creditsResult,
      intentsCountResult,
      intentsMonthCountResult,
      dailyResult,
      balancesResult,
      withdrawalsResult,
    ] = await Promise.all([
      supabase
        .from("balance_transactions")
        .select("amount, fee_amount, created_at")
        .eq("type", "sale_credit"),
      supabase
        .from("payment_intents")
        .select("id", { count: "exact", head: true })
        .eq("status", "success"),
      supabase
        .from("payment_intents")
        .select("id", { count: "exact", head: true })
        .eq("status", "success")
        .gte("paid_at", monthStart.toISOString()),
      supabase
        .from("payment_intents")
        .select("amount, paid_at")
        .eq("status", "success")
        .gte("paid_at", fourteenDaysAgo.toISOString()),
      supabase
        .from("merchant_balances")
        .select("available_balance, pending_balance"),
      supabase
        .from("withdrawals")
        .select("amount, status"),
    ]);

    const credits = creditsResult.data ?? [];
    const qrisGrossAll = credits.reduce(
      (sum, row) => sum + Number(row.amount) + Number(row.fee_amount),
      0
    );
    const mdrAll = credits.reduce(
      (sum, row) => sum + Number(row.fee_amount),
      0
    );

    const monthCredits = credits.filter(
      (row) => new Date(row.created_at as string) >= monthStart
    );
    const qrisGrossMonth = monthCredits.reduce(
      (sum, row) => sum + Number(row.amount) + Number(row.fee_amount),
      0
    );
    const mdrMonth = monthCredits.reduce(
      (sum, row) => sum + Number(row.fee_amount),
      0
    );

    const balances = balancesResult.data ?? [];
    const saldoAvailable = balances.reduce(
      (sum, row) => sum + Number(row.available_balance),
      0
    );
    const saldoPending = balances.reduce(
      (sum, row) => sum + Number(row.pending_balance),
      0
    );

    const withdrawals = withdrawalsResult.data ?? [];
    const withdrawnTotal = withdrawals
      .filter((row) => row.status === "completed")
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const withdrawalPending = withdrawals.filter((row) =>
      ["requested", "processing"].includes(row.status as string)
    ).length;

    const dailyMap = new Map<string, { gross: number; count: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dailyMap.set(d.toISOString().slice(0, 10), { gross: 0, count: 0 });
    }
    for (const intent of dailyResult.data ?? []) {
      if (!intent.paid_at) continue;
      const key = String(intent.paid_at).slice(0, 10);
      const entry = dailyMap.get(key);
      if (!entry) continue;
      entry.gross += Number(intent.amount);
      entry.count += 1;
    }

    const daily = Array.from(dailyMap.entries()).map(([date, value]) => ({
      date,
      gross: value.gross,
      count: value.count,
    }));

    return NextResponse.json({
      totals: {
        qrisCount: intentsCountResult.count ?? 0,
        qrisGross: qrisGrossAll,
        mdr: mdrAll,
        saldoAvailable,
        saldoPending,
        withdrawnTotal,
        withdrawalPending,
      },
      month: {
        qrisCount: intentsMonthCountResult.count ?? 0,
        qrisGross: qrisGrossMonth,
        mdr: mdrMonth,
      },
      daily,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
