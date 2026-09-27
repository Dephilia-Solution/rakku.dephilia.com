import { NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";

function requireSuperadmin() {
  const supabase = createClient();
  return supabase.then((s) => s.auth.getUser()).then(({ data }) => {
    if (!data?.user) throw new Error("Unauthorized");
  });
}

function embedded<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET() {
  try {
    await requireSuperadmin();
    const supabase = await createClient();

    const [
      invoicesResult,
      activeResult,
      trialResult,
      pendingResult,
      companiesResult,
      logsResult,
    ] = await Promise.all([
      supabase
        .from("subscription_invoices")
        .select("*, companies(name, code), plans(name, slug)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("subscription_status", "active"),
      supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("subscription_status", "trial"),
      supabase
        .from("subscription_invoices")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("companies").select("id, plans(name, slug)"),
      supabase
        .from("notification_logs")
        .select("company_id, type")
        .limit(5000),
    ]);

    const invoices = invoicesResult.data ?? [];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const paidInvoices = invoices.filter(
      (invoice) => invoice.status === "success" && invoice.paid_at
    );

    const paidThisMonth = paidInvoices
      .filter((invoice) => new Date(invoice.paid_at as string) >= monthStart)
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const revenueLast30Days = paidInvoices
      .filter(
        (invoice) => new Date(invoice.paid_at as string) >= thirtyDaysAgo
      )
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0);

    // Analytics konversi
    const companies = companiesResult.data ?? [];
    const planDistribution: Record<string, number> = {};
    for (const company of companies) {
      const plan = embedded(
        company.plans as { name: string; slug: string } | { name: string; slug: string }[] | null
      );
      const slug = plan?.slug ?? "none";
      planDistribution[slug] = (planDistribution[slug] ?? 0) + 1;
    }

    const logs = logsResult.data ?? [];
    const trialCompanies = new Set(
      logs.filter((log) => log.type === "trial_started").map((log) => log.company_id)
    );
    const limitCompanies = new Set(
      logs
        .filter((log) => log.type === "limit_80" || log.type === "limit_100")
        .map((log) => log.company_id)
    );
    const paidCompanies = new Set(
      paidInvoices.map((invoice) => invoice.company_id as string)
    );

    const trialConverted = Array.from(trialCompanies).filter((id) =>
      paidCompanies.has(id)
    ).length;
    const limitConverted = Array.from(limitCompanies).filter((id) =>
      paidCompanies.has(id)
    ).length;

    return NextResponse.json({
      invoices,
      summary: {
        paidThisMonth,
        activeSubscriptions: activeResult.count ?? 0,
        trialCompanies: trialResult.count ?? 0,
        pendingInvoices: pendingResult.count ?? 0,
      },
      analytics: {
        planDistribution,
        trialStarted: trialCompanies.size,
        trialConverted,
        limitHit: limitCompanies.size,
        limitConverted,
        revenueLast30Days,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
