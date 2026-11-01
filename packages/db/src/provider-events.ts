import { sql } from "drizzle-orm";
import type { DatabaseClient, Row } from "./query";
import { enqueueJob } from "./jobs";

export interface ProviderEventRecord {
  id: string;
  provider: string;
  event_key: string;
  event_type: string;
  transaction_id: string | null;
  invoice_number: string | null;
  payload: Record<string, unknown>;
  signature_status: "valid" | "invalid" | "unverified";
  correlation_id: string | null;
  received_at: string;
  processed_at: string | null;
  last_error: string | null;
}

function event(row: Row): ProviderEventRecord {
  return { ...(row as ProviderEventRecord), payload: (row.payload ?? {}) as Record<string, unknown> };
}

export async function storeProviderEvent(db: DatabaseClient, input: {
  provider: string;
  eventKey: string;
  eventType: string;
  transactionId?: string | null;
  invoiceNumber?: string | null;
  payload: Record<string, unknown>;
  signatureStatus: "valid" | "invalid" | "unverified";
  correlationId?: string | null;
  enqueue?: boolean;
}): Promise<{ event: ProviderEventRecord; inserted: boolean }> {
  return db.transaction(async tx => {
    const rows = await tx.execute(sql`insert into app_private.provider_events
      (provider,event_key,event_type,transaction_id,invoice_number,payload,signature_status,correlation_id)
      values (${input.provider},${input.eventKey},${input.eventType},${input.transactionId ?? null},
        ${input.invoiceNumber ?? null},${JSON.stringify(input.payload)}::jsonb,${input.signatureStatus},
        ${input.correlationId ?? null})
      on conflict (event_key) do nothing returning *`);
    if (!rows.length) {
      const [existing] = await tx.execute(sql`select * from app_private.provider_events where event_key=${input.eventKey}`);
      if (!existing) throw new Error("Provider event could not be read after insert");
      return { event: event(existing), inserted: false };
    }
    const stored = event(rows[0]);
    if (input.enqueue !== false) {
      await enqueueJob(tx, {
        kind: "vessel.webhook",
        uniqueKey: stored.id,
        payload: { eventId: stored.id },
        correlationId: stored.correlation_id,
      });
    }
    return { event: stored, inserted: true };
  });
}

export async function getProviderEvent(db: DatabaseClient, id: string): Promise<ProviderEventRecord | null> {
  const [row] = await db.execute(sql`select * from app_private.provider_events where id=${id}`);
  return row ? event(row) : null;
}

export async function markProviderEventProcessed(db: DatabaseClient, id: string, lastError: string | null = null): Promise<void> {
  await db.execute(sql`update app_private.provider_events set processed_at=now(), last_error=${lastError}
    where id=${id} and processed_at is null`);
}

export async function markProviderEventError(db: DatabaseClient, id: string, error: unknown): Promise<void> {
  const message = (error instanceof Error ? error.message : String(error))
    .replace(/(bearer|api[_-]?key|secret|token)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 1000);
  await db.execute(sql`update app_private.provider_events set last_error=${message}
    where id=${id} and processed_at is null`);
}
