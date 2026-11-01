import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import { verifyOutletBelongsToCompany } from "@/lib/supabase/queries.data";
import { tierHeader, IMPORT_UUID, type ProductImportMetadata } from "@/lib/import/import-spec";
import { checkFeature } from "@rakku/plans";
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
  if (searchParams.has("version") && !["1","2"].includes(searchParams.get("version")!)) return NextResponse.json({error:"version harus 1 atau 2."},{status:400});
  if (!domain || !IMPORT_DOMAINS.includes(domain as ImportDomain)) {
    return NextResponse.json(
      { error: "Domain wajib: products, ingredients, employees, atau purchases." },
      { status: 400 }
    );
  }

  const spec = getTemplateSpec(domain as ImportDomain);
  let categories: string[] = [];
  let metadata: ProductImportMetadata | undefined;
  const db = createAdminClient();
  if (domain === "purchases" && !(await checkFeature(db, session.company_id, "inventory_advanced")).allowed) {
    return NextResponse.json({error:"Pembelian memerlukan inventory_advanced.",code:"PLAN_LIMIT"},{status:403});
  }
  if (domain !== "employees") {
    const outletId = searchParams.get("outlet_id");
    if (!outletId || !IMPORT_UUID.test(outletId) || !(await verifyOutletBelongsToCompany(outletId, session.company_id))) {
      return NextResponse.json({ error: "outlet_id tujuan wajib dan harus milik perusahaan Anda" }, { status: 400 });
    }
    if (domain === "products") {
      const result = await db.from("categories").select("name")
        .eq("company_id", session.company_id).eq("outlet_id", outletId).order("name");
      if (result.error) return NextResponse.json({ error: "Gagal memuat kategori outlet" }, { status: 500 });
      categories = (result.data ?? []).map(row => row.name);
      const tiers = await db.from("pricing_tiers").select("id,name,slug").eq("company_id",session.company_id).eq("outlet_id",outletId)
        .eq("is_active",true).order("sort_order").order("id");
      if (tiers.error || (tiers.data?.length ?? 0) > 100) return NextResponse.json({error:"Gagal memuat tier outlet (maksimal 100 tier aktif)."},{status:500});
      if (searchParams.get("version") !== "1") metadata = {schema_version:2,domain:"products",company_id:session.company_id,outlet_id:outletId,
        tiers:(tiers.data ?? []).map(row => ({id:String(row.id),name:String(row.name),slug:String(row.slug),header:tierHeader(String(row.slug))}))};
    }
  }
  const workbook = await buildTemplateWorkbook(domain as ImportDomain, categories, metadata);

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
