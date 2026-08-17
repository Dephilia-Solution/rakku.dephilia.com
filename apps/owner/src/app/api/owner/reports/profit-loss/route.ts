import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@rakku/shared-types";
import { createAdminClient } from "@rakku/supabase-clients";

type OwnerWithCompany = OwnerSession & { company_id: string };

type JsonLike = Record<string, unknown>;

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

type DateRange = "today" | "yesterday" | "week" | "all";

function inRange(dateStr: string, dateRange: DateRange): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  if (dateRange === "today") return d.toDateString() === today.toDateString();
  if (dateRange === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return d.toDateString() === y.toDateString();
  }
  if (dateRange === "week") {
    const w = new Date(today);
    w.setDate(w.getDate() - 7);
    return d >= w;
  }
  return true;
}

export async function GET(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const dateRange = (searchParams.get("date_range") || "all") as DateRange;
  const outletId = searchParams.get("outlet_id") || undefined;

  const supabase = createAdminClient();

  // 1. Orders selesai (revenue + basis HPP), scoped company (+ outlet opsional)
  let orderQuery = supabase
    .from("orders")
    .select("*, order_items(product_id, quantity)")
    .eq("company_id", session.company_id)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  if (outletId) {
    orderQuery = orderQuery.eq("outlet_id", outletId);
  }

  const { data: orders } = await orderQuery;
  const orderRows = (orders ?? []) as JsonLike[];

  const completedOrders = orderRows.filter((o) =>
    inRange(o.created_at as string, dateRange)
  );

  const totalRevenue = completedOrders.reduce(
    (sum, o) => sum + Number(o.total_price ?? 0),
    0
  );
  const totalTransactions = completedOrders.length;

  // 2. Kumpulkan product ids untuk HPP (join order_items → product_recipes → ingredients.cost_per_unit)
  const productIds = new Set<string>();
  for (const o of completedOrders) {
    for (const item of (o.order_items ?? []) as JsonLike[]) {
      const pid = item.product_id as string;
      if (pid) productIds.add(pid);
    }
  }

  let hppByProduct = new Map<string, number>();

  if (productIds.size > 0) {
    const { data: recipes } = await supabase
      .from("product_recipes")
      .select(
        "product_id, quantity_used, ingredients(cost_per_unit)"
      )
      .in("product_id", Array.from(productIds));

    hppByProduct = new Map<string, number>();
    for (const r of (recipes ?? []) as JsonLike[]) {
      const pid = r.product_id as string;
      const quantityUsed = Number(r.quantity_used ?? 0);
      const unitCost = Number(
        ((r.ingredients as JsonLike)?.cost_per_unit ?? 0)
      );
      hppByProduct.set(
        pid,
        (hppByProduct.get(pid) ?? 0) + quantityUsed * unitCost
      );
    }
  }

  let totalHpp = 0;
  for (const o of completedOrders) {
    for (const item of (o.order_items ?? []) as JsonLike[]) {
      const pid = item.product_id as string;
      const qty = Number(item.quantity ?? 0);
      totalHpp += (hppByProduct.get(pid) ?? 0) * qty;
    }
  }

  // 3. Pengeluaran periode terkait (scoped company + outlet opsional)
  let expenseQuery = supabase
    .from("expenses")
    .select("amount, expense_date")
    .eq("company_id", session.company_id);

  if (outletId) {
    expenseQuery = expenseQuery.eq("outlet_id", outletId);
  }

  const { data: expenses } = await expenseQuery;
  const totalExpenses = ((expenses ?? []) as JsonLike[])
    .filter((e) => inRange(e.expense_date as string, dateRange))
    .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

  const grossProfit = totalRevenue - totalHpp;
  const netProfit = grossProfit - totalExpenses;

  return NextResponse.json({
    totalRevenue,
    totalHpp,
    grossProfit,
    totalExpenses,
    netProfit,
    totalTransactions,
  });
}