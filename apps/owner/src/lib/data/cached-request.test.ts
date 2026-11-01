import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { createCachedOwnerRequest } from "./cached-request";

test("catalog consumers share a fresh GET but receive independently readable responses", async () => {
  const client = new QueryClient(); let calls = 0;
  const request = createCachedOwnerRequest(client, async () => {
    calls++; await new Promise(resolve => setTimeout(resolve, 5));
    return Response.json({ products: ["Coffee"] });
  });
  try {
    const responses = await Promise.all([request("/api/owner/products?outlet_id=A"), request("/api/owner/products?outlet_id=A")]);
    assert.deepEqual(await Promise.all(responses.map(response => response.json())), [{ products: ["Coffee"] }, { products: ["Coffee"] }]);
    await (await request("/api/owner/products?outlet_id=A")).json();
    assert.equal(calls, 1);
    await request("/api/owner/products?outlet_id=B");
    assert.equal(calls, 2, "outlet keys must remain separate");
  } finally { client.clear(); }
});

test("successful mutations invalidate catalog while auth, balances and stock bypass the cache", async () => {
  const client = new QueryClient(); let calls = 0;
  const request = createCachedOwnerRequest(client, async () => Response.json({ version: ++calls }));
  try {
    await request("/api/owner/products"); await request("/api/owner/products");
    assert.equal(calls, 1);
    await request("/api/owner/categories", { method: "POST" });
    await request("/api/owner/products");
    assert.equal(calls, 3);
    for (const path of ["/api/auth/owner/session", "/api/owner/balance", "/api/owner/ingredients", "/api/owner/orders"]) {
      await request(path); await request(path);
    }
    assert.equal(calls, 11);
    const anotherShell = new QueryClient();
    try {
      await createCachedOwnerRequest(anotherShell, async () => Response.json({ version: ++calls }))("/api/owner/products");
      assert.equal(calls, 12, "another identity/shell cannot inherit cached responses");
    } finally { anotherShell.clear(); }
  } finally { client.clear(); }
});

test("failed GETs are never served as fresh cached data and unmounted consumers cannot read a result", async () => {
  const client = new QueryClient(); let calls = 0;
  const request = createCachedOwnerRequest(client, async () => {
    calls++; return Response.json({ error: "Denied" }, { status: 403 });
  });
  try {
    assert.equal((await request("/api/owner/products")).status, 403);
    assert.equal((await request("/api/owner/products")).status, 403);
    assert.equal(calls, 2);
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const delayed = createCachedOwnerRequest(client, async () => { await waiting; return Response.json({ ok: true }); });
    const controller = new AbortController();
    const cancelled = delayed("/api/owner/categories", { signal: controller.signal });
    const alive = delayed("/api/owner/categories");
    const rejection = assert.rejects(cancelled, { name: "AbortError" });
    controller.abort(); release();
    await rejection;
    assert.deepEqual(await (await alive).json(), { ok: true });
  } finally { client.clear(); }
});
