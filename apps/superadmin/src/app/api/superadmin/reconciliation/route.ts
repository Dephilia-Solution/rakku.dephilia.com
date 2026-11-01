import { NextRequest, NextResponse } from "next/server";
import { sql } from "@rakku/db";
import { recordSettlementReport } from "@rakku/ledger/settlement";
import { createClient } from "@/lib/auth/database";
import { getReconciliationSummary } from "@/lib/reconciliation";

export async function GET() {
  try {
    const supabase = await createClient();

    const [reportsResult, summary] = await Promise.all([
      supabase
        .from("settlement_reports")
        .select("*")
        .order("period_end", { ascending: false })
        .limit(50),
      getReconciliationSummary(supabase),
    ]);

    const paymentExceptions = await supabase.execute(sql`select intent_id,company_id,order_id,amount,reason,
      status,assigned_to,resolution_type,resolved_by,resolution_note,resolution_reference,proof_url,created_at,resolved_at
      from app_private.payment_reconciliation where resolved_at is null order by created_at limit 100`);
    const uncertainAttempts = await supabase.from("payment_intents").select("id,company_id,order_id,invoice_number,amount,created_at")
      .eq("status", "pending").is("provider_transaction_id", null).order("created_at").limit(100);
    return NextResponse.json({
      paymentExceptions, uncertainAttempts: uncertainAttempts.data ?? [],
      reports: reportsResult.data ?? [],
      summary,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json().catch(() => null);

    const provider = String(body?.provider ?? "vessel").trim() || "vessel";
    const providerReference = body?.provider_reference ? String(body.provider_reference).trim() : null;
    const periodStart = String(body?.period_start ?? "").trim();
    const periodEnd = String(body?.period_end ?? "").trim();
    const grossAmount = Number(body?.gross_amount);
    const mdrAmount = Number(body?.mdr_amount);
    const note = body?.note ? String(body.note).trim() : null;

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: "Periode settlement wajib diisi" }, { status: 400 });
    }
    if (!Number.isFinite(grossAmount) || grossAmount < 0
      || !Number.isFinite(mdrAmount) || mdrAmount < 0 || mdrAmount > grossAmount) {
      return NextResponse.json({ error: "Nominal settlement tidak valid" }, { status: 400 });
    }

    try {
      const result = await recordSettlementReport(supabase, {
        provider, providerReference, periodStart, periodEnd,
        grossAmount, mdrAmount, note, actor: user.email ?? user.id,
      });
      return NextResponse.json({
        report: result.report,
        settlement: {
          settled: result.settled,
          expected_net: result.expectedNet,
          difference: result.difference,
          released: result.released,
        },
      }, { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menyimpan rekonsiliasi" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
