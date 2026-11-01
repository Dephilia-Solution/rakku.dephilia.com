import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { signJwt, verifyJwt } from "./jwt";
import { signOwnerSession, verifyOwnerSession } from "../../../apps/owner/src/lib/auth/session-token";
import { signSession, verifySession } from "../../../apps/pos/src/lib/auth/session-token";
const secret = new TextEncoder().encode("isolated-test-secret-at-least-32-characters");
test("tokens cannot cross application or login-stage boundaries", async () => {
  const token = await signJwt(secret, { user_id: "test" }, 600, "pos_pending");
  assert.ok(await verifyJwt(secret, token, "pos_pending"));
  assert.equal(await verifyJwt(secret, token, "pos"), null);
  assert.equal(await verifyJwt(secret, token, "owner"), null);
  const confirmation = await signJwt(secret, { owner_id: "test" }, 600, "owner_verify_email");
  assert.equal(await verifyJwt(secret, confirmation, "owner"), null);
});
test("signed tokens without expiry, with expired claims or a different issuer are rejected", async () => {
  const immortal = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer("rakku").setAudience("pos").setIssuedAt().sign(secret);
  assert.equal(await verifyJwt(secret, immortal, "pos"), null);
  const expired = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer("rakku").setAudience("pos").setIssuedAt().setExpirationTime(1).sign(secret);
  assert.equal(await verifyJwt(secret, expired, "pos"), null);
  await assert.rejects(() => signJwt(secret, {}, 0, "pos_pending"));
  await assert.rejects(() => signJwt(secret, {}, -1, "pos"));
});
test("application verifiers reject incomplete sessions even with a valid signature", async () => {
  const previousOwner = process.env.OWNER_JWT_SECRET;
  const previousPos = process.env.POS_JWT_SECRET;
  process.env.OWNER_JWT_SECRET = process.env.POS_JWT_SECRET = "isolated-session-test-secret-at-least-32-characters";
  try {
    const owner = { session_id: "session", owner_id: "owner", email: "test@example.test", name: "Test", company_id: null, company_name: null, company_slug: null };
    const ownerToken = await signOwnerSession(owner, true);
    assert.equal((await verifyOwnerSession(ownerToken))?.owner_id, "owner");
    assert.equal(await verifySession(ownerToken), null);
    const invalidOwner = await signOwnerSession({ ...owner, session_id: undefined });
    assert.equal(await verifyOwnerSession(invalidOwner), null);
    const pos = { session_id: "session", user_id: "user", company_id: "company", outlet_id: "outlet", role_id: "role", user_name: "User", company_name: "Company", outlet_name: "Outlet" };
    assert.equal((await verifySession(await signSession(pos)))?.user_id, "user");
    assert.equal(await verifySession(await signSession({ ...pos, outlet_id: "" })), null);
  } finally {
    if (previousOwner === undefined) delete process.env.OWNER_JWT_SECRET; else process.env.OWNER_JWT_SECRET = previousOwner;
    if (previousPos === undefined) delete process.env.POS_JWT_SECRET; else process.env.POS_JWT_SECRET = previousPos;
  }
});
