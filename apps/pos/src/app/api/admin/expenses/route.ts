import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { runFinancialCommand } from "@rakku/db/financial-commands";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function GET() {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .order("expense_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { category, amount, description, expense_date } = body;

  if (!category || !category.trim()) {
    return NextResponse.json({ error: "Kategori wajib diisi" }, { status: 400 });
  }

  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Nominal harus lebih dari 0" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    const requestId = typeof body.requestId === "string" ? body.requestId : request.headers.get("idempotency-key");
    const data = await runFinancialCommand(supabase, {
      companyId: session.company_id,
      requestId,
      command: "expense.create",
      payload: body,
      execute: async tx => {
        const result = await tx.from("expenses").insert({
          company_id: session.company_id,
          outlet_id: session.outlet_id,
          category: category.trim(),
          amount: Math.round(amount * 100) / 100,
          description: description ?? null,
          expense_date: expense_date ?? new Date().toISOString(),
          created_by: session.user_id ?? null,
        }).select().single();
        if (result.error || !result.data) throw new Error(result.error?.message ?? "Gagal menyimpan pengeluaran");
        return result.data;
      },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menyimpan pengeluaran" }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, category, amount, description, expense_date } = body;

  if (!id) {
    return NextResponse.json({ error: "ID pengeluaran wajib diisi" }, { status: 400 });
  }

  if (category !== undefined && !category.trim()) {
    return NextResponse.json({ error: "Kategori wajib diisi" }, { status: 400 });
  }

  if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
    return NextResponse.json({ error: "Nominal harus lebih dari 0" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (category !== undefined) updates.category = category.trim();
  if (amount !== undefined) updates.amount = amount;
  if (description !== undefined) updates.description = description;
  if (expense_date !== undefined) updates.expense_date = expense_date;

  const { data, error } = await supabase
    .from("expenses")
    .update(updates)
    .eq("id", id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID pengeluaran wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
