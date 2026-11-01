import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyVesselWebhook } from "./index";

const secret = "isolated-vessel-webhook-secret";
const raw = JSON.stringify({ transaction_id: "trx-1", invoice_number: "INV-1", payment_status: "success" });
const headers = (values: Record<string, string>) => ({
  get(name: string) { return values[name.toLowerCase()] ?? null; },
});
const sign = (payload: string) => createHmac("sha256", secret).update(payload).digest("hex");

test("webhook without a configured secret is explicitly unverified", () => {
  const previous = process.env.VESSEL_WEBHOOK_SECRET;
  delete process.env.VESSEL_WEBHOOK_SECRET;
  try {
    assert.deepEqual(verifyVesselWebhook({ rawBody: raw, headers: headers({}) }), {
      status: "unverified", reason: "Webhook secret belum dikonfigurasi",
    });
  } finally {
    if (previous === undefined) delete process.env.VESSEL_WEBHOOK_SECRET;
    else process.env.VESSEL_WEBHOOK_SECRET = previous;
  }
});

test("timestamped HMAC accepts the expected signature and rejects tampering or stale replay", () => {
  const timestamp = "1700000000";
  const signature = sign(`${timestamp}.${raw}`);
  const input = { rawBody: raw, secret, now: 1700000000 };
  assert.equal(verifyVesselWebhook({ ...input, headers: headers({
    "x-vessel-signature": `sha256=${signature}`, "x-vessel-timestamp": timestamp,
  }) }).status, "valid");
  assert.equal(verifyVesselWebhook({ ...input, headers: headers({
    "x-vessel-signature": sign("tampered"), "x-vessel-timestamp": timestamp,
  }) }).status, "invalid");
  assert.equal(verifyVesselWebhook({ ...input, now: 1700000000 + 301, headers: headers({
    "x-vessel-signature": signature, "x-vessel-timestamp": timestamp,
  }) }).status, "invalid");
  assert.equal(verifyVesselWebhook({ ...input, headers: headers({
    "x-vessel-signature": signature,
  }) }).status, "invalid");
});

test("body-only signature mode is configurable without changing the default timestamped contract", () => {
  const previous = process.env.VESSEL_WEBHOOK_SIGNATURE_MODE;
  process.env.VESSEL_WEBHOOK_SIGNATURE_MODE = "body";
  try {
    assert.equal(verifyVesselWebhook({
      rawBody: raw, secret, headers: headers({ "x-vessel-signature": sign(raw) }),
    }).status, "valid");
  } finally {
    if (previous === undefined) delete process.env.VESSEL_WEBHOOK_SIGNATURE_MODE;
    else process.env.VESSEL_WEBHOOK_SIGNATURE_MODE = previous;
  }
});
