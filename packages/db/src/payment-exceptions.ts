import { sql } from "drizzle-orm";
import type { DatabaseClient, Row } from "./query";

export interface PaymentExceptionRecord {
  intent_id: string;
  company_id: string;
  order_id: string;
  amount: number;
  reason: string;
  status: "open" | "investigating" | "resolved";
  assigned_to: string | null;
  resolution_type: string | null;
  resolution_note: string | null;
  resolution_reference: string | null;
  proof_url: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  provider_payload: Record<string, unknown>;
  created_at: string;
}

export class PaymentExceptionError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "PaymentExceptionError";
  }
}

function exception(row: Row): PaymentExceptionRecord {
  return { ...(row as PaymentExceptionRecord), amount: Number(row.amount) };
}

export async function updatePaymentException(db: DatabaseClient, input: {
  intentId: string;
  actor: string;
  action: "investigate" | "resolve";
  note?: string | null;
  resolutionType?: string | null;
  reference?: string | null;
  proofUrl?: string | null;
  assignedTo?: string | null;
}): Promise<PaymentExceptionRecord> {
  if (!/^[0-9a-f-]{36}$/i.test(input.intentId)) throw new PaymentExceptionError("INVALID_ID", "Intent ID tidak valid");
  if (!input.actor?.trim()) throw new PaymentExceptionError("INVALID_ACTOR", "Actor tidak valid");
  if (!["investigate", "resolve"].includes(input.action)) throw new PaymentExceptionError("INVALID_ACTION", "Aksi tidak valid");
  if (input.action === "resolve" && !input.note?.trim()) {
    throw new PaymentExceptionError("NOTE_REQUIRED", "Catatan resolusi wajib diisi");
  }
  return db.transaction(async tx => {
    const [row] = await tx.execute(sql`select * from app_private.payment_reconciliation
      where intent_id=${input.intentId} for update`);
    if (!row) throw new PaymentExceptionError("NOT_FOUND", "Exception tidak ditemukan", 404);
    const current = exception(row);
    if (current.status === "resolved") return current;
    const status = input.action === "resolve" ? "resolved" : "investigating";
    const [updated] = await tx.execute(sql`update app_private.payment_reconciliation set
      status=${status}, assigned_to=${input.assignedTo ?? current.assigned_to ?? input.actor},
      resolution_type=${input.action === "resolve" ? (input.resolutionType ?? "manual_review") : current.resolution_type},
      resolution_note=${input.action === "resolve" ? input.note!.trim() : current.resolution_note},
      resolution_reference=${input.action === "resolve" ? (input.reference ?? null) : current.resolution_reference},
      proof_url=${input.action === "resolve" ? (input.proofUrl ?? null) : current.proof_url},
      resolved_by=${input.action === "resolve" ? input.actor : current.resolved_by},
      resolved_at=${input.action === "resolve" ? new Date().toISOString() : current.resolved_at}
      where intent_id=${input.intentId} returning *`);
    if (!updated) throw new PaymentExceptionError("UPDATE_FAILED", "Gagal memperbarui exception", 500);
    return exception(updated);
  });
}
