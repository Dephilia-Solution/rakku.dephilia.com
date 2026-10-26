import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import { verifyOutletBelongsToCompany } from "@/lib/supabase/queries.data";
import {
  IMPORT_DOMAINS,
  buildTemplateWorkbook,
  getTemplateSpec,
  type ImportDomain,
} from "@/lib/import/import-excel";

export async function GET(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) {
    return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  if (!domain || !IMPORT_DOMAINS.includes(domain as ImportDomain)) {
    return NextResponse.json(
      { error: "Parameter domain wajib: products | employees | ingredients" },
      { status: 400 }
    );
  }

  const spec = getTemplateSpec(domain as ImportDomain);
  let references = [];
  if (domain !== "employees") {
    const outletId = searchParams.get("outlet_id");
    if (!outletId || !(await verifyOutletBelongsToCompany(outletId, session.company_id))) {
      return NextResponse.json({ error: "outlet_id tujuan wajib dan harus milik perusahaan Anda" }, { status: 400 });
    }
    const result = await createAdminClient().from("ingredients").select("id,name,unit,is_active")
      .eq("company_id", session.company_id).eq("outlet_id", outletId).order("name");
    if (result.error) return NextResponse.json({ error: "Gagal memuat referensi bahan outlet" }, { status: 500 });
    references = result.data ?? [];
  }
  const workbook = buildTemplateWorkbook(domain as ImportDomain, references);

  return new Response(workbook.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${spec.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
