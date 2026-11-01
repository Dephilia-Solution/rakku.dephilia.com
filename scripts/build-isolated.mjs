// Production compilation with explicitly blocked DB/provider transports.
// Never use deployment secrets or a live database to validate a local build.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const allowed = ["owner", "pos", "superadmin", "landing"];
const apps = process.argv.slice(2);
const buildDirectory = process.env.RAKKU_BUILD_DIRECTORY || ".next-hardening";
if (!/^\.next-hardening(?:-[a-z0-9]+)*$/.test(buildDirectory)) throw new Error("Invalid isolated build directory");
if (!apps.length || apps.some(app => !allowed.includes(app))) throw new Error("Specify apps: owner pos superadmin landing");
const env = { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", RAKKU_ISOLATED_BUILD: "1",
  RAKKU_BUILD_DIRECTORY: buildDirectory,
  DATABASE_URL: "postgresql://isolated:isolated@127.0.0.1:1/isolated?connect_timeout=1",
  OWNER_JWT_SECRET: "isolated-build-owner-secret-at-least-32-characters",
  POS_JWT_SECRET: "isolated-build-pos-secret-at-least-32-characters",
  NEON_AUTH_BASE_URL: "http://127.0.0.1:1", NEON_AUTH_COOKIE_SECRET: "isolated-build-neon-secret-at-least-32-characters",
  NEXT_PUBLIC_OWNER_URL: "http://localhost:3000", NEXT_PUBLIC_POS_URL: "http://localhost:3001",
  NEXT_PUBLIC_SUPERADMIN_URL: "http://localhost:3002", NEXT_PUBLIC_LANDING_URL: "http://localhost:3003",
};
for (const provider of ["VESSEL", "ECHO", "SILOS"]) {
  env[`${provider}_API_URL`] = "http://127.0.0.1:1";
  env[`${provider}_API_KEY`] = "isolated-build-provider-blocked";
}
for (const app of apps) {
  const cwd = resolve(root, "apps", app);
  const cli = require.resolve("next/dist/bin/next", { paths: [cwd] });
  const code = await new Promise((done, reject) => {
    const child = spawn(process.execPath, [cli, "build", "--webpack"], { cwd, env, stdio: "inherit" });
    child.once("error", reject); child.once("close", code => done(code ?? 1));
  });
  if (code !== 0) { process.exitCode = Number(code); break; }
}
