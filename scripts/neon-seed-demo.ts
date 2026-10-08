import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { createAdminClient, closeDatabase, sql, type DatabaseClient } from "@rakku/db";

config({ path: process.env.NEON_ENV_FILE || ".env.local" });
const OWNER_EMAIL = "demo_owner@rakku.test";
const OWNER_PASSWORD = "DemoOwner2026!";
const COMPANY_CODE = "DEMO";
const COMPANY_PASSWORD = "DemoPOS2026!";
const STAFF_USERNAME = "kasir_demo";
const STAFF_PIN = "123456";

async function findOrCreate(db: DatabaseClient, table: string, match: Record<string, unknown>, values: Record<string, unknown>) {
  let query = db.from(table).select();
  for (const [column, value] of Object.entries(match)) query = query.eq(column, value);
  const existing = await query.maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data;
  const created = await db.from(table).insert({ ...values, ...match }).select().single();
  if (created.error || !created.data) throw new Error(created.error?.message ?? `Failed to create ${table}`);
  return created.data;
}

async function main() {
  const [ownerHash, companyHash, pinHash] = await Promise.all([
    bcrypt.hash(OWNER_PASSWORD, 12), bcrypt.hash(COMPANY_PASSWORD, 12), bcrypt.hash(STAFF_PIN, 12),
  ]);
  await createAdminClient().transaction(async db => {
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended('rakku-demo-seed',0))`);
    const plan = await db.from("plans").select("id").eq("slug", "pro").single();
    const menus = await db.from("menus").select("id");
    if (!plan.data || !menus.data?.length) throw new Error("Run pnpm db:seed before demo seed");
    const owner = await findOrCreate(db, "owners", { email: OWNER_EMAIL }, {
      name: "Owner Demo", password_hash: ownerHash, is_active: true, email_verified_at: new Date().toISOString(),
    });
    if (!await bcrypt.compare(OWNER_PASSWORD, owner.password_hash)) throw new Error("Existing demo email has a different password; no account was overwritten");
    const company = await findOrCreate(db, "companies", { code: COMPANY_CODE }, {
      name: "Rakku Demo", slug: "rakku-demo", owner_id: owner.id, password_hash: companyHash,
      status: "active", plan_id: plan.data.id, subscription_status: "trial",
      trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    });
    if (company.owner_id !== owner.id || !await bcrypt.compare(COMPANY_PASSWORD, company.password_hash)) {
      throw new Error("Existing DEMO company does not match this demo identity; no data was overwritten");
    }
    const outlet = await findOrCreate(db, "outlets", { company_id: company.id, name: "Outlet Demo" }, {
      address: "Outlet demonstrasi Rakku", status: "active", qr_menu_slug: "rakku-demo",
    });
    const role = await findOrCreate(db, "roles", { company_id: company.id, name: "Kasir Demo" }, {});
    const access = await db.from("role_menu_access").upsert(menus.data.map(menu => ({
      role_id: role.id, menu_id: menu.id, can_view: true, can_create: true, can_edit: true, can_delete: true,
    })), { onConflict: "role_id,menu_id", ignoreDuplicates: true });
    if (access.error) throw new Error(access.error.message);
    const user = await findOrCreate(db, "users", { company_id: company.id, username: STAFF_USERNAME }, {
      role_id: role.id, name: "Kasir Demo", pin_hash: pinHash, all_outlets: false, status: "active",
    });
    if (!await bcrypt.compare(STAFF_PIN, user.pin_hash)) throw new Error("Existing demo staff PIN differs; no credential was overwritten");
    const assignment = await db.from("user_outlets").upsert({ user_id: user.id, outlet_id: outlet.id }, {
      onConflict: "user_id,outlet_id", ignoreDuplicates: true,
    });
    if (assignment.error) throw new Error(assignment.error.message);
    const category = await findOrCreate(db, "categories", { company_id: company.id, outlet_id: outlet.id, name: "Minuman" }, { sort_order: 1 });
    const dineIn = await findOrCreate(db, "pricing_tiers", { company_id: company.id, outlet_id: outlet.id, slug: "dine-in" }, {
      name: "Dine In", is_active: true, sort_order: 1,
    });
    const takeAway = await findOrCreate(db, "pricing_tiers", { company_id: company.id, outlet_id: outlet.id, slug: "take-away" }, {
      name: "Take Away", is_active: true, sort_order: 2,
    });
    const coffee = await findOrCreate(db, "products", { company_id: company.id, outlet_id: outlet.id, name: "Kopi Demo" }, {
      price: 20000, category_id: category.id, description: "Kopi untuk mencoba transaksi demo", is_active: true,
    });
    const tea = await findOrCreate(db, "products", { company_id: company.id, outlet_id: outlet.id, name: "Teh Demo" }, {
      price: 15000, category_id: category.id, description: "Teh untuk mencoba transaksi demo", is_active: true,
    });
    const prices = await db.from("product_tier_prices").upsert([coffee, tea].flatMap(product => [dineIn, takeAway].map(tier => ({
      product_id: product.id, tier_id: tier.id, price: product.price,
    }))), { onConflict: "product_id,tier_id", ignoreDuplicates: true });
    if (prices.error) throw new Error(prices.error.message);
    const ingredient = await findOrCreate(db, "ingredients", { company_id: company.id, outlet_id: outlet.id, name: "Biji Kopi Demo" }, {
      unit: "gram", stock_quantity: 0, min_stock_alert: 100, cost_per_unit: 150,
    });
    // Opening stock has an audit trail and is never reset on subsequent runs.
    const opening = await db.from("stock_movements").select("id").eq("ingredient_id", ingredient.id)
      .eq("type", "adjustment").eq("reference_id", ingredient.id).maybeSingle();
    if (opening.error) throw new Error(opening.error.message);
    if (!opening.data) {
      await db.execute(sql`update public.ingredients set stock_quantity=stock_quantity+1000 where id=${ingredient.id}`);
      const movement = await db.from("stock_movements").insert({ company_id: company.id, outlet_id: outlet.id,
        ingredient_id: ingredient.id, type: "adjustment", quantity_change: 1000, reference_id: ingredient.id,
        note: "Opening stock demo", created_by: user.id });
      if (movement.error) throw new Error(movement.error.message);
    }
    await findOrCreate(db, "product_recipes", { product_id: coffee.id, ingredient_id: ingredient.id }, { quantity_used: 18 });
    await findOrCreate(db, "dining_tables", { company_id: company.id, outlet_id: outlet.id, name: "Meja 1" }, { status: "available" });
  });
  console.log("Demo ready: 1 Owner, 1 POS employee, 1 outlet, 2 products.");
  console.log(`Owner: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
  console.log(`POS: ${COMPANY_CODE} / ${COMPANY_PASSWORD}; employee ${STAFF_USERNAME}, PIN ${STAFF_PIN}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(closeDatabase);
