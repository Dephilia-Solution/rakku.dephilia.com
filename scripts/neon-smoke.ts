import { config } from "dotenv";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createAdminClient, createTenantClient, closeDatabase, sql } from "@rakku/db";

config({ path: process.env.NEON_ENV_FILE || ".env.local" });
async function main() {
  const db = createAdminClient();
  const role = await db.execute(sql`select current_user as name, rolbypassrls, rolsuper from pg_roles where rolname=current_user`);
  assert.equal(role[0].name, "rakku_runtime");
  assert.equal(role[0].rolbypassrls, false);
  assert.equal(role[0].rolsuper, false);
  const owner = await db.from("owners").select("id,password_hash,is_active").eq("email", "demo_owner@rakku.test").single();
  assert.equal(owner.error, null);
  assert.ok(owner.data?.is_active && await bcrypt.compare("DemoOwner2026!", owner.data.password_hash));
  const company = await db.from("companies").select("id,password_hash,owner_id,plans(slug)").eq("code", "DEMO").single();
  assert.equal(company.error, null);
  assert.equal(company.data.owner_id, owner.data.id);
  assert.ok(await bcrypt.compare("DemoPOS2026!", company.data.password_hash));
  assert.equal(company.data.plans.slug, "pro");
  const user = await db.from("users").select("id,pin_hash,role_id,roles!inner(name)")
    .eq("company_id", company.data.id).eq("username", "kasir_demo").single();
  assert.equal(user.error, null);
  assert.ok(await bcrypt.compare("123456", user.data.pin_hash));
  const outlet = await db.from("outlets").select("id").eq("company_id", company.data.id).single();
  assert.equal(outlet.error, null);
  const tenant = createTenantClient(async () => ({ company_id: company.data.id, outlet_id: outlet.data.id, user_id: user.data.id }));
  const catalog = await tenant.from("products").select("id,name,price,categories(name)", { count: "exact" }).order("name");
  assert.equal(catalog.error, null);
  assert.equal(catalog.count, 2);
  assert.equal(catalog.data?.[0].categories.name, "Minuman");
  assert.equal(typeof catalog.data?.[0].price, "number");
  const privateAccess = await tenant.from("owners").select("id");
  assert.deepEqual(privateAccess.data, []);
  // Prove native Drizzle transaction rollback against the actual Neon driver.
  const marker = "00000000-0000-4000-8000-000000000099";
  await assert.rejects(() => db.transaction(async tx => {
    const inserted = await tx.from("auth_audit_logs").insert({ id: marker, event_type: "migration_smoke", success: true });
    if (inserted.error) throw new Error(inserted.error.message);
    throw new Error("expected rollback");
  }), /expected rollback/);
  assert.equal((await db.from("auth_audit_logs").select("id").eq("id", marker).maybeSingle()).data, null);
  console.log("Neon smoke passed: runtime role, demo credentials, FK relations, exact count, tenant RLS, native transaction rollback.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(closeDatabase);
