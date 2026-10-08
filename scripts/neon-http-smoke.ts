import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(__dirname, "..");
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));
async function withApp(name: string, port: number, work: (request: (path: string, body?: unknown) => Promise<{ response: Response; data: any }>) => Promise<void>) {
  const cwd = resolve(root, "apps", name);
  const next = createRequire(resolve(cwd, "package.json")).resolve("next/dist/bin/next");
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [next, "dev", "-p", String(port), "--hostname", "127.0.0.1"], {
    cwd, env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=1024",
      NEXT_PUBLIC_OWNER_URL: "http://127.0.0.1:3100", NEXT_PUBLIC_POS_URL: "http://127.0.0.1:3101",
      SUPERADMIN_URL: "http://127.0.0.1:3102" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", chunk => { logs = (logs + chunk.toString()).slice(-12000); });
  child.stderr.on("data", chunk => { logs = (logs + chunk.toString()).slice(-12000); });
  const cookies = new Map<string, string>();
  async function request(path: string, body?: unknown) {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST", redirect: "manual", signal: AbortSignal.timeout(60000),
      headers: { Cookie: Array.from(cookies).map(([key, value]) => `${key}=${value}`).join("; "),
        Origin: base, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(";", 1)[0]; const equal = first.indexOf("=");
      cookies.set(first.slice(0, equal), first.slice(equal + 1));
    }
    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    return { response, data };
  }
  try {
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      if (child.exitCode !== null) throw new Error(`${name} dev server exited`);
      try { const response = await fetch(`${base}/login`, { signal: AbortSignal.timeout(2000) }); if (response.ok) { ready = true; break; } } catch {}
      await sleep(1000);
    }
    if (!ready) throw new Error(`${name} did not become ready`);
    await work(request);
    console.log(`${name}: HTTP smoke passed`);
  } catch (error) {
    // Next logs do not print env values or cookies; include only diagnostics.
    console.error(logs);
    throw error;
  } finally {
    if (child.pid) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else child.kill("SIGTERM");
    }
  }
}

async function main() {
  await withApp("owner", 3100, async request => {
    const login = await request("/api/auth/owner/login", { email: "demo_owner@rakku.test", password: "DemoOwner2026!" });
    assert.equal(login.response.status, 200, JSON.stringify(login.data));
    assert.equal(login.data.owner.email, "demo_owner@rakku.test");
    const session = await request("/api/auth/owner/session");
    assert.equal(session.response.status, 200, JSON.stringify(session.data));
    const dashboard = await request("/dashboard");
    assert.equal(dashboard.response.status, 200);
  });
  await withApp("pos", 3101, async request => {
    const denied = await request("/api/admin/products");
    assert.equal(denied.response.status, 401);
    const company = await request("/api/auth/tenant/company", { code: "DEMO", password: "DemoPOS2026!" });
    assert.equal(company.response.status, 200, JSON.stringify(company.data));
    const outlets = await request("/api/auth/tenant/outlet");
    assert.equal(outlets.response.status, 200, JSON.stringify(outlets.data));
    assert.equal(outlets.data.outlets.length, 1);
    const selected = await request("/api/auth/tenant/outlet", { outlet_id: outlets.data.outlets[0].id });
    assert.equal(selected.response.status, 200, JSON.stringify(selected.data));
    const accounts = await request("/api/auth/tenant/accounts");
    assert.equal(accounts.response.status, 200, JSON.stringify(accounts.data));
    assert.equal(accounts.data.accounts.length, 1);
    const pin = await request("/api/auth/tenant/verify-pin", { user_id: accounts.data.accounts[0].id, pin: "123456" });
    assert.equal(pin.response.status, 200, JSON.stringify(pin.data));
    const products = await request("/api/admin/products");
    assert.equal(products.response.status, 200, JSON.stringify(products.data));
    assert.equal(products.data.length, 2);
    const register = await request("/register");
    assert.equal(register.response.status, 200);
  });
  await withApp("superadmin", 3102, async request => {
    const session = await request("/api/auth/get-session");
    assert.equal(session.response.status, 200, JSON.stringify(session.data));
    const denied = await request("/api/superadmin/companies");
    assert.equal(denied.response.status, 401);
    const protectedPage = await request("/companies");
    assert.ok([302,303,307,308].includes(protectedPage.response.status));
  });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
