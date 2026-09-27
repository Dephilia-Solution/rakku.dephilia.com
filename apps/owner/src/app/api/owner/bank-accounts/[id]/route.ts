import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const supabase = createAdminClient();

  const { data: account } = await supabase
    .from("merchant_bank_accounts")
    .select("id")
    .eq("id", id)
    .eq("company_id", session.company_id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Rekening tidak ditemukan" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body?.bank_name !== undefined) {
    updates.bank_name = String(body.bank_name).trim();
  }
  if (body?.account_number !== undefined) {
    const digits = String(body.account_number).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 20) {
      return NextResponse.json(
        { error: "Nomor rekening tidak valid" },
        { status: 400 }
      );
    }
    updates.account_number = digits;
  }
  if (body?.account_holder !== undefined) {
    updates.account_holder = String(body.account_holder).trim();
  }
  if (body?.status !== undefined) {
    updates.status = body.status === "inactive" ? "inactive" : "active";
  }

  if (body?.is_default === true) {
    await supabase
      .from("merchant_bank_accounts")
      .update({ is_default: false })
      .eq("company_id", session.company_id);
    updates.is_default = true;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("merchant_bank_accounts")
    .update(updates)
    .eq("id", id)
    .eq("company_id", session.company_id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Gagal mengubah rekening" },
      { status: 500 }
    );
  }

  return NextResponse.json({ bank_account: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: account } = await supabase
    .from("merchant_bank_accounts")
    .select("id")
    .eq("id", id)
    .eq("company_id", session.company_id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Rekening tidak ditemukan" }, { status: 404 });
  }

  const { count } = await supabase
    .from("withdrawals")
    .select("id", { count: "exact", head: true })
    .eq("bank_account_id", id)
    .in("status", ["requested", "processing"]);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Rekening sedang dipakai pengajuan pencairan yang belum selesai" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("merchant_bank_accounts")
    .delete()
    .eq("id", id)
    .eq("company_id", session.company_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
