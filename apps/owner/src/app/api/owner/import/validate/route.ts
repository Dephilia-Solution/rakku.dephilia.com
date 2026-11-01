import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, sql } from "@rakku/db";
import { stageImport, importPurchaseHash, ImportError } from "@rakku/db/imports";
import { allowAuthAttempt } from "@rakku/db/sessions";
import { hashPin } from "@rakku/auth-utils";
import { checkLimit, checkFeature } from "@rakku/plans";
import type { OwnerSession, PlanLimitKey } from "@rakku/shared-types";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { verifyOutletBelongsToCompany } from "@/lib/supabase/queries.data";
import { IMPORT_DOMAINS, IMPORT_HEADERS, IMPORT_MAX_RECIPE_ROWS, IMPORT_MAX_ROWS,
  applyPlanBudget, isLinkedWorkbook, parseWorkbook, rowKind, validateRows, type ImportDomain, type ValidationContext } from "@/lib/import/import-excel";
import { tierHeader, IMPORT_MAX_PURCHASE_LINES, IMPORT_UUID } from "@/lib/import/import-spec";
import { prepareImageArchive, IMAGE_LIMITS } from "@/lib/import/import-images";
import { readImportForm } from "@/lib/import/import-http";
import { canStageImportPreview } from "@/lib/import/import-preview-policy";
import { logError, logEvent } from "@rakku/observability";

type OwnerWithCompany = OwnerSession & { company_id: string };
const kindFor = (domain: ImportDomain) => domain === "products" ? "product" : domain === "ingredients" ? "ingredient" : domain === "purchases" ? "purchase" : "employee";
const key = (value: unknown) => String(value ?? "").trim().normalize("NFKC").toLocaleLowerCase("id-ID");
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const started = performance.now(), trace = { phase: "authenticate", requestId: request.headers.get("x-request-id") ?? crypto.randomUUID() };
  try {
    const response = await validateImportRequest(request, trace);
    const durationMs = Math.round(performance.now() - started);
    if (durationMs >= 1500) logEvent("warn", "owner.import.validate.slow", { request_id: trace.requestId, phase: trace.phase, duration_ms: durationMs, status: response.status });
    return response;
  } catch (error) {
    const durationMs = Math.round(performance.now() - started);
    logError("owner.import.validate.failed", error, { request_id: trace.requestId, phase: trace.phase, duration_ms: durationMs });
    return NextResponse.json({ error: `Import gagal pada tahap ${trace.phase}. Periksa file/referensi lalu coba kembali.`, code: "IMPORT_FAILED", request_id: trace.requestId }, { status: 500 });
  }
}

