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

// ─── UUID helpers ───
const UUID = {
  company: { stocko: "a0000000-0000-4000-8000-000000000001", tokoko: "a0000000-0000-4000-8000-000000000002" },
  outlet: {
    stocko_utama: "b0000000-0000-4000-8000-000000000001",
    stocko_cabang: "b0000000-0000-4000-8000-000000000002",
    tokoko_utama: "b0000000-0000-4000-8000-000000000003",
  },
  role: {
    stocko_owner: "c0000000-0001-4000-8000-000000000001",
    stocko_kepala_cabang: "c0000000-0001-4000-8000-000000000002",
    stocko_admin: "c0000000-0001-4000-8000-000000000003",
    stocko_kasir: "c0000000-0001-4000-8000-000000000004",
    tokoko_owner: "c0000000-0002-4000-8000-000000000001",
    tokoko_kepala_cabang: "c0000000-0002-4000-8000-000000000002",
    tokoko_admin: "c0000000-0002-4000-8000-000000000003",
    tokoko_kasir: "c0000000-0002-4000-8000-000000000004",
  },
  user: {
    budi: "d0000000-0001-4000-8000-000000000001",
    siti: "d0000000-0001-4000-8000-000000000002",
    ahmad: "d0000000-0001-4000-8000-000000000003",
    rudi: "d0000000-0001-4000-8000-000000000004",
    dewi: "d0000000-0001-4000-8000-000000000005",
    ali: "d0000000-0001-4000-8000-000000000006",
    rina: "d0000000-0001-4000-8000-000000000007",
    joko: "d0000000-0001-4000-8000-000000000008",
  },
  category: (suffix: string, i: number) => `e0000000-${suffix.slice(0, 4)}-4000-8000-${String(i).padStart(12, "0")}`,
  product: (suffix: string, i: number) => `f0000000-${suffix.slice(0, 4)}-4000-8000-${String(i).padStart(12, "0")}`,
};

async function upsertRoles(companyId: string, roleIds: Record<string, string>) {
  const roles = [
    { id: roleIds.owner, company_id: companyId, name: "Owner" },
    { id: roleIds.kepala_cabang, company_id: companyId, name: "Kepala Cabang" },
    { id: roleIds.admin, company_id: companyId, name: "Admin" },
    { id: roleIds.kasir, company_id: companyId, name: "Kasir" },
  ];

  for (const role of roles) {
    const { data: existing } = await supabase
      .from("roles")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", role.name)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("roles").insert(role);
      if (error) console.error(`❌ Gagal insert role ${role.name}:`, error.message);
    }
  }

  const { data: roleMap } = await supabase.from("roles").select("id, name").eq("company_id", companyId);
  return Object.fromEntries((roleMap ?? []).map((r) => [r.name, r.id]));
}

async function upsertMenuAccess(companyId: string, roleMap: Record<string, string>) {
  const { data: menus } = await supabase.from("menus").select("id, slug");
  if (!menus || menus.length === 0) {
    console.error("❌ Menu tidak ditemukan. Jalankan migration 002_multi_tenant.sql dulu.");
    process.exit(1);
  }

  const menuMap = Object.fromEntries(menus.map((m) => [m.slug, m.id]));
  const accessMap: Record<string, string[]> = {
    Owner: ["register", "orders", "reports", "products"],
    "Kepala Cabang": ["register", "orders", "reports"],
    Admin: ["orders", "reports", "products"],
    Kasir: ["register", "orders"],
  };

  for (const [roleName, slugs] of Object.entries(accessMap)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;

    for (const slug of slugs) {
      const menuId = menuMap[slug];
      if (!menuId) continue;

      const { data: existing } = await supabase
        .from("role_menu_access")
        .select("role_id")
        .eq("role_id", roleId)
        .eq("menu_id", menuId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("role_menu_access").insert({
          role_id: roleId,
          menu_id: menuId,
          can_view: true,
        });
      }
    }
  }
}

