import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import type { OwnerSession } from "@rakku/shared-types";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return null;
  return session as OwnerWithCompany;
}

function normalizeAccountNumber(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 20) return null;
  return digits;
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
    .from("merchant_bank_accounts")
    .select("*")
    .eq("company_id", session.company_id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bank_accounts: data ?? [] });
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
  const bankName = String(body?.bank_name ?? "").trim();
  const accountNumber = normalizeAccountNumber(body?.account_number);
  const accountHolder = String(body?.account_holder ?? "").trim();
  const makeDefault = Boolean(body?.is_default);

  if (!bankName || !accountNumber || !accountHolder) {
    return NextResponse.json(
      { error: "Nama bank, nomor rekening, dan nama pemilik wajib diisi" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { count } = await supabase
    .from("merchant_bank_accounts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", session.company_id);

  const isFirst = (count ?? 0) === 0;

  if (makeDefault || isFirst) {
    await supabase
      .from("merchant_bank_accounts")
      .update({ is_default: false })
      .eq("company_id", session.company_id);
  }

  const { data, error } = await supabase
    .from("merchant_bank_accounts")
    .insert({
      company_id: session.company_id,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder: accountHolder,
      is_default: makeDefault || isFirst,
      status: "active",
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Gagal menyimpan rekening" },
      { status: 500 }
    );
  }

  return NextResponse.json({ bank_account: data }, { status: 201 });
}
