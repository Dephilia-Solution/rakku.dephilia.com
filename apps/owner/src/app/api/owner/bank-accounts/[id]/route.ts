import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient, sql } from "@rakku/db";

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

  const updates: Record<string, unknown> = {};
  if (body?.bank_name !== undefined) {
    const bankName = String(body.bank_name).trim();
    if (!bankName) return NextResponse.json({ error: "Nama bank wajib diisi" }, { status: 400 });
    updates.bank_name = bankName;
  }
  if (body?.account_number !== undefined) {
    const digits = String(body.account_number).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 20) {
      return NextResponse.json({ error: "Nomor rekening tidak valid" }, { status: 400 });
    }
    updates.account_number = digits;
  }
  if (body?.account_holder !== undefined) {
    const holder = String(body.account_holder).trim();
    if (!holder) return NextResponse.json({ error: "Nama pemilik wajib diisi" }, { status: 400 });
    updates.account_holder = holder;
  }
  if (body?.status !== undefined) {
    updates.status = body.status === "inactive" ? "inactive" : "active";
  }
  if (body?.is_default === true) updates.is_default = true;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });
  }

  try {
    const data = await supabase.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${session.company_id},0))`);
      const account = await tx.from("merchant_bank_accounts").select("id,is_default")
        .eq("id", id).eq("company_id", session.company_id).maybeSingle();
      if (account.error) throw new Error(account.error.message);
      if (!account.data) throw Object.assign(new Error("Rekening tidak ditemukan"), { status: 404 });
      if (body?.is_default === true) {
        const cleared = await tx.from("merchant_bank_accounts")
          .update({ is_default: false }).eq("company_id", session.company_id);
        if (cleared.error) throw new Error(cleared.error.message);
      }
      const result = await tx.from("merchant_bank_accounts").update(updates)
        .eq("id", id).eq("company_id", session.company_id).select().single();
      if (result.error || !result.data) throw new Error(result.error?.message ?? "Gagal mengubah rekening");
      return result.data;
    });
    return NextResponse.json({ bank_account: data });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengubah rekening" }, { status });
  }
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

  try {
    await supabase.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${session.company_id},0))`);
      const account = await tx.from("merchant_bank_accounts").select("id,is_default")
        .eq("id", id).eq("company_id", session.company_id).maybeSingle();
      if (account.error) throw new Error(account.error.message);
      if (!account.data) throw Object.assign(new Error("Rekening tidak ditemukan"), { status: 404 });
      const pending = await tx.from("withdrawals").select("id", { count: "exact", head: true })
        .eq("bank_account_id", id).in("status", ["requested", "processing"]);
      if (pending.error) throw new Error(pending.error.message);
      if ((pending.count ?? 0) > 0) throw new Error("Rekening sedang dipakai pengajuan pencairan yang belum selesai");
      const removed = await tx.from("merchant_bank_accounts").delete()
        .eq("id", id).eq("company_id", session.company_id);
      if (removed.error) throw new Error(removed.error.message);
      if (account.data.is_default) {
        const next = await tx.from("merchant_bank_accounts").select("id")
          .eq("company_id", session.company_id).eq("status", "active")
          .order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (next.error) throw new Error(next.error.message);
        if (next.data) {
          const promoted = await tx.from("merchant_bank_accounts").update({ is_default: true })
            .eq("id", next.data.id).eq("company_id", session.company_id);
          if (promoted.error) throw new Error(promoted.error.message);
        }
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menghapus rekening" }, { status });
  }
}
