import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { markProviderEventProcessed, storeProviderEvent } from "@rakku/db/provider-events";
import { logError, logEvent } from "@rakku/observability";
import { verifyVesselWebhook } from "@rakku/vessel-client";
import { runDueJobs } from "@/lib/billing/provider-jobs";

type JsonLike = Record<string, unknown>;

function pick(payload: JsonLike, key: string): string | null {
  const direct = payload[key];
  if (typeof direct === "string") return direct;
  const nested = payload.data;
  if (nested && typeof nested === "object") {
    const value = (nested as JsonLike)[key];
    if (typeof value === "string") return value;
  }
  return null;
}

function eventKey(input: {
  transactionId: string | null;
  invoiceNumber: string | null;
  status: string | null;
  paidAt: string | null;
  amount: string | null;
  raw: string;
  signatureStatus: "valid" | "invalid" | "unverified";
}): string {
  return createHash("sha256").update(JSON.stringify([
    "vessel", input.transactionId, input.invoiceNumber, input.status, input.paidAt,
    input.amount, input.signatureStatus, input.raw,
  ])).digest("hex");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 256 * 1024) {
    return NextResponse.json({ error: "Payload terlalu besar" }, { status: 413 });
  }
  const raw = await request.text();
  if (raw.length > 256 * 1024) {
    return NextResponse.json({ error: "Payload terlalu besar" }, { status: 413 });
  }
  let payload: JsonLike;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("invalid");
    payload = parsed as JsonLike;
  } catch {
    return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  }

  const transactionId = pick(payload, "transaction_id") ?? pick(payload, "id");
  const invoiceNumber = pick(payload, "invoice_number");
  const status = pick(payload, "payment_status") ?? pick(payload, "status");
  const paidAt = pick(payload, "paid_at");
  const amount = pick(payload, "amount");
  const verification = verifyVesselWebhook({ rawBody: raw, headers: request.headers });
  const key = eventKey({ transactionId, invoiceNumber, status, paidAt, amount, raw, signatureStatus: verification.status });
  const supabase = createAdminClient();

  if (verification.status === "invalid") {
    try {
      const stored = await storeProviderEvent(supabase, {
        provider: "vessel",
        eventKey: key,
        eventType: `payment.${status ?? "unknown"}`,
        transactionId,
        invoiceNumber,
        payload,
        signatureStatus: "invalid",
        correlationId: `vessel:${key.slice(0, 16)}`,
        enqueue: false,
      });
      if (stored.inserted) await markProviderEventProcessed(supabase, stored.event.id, "Signature provider tidak valid");
    } catch {
      // The invalid event is not trusted or processed; the response remains 401.
    }
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 401 });
  }

  try {
    const stored = await storeProviderEvent(supabase, {
      provider: "vessel",
      eventKey: key,
      eventType: `payment.${status ?? "unknown"}`,
      transactionId,
      invoiceNumber,
      payload,
      signatureStatus: verification.status,
      correlationId: `vessel:${key.slice(0, 16)}`,
    });
    if (stored.inserted) {
      try {
        await runDueJobs(supabase, {
          workerId: `webhook-${randomUUID()}`,
          batchSize: 2,
          deadlineMs: 4000,
          leaseSeconds: 30,
        });
      } catch (error) {
        logError("webhook.vessel.worker_deferred", error, { event_id: stored.event.id, correlation_id: stored.event.correlation_id });
      }
      logEvent("info", "webhook.vessel.stored", {
        event_id: stored.event.id, provider: "vessel", correlation_id: stored.event.correlation_id,
      });
    }
    return NextResponse.json({ received: true, duplicate: !stored.inserted });
  } catch (error) {
    logError("webhook.vessel.store_failed", error, { correlation_id: key.slice(0, 16) });
    return NextResponse.json({ received: false }, { status: 503 });
  }
}
