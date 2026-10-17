import assert from "node:assert/strict";

class ProductionClient {
  private cookies = new Map<string, string>();
  constructor(readonly origin: string) {}
  async request(path: string, body?: unknown) {
    const response = await fetch(`${this.origin}${path}`, {
      method: body === undefined ? "GET" : "POST", redirect: "manual", signal: AbortSignal.timeout(45000),
      headers: { Origin: this.origin, Cookie: Array.from(this.cookies).map(([key, value]) => `${key}=${value}`).join("; "),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(";", 1)[0]; const equal = first.indexOf("=");
      this.cookies.set(first.slice(0, equal), first.slice(equal + 1));
    }
    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = null; }
    return { response, data };
  }
}

async function owner() {
  const client = new ProductionClient(process.env.OWNER_PRODUCTION_URL || "https://rakku.vercel.app");
  const login = await client.request("/api/auth/owner/login", { email: "demo_owner@rakku.test", password: "DemoOwner2026!" });
  assert.equal(login.response.status, 200, `Owner login: HTTP ${login.response.status}; ${login.data?.error ?? "unexpected response"}`);
  const session = await client.request("/api/auth/owner/session");
  assert.equal(session.response.status, 200, "Owner session failed");
  const dashboard = await client.request("/dashboard");
  assert.equal(dashboard.response.status, 200, "Owner dashboard failed");
  console.log(`Owner production passed: ${client.origin}`);
}

async function pos() {
  const client = new ProductionClient(process.env.POS_PRODUCTION_URL || "https://pos-rakku.vercel.app");
  assert.equal((await client.request("/api/admin/products")).response.status, 401, "POS anonymous API not guarded");
  const login = await client.request("/api/auth/tenant/company", { code: "DEMO", password: "DemoPOS2026!" });
  assert.equal(login.response.status, 200, `POS company: HTTP ${login.response.status}; ${login.data?.error ?? "unexpected response"}`);
  const outlets = await client.request("/api/auth/tenant/outlet");
  assert.equal(outlets.response.status, 200, "POS outlet list failed");
  assert.ok(outlets.data?.outlets?.length);
  const selected = await client.request("/api/auth/tenant/outlet", { outlet_id: outlets.data.outlets[0].id });
  assert.equal(selected.response.status, 200, "POS outlet selection failed");
  const accounts = await client.request("/api/auth/tenant/accounts");
  assert.equal(accounts.response.status, 200, "POS account list failed");
  const account = accounts.data?.accounts?.find((row: { username?: string; name?: string }) => row.username === "kasir_demo" || row.name === "Kasir Demo");
  assert.ok(account, "Demo cashier missing");
  const pin = await client.request("/api/auth/tenant/verify-pin", { user_id: account.id, pin: "123456" });
  assert.equal(pin.response.status, 200, `POS PIN: HTTP ${pin.response.status}; ${pin.data?.error ?? "unexpected response"}`);
  const products = await client.request("/api/admin/products");
  assert.equal(products.response.status, 200, "POS catalog failed");
  assert.ok(products.data?.some((row: { name: string }) => row.name === "Kopi Demo"));
  assert.equal((await client.request("/register")).response.status, 200, "POS register failed");
  const menu = await client.request("/api/public/menu/rakku-demo");
  assert.equal(menu.response.status, 200, "Public QR menu failed");
  console.log(`POS production passed: ${client.origin}`);
}

async function superadmin(origin: string) {
  const client = new ProductionClient(origin);
  assert.equal((await client.request("/activate")).response.status, 200, `${origin}: activation route unavailable`);
  const session = await client.request("/api/auth/get-session");
  assert.equal(session.response.status, 200, `${origin}: Neon Auth proxy unavailable`);
  assert.equal((await client.request("/api/superadmin/companies")).response.status, 401, `${origin}: anonymous API not guarded`);
  assert.ok([302,303,307,308].includes((await client.request("/companies")).response.status), `${origin}: protected page not redirected`);
  console.log(`Superadmin production passed (anonymous session/guard): ${origin}`);
}

async function main() {
  const checks = [owner, pos, () => superadmin("https://superadmin-rakku.vercel.app")];
  if (!process.argv.includes("--vercel-only")) checks.push(() => superadmin("https://admin.rakku.dephilia.com"));
  else console.log("Temporary rollout scope: custom Superadmin domain deferred by developer; verifying Vercel URL.");
  for (const check of checks) {
    try { await check(); }
    catch (error) { console.error(error instanceof Error ? error.message : "Production smoke failed"); process.exitCode = 1; }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