async function validateImportRequest(request: NextRequest, trace: { phase: string; requestId: string }) {
  trace.phase = "authenticate";
  const session = await getOwnerSessionFromCookies() as OwnerWithCompany | null;
  if (!session?.company_id) return NextResponse.json({ error: "Sesi berakhir. Masuk kembali lalu coba lagi." }, { status: 401 });
  const db = createAdminClient();
  if (!await allowAuthAttempt(db, `import-validate:${session.owner_id}`, 10, 600)) {
    return NextResponse.json({ error: "Terlalu banyak validasi import. Tunggu beberapa menit sebelum mencoba lagi.", code: "IMPORT_RATE_LIMIT" }, { status: 429, headers: { "Retry-After": "600" } });
  }
  trace.phase = "read-upload";
  let form: FormData;
  try { form = await readImportForm(request); }
  catch(error) { return NextResponse.json({ error:error instanceof Error?error.message:"Data unggahan Excel tidak dapat dibaca." }, { status: 400 }); }
  const rawDomain = String(form.get("domain") ?? "");
  if (!IMPORT_DOMAINS.includes(rawDomain as ImportDomain)) return NextResponse.json({ error: "Pilih jenis import Produk, Bahan Baku, Karyawan, atau Pembelian." }, { status: 400 });
  const domain = rawDomain as ImportDomain;
  trace.phase = "check-access";
  if (domain === "purchases" && !(await checkFeature(db,session.company_id,"inventory_advanced")).allowed) return NextResponse.json({error:"Pembelian memerlukan inventory_advanced.",code:"PLAN_LIMIT"},{status:403});
  let outletId: string | null = null;
  if (domain !== "employees") {
    outletId = String(form.get("outlet_id") ?? "");
    if (!IMPORT_UUID.test(outletId) || !(await verifyOutletBelongsToCompany(outletId, session.company_id))) {
      return NextResponse.json({ error: "Pilih outlet aktif yang valid." }, { status: 400 });
    }
  }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Pilih file Excel (.xlsx) yang berisi data." }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: "Format yang didukung adalah .xlsx. Unduh template terbaru untuk memastikan dropdown kategori/satuan berfungsi." }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "Ukuran file maksimal 2 MB." }, { status: 400 });
  let parsed;
  trace.phase = "parse-workbook";
  try { parsed = parseWorkbook(await file.arrayBuffer(), domain); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Workbook Excel tidak valid." }, { status: 400 }); }
  if (!parsed.headerOk) {
    const sheets = domain === "products" ? "Produk, Komposisi" : domain === "ingredients" ? "Bahan Baku" : "Karyawan";
    const headers = domain === "products" ? `Produk (${IMPORT_HEADERS.products.join(", ")}) dan Komposisi (${IMPORT_HEADERS.recipes.join(", ")})`
      : domain === "ingredients" ? `Bahan Baku (${IMPORT_HEADERS.ingredients.join(", ")})` : "Karyawan (nama, username, pin, role, outlets)";
    return NextResponse.json({ error: parsed.structuralErrors.map(issue=>issue.message).join(" ") || `Sheet harus tepat ${sheets}, nama/header kolom sesuai urutan: ${headers}. Unduh template terbaru.`, code:"IMPORT_STRUCTURE_INVALID", structural_errors:parsed.structuralErrors }, { status: 400 });
  }
  if (!parsed.rows.length) return NextResponse.json({ error: "Tidak ada baris data. Isi data mulai baris kedua." }, { status: 400 });

  const limitKey = domain as PlanLimitKey;
  trace.phase = "load-outlet-references";
  const limitPromise = domain === "purchases" ? Promise.resolve({max:null,current:0}) : checkLimit(db, session.company_id, limitKey);
  let budget: number | null = null;
  let limitUsed: string | null = null;
  const context: ValidationContext = {};
  if (domain !== "employees") {
    const productCodes = [...new Set(parsed.rows.filter(row=>row.payload.kind==="product").map(row=>String(row.payload.code??"")).filter(Boolean))];
    const productNames = [...new Set(parsed.rows.filter(row=>row.payload.kind==="product").map(row=>key(row.payload.name)).filter(Boolean))];
    const recipeCodes = [...new Set(parsed.rows.filter(row=>row.payload.kind==="recipe").map(row=>String(row.payload.product_code??"")).filter(Boolean))];
    const productLookup=[...new Set([...productCodes,...recipeCodes])];
    const ingredientCodes=[...new Set(parsed.rows.filter(row=>row.payload.kind==="ingredient").map(row=>String(row.payload.code??""))
      .concat(parsed.rows.filter(row=>["recipe","purchase_line"].includes(String(row.payload.kind))).map(row=>String(row.payload.ingredient_code??""))).filter(Boolean))];
    const [limit,ingredientResult, productResult, productNameResult, categoryResult, tierResult] = await Promise.all([
      limitPromise,
      ingredientCodes.length ? db.from("ingredients").select("id,code,name,unit,is_active").eq("company_id", session.company_id).eq("outlet_id", outletId).in("code",ingredientCodes) : Promise.resolve({ data: [], error: null }),
      domain === "products" && productLookup.length ? db.from("products").select("id,code,name,category_id,price,description").eq("company_id", session.company_id).eq("outlet_id", outletId).in("code",productLookup) : Promise.resolve({ data: [], error: null }),
      domain === "products" && productNames.length ? db.execute(sql`select distinct lower(name) as name from public.products where company_id=${session.company_id} and outlet_id=${outletId} and lower(name) in (${sql.join(productNames.map(name=>sql`${name}`),sql`,`)})`) : Promise.resolve([]),
      domain === "products" ? db.from("categories").select("id,name").eq("company_id", session.company_id).eq("outlet_id", outletId) : Promise.resolve({ data: [], error: null }),
      domain === "products" ? db.from("pricing_tiers").select("id,name,slug").eq("company_id",session.company_id).eq("outlet_id",outletId).eq("is_active",true).order("sort_order").order("id") : Promise.resolve({ data: [], error: null }),
    ]);
    budget=typeof limit.max==="number"?Math.max(0,limit.max-(limit.current??0)):null;
    limitUsed=typeof limit.max==="number"?`${limit.current??0}/${limit.max}`:null;
    if (ingredientResult.error || productResult.error || categoryResult.error) return NextResponse.json({ error: "Data kode outlet tidak dapat divalidasi. Coba lagi." }, { status: 500 });
    context.existingIngredientCodes = new Map((ingredientResult.data ?? []).filter((item: { code?: string | null }) => !!item.code)
      .map((item: { id: string; code: string; name: string; unit: string; is_active: boolean }) => [key(item.code), item]));
    // Read just names for the duplicate-name advisory; full product payloads stay limited to uploaded codes.
    context.existingProductNames = new Set(productNameResult.map(item=>key(item.name)));
    context.existingProductCodes = new Map((productResult.data ?? []).filter((item: { code?: string | null }) => !!item.code)
      .map((item: { id: string; code: string; name: string; category_id: string; price: number; description: string | null }) => [key(item.code), { ...item, price: Number(item.price) }]));
    context.existingCategories = new Map((categoryResult.data ?? []).map((item: { id: string; name: string }) => [key(item.name), item]));
    if (domain === "products") {
      if (tierResult.error) return NextResponse.json({error:"Tier outlet tidak dapat dimuat."},{status:500});
      context.tiers = (tierResult.data ?? []).map(item=>({id:String(item.id),name:String(item.name),slug:String(item.slug),header:tierHeader(String(item.slug))}));
      context.companyId=session.company_id; context.outletId=outletId!; context.metadata=parsed.metadata;
      const productIds=(productResult.data??[]).map(item=>String((item as {id:string}).id));
      const prices=productIds.length?await db.from("product_tier_prices").select("product_id,tier_id,price").in("product_id",productIds):{data:[],error:null};
      if(prices.error)return NextResponse.json({error:"Harga tier produk tidak dapat divalidasi."},{status:500});
      context.existingTierPrices=new Map((prices.data??[]).map(item=>[`${item.product_id}:${item.tier_id}`,Number(item.price)]));
    }
  } else {
    const [limit,roles, outlets, users] = await Promise.all([limitPromise,
      db.from("roles").select("id,name").eq("company_id", session.company_id),
      db.from("outlets").select("id,name").eq("company_id", session.company_id),
      db.from("users").select("username").eq("company_id", session.company_id),
    ]);
    budget=typeof limit.max==="number"?Math.max(0,limit.max-(limit.current??0)):null;
    limitUsed=typeof limit.max==="number"?`${limit.current??0}/${limit.max}`:null;
    if (roles.error || outlets.error || users.error) return NextResponse.json({ error: "Data referensi karyawan tidak dapat dimuat." }, { status: 500 });
    context.existingUsernames = new Set((users.data ?? []).map((item: { username: string }) => key(item.username)));
    context.roleNameMap = new Map((roles.data ?? []).map((item: { id: string; name: string }) => [key(item.name), item]));
    context.outletNameMap = new Map((outlets.data ?? []).map((item: { id: string; name: string }) => [key(item.name), item]));
  }
  trace.phase = "validate-business-references";
  try { validateRows(domain, parsed.rows, context); }
  catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Metadata tier tidak valid.",code:"IMPORT_TIERS_STALE"},{status:409}); }
  if (domain === "purchases") {
    trace.phase = "lookup-purchase-references";
    const codes=[...new Set(parsed.rows.filter(row=>row.payload.kind==="purchase").map(row=>String(row.payload.code??"").trim().normalize("NFKC").toLocaleUpperCase("id-ID")).filter(Boolean))];
    const references=codes.length?await db.execute(sql`select reference,payload_hash,purchase_id from app_private.import_purchase_references where company_id=${session.company_id} and outlet_id=${outletId} and reference in (${sql.join(codes.map(code=>sql`${code}`),sql`,`)})`):[];
    const byCode=new Map(references.map(item=>[key(item.reference),item]));
    for (const row of parsed.rows.filter(row=>row.payload.kind==="purchase")) {
      const existing=byCode.get(key(row.payload.code)); row.payload.payload_hash=importPurchaseHash(row,parsed.rows.filter(line=>line.payload.kind==="purchase_line"));
      row.payload.conflict=!!existing; row.payload.purchase_replayed=!!existing&&existing.payload_hash===row.payload.payload_hash;
      row.payload.existing_id=existing?.purchase_id??null;
      if(existing) {
        if(existing.payload_hash!==row.payload.payload_hash) row.errors.push({field:"kode_pembelian",message:"Kode pembelian pernah dicatat dengan isi berbeda; gunakan kode baru."});
        else row.warnings.push({field:"kode_pembelian",message:"Pembelian identik sudah dicatat. Selalu dilewati tanpa menambah stok."});
      }
    }
  }
  const imageZip = form.get("images_zip");
  if (imageZip !== null && (domain !== "products" || !(imageZip instanceof File) || !/\.zip$/i.test(imageZip.name) || !imageZip.size || imageZip.size > IMAGE_LIMITS.archiveBytes)) {
    return NextResponse.json({error:"images_zip hanya untuk produk: ZIP gambar terpisah, maksimal 3 MB; total Excel + ZIP maksimal 4 MB."},{status:400});
  }
  let imageData: Awaited<ReturnType<typeof prepareImageArchive>>;
  trace.phase = "process-image-archive";
  try { imageData = await prepareImageArchive(imageZip instanceof File ? Buffer.from(await imageZip.arrayBuffer()) : null,parsed.rows); }
  catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"ZIP gambar tidak valid.",code:"IMPORT_IMAGES_INVALID"},{status:400}); }
  applyPlanBudget(domain, parsed.rows, budget);
  const linked = domain === "purchases" || parsed.schemaVersion === 2 || isLinkedWorkbook(parsed.rows);
  const errors = parsed.rows.filter(row => row.errors.length);
  const mainRows = parsed.rows.filter(row => rowKind(row, domain) === kindFor(domain));
  const recipeRows = parsed.rows.filter(row => rowKind(row, domain) === "recipe");
  const eligible = mainRows.filter(row => !row.errors.length);
  if (!mainRows.length && !(domain === "products" && recipeRows.length)) return NextResponse.json({ error: "Isi minimal satu baris data utama. Komposisi saja hanya diperbolehkan untuk produk berkode yang sudah ada di outlet." }, { status: 400 });
  const canConfirm = canStageImportPreview({ domain, linked, validMainRows: eligible.length, recipeRows: recipeRows.length, errorRows: errors.length });
  trace.phase = "hash-employee-credentials";
  if (domain === "employees") for (const row of parsed.rows) {
    if (!row.errors.length && typeof row.payload.pin === "string") row.payload.pin_hash = await hashPin(row.payload.pin);
    delete row.payload.pin;
  }
  let batchId: string | undefined;
  if (canConfirm) {
    trace.phase = "stage-preview";
    try { batchId = await stageImport(db, { companyId: session.company_id, ownerId:session.owner_id, domain, outletId, fileName: file.name.slice(0,255), rows: parsed.rows,
      schemaVersion:parsed.schemaVersion,context:{linked,metadata:parsed.metadata??null,structural_errors:parsed.structuralErrors,image_summary:imageData.summary,timezone:domain==="purchases"?"Asia/Jakarta":null},assets:imageData.assets }); }
    catch (error) {
      const databaseCode = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
      if (["42P01", "42703", "3F000"].includes(databaseCode ?? "")) {
        logError("owner.import.schema_not_ready", error, { request_id: trace.requestId, phase: trace.phase, migration: "0019_comprehensive_imports.sql" });
        return NextResponse.json({ error: "Schema import terbaru belum tersedia pada database ini. Pastikan migrasi 0019_comprehensive_imports.sql sudah diterapkan; setelah itu pilih Validasi ulang dengan file yang sama.", code: "IMPORT_SCHEMA_NOT_READY", request_id: trace.requestId }, { status: 503 });
      }
      return NextResponse.json({ error: error instanceof ImportError ? error.message : "Gagal menyimpan preview import. Coba lagi.", ...(error instanceof ImportError ? { code: error.code } : {}), request_id: trace.requestId }, { status: error instanceof ImportError ? error.status : 500 });
    }
  }
  trace.phase = "read-staged-preview";
  const [stagedBatch]=batchId ? await db.execute(sql`select b.expires_at,coalesce(jsonb_agg(jsonb_build_object('id',a.id,'reference',a.reference,'content_hash',a.content_hash,'byte_size',a.byte_size,'width',a.width,'height',a.height,'state',a.state) order by a.reference) filter(where a.id is not null),'[]'::jsonb) as assets
    from app_private.import_batches b left join app_private.import_assets a on a.batch_id=b.id and a.company_id=b.company_id
    where b.id=${batchId} and b.company_id=${session.company_id} group by b.id`) : [null];
  if(batchId && !stagedBatch)throw new Error("Staged import batch disappeared before preview response.");
  const stagedAssets=(stagedBatch?.assets ?? []) as {id:string;reference:string;content_hash:string;byte_size:number;width:number;height:number;state:string}[];
  for(const row of parsed.rows) {
    const asset=stagedAssets.find(asset=>asset.reference===row.payload.image_reference_normalized);
    if(asset)row.payload.image_asset_id=asset.id;
  }
  const validProductRows = mainRows.filter(row => rowKind(row, domain) === "product" && !row.errors.length);
  const categoryNames = [...new Map(validProductRows.filter(row => row.payload.category_is_new)
    .map(row => [key(row.payload.category_name), String(row.payload.category_name).trim()])).values()];
  const categoriesForNewProducts = [...new Map(validProductRows.filter(row => !row.payload.conflict && row.payload.category_is_new)
    .map(row => [key(row.payload.category_name), String(row.payload.category_name).trim()])).values()];
  const categoriesForExistingProducts = [...new Map(validProductRows.filter(row => row.payload.conflict && row.payload.category_is_new)
    .map(row => [key(row.payload.category_name), String(row.payload.category_name).trim()])).values()];
  const conflicts = new Set(parsed.rows.filter(row => row.payload.conflict && !row.errors.length)
    .map(row => String(row.payload.code ?? row.payload.product_code ?? row.payload.username ?? ""))).size;
  const ingredientRefs = context.existingIngredientCodes?.size ?? 0;
  // Expired batches and provider files are handled by the scheduled cleanup route.
  // Validation must never wait on external Silos deletes before returning a preview.
  trace.phase = "build-preview-response";
  return NextResponse.json({ ...(batchId ? { batch_id: batchId, expires_in_seconds: 86400, expires_at: stagedBatch!.expires_at } : {}),
     schema_version:parsed.schemaVersion,metadata:parsed.metadata??null,assets:stagedAssets,
    summary: { total: parsed.rows.length, main_total: mainRows.length, valid: eligible.length, errors: errors.length,
      warnings: parsed.rows.reduce((count,row) => count + row.warnings.length, 0), linked_errors: linked ? errors.length : 0,
       can_confirm: canConfirm, conflicts, conflict_rows: conflicts,
      inserted: mainRows.filter(row => !row.payload.conflict && !row.errors.length).length,
       updated_candidates: domain==="purchases"?0:conflicts, skipped_candidates: conflicts,
       purchase_replays:mainRows.filter(row=>row.payload.purchase_replayed).length,
       new_categories: categoryNames, new_categories_for_insert: categoriesForNewProducts, new_categories_for_update: categoriesForExistingProducts,
         recipes: recipeRows.length, purchase_lines:parsed.rows.filter(row=>row.payload.kind==="purchase_line").length,
       tiers:context.tiers??[],tier_prices:mainRows.reduce((sum,row)=>sum+(Array.isArray(row.payload.tier_prices)?row.payload.tier_prices.filter(item=>item.price!==null).length:0),0),
       images:imageData.summary,
       existing_ingredients: ingredientRefs, limit_used: limitUsed,
      limit_note: budget === 0 ? `Kuota ${domain === "products" ? "produk" : domain === "ingredients" ? "bahan baku" : "karyawan"} penuh untuk kode baru; data berkode sama masih dapat dilewati atau diperbarui.` : null,
       max_rows: IMPORT_MAX_ROWS[domain], max_recipe_rows: IMPORT_MAX_RECIPE_ROWS, max_purchase_lines:IMPORT_MAX_PURCHASE_LINES },
    rows: parsed.rows.map(row => ({ row_number: row.rowNumber, sheet_name: row.payload.sheet_name, sheet_row: row.payload.sheet_row,
      field: row.errors[0]?.field ?? row.warnings[0]?.field ?? null, kind: rowKind(row,domain), conflict: row.payload.conflict === true,
         code: String(row.payload.code ?? row.payload.username ?? row.payload.product_code ?? row.payload.purchase_code ?? ""), category_name: String(row.payload.category_name ?? ""),
        name: String(row.payload.name ?? row.payload.username ?? (row.payload.kind === "recipe" ? `${row.payload.product_code} → ${row.payload.ingredient_code}`
          :row.payload.kind==="purchase_line"?`${row.payload.purchase_code} → ${row.payload.ingredient_code}`:row.payload.kind==="purchase"?`${row.payload.code} — ${row.payload.local_date}`:"-")),
       values:Object.fromEntries(Object.entries(row.payload).filter(([field])=>!["pin","pin_hash"].includes(field))),
       errors: row.errors, warnings: row.warnings })), sheet_max_note: null });
}
