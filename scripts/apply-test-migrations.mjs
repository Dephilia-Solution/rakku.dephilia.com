// Apply migrations to an explicitly disposable PostgreSQL database for the
// two-connection harness. Never use an application database URL.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is required");
if (process.env.RAKKU_ALLOW_DISPOSABLE_DB !== "1") {
  throw new Error("Set RAKKU_ALLOW_DISPOSABLE_DB=1 for a disposable database");
}
if (url === process.env.DATABASE_URL || url === process.env.DATABASE_URL_UNPOOLED) {
  throw new Error("TEST_DATABASE_URL must differ from application database variables");
}
const directory = resolve("packages/db/migrations");
const files = readdirSync(directory).filter(file => /^\d+_.*\.sql$/.test(file)).sort();
const connection = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await connection.begin(async tx => {
    for (const file of files) await tx.unsafe(readFileSync(resolve(directory, file), "utf8"));
  });
  console.log(`Applied ${files.length} migrations to the disposable test database.`);
} finally {
  await connection.end();
}
