import type { DemoState } from "./models";
import { clone, fail, record, text } from "./business";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(record(value))
    .filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  return value;
}

/** Called after authorization/scope checks, on run()'s private transaction clone. */
export function withRequestReceipt<T>(state: DemoState, requestId: unknown, operation: string, payload: unknown, execute: () => T): T {
  if (requestId === undefined) return execute();
  const request_id = text(requestId, "request_id").toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(request_id)) fail("request_id must be a UUID");
  const signature = JSON.stringify(canonical({ actor: state.session.mode === "owner" ? "owner" : state.session.employee_id, payload }));
  const previous = state.request_receipts?.find(receipt => receipt.request_id === request_id);
  if (previous) {
    if (previous.operation !== operation || previous.signature !== signature) fail("IDEMPOTENCY_CONFLICT: request_id was already used for a different operation or payload");
    return clone(previous.result) as T;
  }
  const result = execute();
  (state.request_receipts ??= []).push({ request_id, operation, signature, result: clone(result) });
  return result;
}
