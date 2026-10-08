import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { connect, quoteIdentifier } from "./lib/neon-config";

async function main() {
  const connection = connect("DATABASE_URL_UNPOOLED");
  try {
    const directory = new URL("../packages/db/migrations/", import.meta.url);
    const files = (await readdir(directory)).filter(file => /^\d+_.*\.sql$/.test(file)).sort();
    await connection.begin(async tx => {
      await tx.unsafe("select pg_advisory_xact_lock(hashtextextended('rakku-schema-migrations',0))");
      await tx.unsafe("CREATE SCHEMA IF NOT EXISTS rakku_migrations; REVOKE ALL ON SCHEMA rakku_migrations FROM PUBLIC;");
      await tx.unsafe("CREATE TABLE IF NOT EXISTS rakku_migrations.history (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
      const history = await tx.unsafe<{ name: string; checksum: string }[]>("select name, checksum from rakku_migrations.history");
      for (const file of files) {
        const migration = await readFile(new URL(file, directory), "utf8");
        const checksum = createHash("sha256").update(migration).digest("hex");
        const applied = history.find(row => row.name === file);
        if (applied) {
          if (applied.checksum !== checksum) throw new Error(`Applied migration changed: ${file}`);
          continue;
        }
        if (file === "0001_baseline.sql") {
          const existing = await tx.unsafe("select 1 from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' limit 1");
          if (existing.length) throw new Error("Baseline requires an empty public schema; do not run against the source database");
        }
        await tx.unsafe(migration);
        await tx.unsafe("insert into rakku_migrations.history(name,checksum) values($1,$2)", [file, checksum]);
        console.log(`Applied ${file}`);
      }
      const runtimeUrl = process.env.DATABASE_URL;
      if (!runtimeUrl) throw new Error("DATABASE_URL is required to grant runtime privileges");
      const user = decodeURIComponent(new URL(runtimeUrl).username);
      const role = quoteIdentifier(user);
      const roles = await tx.unsafe("select rolsuper, rolbypassrls from pg_roles where rolname = $1", [user]);
      if (!roles.length || roles[0].rolsuper || roles[0].rolbypassrls) throw new Error("Runtime role must exist and must not be a superuser/BYPASSRLS role");
      const owner = await tx.unsafe("select current_user as name");
      if (owner[0].name === user) throw new Error("Use a separate migration owner and least-privilege runtime role");
      await tx.unsafe(`GRANT USAGE ON SCHEMA public, app_private TO ${role};
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role};
        GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA app_private TO ${role};
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role};
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, app_private TO ${role};
        REVOKE UPDATE, DELETE ON public.balance_transactions, public.stock_movements FROM ${role};
        REVOKE CREATE ON SCHEMA public FROM ${role};`);
    });
    console.log("Schema ready. Managed Better Auth must be enabled separately on this Neon branch.");
  } finally { await connection.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
