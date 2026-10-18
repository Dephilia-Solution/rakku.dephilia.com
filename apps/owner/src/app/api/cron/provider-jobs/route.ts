import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { countJobs } from "@rakku/db/jobs";
import { runDueJobs } from "@/lib/billing/provider-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`
    || request.headers.get("x-cron-secret") === secret;
}

function bounded(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();
  if (request.nextUrl.searchParams.get("dry") === "1") {
    return NextResponse.json({ ok: true, dry: true, counts: await countJobs(db) });
  }
  const result = await runDueJobs(db, {
    workerId: `provider-cron-${randomUUID()}`,
    batchSize: bounded(request.nextUrl.searchParams.get("limit"), 10, 1, 50),
    deadlineMs: bounded(request.nextUrl.searchParams.get("deadline_ms"), 15000, 1000, 50000),
    leaseSeconds: 60,
    maxBatches: 20,
  });
  return NextResponse.json({ ok: true, result });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
