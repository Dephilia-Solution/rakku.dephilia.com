/**
 * Run Migration Script for Supabase
 *
 * This script displays the SQL migration for easy copying to Supabase Dashboard.
 * Usage: node scripts/run-migration.js
 */

const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  console.error("❌ Error: Missing SUPABASE_URL");
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error("❌ Error: Cannot extract project ref from SUPABASE_URL");
  process.exit(1);
}

console.log("🚀 Running Migration 004_m6_hardening.sql...\n");

console.log("⚙️  To run this migration, please use Supabase Dashboard SQL Editor:\n");
console.log("METHOD - Copy & Paste to Supabase Dashboard:\n");
console.log("1. Go to: https://app.supabase.com/project/" + projectRef + "/sql");
console.log("2. Click 'New Query'");
console.log("3. Copy the SQL below and paste it");
console.log("4. Click 'Run'\n");

// Read and display the SQL
const migrationPath = path.join(__dirname, "../supabase/migrations/004_m6_hardening.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

console.log("=".repeat(70));
console.log("COPY EVERYTHING BELOW THIS LINE:");
console.log("=".repeat(70) + "\n");
console.log(sql);
console.log("\n" + "=".repeat(70));
console.log("END OF SQL - Copy everything above");
console.log("=".repeat(70));

console.log("\n✨ After running the SQL in Supabase Dashboard:");
console.log("   ✅ Company login rate limiting enabled (10 attempts = 15 min lock)");
console.log("   ✅ Audit logging enabled (auth_audit_logs table)");
console.log("   ✅ Session idle timeout enabled (30 minutes)");
console.log("   ✅ M6 features fully operational!\n");
