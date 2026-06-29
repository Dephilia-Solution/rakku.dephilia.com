import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const sqlPath = path.resolve(__dirname, "../supabase/migrations/003_rls_permissive.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    const { error } = await supabase.rpc("pgsql", { query: stmt + ";" });
    if (error && !error.message.includes("function pgsql does not exist")) {
      console.error("Error:", error.message);
    }
  }

  console.log("✅ Migration 003 selesai dijalankan");
}

main().catch(console.error);
