import { config } from "dotenv";
import { closeDatabase, createAdminClient, sql } from "@rakku/db";
import { countJobs, replayDeadLetter } from "@rakku/db/jobs";

config({ path: process.env.NEON_ENV_FILE || ".env.local" });

async function main() {
  const args = process.argv.slice(2);
  const db = createAdminClient();
  try {
    if (args.includes("--replay")) {
      const index = args.indexOf("--replay");
      const id = args[index + 1];
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Berikan job ID yang valid");
      const job = await replayDeadLetter(db, id);
      if (!job) throw new Error("Job tidak ditemukan atau bukan dead-letter");
      console.log(JSON.stringify({ replayed: job.id, kind: job.kind, state: job.state, replay_count: job.replay_count }));
      return;
    }
    const counts = await countJobs(db);
    if (!args.includes("--list")) {
      console.log(JSON.stringify({ dry_run: true, counts }));
      return;
    }
    const dead = await db.execute(sql`
      select id, kind, attempts, max_attempts, replay_count, dead_lettered_at, last_error
      from app_private.job_queue
      where state='dead_letter'
      order by dead_lettered_at desc
      limit 50
    `);
    console.log(JSON.stringify({ counts, dead_letter: dead }, null, 2));
  } finally {
    await closeDatabase();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Provider job command failed");
  process.exitCode = 1;
});
