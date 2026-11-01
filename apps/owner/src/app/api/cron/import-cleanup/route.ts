import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { uploadFile, deleteFile } from "@rakku/silos-client";
import { cleanupExpiredImports, findImportCleanupCompanies } from "@/lib/import/import-assets";
import { logError } from "@rakku/observability";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient(), deadline = Date.now() + 120_000;
  const companies = await findImportCleanupCompanies(db);
  let processed = 0, failed = 0, batches = 0, deletions = 0;
  for (const company of companies) {
    if (Date.now() > deadline) break;
    try {
      const result = await cleanupExpiredImports(db, String(company.id), String(company.owner_id), { uploadFile, deleteFile });
      processed++; batches += result.batches; deletions += result.delete_attempts;
    } catch (error) { failed++; logError("import.cleanup.failed", error, { company_id: company.id }); }
  }
  return NextResponse.json({ processed, failed, batches, delete_attempts: deletions, deferred: companies.length - processed - failed }, { headers: { "Cache-Control": "no-store" } });
}
