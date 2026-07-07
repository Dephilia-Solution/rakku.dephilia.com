import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export async function signJwt(
  secret: Uint8Array,
  payload: Record<string, unknown>,
  expiresInSec?: number
): Promise<string> {
  const jwt = new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt();

  if (expiresInSec) {
    jwt.setExpirationTime(`${expiresInSec}s`);
  }

  return jwt.sign(secret);
}

export async function verifyJwt<T>(
  secret: Uint8Array,
  token: string
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as T;
  } catch {
    return null;
  }
}
