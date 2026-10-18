import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";
export type ErrorCategory =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_VERIFICATION"
  | "DATABASE"
  | "INTERNAL";

const sensitive = /(password|passwd|pin|token|secret|cookie|authorization|api[_-]?key|account[_-]?number|card|email|phone|customer[_-]?name|owner[_-]?name|full[_-]?name|otp)/i;
const MAX_STRING = 500;
const MAX_DEPTH = 5;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 50).map(item => redact(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key, sensitive.test(key) ? "[redacted]" : redact(item, depth + 1),
    ]));
  }
  return undefined;
}

export function correlationId(value?: string | null): string {
  return value && /^[A-Za-z0-9._:-]{1,200}$/.test(value) ? value : randomUUID();
}

export function categorizeError(error: unknown): ErrorCategory {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (["42501", "FORBIDDEN"].includes(code ?? "") || /forbidden|akses ditolak|permission/i.test(message)) return "AUTHORIZATION";
  if (/unauthorized|authentication|kredensial|PIN salah/i.test(message)) return "AUTHENTICATION";
  if (/not found|tidak ditemukan|404/i.test(message)) return "NOT_FOUND";
  if (/conflict|sudah berubah|revision|duplicate|409/i.test(message)) return "CONFLICT";
  if (/provider|vessel|doku|timeout|ECONN|fetch failed/i.test(message)) return "PROVIDER_UNAVAILABLE";
  if (/identity|amount mismatch|invoice mismatch|verification/i.test(message)) return "PROVIDER_VERIFICATION";
  if (/database|postgres|DB_|23\d{3}|42\d{3}/i.test(message)) return "DATABASE";
  if (/invalid|wajib|tidak valid|400/i.test(message)) return "VALIDATION";
  return "INTERNAL";
}

export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.RAKKU_SERVICE || "rakku",
    environment: process.env.RAKKU_ENVIRONMENT || process.env.NODE_ENV || "development",
    event,
    ...((redact(fields) as Record<string, unknown>) ?? {}),
  };
  const line = `${JSON.stringify(record)}\n`;
  if (level === "error") process.stderr.write(line);
  else process.stdout.write(line);
}

export function logError(event: string, error: unknown, fields: Record<string, unknown> = {}): void {
  logEvent("error", event, {
    ...fields,
    error_category: categorizeError(error),
    error: error instanceof Error ? error.message : String(error),
  });
}
