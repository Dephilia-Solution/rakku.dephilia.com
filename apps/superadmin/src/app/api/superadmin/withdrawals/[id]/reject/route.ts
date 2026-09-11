import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { releaseBalance } from "@rakku/ledger";
import { sendBillingEmail } from "@rakku/emails";

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Unauthorized");
  return data.user;
}

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSuperadmin();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const reason = String(body?.reason ?? "").trim();

    if (!reason) {
      return NextResponse.json(
        { error: "Alasan penolakan wajib diisi" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: withdrawal } = await admin
      .from("withdrawals")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!withdrawal) {
      return NextResponse.json(
        { error: "Pengajuan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (!["requested", "processing"].includes(withdrawal.status as string)) {
      return NextResponse.json(
        { error: "Pengajuan sudah final" },
        { status: 400 }
      );
    }

    const release = await releaseBalance(admin, {
      companyId: withdrawal.company_id as string,
      amount: Number(withdrawal.amount),
      referenceType: "withdrawal",
      referenceId: withdrawal.id as string,
      note: `Pencairan ditolak: ${reason}`,
      createdBy: user.email ?? "superadmin",
    });

    if (!release.ok) {
      return NextResponse.json(
        { error: release.error ?? "Gagal mengembalikan saldo" },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("withdrawals")
      .update({
        status: "rejected",
        reject_reason: reason,
        processed_at: new Date().toISOString(),
        processed_by: user.email ?? user.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Gagal menyimpan status" },
        { status: 500 }
      );
    }

    try {
      await sendBillingEmail(admin, {
        companyId: withdrawal.company_id as string,
        type: "withdrawal_rejected",
        period: withdrawal.id as string,
        subject: "Pengajuan pencairan ditolak",
        eyebrow: "Pencairan Saldo",
        title: "Pengajuan pencairan ditolak.",
        paragraphs: [
          `Pengajuan pencairan ${formatRupiah(Number(withdrawal.amount))} tidak dapat diproses.`,
          `Alasan: ${reason}. Saldo sudah dikembalikan ke saldo tersedia Anda.`,
        ],
        note: "Silakan ajukan kembali setelah masalahnya diselesaikan.",
      });
    } catch (err) {
      console.error("[withdrawals] gagal kirim email tolak:", err);
    }

    return NextResponse.json({ withdrawal: data });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
