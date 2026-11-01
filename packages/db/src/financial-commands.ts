import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DatabaseClient, Row } from "./query";

export class FinancialCommandError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "FinancialCommandError";
  }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function runFinancialCommand<T>(db: DatabaseClient, input: {
  companyId: string;
  requestId?: string | null;
  command: string;
  payload: unknown;
  execute: (tx: DatabaseClient) => Promise<T>;
}): Promise<T> {
  const requestId = input.requestId?.trim() || null;
  if (!requestId) return input.execute(db);
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(requestId)) throw new FinancialCommandError("INVALID_REQUEST_ID", "Request identity tidak valid");
  if (!input.command.trim()) throw new FinancialCommandError("INVALID_COMMAND", "Command tidak valid");
  const hash = createHash("sha256").update(stable(input.payload)).digest("hex");
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.companyId},0))`);
    const [existing] = await tx.execute(sql`select command,request_hash,result
      from app_private.financial_requests where company_id=${input.companyId} and request_id=${requestId}`);
    if (existing) {
      if (existing.command !== input.command || existing.request_hash !== hash) {
        throw new FinancialCommandError("REQUEST_CONFLICT", "Request identity dipakai untuk payload berbeda", 409);
      }
      return existing.result as T;
    }
    const result = await input.execute(tx);
    await tx.execute(sql`insert into app_private.financial_requests
      (company_id,request_id,command,request_hash,result)
      values (${input.companyId},${requestId},${input.command},${hash},${JSON.stringify(result ?? null)}::jsonb)`);
    return result;
  });
}

export async function getFinancialCommand(db: DatabaseClient, companyId: string, requestId: string): Promise<Row | null> {
  const [row] = await db.execute(sql`select * from app_private.financial_requests
    where company_id=${companyId} and request_id=${requestId}`);
  return row ?? null;
}
