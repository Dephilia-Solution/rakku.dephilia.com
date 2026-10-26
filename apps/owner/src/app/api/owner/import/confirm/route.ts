import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { confirmImport, ImportError } from "@rakku/db/imports";
import { checkLimit } from "@rakku/plans";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";

export async function POST(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.batch_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.batch_id)) {
    return NextResponse.json({ error: "batch_id tidak valid" }, { status: 400 });
  }
  try {
    const result = await confirmImport(createAdminClient(), {
      companyId: session.company_id, batchId: body.batch_id, ownerId: session.owner_id,
      checkQuota: async (tx, domain, count) => (await checkLimit(tx, session.company_id!, domain, count)).allowed,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Impor gagal. Tidak ada data yang ditambahkan; Anda dapat mencoba lagi." }, { status: 500 });
  }
}
