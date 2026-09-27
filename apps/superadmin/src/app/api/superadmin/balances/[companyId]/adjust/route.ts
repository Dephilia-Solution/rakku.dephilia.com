import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { adjustBalance, getBalance } from "@rakku/ledger";

function requireSuperadmin() {
  const supabase = createClient();
  return supabase.then((s) => s.auth.getUser()).then(({ data }) => {
    if (!data?.user) throw new Error("Unauthorized");
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    await requireSuperadmin();

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
    const result = await adjustBalance(admin, { companyId, amount, note });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const balance = await getBalance(admin, companyId);
    return NextResponse.json({ balance, inserted: result.inserted });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
