import { connect, quoteIdentifier } from "./lib/neon-config";
import postgres from "postgres";
import { normalizeDatabaseUrl } from "@rakku/db";

async function main() {
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error("DATABASE_URL is required");
  const runtimeUrl = new URL(configured);
  const name = decodeURIComponent(runtimeUrl.username);
  const password = decodeURIComponent(runtimeUrl.password);
  if (name !== "rakku_runtime" || !/^[a-f0-9]{64}$/.test(password)) throw new Error("Use the generated rakku_runtime URL with a 256-bit hex password");
  const adminUrl = new URL(process.env.DATABASE_URL_UNPOOLED!);
  if (runtimeUrl.pathname !== adminUrl.pathname || runtimeUrl.hostname.replace("-pooler", "") !== adminUrl.hostname) {
    throw new Error("Runtime and migration connection must use the same endpoint/database");
  }
  const admin = connect("DATABASE_URL_UNPOOLED");
  try {
    const roles = await admin`select rolname, rolcanlogin, rolbypassrls, rolsuper from pg_roles where rolname=${name}`;
    if (!roles.length) {
      // name is identifier-validated; password is generated hex, not request input.
      await admin.unsafe(`CREATE ROLE ${quoteIdentifier(name)} LOGIN NOINHERIT NOBYPASSRLS PASSWORD '${password}'`);
      console.log(`Created ${name}`);
    } else {
      if (!roles[0].rolcanlogin || roles[0].rolbypassrls || roles[0].rolsuper) throw new Error("Existing runtime role has incompatible privileges");
      console.log(`${name} already exists; password was not changed`);
    }
    const runtime = postgres(normalizeDatabaseUrl(configured), { max: 1, connect_timeout: 15, prepare: false, onnotice: () => {} });
    try {
      const identity = await runtime`select current_user as role, current_database() as database`;
      console.log(`Runtime login verified: ${identity[0].role}/${identity[0].database}`);
    } finally { await runtime.end(); }
  } finally { await admin.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
