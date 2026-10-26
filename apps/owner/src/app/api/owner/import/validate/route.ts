import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { stageImport } from "@rakku/db/imports";
import { hashPin } from "@rakku/auth-utils";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { checkLimit } from "@rakku/plans";
import { verifyOutletBelongsToCompany } from "@/lib/supabase/queries.data";
import { IMPORT_DOMAINS, IMPORT_MAX_ROWS, applyPlanBudget, finalizeLinkedRows, isLinkedWorkbook,
  parseWorkbook, rowKind, validateRows, type ImportDomain, type ValidationContext } from "@/lib/import/import-excel";
import { IMPORT_MAX_FILE_BYTES, IMPORT_MAX_RECIPE_ROWS } from "@/lib/import/import-spec";

export async function POST(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return NextResponse.json({ error: "Anda belum memiliki perusahaan" }, { status: 403 });
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Form upload tidak valid" }, { status: 400 }); }
  const rawDomain = String(form.get("domain") ?? "");
  if (!IMPORT_DOMAINS.includes(rawDomain as ImportDomain)) return NextResponse.json({ error: "Parameter domain wajib: products | employees | ingredients" }, { status: 400 });
  const domain = rawDomain as ImportDomain;
  const db = createAdminClient();
  let outletId: string | null = null;
  if (domain !== "employees") {
    outletId = String(form.get("outlet_id") ?? "");
    if (!outletId || !(await verifyOutletBelongsToCompany(outletId, session.company_id))) return NextResponse.json({ error: "Outlet tidak valid" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File Excel wajib diunggah" }, { status: 400 });
  if (file.size > IMPORT_MAX_FILE_BYTES) return NextResponse.json({ error: "Ukuran file maksimal 2 MB" }, { status: 400 });
  if (!/\.(xlsx|xls)$/i.test(file.name) || !file.size) return NextResponse.json({ error: "Pilih file XLSX atau XLS yang berisi data" }, { status: 400 });
  let parsed;
  try { parsed = parseWorkbook(await file.arrayBuffer(), domain); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message.startsWith("Maksimal") ? error.message : "File Excel tidak dapat dibaca. Gunakan template yang tersedia." }, { status: 400 });
  }
  if (!parsed.headerOk) return NextResponse.json({ error: "Format kolom tidak sesuai. Unduh template Excel terlebih dahulu lalu isi sesuai petunjuknya." }, { status: 400 });
  if (!parsed.rows.length) return NextResponse.json({ error: "File tidak berisi data. Isi data mulai baris kedua." }, { status: 400 });

  const limit = await checkLimit(db, session.company_id, domain);
  const budgetFor = (value: typeof limit) => typeof value.max === "number" ? Math.max(0, value.max - (typeof value.current === "number" ? value.current : 0)) : null;
  // A full ingredient quota still permits reference-only workbooks.
  if (domain !== "ingredients" && !limit.allowed) return NextResponse.json({ code: "PLAN_LIMIT", error: "Kuota paket sudah penuh. Upgrade untuk menambah data." }, { status: 403 });
  const ctx: ValidationContext = {};
  if (domain !== "employees") {
    if (domain === "ingredients" || isLinkedWorkbook(parsed.rows)) {
      const ingredients = await db.from("ingredients").select("id,name,unit,is_active")
        .eq("company_id", session.company_id).eq("outlet_id", outletId);
      if (ingredients.error) return NextResponse.json({ error: "Gagal memuat referensi bahan outlet" }, { status: 500 });
      ctx.existingIngredients = ingredients.data ?? [];
    }
    if (domain === "products") {
      const products = await db.from("products").select("name").eq("company_id", session.company_id).eq("outlet_id", outletId);
      if (products.error) return NextResponse.json({ error: "Gagal memuat produk outlet" }, { status: 500 });
      ctx.existingProductNames = new Set((products.data ?? []).map((product: { name: string }) => product.name.trim().toLowerCase()));
    }
  } else {
    const [roles, outlets, users] = await Promise.all([
      db.from("roles").select("id,name").eq("company_id", session.company_id),
      db.from("outlets").select("id,name").eq("company_id", session.company_id),
      db.from("users").select("username").eq("company_id", session.company_id),
    ]);
    if (roles.error || outlets.error || users.error) return NextResponse.json({ error: "Gagal menyiapkan data referensi" }, { status: 500 });
    ctx.existingUsernames = new Set((users.data ?? []).map((user: { username: string }) => user.username.toLowerCase()));
    ctx.roleNameMap = new Map((roles.data ?? []).map((role: { id: string; name: string }) => [role.name.toLowerCase(), role]));
    ctx.outletNameMap = new Map((outlets.data ?? []).map((outlet: { id: string; name: string }) => [outlet.name.toLowerCase(), outlet]));
  }
  validateRows(domain, parsed.rows, ctx);
  applyPlanBudget(domain, parsed.rows, budgetFor(limit));
  if (domain === "products" && isLinkedWorkbook(parsed.rows)) {
    const ingredientLimit = await checkLimit(db, session.company_id, "ingredients");
    applyPlanBudget("ingredients", parsed.rows, budgetFor(ingredientLimit));
  }
  finalizeLinkedRows(parsed.rows);
  const mainKind = domain === "products" ? "product" : domain === "ingredients" ? "ingredient" : "employee";
  const mainRows = parsed.rows.filter(row => rowKind(row, domain) === mainKind);
  if (!mainRows.length) return NextResponse.json({ error: "Isi minimal satu baris data pada sheet utama." }, { status: 400 });
  const validRows = mainRows.filter(row => !row.errors.length);
  const errorRows = parsed.rows.filter(row => row.errors.length);
  const linkedErrors = isLinkedWorkbook(parsed.rows) ? errorRows.length : 0;
  // Hash before staging, remove raw PINs even on invalid rows.
  if (domain === "employees") for (const row of parsed.rows) {
    if (!row.errors.length && typeof row.payload.pin === "string") row.payload.pin_hash = await hashPin(row.payload.pin);
    delete row.payload.pin;
  }
  let batchId: string;
  try {
    batchId = await stageImport(db, { companyId: session.company_id, domain, outletId, fileName: file.name.slice(0, 255), rows: parsed.rows });
  } catch { return NextResponse.json({ error: "Gagal menyimpan hasil validasi. Silakan coba lagi." }, { status: 500 }); }
  const ingredients = parsed.rows.filter(row => rowKind(row, domain) === "ingredient");
  const existingIngredientIds = new Set(parsed.rows.map(row => row.payload.resolved_ingredient_id).filter(Boolean));
  return NextResponse.json({
    batch_id: batchId,
    summary: {
      total: parsed.rows.length, main_total: mainRows.length, valid: validRows.length, errors: errorRows.length,
      linked_errors: linkedErrors, can_confirm: validRows.length > 0 && linkedErrors === 0,
      new_ingredients: ingredients.filter(row => row.payload.ingredient_mode === "new").length,
      existing_ingredients: existingIngredientIds.size,
      recipes: parsed.rows.filter(row => rowKind(row, domain) === "recipe").length,
      max_rows: IMPORT_MAX_ROWS[domain], max_recipe_rows: IMPORT_MAX_RECIPE_ROWS,
      limit_used: budgetFor(limit) !== null ? `${limit.current ?? 0}/${limit.max}` : null,
      limit_note: budgetFor(limit) === 0 ? "Kuota paket sudah penuh untuk data baru" : null,
    },
    rows: parsed.rows.map(row => ({ row_number: row.rowNumber, sheet_name: row.payload.sheet_name, sheet_row: row.payload.sheet_row,
      kind: rowKind(row, domain), ingredient_mode: row.payload.ingredient_mode,
      name: String(row.payload.name ?? row.payload.username ?? (row.payload.kind === "recipe" ? `${row.payload.product_code} → ${row.payload.ingredient_code || row.payload.ingredient_id}` : "-")), errors: row.errors })),
    sheet_max_note: null,
  });
}
