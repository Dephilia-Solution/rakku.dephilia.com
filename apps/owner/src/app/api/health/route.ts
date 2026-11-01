import { NextResponse } from "next/server";
import { createAdminClient, sql } from "@rakku/db";
import { logError } from "@rakku/observability";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await createAdminClient().execute(sql`select 1`);
    return NextResponse.json({
      status: "ok", service: "owner", database: "reachable",
      latency_ms: Date.now() - started,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("health.owner.database_unavailable", error, { service: "owner" });
    return NextResponse.json({
      status: "unavailable", service: "owner", database: "unreachable",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
