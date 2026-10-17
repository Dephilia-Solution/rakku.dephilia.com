import { NextRequest, NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import { createAdminClient } from "@rakku/db";
import { finalizeWithdrawal } from "@rakku/ledger";
import { sendBillingEmail } from "@rakku/emails";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperadmin().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const reference = String(body?.reference_number ?? "").trim();
  if (!reference) return NextResponse.json({ error: "Nomor referensi transfer wajib diisi" }, { status: 400 });
  const { id } = await params;
  const db = createAdminClient();
  try {
    const withdrawal = await finalizeWithdrawal(db, id, { outcome: "completed", actor: user.email ?? user.id,
      referenceNumber: reference, proofUrl: body?.transfer_proof_url ? String(body.transfer_proof_url).trim() : null });
    await sendBillingEmail(db, { companyId: withdrawal.company_id, type: "withdrawal_completed", period: id,
      subject: "Pencairan saldo selesai", eyebrow: "Pencairan Saldo", title: "Pencairan selesai.",
      paragraphs: [`Pencairan Rp ${Number(withdrawal.amount).toLocaleString("id-ID")} ke ${withdrawal.bank_name} ${withdrawal.account_number} (${withdrawal.account_holder}) sudah ditransfer.`, `Nomor referensi: ${reference}.`],
      note: "Silakan cek mutasi rekening Anda. Terima kasih." }).catch(error => console.error("[withdrawals] post-commit email failed", error));
    return NextResponse.json({ withdrawal });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menyelesaikan pencairan" }, { status: 400 });
  }
}
