import { createNeonAuth } from "@neondatabase/auth/next/server";

let instance: ReturnType<typeof createNeonAuth> | undefined;
export function getAuth() {
  if (instance) return instance;
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret || secret.length < 32) {
    throw new Error("NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET (32+ characters) are required");
  }
  instance = createNeonAuth({ baseUrl, cookies: { secret, sessionDataTtl: 60 } });
  return instance;
}
