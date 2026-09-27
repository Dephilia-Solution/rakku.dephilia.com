import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { settleWithdrawal } from "@rakku/ledger";
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
    const referenceNumber = String(body?.reference_number ?? "").trim();
    const proofUrl = body?.transfer_proof_url
      ? String(body.transfer_proof_url).trim()
      : null;

    if (!referenceNumber) {
      return NextResponse.json(
        { error: "Nomor referensi transfer wajib diisi" },
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

    const settle = await settleWithdrawal(admin, {
      companyId: withdrawal.company_id as string,
      amount: Number(withdrawal.amount),
      fee: Number(withdrawal.fee),
      referenceType: "withdrawal",
      referenceId: withdrawal.id as string,
      note: `Pencairan selesai (ref ${referenceNumber})`,
      createdBy: user.email ?? "superadmin",
    });

    if (!settle.ok) {
      return NextResponse.json(
        { error: settle.error ?? "Gagal menyelesaikan pencairan" },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("withdrawals")
      .update({
        status: "completed",
        reference_number: referenceNumber,
        transfer_proof_url: proofUrl,
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
        type: "withdrawal_completed",
        period: withdrawal.id as string,
        subject: "Pencairan saldo selesai",
        eyebrow: "Pencairan Saldo",
        title: "Pencairan selesai.",
        paragraphs: [
          `Pencairan ${formatRupiah(Number(withdrawal.amount))} ke ${withdrawal.bank_name} ${withdrawal.account_number} (${withdrawal.account_holder}) sudah ditransfer.`,
          `Nomor referensi: ${referenceNumber}.`,
        ],
        note: "Silakan cek mutasi rekening Anda. Terima kasih.",
      });
    } catch (err) {
      console.error("[withdrawals] gagal kirim email selesai:", err);
    }

    return NextResponse.json({ withdrawal: data });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
