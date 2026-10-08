import { NextRequest, NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import { createAdminClient } from "@rakku/db";
import { finalizeWithdrawal } from "@rakku/ledger";
import { sendBillingEmail } from "@rakku/emails";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperadmin().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const reason = String(body?.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: "Alasan penolakan wajib diisi" }, { status: 400 });
  const { id } = await params;
  const db = createAdminClient();
  try {
    const withdrawal = await finalizeWithdrawal(db, id, { outcome: "rejected", actor: user.email ?? user.id, reason });
    await sendBillingEmail(db, { companyId: withdrawal.company_id, type: "withdrawal_rejected", period: id,
      subject: "Pengajuan pencairan ditolak", eyebrow: "Pencairan Saldo", title: "Pengajuan pencairan ditolak.",
      paragraphs: [`Pengajuan pencairan Rp ${Number(withdrawal.amount).toLocaleString("id-ID")} tidak dapat diproses.`, `Alasan: ${reason}. Saldo sudah dikembalikan ke saldo tersedia Anda.`],
      note: "Silakan ajukan kembali setelah masalahnya diselesaikan." }).catch(error => console.error("[withdrawals] post-commit email failed", error));
    return NextResponse.json({ withdrawal });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menolak pencairan" }, { status: 400 });
  }
}
