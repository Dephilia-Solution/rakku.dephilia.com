import { signJwt, verifyJwt } from "@rakku/auth-utils/jwt";
import type { TenantSession } from "@rakku/shared-types";

function secret() {
  const value = process.env.POS_JWT_SECRET;
  if (!value || value.length < 32) throw new Error("POS_JWT_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}
export async function signSession(session: TenantSession) {
  return signJwt(secret(), { ...session }, 12 * 60 * 60);
}
export async function verifySession(token: string): Promise<TenantSession | null> {
  const payload = await verifyJwt<TenantSession & { exp?: number }>(secret(), token);
  if (!payload?.exp) return null;
  return { user_id: payload.user_id, company_id: payload.company_id, outlet_id: payload.outlet_id,
    role_id: payload.role_id, user_name: payload.user_name, company_name: payload.company_name, outlet_name: payload.outlet_name };
}
