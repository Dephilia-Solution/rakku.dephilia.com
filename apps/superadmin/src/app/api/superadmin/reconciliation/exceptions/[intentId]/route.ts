import { NextRequest, NextResponse } from "next/server";
import { updatePaymentException, PaymentExceptionError } from "@rakku/db/payment-exceptions";
import { createClient } from "@/lib/auth/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ intentId: string }> },
) {
  let supabase;
  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { intentId } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body wajib diisi" }, { status: 400 });
    const exception = await updatePaymentException(supabase, {
      intentId,
      actor: data.user.email ?? data.user.id,
      action: body.action === "resolve" ? "resolve" : "investigate",
      note: body.note ? String(body.note) : null,
      resolutionType: body.resolution_type ? String(body.resolution_type) : null,
      reference: body.reference ? String(body.reference) : null,
      proofUrl: body.proof_url ? String(body.proof_url) : null,
      assignedTo: body.assigned_to ? String(body.assigned_to) : null,
    });
    return NextResponse.json({ exception });
  } catch (error) {
    if (error instanceof PaymentExceptionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
