import { signJwt, verifyJwt } from "@rakku/auth-utils/jwt";
import type { TenantSession } from "@rakku/shared-types";

function secret() {
  const value = process.env.POS_JWT_SECRET;
  if (!value || value.length < 32) throw new Error("POS_JWT_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}
export async function signSession(session: TenantSession) {
  return signJwt(secret(), { ...session }, 12 * 60 * 60, "pos");
}
export async function verifySession(token: string): Promise<TenantSession | null> {
  const payload = await verifyJwt<TenantSession>(secret(), token, "pos");
  if (!payload || ![payload.session_id, payload.user_id, payload.company_id, payload.outlet_id, payload.role_id, payload.user_name, payload.company_name, payload.outlet_name].every(v => typeof v === "string" && v.length > 0)) return null;
  return { session_id: payload.session_id, user_id: payload.user_id, company_id: payload.company_id, outlet_id: payload.outlet_id,
    role_id: payload.role_id, user_name: payload.user_name, company_name: payload.company_name, outlet_name: payload.outlet_name };
}
