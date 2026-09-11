import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { createWithdrawalRequest } from "@/lib/billing/withdrawal-service";
import type { OwnerSession } from "@rakku/shared-types";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return null;
  return session as OwnerWithCompany;
}

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("company_id", session.company_id)
    .order("requested_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ withdrawals: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);

  const result = await createWithdrawalRequest(createAdminClient(), {
    companyId: session.company_id,
    ownerId: session.owner_id,
    bankAccountId: String(body?.bank_account_id ?? "").trim(),
    amount: Number(body?.amount),
    note: body?.note ? String(body.note).trim() : null,
  });

  if ("error" in result) {
    const notFound = result.error.includes("Rekening tidak ditemukan");
    return NextResponse.json(
      { error: result.error },
      { status: notFound ? 404 : 400 }
    );
  }

  return NextResponse.json({ withdrawal: result.withdrawal }, { status: 201 });
}
