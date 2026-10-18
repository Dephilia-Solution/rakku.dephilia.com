import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { JWTPayload } from "jose";

export async function signJwt(
  secret: Uint8Array,
  payload: Record<string, unknown>,
  expiresInSec: number,
  purpose = "session"
): Promise<string> {
  if (!Number.isSafeInteger(expiresInSec) || expiresInSec <= 0) throw new Error("Token lifetime must be positive");
  const jwt = new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("rakku")
    .setAudience(purpose)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSec}s`);

  return jwt.sign(secret);
}

export async function verifyJwt<T>(
  secret: Uint8Array,
  token: string,
  purpose = "session"
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"], issuer: "rakku", audience: purpose,
      requiredClaims: ["exp", "iat", "iss", "aud"],
    });
    return payload as unknown as T;
  } catch {
    return null;
  }
}