async function seed() {
  console.log("🌱 Mulai seeding full...\n");

  const pinHash = await bcrypt.hash("123456", 10);

  // ═══════════════════════════════════════════════
  //  1. COMPANY TOKOKO (jika belum ada)
  // ═══════════════════════════════════════════════
  const { data: existingTokoko } = await supabase
    .from("companies")
    .select("id")
    .eq("code", "TOKOKO")
    .maybeSingle();

  let tokokoId: string;
  if (existingTokoko) {
    tokokoId = existingTokoko.id;
    console.log(`ℹ️  Company TOKOKO sudah ada (id: ${tokokoId})`);
  } else {
    const passwordHash = await bcrypt.hash("tokoko123", 10);
    const { data: company, error } = await supabase
      .from("companies")
      .insert({
        id: UUID.company.tokoko,
        code: "TOKOKO",
        name: "Tokoko Default",
        password_hash: passwordHash,
        logo_url: null,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Gagal membuat TOKOKO:", error.message);
      process.exit(1);
    }
    tokokoId = company!.id;
    console.log("✅ Company TOKOKO dibuat (password: tokoko123)");
  }

  // ═══════════════════════════════════════════════
  //  2. ROLE + MENU ACCESS untuk TOKOKO
  // ═══════════════════════════════════════════════
  const tokokoRoleIds = {
    owner: UUID.role.tokoko_owner,
    kepala_cabang: UUID.role.tokoko_kepala_cabang,
    admin: UUID.role.tokoko_admin,
    kasir: UUID.role.tokoko_kasir,
  };
  const tokokoRoles = await upsertRoles(tokokoId, tokokoRoleIds);
  await upsertMenuAccess(tokokoId, tokokoRoles);
  console.log("✅ Roles & Menu Access untuk TOKOKO siap");
  console.log("");

  // ═══════════════════════════════════════════════
  //  3. OUTLET TOKOKO — Toko Utama
  // ═══════════════════════════════════════════════
  const { data: tokokoOutlet } = await supabase
    .from("outlets")
    .select("id")
    .eq("company_id", tokokoId)
    .maybeSingle();

  let tokokoOutletId: string;
  if (tokokoOutlet) {
    tokokoOutletId = tokokoOutlet.id;
    console.log(`ℹ️  Outlet TOKOKO sudah ada (id: ${tokokoOutletId})`);
  } else {
    const { data: outlet, error } = await supabase
      .from("outlets")
      .insert({
        id: UUID.outlet.tokoko_utama,
        company_id: tokokoId,
        name: "Toko Utama",
        address: "Jl. Merdeka No. 10, Jakarta",
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Gagal membuat outlet TOKOKO:", error.message);
      process.exit(1);
    }
    tokokoOutletId = outlet.id;
    console.log("✅ Outlet Toko Utama (TOKOKO) dibuat");
  }

  // ═══════════════════════════════════════════════
  //  4. USERS TOKOKO
  // ═══════════════════════════════════════════════
  const tokokoUsers = [
    { id: UUID.user.ali, company_id: tokokoId, role_id: tokokoRoles["Owner"], name: "Ali Owner", username: "ali", pin_hash: pinHash, all_outlets: true, status: "active" },
    { id: UUID.user.rina, company_id: tokokoId, role_id: tokokoRoles["Admin"], name: "Rina Admin", username: "rina", pin_hash: pinHash, all_outlets: false, status: "active" },
    { id: UUID.user.joko, company_id: tokokoId, role_id: tokokoRoles["Kasir"], name: "Joko Kasir", username: "joko", pin_hash: pinHash, all_outlets: false, status: "active" },
  ];

  for (const user of tokokoUsers) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("company_id", tokokoId)
      .eq("username", user.username)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("users").insert(user);
      if (error) console.error(`❌ Gagal membuat user ${user.username}:`, error.message);
    }
  }
  console.log("✅ 3 User TOKOKO siap (PIN: 123456)");

  // Assign non-owner users to outlet
  for (const user of tokokoUsers.filter((u) => !u.all_outlets)) {
    const { data: existing } = await supabase
      .from("user_outlets")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("outlet_id", tokokoOutletId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("user_outlets").insert({ user_id: user.id, outlet_id: tokokoOutletId });
    }
  }
  console.log("✅ User TOKOKO di-assign ke Toko Utama");
  console.log("");

  // ═══════════════════════════════════════════════
  //  5. RAKKU — Outlet Cabang + Users (jika belum ada)
  // ═══════════════════════════════════════════════
  const stockoId = UUID.company.stocko;

  const { data: existingCabang } = await supabase
    .from("outlets")
    .select("id")
    .eq("company_id", stockoId)
    .eq("name", "Outlet Cabang")
    .maybeSingle();

  const stockoCabangId: string = existingCabang ? existingCabang.id : UUID.outlet.stocko_cabang;

  if (!existingCabang) {
    const { data: cabang, error } = await supabase
      .from("outlets")
      .insert({
        id: UUID.outlet.stocko_cabang,
        company_id: stockoId,
        name: "Outlet Cabang",
        address: "Jl. Cabang No. 5, Bandung",
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Gagal membuat Outlet Cabang:", error.message);
    } else {
      console.log("✅ Outlet Cabang (RAKKU) dibuat");

      // Get RAKKU roles
      const { data: stockoRolesData } = await supabase
        .from("roles")
        .select("id, name")
        .eq("company_id", stockoId);
      const stockoRoleMap = Object.fromEntries((stockoRolesData ?? []).map((r) => [r.name, r.id]));

      // Users for Outlet Cabang
      const cabangUsers = [
        { id: UUID.user.rudi, company_id: stockoId, role_id: stockoRoleMap["Kepala Cabang"], name: "Rudi Kepala Cabang", username: "rudi", pin_hash: pinHash, all_outlets: false, status: "active" },
        { id: UUID.user.dewi, company_id: stockoId, role_id: stockoRoleMap["Kasir"], name: "Dewi Kasir", username: "dewi", pin_hash: pinHash, all_outlets: false, status: "active" },
      ];

      for (const user of cabangUsers) {
        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("company_id", stockoId)
          .eq("username", user.username)
          .maybeSingle();

        if (!existing) {
          const { error: ue } = await supabase.from("users").insert(user);
          if (ue) console.error(`❌ Gagal membuat user ${user.username}:`, ue.message);
        }
      }
      console.log("✅ 2 User Outlet Cabang siap (PIN: 123456)");

      // Assign users to outlet
      for (const user of cabangUsers) {
        const { data: existing } = await supabase
          .from("user_outlets")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("outlet_id", cabang.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from("user_outlets").insert({ user_id: user.id, outlet_id: cabang.id });
        }
      }
      console.log("✅ User Outlet Cabang di-assign");
    }
  } else {
    console.log("ℹ️  Outlet Cabang (RAKKU) sudah ada");
  }
  console.log("");

  // ═══════════════════════════════════════════════
  //  6. CATEGORIES & PRODUCTS per OUTLET
  // ═══════════════════════════════════════════════
  const outletCategories: Record<string, { name: string; sort_order: number }[]> = {
    [UUID.outlet.stocko_utama]: [
      { name: "Minuman Kopi", sort_order: 1 },
      { name: "Minuman Non-Kopi", sort_order: 2 },
      { name: "Makanan Ringan", sort_order: 3 },
    ],
    [stockoCabangId]: [
      { name: "Kopi", sort_order: 1 },
      { name: "Non-Kopi", sort_order: 2 },
      { name: "Pastry", sort_order: 3 },
    ],
    [tokokoOutletId]: [
      { name: "Makanan Berat", sort_order: 1 },
      { name: "Makanan Ringan", sort_order: 2 },
      { name: "Minuman", sort_order: 3 },
    ],
  };

  const outletProducts: Record<string, { name: string; price: number; catIndex: number; description: string }[]> = {
    [UUID.outlet.stocko_utama]: [
      { name: "Espresso", price: 25000, catIndex: 0, description: "Shot of pure espresso" },
      { name: "Cafe Latte", price: 35000, catIndex: 0, description: "Espresso with steamed milk" },
      { name: "Cappuccino", price: 35000, catIndex: 0, description: "Espresso with foam & steamed milk" },
      { name: "Iced Americano", price: 30000, catIndex: 0, description: "Espresso with cold water & ice" },
      { name: "Green Tea", price: 25000, catIndex: 1, description: "Japanese green tea" },
      { name: "Chocolate", price: 30000, catIndex: 1, description: "Rich hot chocolate" },
      { name: "Butter Croissant", price: 25000, catIndex: 2, description: "Flaky butter croissant" },
      { name: "Banana Muffin", price: 20000, catIndex: 2, description: "Moist banana muffin" },
    ],
    [stockoCabangId]: [
      { name: "Americano", price: 20000, catIndex: 0, description: "Classic black coffee" },
      { name: "Cappuccino", price: 30000, catIndex: 0, description: "Italian cappuccino" },
      { name: "Vanilla Latte", price: 35000, catIndex: 0, description: "Latte with vanilla syrup" },
      { name: "Milo", price: 25000, catIndex: 1, description: "Iced milo" },
      { name: "Thai Tea", price: 28000, catIndex: 1, description: "Thai iced tea" },
      { name: "Lemon Tea", price: 20000, catIndex: 1, description: "Fresh lemon tea" },
      { name: "Croissant", price: 22000, catIndex: 2, description: "Butter croissant" },
      { name: "Chiffon Cake", price: 18000, catIndex: 2, description: "Soft chiffon cake" },
      { name: "Cheesecake", price: 30000, catIndex: 2, description: "New York cheesecake" },
    ],
    [tokokoOutletId]: [
      { name: "Nasi Goreng", price: 45000, catIndex: 0, description: "Indonesian fried rice" },
      { name: "Mie Goreng", price: 40000, catIndex: 0, description: "Indonesian fried noodles" },
      { name: "Ayam Geprek", price: 50000, catIndex: 0, description: "Crispy chicken with sambal" },
      { name: "Kentang Goreng", price: 20000, catIndex: 1, description: "French fries" },
      { name: "Pisang Goreng", price: 15000, catIndex: 1, description: "Fried banana" },
      { name: "Risoles", price: 12000, catIndex: 1, description: "Stuffed fried roll" },
      { name: "Es Teh Manis", price: 8000, catIndex: 2, description: "Iced sweet tea" },
      { name: "Es Jeruk", price: 10000, catIndex: 2, description: "Fresh orange juice" },
      { name: "Air Mineral", price: 5000, catIndex: 2, description: "Mineral water" },
    ],
  };

  let catCounter = 1;
  for (const [outletId, cats] of Object.entries(outletCategories)) {
    const companyId = outletId === tokokoOutletId ? tokokoId : stockoId;
    const outletLabel = outletId === UUID.outlet.stocko_utama
      ? "Outlet Utama (RAKKU)"
      : outletId === stockoCabangId
        ? "Outlet Cabang (RAKKU)"
        : "Toko Utama (TOKOKO)";

    // Insert categories
    const catIds: string[] = [];
    for (let i = 0; i < cats.length; i++) {
      const catId = UUID.category(outletId.slice(-12), catCounter);
      catCounter++;

      const { data: existing } = await supabase
        .from("categories")
        .select("id")
        .eq("outlet_id", outletId)
        .eq("name", cats[i].name)
        .maybeSingle();

      if (existing) {
        catIds.push(existing.id);
      } else {
        const { data: cat } = await supabase
          .from("categories")
          .insert({
            id: catId,
            company_id: companyId,
            outlet_id: outletId,
            name: cats[i].name,
            sort_order: cats[i].sort_order,
          })
          .select()
          .single();

        if (cat) catIds.push(cat.id);
      }
    }

    // Insert products
    const products = outletProducts[outletId];
    if (!products) continue;

    let prodCount = 0;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const prodId = UUID.product(outletId.slice(-12), i + 1);

      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("outlet_id", outletId)
        .eq("name", p.name)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase.from("products").insert({
          id: prodId,
          company_id: companyId,
          outlet_id: outletId,
          category_id: catIds[p.catIndex],
          name: p.name,
          price: p.price,
          description: p.description,
          is_active: true,
        });
        if (!error) prodCount++;
      } else {
        prodCount++;
      }
    }

    console.log(`✅ ${prodCount} produk untuk ${outletLabel}`);
  }

  // ═══════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════
  console.log("\n🎉 Seeding full selesai!");
  console.log("");
  console.log("📋 Informasi Login Tenant:");
  console.log("   ┌──────────────────────┬──────────────────────────────────────┐");
  console.log("   │ RAKKU                │ Kode: RAKKU                         │");
  console.log("   │                      │ Password: rakku123                   │");
  console.log("   ├──────────────────────┼──────────────────────────────────────┤");
  console.log("   │ Outlet Utama         │ budi (Owner*) | siti (Admin) | ahmad (Kasir) │");
  console.log("   │ Outlet Cabang        │ budi (Owner*) | rudi (Kepala Cabang) | dewi (Kasir) │");
  console.log("   ├──────────────────────┼──────────────────────────────────────┤");
  console.log("   │ TOKOKO               │ Kode: TOKOKO                        │");
  console.log("   │                      │ Password: tokoko123                  │");
  console.log("   ├──────────────────────┼──────────────────────────────────────┤");
  console.log("   │ Toko Utama           │ ali (Owner*) | rina (Admin) | joko (Kasir) │");
  console.log("   └──────────────────────┴──────────────────────────────────────┘");
  console.log("   (*) Owner bisa akses semua outlet");
  console.log("   PIN: 123456 untuk semua user\n");
  console.log("\n   Superadmin: daftarkan via Supabase Auth (email/password)");
  console.log("   lalu login di /superadmin/login\n");
}

seed().catch((err) => {
  console.error("❌ Seed gagal:", err);
  process.exit(1);
});
