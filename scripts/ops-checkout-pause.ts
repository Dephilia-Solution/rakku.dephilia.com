import { config } from "dotenv";
import { closeDatabase, createAdminClient } from "@rakku/db";
import { getRuntimeFlag, setRuntimeFlag } from "@rakku/db/runtime-flags";

config({ path: process.env.NEON_ENV_FILE || ".env.local" });

async function main() {
  const action = process.argv[2];
  const db = createAdminClient();
  try {
    if (action === "--status") {
      console.log(JSON.stringify({ checkout_paused: await getRuntimeFlag(db, "checkout_paused") }));
      return;
    }
    if (!["--enable", "--disable"].includes(action)) {
      throw new Error("Gunakan --status, --enable, atau --disable");
    }
    const actor = (process.env.OPS_ACTOR || "operator").slice(0, 200);
    await setRuntimeFlag(db, "checkout_paused", action === "--enable", actor);
    console.log(JSON.stringify({ checkout_paused: action === "--enable", actor }));
  } finally {
    await closeDatabase();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Checkout pause command failed");
  process.exitCode = 1;
});
