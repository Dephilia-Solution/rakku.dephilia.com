import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@rakku/shared-types";
import { createAdminClient } from "@rakku/db";
import { checkFeature, getCompanyPlan } from "@rakku/plans";
import { jakartaDayStart, jakartaRangeBounds, type ReportRange } from "@rakku/shared-types";

type OwnerWithCompany = OwnerSession & { company_id: string };
type JsonLike = Record<string, unknown>;
const DAY_MS = 24 * 60 * 60 * 1000;

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return null;
  return session as OwnerWithCompany;
}

export async function GET(request: NextRequest) {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: "Anda belum memiliki perusahaan" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const dateRange = (searchParams.get("date_range") || "all") as ReportRange;
  const outletId = searchParams.get("outlet_id") || undefined;
  const supabase = createAdminClient();

  const feature = await checkFeature(supabase, session.company_id, "profit_loss");
  if (!feature.allowed) return NextResponse.json(feature, { status: 403 });

  const resolved = await getCompanyPlan(supabase, session.company_id);
  const bounds = jakartaRangeBounds(dateRange);
  let start = bounds.start;
  let historyLimited = false;
  if (!start && resolved.plan.report_history_days >= 0) {
    const localStart = jakartaDayStart(new Date());
    start = new Date(localStart.getTime() - Math.max(0, resolved.plan.report_history_days - 1) * DAY_MS).toISOString();
    historyLimited = true;
  }

  let orderQuery = supabase
    .from("orders")
    .select("*, order_items(product_id, quantity, cogs_amount)")
    .eq("company_id", session.company_id)
    .eq("status", "completed")
    .eq("payment_status", "paid");
  if (outletId) orderQuery = orderQuery.eq("outlet_id", outletId);
  if (start) orderQuery = orderQuery.gte("created_at", start);
  if (bounds.end) orderQuery = orderQuery.lt("created_at", bounds.end);
  const { data: orders } = await orderQuery.order("created_at", { ascending: false });
  const completedOrders = (orders ?? []) as JsonLike[];

  const totalRevenue = completedOrders.reduce((sum, order) => sum + Number(order.total_price ?? 0), 0);
  const discountAmount = completedOrders.reduce((sum, order) => sum + Number(order.discount_amount ?? 0), 0);
  const taxAmount = completedOrders.reduce((sum, order) => sum + Number(order.tax_amount ?? 0), 0);
  const roundingAmount = completedOrders.reduce((sum, order) => sum + Number(order.rounding_amount ?? 0), 0);

  const productIds = new Set<string>();
  for (const order of completedOrders) {
    for (const item of (order.order_items ?? []) as JsonLike[]) {
      const productId = item.product_id as string;
      if (productId) productIds.add(productId);
    }
  }

  let hppByProduct = new Map<string, number>();
  if (productIds.size > 0) {
    const { data: recipes } = await supabase
      .from("product_recipes")
      .select("product_id, quantity_used, ingredients(cost_per_unit)")
      .in("product_id", Array.from(productIds));
    hppByProduct = new Map<string, number>();
    for (const recipe of (recipes ?? []) as JsonLike[]) {
      const productId = recipe.product_id as string;
      const quantityUsed = Number(recipe.quantity_used ?? 0);
      const unitCost = Number(((recipe.ingredients as JsonLike)?.cost_per_unit ?? 0));
      hppByProduct.set(productId, (hppByProduct.get(productId) ?? 0) + quantityUsed * unitCost);
    }
  }

  let totalHpp = 0;
  let estimatedCogs = 0;
  let estimatedItemCount = 0;
  for (const order of completedOrders) {
    for (const item of (order.order_items ?? []) as JsonLike[]) {
      if (item.cogs_amount == null) {
        const productId = item.product_id as string;
        const estimated = (hppByProduct.get(productId) ?? 0) * Number(item.quantity ?? 0);
        totalHpp += estimated;
        estimatedCogs += estimated;
        estimatedItemCount++;
      } else {
        totalHpp += Number(item.cogs_amount);
      }
    }
  }

  let expenseQuery = supabase.from("expenses").select("amount, expense_date").eq("company_id", session.company_id);
  if (outletId) expenseQuery = expenseQuery.eq("outlet_id", outletId);
  if (start) expenseQuery = expenseQuery.gte("expense_date", start);
  if (bounds.end) expenseQuery = expenseQuery.lt("expense_date", bounds.end);
  const { data: expenses } = await expenseQuery;
  const totalExpenses = (expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

  return NextResponse.json({
    totalRevenue,
    paidRevenue: totalRevenue,
    discountAmount,
    taxAmount,
    roundingAmount,
    totalHpp,
    estimatedCogs,
    hasEstimatedCogs: estimatedItemCount > 0,
    estimatedItemCount,
    grossProfit: totalRevenue - totalHpp,
    totalExpenses,
    netProfit: totalRevenue - totalHpp - totalExpenses,
    totalTransactions: completedOrders.length,
    rangeStart: start,
    rangeEnd: bounds.end,
    historyLimited,
    definitionVersion: "2026-10-17",
  });
}
