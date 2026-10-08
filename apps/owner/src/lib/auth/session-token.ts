import { signJwt, verifyJwt } from "@rakku/auth-utils/jwt";
import type { OwnerSession } from "@rakku/shared-types";

export const OWNER_SESSION_DURATION = 24 * 60 * 60;
export const OWNER_REMEMBER_DURATION_SECONDS = 30 * 24 * 60 * 60;
function secret() {
  const value = process.env.OWNER_JWT_SECRET;
  if (!value || value.length < 32) throw new Error("OWNER_JWT_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}
export async function signOwnerSession(session: OwnerSession, remember = false) {
  return signJwt(secret(), { ...session }, remember ? OWNER_REMEMBER_DURATION_SECONDS : OWNER_SESSION_DURATION);
}
export async function verifyOwnerSession(token: string): Promise<OwnerSession | null> {
  const payload = await verifyJwt<OwnerSession>(secret(), token);
  if (!payload) return null;
  return { owner_id: payload.owner_id, email: payload.email, name: payload.name,
    company_id: payload.company_id ?? null, company_name: payload.company_name ?? null, company_slug: payload.company_slug ?? null };
}
