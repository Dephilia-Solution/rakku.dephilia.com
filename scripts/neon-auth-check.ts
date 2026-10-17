import { config } from "dotenv";

config({ path: process.env.NEON_ENV_FILE || ".env.neon" });
async function main() {
  const base = process.env.NEON_AUTH_BASE_URL;
  if (!base) throw new Error("NEON_AUTH_BASE_URL is required");
  for (const origin of ["http://localhost:3002", "https://admin.rakku.dephilia.com", "https://superadmin-rakku.vercel.app"]) {
    const response = await fetch(`${base}/sign-in/email`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
      // Intentionally nonexistent account: test origin validation without creating
      // accounts, sending mail, or printing auth cookies/tokens.
      body: JSON.stringify({ email: "auth-smoke@rakku.invalid", password: "invalid-smoke-password" }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json().catch(() => ({}));
    console.log(`${origin}: HTTP ${response.status}, ${body.code ?? "no error code"}`);
    if (response.status !== 401 || body.code !== "INVALID_EMAIL_OR_PASSWORD") {
      process.exitCode = 1;
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
