import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";
import {
  computeExpectedNet,
  getReconciliationSummary,
} from "@/lib/reconciliation";

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

    const [reportsResult, summary] = await Promise.all([
      supabase
        .from("settlement_reports")
        .select("*")
        .order("period_end", { ascending: false })
        .limit(50),
      getReconciliationSummary(supabase),
    ]);

    return NextResponse.json({
      reports: reportsResult.data ?? [],
      summary,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSuperadmin();
    const body = await request.json().catch(() => null);

    const provider = String(body?.provider ?? "vessel").trim() || "vessel";
    const periodStart = String(body?.period_start ?? "").trim();
    const periodEnd = String(body?.period_end ?? "").trim();
    const grossAmount = Number(body?.gross_amount);
    const mdrAmount = Number(body?.mdr_amount);
    const note = body?.note ? String(body.note).trim() : null;

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "Periode settlement wajib diisi" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(grossAmount) || grossAmount < 0) {
      return NextResponse.json(
        { error: "Nominal gross tidak valid" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(mdrAmount) || mdrAmount < 0) {
      return NextResponse.json(
        { error: "Nominal MDR tidak valid" },
        { status: 400 }
      );
    }
    if (new Date(periodStart) > new Date(periodEnd)) {
      return NextResponse.json(
        { error: "Tanggal mulai tidak boleh melebihi tanggal akhir" },
        { status: 400 }
      );
    }

    const netAmount = grossAmount - mdrAmount;

    const supabase = await createClient();
    const expectedNet = await computeExpectedNet(
      supabase,
      periodStart,
      periodEnd
    );
    const difference = netAmount - expectedNet;

    const { data, error } = await supabase
      .from("settlement_reports")
      .insert({
        provider,
        period_start: periodStart,
        period_end: periodEnd,
        gross_amount: grossAmount,
        mdr_amount: mdrAmount,
        net_amount: netAmount,
        expected_net: expectedNet,
        difference,
        note,
        created_by: user.email ?? user.id,
      })
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Gagal menyimpan rekonsiliasi" },
        { status: 500 }
      );
    }

    return NextResponse.json({ report: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
