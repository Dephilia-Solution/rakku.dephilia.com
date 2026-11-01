import { NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { uploadFile,deleteFile } from "@rakku/silos-client";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { cleanupExpiredImports } from "@/lib/import/import-assets";

export const runtime="nodejs";
export async function POST() {
  const session=await getOwnerSessionFromCookies();
  if(!session?.company_id) return NextResponse.json({error:"Sesi berakhir"},{status:401});
  try { return NextResponse.json(await cleanupExpiredImports(createAdminClient(),session.company_id,session.owner_id,{uploadFile,deleteFile})); }
  catch { return NextResponse.json({error:"Cleanup belum selesai. Ulangi untuk mencoba penghapusan kembali."},{status:500}); }
}
