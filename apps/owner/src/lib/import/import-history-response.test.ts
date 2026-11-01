import assert from "node:assert/strict";
import test from "node:test";
import { readImportHistoryResponse, successfulImportHistory } from "./import-history-response";

test("history includes only confirmed imports, never previews or failed batches", () => {
  const batches = ["validated", "failed", "expired", "confirmed"].map((status, index) => ({ id: index, status }));
  assert.deepEqual(successfulImportHistory(batches).map(batch => batch.status), ["confirmed"]);
});

test("history response reader accepts JSON and reports empty or invalid HTTP responses clearly", async () => {
  assert.deepEqual(await readImportHistoryResponse(new Response('{"batches":[]}')), { batches: [] });
  await assert.rejects(() => readImportHistoryResponse(new Response("", { status: 500 })), /HTTP 500/);
  await assert.rejects(() => readImportHistoryResponse(new Response("not-json")), /kosong atau tidak valid/);
});
