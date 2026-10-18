import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { runFinancialCommand } from "@rakku/db/financial-commands";
import { adjustBalance, getBalance } from "@rakku/ledger";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const user = await requireSuperadmin();

    const { companyId } = await params;
    if (!companyId) {
      return NextResponse.json({ error: "companyId wajib diisi" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const amount = Number(body?.amount);
    const note = String(body?.note ?? "").trim();

    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json(
        { error: "Nominal harus angka dan tidak boleh 0" },
        { status: 400 }
      );
    }
    if (!note) {
      return NextResponse.json(
        { error: "Catatan wajib diisi untuk koreksi saldo" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const requestId = typeof body?.requestId === "string" ? body.requestId : request.headers.get("idempotency-key");
    try {
      const result = await runFinancialCommand(admin, {
        companyId,
        requestId,
        command: "balance.adjustment",
        payload: { amount, note },
        execute: async tx => {
          const mutation = await adjustBalance(tx, {
            companyId, amount, note, createdBy: user.email ?? user.id,
            referenceId: requestId && /^[0-9a-f-]{36}$/i.test(requestId) ? requestId : null,
          });
          if (!mutation.ok) throw new Error(mutation.error ?? "Gagal menyesuaikan saldo");
          return mutation;
        },
      });
      const balance = await getBalance(admin, companyId);
      return NextResponse.json({ balance, inserted: result.inserted });
    } catch (error) {
      const status = (error as { status?: number }).status ?? 400;
      return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menyesuaikan saldo" }, { status });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
