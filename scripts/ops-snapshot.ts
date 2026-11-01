import { config } from "dotenv";
import { closeDatabase, createAdminClient } from "@rakku/db";
import { operationalSnapshot } from "@rakku/db/maintenance";

config({ path: process.env.NEON_ENV_FILE || ".env.local" });

async function main() {
  const db = createAdminClient();
  try {
    const snapshot = await operationalSnapshot(db);
    console.log(JSON.stringify({ ok: snapshot.alerts.length === 0, snapshot }, null, 2));
    if (process.argv.slice(2).includes("--check") && snapshot.alerts.length) process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Operational snapshot failed");
  process.exitCode = 1;
});
