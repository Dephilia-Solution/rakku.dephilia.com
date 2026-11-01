import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, sql } from "@rakku/db";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@rakku/shared-types";
import { IMPORT_BACKEND_DOMAINS as IMPORT_DOMAINS, type BackendImportDomain as ImportDomain } from "@/lib/import/import-spec";
import { logError } from "@rakku/observability";

type OwnerWithCompany = OwnerSession & { company_id: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

interface ImportBatchView {
  id: string;
  domain: string;
  outlet_id: string | null;
  outlet_name: string | null;
  file_name: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  imported_rows: number;
  status: string;
  created_at: string;
  confirmed_at: string | null;
}

interface ImportRowView {
  row_number: number;
  payload: unknown;
  is_valid: boolean;
  errors: unknown;
}

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const session = await requireOwner();
    if (!session) {
      return NextResponse.json(
        { error: "Anda belum memiliki perusahaan" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batch_id");
    const domain = searchParams.get("domain");
    const outletId = searchParams.get("outlet_id");
    if ((domain && !IMPORT_DOMAINS.includes(domain as ImportDomain)) || (outletId && !UUID.test(outletId))) {
      return NextResponse.json({ error: "Filter riwayat tidak valid" }, { status: 400 });
    }
    if (batchId && !UUID.test(batchId)) {
      return NextResponse.json({ error: "batch_id tidak valid" }, { status: 400 });
    }
    const supabase = createAdminClient();

    if (batchId) {
      const [batch] = (await supabase.execute(sql`
        select b.id, b.domain, b.outlet_id, b.file_name, b.total_rows, b.valid_rows,
                b.error_rows, b.imported_rows, b.status, b.created_at, b.confirmed_at,
                b.schema_version,b.context,b.expires_at,b.created_by_owner_id,b.confirmed_by_owner_id,b.confirmation_options,b.confirmation_result,
               o.name as outlet_name
        from app_private.import_batches b
        left join public.outlets o on o.id = b.outlet_id and o.company_id = b.company_id
        where b.id = ${batchId} and b.company_id = ${session.company_id} and b.status = 'confirmed'
      `)) as (ImportBatchView | undefined)[];

      if (!batch) {
        return NextResponse.json({ error: "Impor berhasil tidak ditemukan" }, { status: 404 });
      }

      const rows = (await supabase.execute(sql`
        select row_number, payload - 'pin' - 'pin_hash' as payload, is_valid, errors,warnings
        from app_private.import_rows
        where batch_id = ${batchId}
        order by row_number
      `)) as ImportRowView[];

      return NextResponse.json({ batch, rows: rows ?? [] });
    }

    const batches = (await supabase.execute(sql`
      select id, domain, outlet_id, file_name, total_rows, valid_rows, error_rows,
              imported_rows, status, created_at, confirmed_at,schema_version,expires_at,created_by_owner_id,confirmed_by_owner_id,confirmation_options,confirmation_result,
             null::text as outlet_name
      from app_private.import_batches
      where company_id = ${session.company_id}
        and status = 'confirmed'
        ${domain ? sql`and domain=${domain}` : sql``}
        ${outletId ? sql`and outlet_id=${outletId}` : sql``}
      order by confirmed_at desc nulls last, created_at desc
      limit 20
    `)) as ImportBatchView[];

    return NextResponse.json({ batches: batches ?? [] });
  } catch (error) {
    logError("owner.import.history.failed", error, { request_id: requestId });
    return NextResponse.json({ error: "Riwayat impor tidak dapat dimuat. Coba muat ulang.", request_id: requestId }, { status: 500 });
  }
}
