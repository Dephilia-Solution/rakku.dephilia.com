import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";
import { createAdminClient } from "@rakku/supabase-clients";

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Unauthorized");
  return data.user;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSuperadmin();
    const { id } = await params;

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

    if (withdrawal.status !== "requested") {
      return NextResponse.json(
        { error: "Pengajuan tidak dalam status menunggu" },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("withdrawals")
      .update({
        status: "processing",
        processed_by: user.email ?? user.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Gagal memproses pengajuan" },
        { status: 500 }
      );
    }

    return NextResponse.json({ withdrawal: data });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
