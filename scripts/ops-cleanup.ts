import { config } from "dotenv";
import { closeDatabase, createAdminClient } from "@rakku/db";
import {
  cleanupDoneJobs,
  cleanupExpiredRateLimits,
  cleanupExpiredSessions,
  cleanupProcessedProviderEvents,
} from "@rakku/db/maintenance";

config({ path: process.env.NEON_ENV_FILE || ".env.local" });

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const beforeArg = args.find(arg => arg.startsWith("--before="))?.slice("--before=".length);
  const before = beforeArg ? new Date(beforeArg) : daysAgo(30);
  if (Number.isNaN(before.getTime())) throw new Error("--before harus berupa tanggal ISO");
  const db = createAdminClient();
  try {
    const results = [];
    results.push(await cleanupExpiredSessions(db, before, apply));
    results.push(await cleanupExpiredRateLimits(db, before, apply));
    results.push(await cleanupDoneJobs(db, before, apply));
    results.push(await cleanupProcessedProviderEvents(db, daysAgo(90), apply));
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", before: before.toISOString(), results }, null, 2));
  } finally {
    await closeDatabase();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Cleanup failed");
  process.exitCode = 1;
});
