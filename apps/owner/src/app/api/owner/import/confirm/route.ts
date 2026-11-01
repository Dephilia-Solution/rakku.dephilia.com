import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { confirmImport, ImportError } from "@rakku/db/imports";
import { checkLimit, checkFeature } from "@rakku/plans";
import { recordPurchase } from "@rakku/inventory";
import { uploadFile, deleteFile } from "@rakku/silos-client";
import { prepareImportAssets, cleanupImportAssets, releaseImportAssetLease, cleanupExpiredImports } from "@/lib/import/import-assets";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.batch_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.batch_id)) {
    return NextResponse.json({ error: "batch_id tidak valid" }, { status: 400 });
  }
  const conflictMode = body.conflict_mode ?? "skip";
  if (conflictMode !== "skip" && conflictMode !== "update") return NextResponse.json({ error: "Pilih Lewati atau Perbarui untuk kode yang sudah tersedia." }, { status: 400 });
  if (typeof body.allow_new_categories !== "boolean") return NextResponse.json({ error: "Konfirmasi kategori baru wajib diberikan." }, { status: 400 });
  const db=createAdminClient(),scope={companyId:session.company_id,batchId:body.batch_id,ownerId:session.owner_id},provider={uploadFile,deleteFile};
  let token:string|null=null;
  try {
    await cleanupExpiredImports(db,session.company_id,session.owner_id,provider);
    token=await prepareImportAssets(db,scope,provider);
    const result = await confirmImport(db, {
      companyId: session.company_id, batchId: body.batch_id, ownerId: session.owner_id,
      conflictMode, allowNewCategories: body.allow_new_categories,
       checkQuota: async (tx, domain, count) => domain === "purchases" || (await checkLimit(tx, session.company_id!, domain, count)).allowed,
       checkInventoryAdvanced:async tx=>(await checkFeature(tx,session.company_id!,"inventory_advanced")).allowed,
       recordPurchase, imageLeaseToken:token??undefined,
    });
    if(token) await cleanupImportAssets(db,scope,provider,token,true).catch(()=>undefined);
    return NextResponse.json(result);
  } catch (error) {
    if(token) await cleanupImportAssets(db,scope,provider,token,true).catch(()=>undefined);
    if (error instanceof ImportError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Impor gagal. Tidak ada data yang ditambahkan; Anda dapat mencoba lagi." }, { status: 500 });
  } finally {
    if(token) await releaseImportAssetLease(db,scope,token).catch(()=>undefined);
  }
}
