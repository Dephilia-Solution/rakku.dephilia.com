import { createAdminClient } from "@rakku/db";
import { consumeSession, issueSession } from "@rakku/db/sessions";
import { signJwt, verifyJwt } from "@rakku/auth-utils/jwt";
function secret() {
  const value = process.env.OWNER_JWT_SECRET;
  if (!value || value.length < 32) throw new Error("OWNER_JWT_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}
export async function signVerification(owner: { id: string; email: string }) {
  const session_id = await issueSession(createAdminClient(), "verify_email", owner.id, 3600);
  return signJwt(secret(), { owner_id: owner.id, email: owner.email, session_id }, 3600, "owner_verify_email");
}
export async function consumeVerification(token: string) {
  const payload = await verifyJwt<{ owner_id: string; email: string; session_id: string }>(secret(), token, "owner_verify_email");
  if (!payload || ![payload.owner_id, payload.email, payload.session_id].every(v => typeof v === "string" && v)) throw new Error("Invalid verification");
  return createAdminClient().transaction(async tx => {
    await consumeSession(tx, payload.session_id, "verify_email", payload.owner_id);
    const { data: owner, error } = await tx.from("owners").update({ email_verified_at: new Date().toISOString() })
      .eq("id", payload.owner_id).eq("email", payload.email).eq("is_active", true).select("id, email, name").single();
    if (error || !owner) throw new Error("Owner not found");
    return owner as { id: string; email: string; name: string };
  });
}
