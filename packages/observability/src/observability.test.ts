import { test } from "node:test";
import assert from "node:assert/strict";
import { categorizeError, correlationId, logError, redact } from "./index";

test("redaction removes secrets, PII and nested sensitive values", () => {
  const result = redact({
    requestId: "req-1",
    password: "plain-password",
    nested: { api_key: "key-123", authorization: "Bearer abc", safe: "value" },
    email: "owner@example.test",
    amount: 1000,
    items: [{ account_number: "12345678", note: "ok" }],
  }) as Record<string, unknown>;
  const text = JSON.stringify(result);
  assert.equal(text.includes("plain-password"), false);
  assert.equal(text.includes("key-123"), false);
  assert.equal(text.includes("owner@example.test"), false);
  assert.equal(text.includes("12345678"), false);
  assert.equal(result.requestId, "req-1");
  assert.equal(result.amount, 1000);
});

test("correlation IDs are bounded and safe", () => {
  assert.equal(correlationId("vessel:abc-123"), "vessel:abc-123");
  assert.notEqual(correlationId("bad value with spaces"), "bad value with spaces");
  assert.match(correlationId(null), /^[0-9a-f-]{36}$/i);
});

test("error taxonomy is stable for operational alerts", () => {
  assert.equal(categorizeError(Object.assign(new Error("Forbidden"), { code: "42501" })), "AUTHORIZATION");
  assert.equal(categorizeError(new Error("provider timeout")), "PROVIDER_UNAVAILABLE");
  assert.equal(categorizeError(new Error("duplicate request")), "CONFLICT");
  assert.equal(categorizeError(new Error("invalid amount")), "VALIDATION");
});

test("structured log emits JSON without leaking a secret", () => {
  const writes: string[] = [];
  const original = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { writes.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try {
    logError("test.failure", new Error("timeout"), {
      correlation_id: "corr-1", token: "secret-token", provider: "vessel",
    });
  } finally {
    process.stderr.write = original;
  }
  const line = writes.join("");
  assert.equal(line.includes("secret-token"), false);
  const record = JSON.parse(line);
  assert.equal(record.level, "error");
  assert.equal(record.event, "test.failure");
  assert.equal(record.correlation_id, "corr-1");
  assert.equal(record.error_category, "PROVIDER_UNAVAILABLE");
});
