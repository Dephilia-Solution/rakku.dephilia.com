import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const { SignJWT } = await import(pathToFileURL(require.resolve("jose", { paths: [resolve(root, "packages/auth-utils")] })).href);
const secret = "isolated-http-auth-test-secret-at-least-32-characters";
const buildDirectory = process.env.RAKKU_BUILD_DIRECTORY || ".next-hardening";
if (!/^\.next-hardening(?:-[a-z0-9]+)*$/.test(buildDirectory)) throw new Error("Invalid isolated build directory");
const env = { ...process.env, NODE_ENV: "production", RAKKU_ISOLATED_BUILD: "1",
  DATABASE_URL: "postgresql://isolated:isolated@127.0.0.1:1/isolated?connect_timeout=1",
  OWNER_JWT_SECRET: secret, POS_JWT_SECRET: secret, NEON_AUTH_COOKIE_SECRET: secret,
  NEON_AUTH_BASE_URL: "http://127.0.0.1:1",
};
for (const service of ["VESSEL", "ECHO", "SILOS"]) {
  env[`${service}_API_URL`] = "http://127.0.0.1:1"; env[`${service}_API_KEY`] = "blocked";
}
const processes = [];
const origins = {};
const logs = new Map();
const pause = ms => new Promise(done => setTimeout(done, ms));
async function request(app, path, options = {}) {
  return fetch(`${origins[app]}${path}`, { ...options, redirect: "manual", signal: AbortSignal.timeout(3000) });
}
async function verify(app, path, expected, options = {}) {
  const response = await request(app, path, options);
  assert.ok(expected.includes(response.status), `${app} ${path}: expected ${expected}, got ${response.status}`);
  if (expected.includes(307)) assert.equal(new URL(response.headers.get("location"), origins[app]).pathname, "/login");
  await response.body?.cancel();
  console.log(`PASS ${app} ${options.method ?? "GET"} ${path} → ${response.status}`);
}
try {
  for (const [index, app] of ["owner", "pos", "superadmin"].entries()) {
    const cwd = resolve(root, "apps", app), port = 3510 + index;
    await access(resolve(cwd, buildDirectory, "BUILD_ID"));
    await new Promise((done, reject) => {
      const probe = createServer(); probe.once("error", reject);
      probe.listen(port, "127.0.0.1", () => probe.close(done));
    });
    origins[app] = `http://127.0.0.1:${port}`;
    const cli = require.resolve("next/dist/bin/next", { paths: [cwd] });
    const child = spawn(process.execPath, [cli, "start", "-H", "127.0.0.1", "-p", String(port)], { cwd, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    processes.push(child);
    child.on("error", error => logs.set(app, String(error)));
    for (const stream of [child.stdout, child.stderr]) stream.on("data", data => logs.set(app, `${logs.get(app) ?? ""}${data}`.slice(-2000)));
    const deadline = Date.now() + 20000;
    let ready = false;
    while (Date.now() < deadline) {
      try { const response = await request(app, "/login"); await response.body?.cancel(); if (response.status === 200) { ready = true; break; } } catch {}
      await pause(250);
    }
    assert.ok(ready, `${app} not ready: ${logs.get(app)}`);
  }
  await verify("owner", "/demo", [200]);
  for (const path of ["/login", "/register", "/forgot-password", "/check-email", "/reset-password"]) await verify("owner", path, [200]);
  for (const path of ["/onboarding", "/dashboard"]) await verify("owner", path, [307]);
  for (const path of ["/login/select-outlet", "/login/select-user", "/login/enter-pin?user_id=foreign"]) await verify("pos", path, [307]);
  await verify("pos", "/register", [307]);
  await verify("pos", "/api/admin/orders", [401], { method: "POST" });
  await verify("pos", "/api/auth/tenant/company", [403], { method: "POST" });
  await verify("owner", "/api/auth/owner/login", [403], { method: "POST" });
  await verify("owner", "/api/webhooks/vessel", [503], { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  await verify("superadmin", "/companies", [307]);
  await verify("superadmin", "/api/auth/sign-up/email", [404], { method: "POST", headers: { origin: origins.superadmin } });
  const encodedSecret = new TextEncoder().encode(secret);
  const wrongPurpose = await new SignJWT({ owner_id: "owner", session_id: "session", email: "owner@example.test", name: "Owner" })
    .setProtectedHeader({ alg: "HS256" }).setIssuer("rakku").setAudience("owner_verify_email").setIssuedAt().setExpirationTime("1h").sign(encodedSecret);
  await verify("owner", "/dashboard", [307], { headers: { cookie: `owner_session=${wrongPurpose}` } });
  const pending = await new SignJWT({ company_id: "company", outlet_id: "outlet", user_id: "user", session_id: "session" })
    .setProtectedHeader({ alg: "HS256" }).setIssuer("rakku").setAudience("pos_pending").setIssuedAt().setExpirationTime("10m").sign(encodedSecret);
  await verify("pos", "/api/admin/orders", [401], { method: "POST", headers: { cookie: `session=${pending}`, origin: origins.pos } });
  console.log("HTTP auth guards passed with blocked database/provider transports. Positive authenticated flows still require isolated staging.");
} finally {
  for (const child of processes.reverse()) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") await new Promise(done => {
      const stop = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      stop.once("error", done); stop.once("close", done);
    });
    else { child.kill("SIGTERM"); await new Promise(done => child.once("close", done)); }
  }
}
