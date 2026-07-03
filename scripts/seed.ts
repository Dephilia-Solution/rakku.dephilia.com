/**
 * Seed script untuk inisialisasi data awal Rakku.
 *
 * Cara pakai:
 *   1. Pastikan migration 001_init.sql dan 002_multi_tenant.sql sudah dijalankan
 *   2. Pastikan .env.local sudah berisi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   3. Jalankan: npx tsx scripts/seed.ts
 */

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("🌱 Mulai seeding...\n");

  // ─── 1. Cek apakah company default sudah ada ───
  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("code", "RAKKU")
    .single();

  if (existingCompany) {
    console.log("ℹ️  Company RAKKU sudah ada, melewati seeding.");
    console.log("   Jika ingin reset, hapus data company & seed ulang.");
    process.exit(0);
  }

  // ─── 2. Company default ───
  const companyPassword = "rakku123";
  const companyPasswordHash = await bcrypt.hash(companyPassword, 10);

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      id: "a0000000-0000-4000-8000-000000000001",
      code: "RAKKU",
      name: "Rakku Default",
      password_hash: companyPasswordHash,
      status: "active",
    })
    .select()
    .single();

  if (companyError) {
    console.error("❌ Gagal membuat company:", companyError.message);
    process.exit(1);
  }

  console.log("✅ Company RAKKU dibuat (password: rakku123)");

  // ─── 3. Outlet default ───
  const { data: outlet, error: outletError } = await supabase
    .from("outlets")
    .insert({
      id: "b0000000-0000-4000-8000-000000000001",
      company_id: company.id,
      name: "Outlet Utama",
      address: "Jl. Contoh No. 1, Jakarta",
      status: "active",
    })
    .select()
    .single();

  if (outletError) {
    console.error("❌ Gagal membuat outlet:", outletError.message);
    process.exit(1);
  }
  console.log("✅ Outlet Utama dibuat");

  // ─── 4. Role default ───
  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .insert([
      { id: "c0000000-0001-4000-8000-000000000001", company_id: company.id, name: "Owner" },
      { id: "c0000000-0001-4000-8000-000000000002", company_id: company.id, name: "Kepala Cabang" },
      { id: "c0000000-0001-4000-8000-000000000003", company_id: company.id, name: "Admin" },
      { id: "c0000000-0001-4000-8000-000000000004", company_id: company.id, name: "Kasir" },
    ])
    .select();

  if (rolesError) {
    console.error("❌ Gagal membuat role:", rolesError.message);
    process.exit(1);
  }
  console.log("✅ 4 Role default dibuat");

  // ─── 5. Role-Menu Access ───
  const { data: menus } = await supabase.from("menus").select("id, slug");

  if (!menus || menus.length === 0) {
    console.error("❌ Menu tidak ditemukan. Jalankan migration 002_multi_tenant.sql dulu.");
    process.exit(1);
  }

  const menuMap = Object.fromEntries(menus.map((m) => [m.slug, m.id]));
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  const accessEntries: { role_id: string; menu_id: string; can_view: boolean }[] = [];

  // Owner: semua
  for (const slug of ["register", "orders", "reports", "products"]) {
    accessEntries.push({ role_id: roleMap["Owner"], menu_id: menuMap[slug], can_view: true });
  }

  // Kepala Cabang: register, orders, reports
  for (const slug of ["register", "orders", "reports"]) {
    accessEntries.push({ role_id: roleMap["Kepala Cabang"], menu_id: menuMap[slug], can_view: true });
  }

  // Admin: orders, reports, products
  for (const slug of ["orders", "reports", "products"]) {
    accessEntries.push({ role_id: roleMap["Admin"], menu_id: menuMap[slug], can_view: true });
  }

  // Kasir: register, orders
  for (const slug of ["register", "orders"]) {
    accessEntries.push({ role_id: roleMap["Kasir"], menu_id: menuMap[slug], can_view: true });
  }

  const { error: accessError } = await supabase
    .from("role_menu_access")
    .insert(accessEntries);

  if (accessError) {
    console.error("❌ Gagal membuat access matrix:", accessError.message);
    process.exit(1);
  }
  console.log("✅ Role-Menu Access matrix dibuat");

  // ─── 6. Users ───
  const ownerPinHash = await bcrypt.hash("123456", 10);
  const adminPinHash = await bcrypt.hash("123456", 10);
  const kasirPinHash = await bcrypt.hash("123456", 10);

  const { data: users, error: usersError } = await supabase
    .from("users")
    .insert([
      {
        id: "d0000000-0001-4000-8000-000000000001",
        company_id: company.id,
        role_id: roleMap["Owner"],
        name: "Budi Pemilik",
        username: "budi",
        pin_hash: ownerPinHash,
        all_outlets: true,
        status: "active",
      },
      {
        id: "d0000000-0001-4000-8000-000000000002",
        company_id: company.id,
        role_id: roleMap["Admin"],
        name: "Siti Admin",
        username: "siti",
        pin_hash: adminPinHash,
        all_outlets: false,
        status: "active",
      },
      {
        id: "d0000000-0001-4000-8000-000000000003",
        company_id: company.id,
        role_id: roleMap["Kasir"],
        name: "Ahmad Kasir",
        username: "ahmad",
        pin_hash: kasirPinHash,
        all_outlets: false,
        status: "active",
      },
    ])
    .select();

  if (usersError) {
    console.error("❌ Gagal membuat user:", usersError.message);
    process.exit(1);
  }
  console.log("✅ 3 User dibuat (PIN: 123456 untuk semua)");

  // ─── 7. Assign user outlets ───
  const adminUser = users.find((u) => u.username === "siti");
  const kasirUser = users.find((u) => u.username === "ahmad");

  if (adminUser && kasirUser) {
    const { error: uoError } = await supabase.from("user_outlets").insert([
      { user_id: adminUser.id, outlet_id: outlet.id },
      { user_id: kasirUser.id, outlet_id: outlet.id },
    ]);

    if (uoError) {
      console.error("❌ Gagal assign user outlets:", uoError.message);
      process.exit(1);
    }
    console.log("✅ User di-assign ke Outlet Utama");
  }

  // ─── 8. Backfill existing products & categories ───
  const { error: catBackfill } = await supabase
    .from("categories")
    .update({
      company_id: company.id,
      outlet_id: outlet.id,
    })
    .is("company_id", null);

  if (catBackfill) {
    console.warn("⚠️  Gagal backfill categories:", catBackfill.message);
  }

  const { error: prodBackfill } = await supabase
    .from("products")
    .update({
      company_id: company.id,
      outlet_id: outlet.id,
    })
    .is("company_id", null);

  if (prodBackfill) {
    console.warn("⚠️  Gagal backfill products:", prodBackfill.message);
  }

  console.log("\n🎉 Seeding selesai!");
  console.log("\n📋 Informasi Login:");
  console.log("   ┌──────────────────────┬──────────────────────────────┐");
  console.log("   │ Tenant Login          │ Kode: RAKKU                  │");
  console.log("   │                       │ Password: rakku123           │");
  console.log("   ├──────────────────────┼──────────────────────────────┤");
  console.log("   │ User (Owner)          │ Username: budi  | PIN: 123456│");
  console.log("   │ User (Admin)          │ Username: siti  | PIN: 123456│");
  console.log("   │ User (Kasir)          │ Username: ahmad | PIN: 123456│");
  console.log("   └──────────────────────┴──────────────────────────────┘");
  console.log("\n   Superadmin: daftarkan via Supabase Auth (email/password)");
  console.log("   lalu login di /superadmin/login\n");
}

seed().catch((err) => {
  console.error("❌ Seed gagal:", err);
  process.exit(1);
});
