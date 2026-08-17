/**
 * Seed script untuk Company BUILD COFFEE (kode BUILD).
 *
 * Membuat:
 *  - Company BUILD + 4 role (Owner, Kepala Cabang, Admin, Kasir)
 *  - 3 outlet (Tembalang, Banyumanik, Pleburan) + qr_menu_slug
 *  - 1 Owner (all_outlets) + 5 user per outlet (1 Kepala Cabang,
 *    1 Admin, 3 Kasir) — PIN 123456 semua
 *  - Menu coffeeshop lengkap (5 kategori, 39 produk) per outlet
 *  - Ingredients + resep (product_recipes) lengkap semua produk
 *  - Pricing tier (Dine In / Take Away) + product_tier_prices
 *  - Modifiers kopi + modifier_tier_prices
 *  - 10 dining_tables per outlet
 *  - Role-menu access matrix (di-seed penuh agar langsung jalan)
 *  - Akun owners (portal /owner): owner@build.test / build12345,
 *    companies.owner_id di-set ke owner tsb
 *
 * Idempotent: aman dijalankan ulang (upsert by name/slug/username).
 * Jalankan: npx tsx scripts/seed-build.ts
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

const COMPANY_CODE = "BUILD";
const COMPANY_NAME = "BUILD COFFEE";
const COMPANY_PASSWORD = "build123";

// Akun owners untuk portal /owner (email + password).
const OWNER_NAME = "Owner BUILD COFFEE";
const OWNER_EMAIL = "owner@build.test";
const OWNER_PASSWORD = "build12345";

const OUTLETS = [
  {
    name: "BUILD COFFEE Tembalang",
    address: "Jl. Ngesrep Timur V No.8, Tembalang, Semarang",
    qrSlug: "build-tembalang",
  },
  {
    name: "BUILD COFFEE Banyumanik",
    address: "Jl. Prof. Sudarto SH No.88, Banyumanik, Semarang",
    qrSlug: "build-banyumanik",
  },
  {
    name: "BUILD COFFEE Pleburan",
    address: "Jl. Pleburan Raya No.12, Semarang",
    qrSlug: "build-pleburan",
  },
];

const ROLE_NAMES = ["Owner", "Kepala Cabang", "Admin", "Kasir"];

// Role-menu access per role (slug menu). Semua menu didaftarkan penuh.
const ACCESS_MAP: Record<string, string[]> = {
  Owner: ["register", "orders", "reports", "products", "ingredients", "tables", "taxes", "expenses", "purchases"],
  "Kepala Cabang": ["register", "orders", "reports", "products", "ingredients", "tables", "expenses", "purchases"],
  Admin: ["orders", "reports", "products", "ingredients", "tables", "expenses", "purchases"],
  Kasir: ["register", "orders", "tables"],
};

// ─── Kategori (sama untuk semua outlet) ───
const CATEGORIES = [
  { name: "Minuman Kopi", sort_order: 1 },
  { name: "Minuman Non-Kopi", sort_order: 2 },
  { name: "Roti & Pastry", sort_order: 3 },
  { name: "Makanan", sort_order: 4 },
  { name: "Dessert", sort_order: 5 },
];

// ─── Produk (sama untuk semua outlet) ───
// catIndex mengacu ke indeks CATEGORIES.
const PRODUCTS: { name: string; price: number; catIndex: number; description: string }[] = [
  // Minuman Kopi
  { name: "Espresso", price: 18000, catIndex: 0, description: "Shot espresso murni, kuat & pekat" },
  { name: "Americano", price: 22000, catIndex: 0, description: "Espresso + air panas, hitam pekat" },
  { name: "Cappuccino", price: 28000, catIndex: 0, description: "Espresso + susu steamed + foam" },
  { name: "Cafe Latte", price: 32000, catIndex: 0, description: "Espresso + susu steamed yang lembut" },
  { name: "Vanilla Latte", price: 35000, catIndex: 0, description: "Latte dengan sirup vanilla" },
  { name: "Caramel Macchiato", price: 36000, catIndex: 0, description: "Latte dengan sirup karamel" },
  { name: "Mocha", price: 36000, catIndex: 0, description: "Espresso + cokelat + susu" },
  { name: "Kopi Susu Gula Aren", price: 28000, catIndex: 0, description: "Kopi susu dengan gula aren cair" },
  { name: "Vietnam Drip", price: 27000, catIndex: 0, description: "Kopi tetes Vietnam dengan susu" },
  { name: "Affogato", price: 30000, catIndex: 0, description: "Espresso di atas es krim vanilla" },
  // Minuman Non-Kopi
  { name: "Matcha Latte", price: 34000, catIndex: 1, description: "Matcha premium + susu" },
  { name: "Taro Latte", price: 32000, catIndex: 1, description: "Taro + susu, manis creamy" },
  { name: "Red Velvet", price: 33000, catIndex: 1, description: "Red velvet latte dengan susu" },
  { name: "Chocolate", price: 30000, catIndex: 1, description: "Cokelat panas yang kaya" },
  { name: "Green Tea", price: 24000, catIndex: 1, description: "Teh hijau Jepang" },
  { name: "Teh Tarik", price: 23000, catIndex: 1, description: "Teh + susu khas, creamy" },
  { name: "Lemon Tea", price: 25000, catIndex: 1, description: "Teh dengan perasan jeruk lemon" },
  { name: "Fresh Orange", price: 27000, catIndex: 1, description: "Jus jeruk segar" },
  { name: "Air Mineral", price: 8000, catIndex: 1, description: "Air mineral 600ml" },
  // Roti & Pastry
  { name: "Butter Croissant", price: 25000, catIndex: 2, description: "Croissant mentega, flaky" },
  { name: "Almond Croissant", price: 33000, catIndex: 2, description: "Croissant dengan almond slice" },
  { name: "Choco Croissant", price: 30000, catIndex: 2, description: "Croissant isi cokelat" },
  { name: "Roti Cokelat", price: 22000, catIndex: 2, description: "Roti lembut isi cokelat" },
  { name: "Blueberry Muffin", price: 25000, catIndex: 2, description: "Muffin blueberry moist" },
  { name: "Pain au Chocolat", price: 30000, catIndex: 2, description: "Pastry isi cokelat batang" },
  { name: "Bagel", price: 26000, catIndex: 2, description: "Bagel kenyal, pilihan klasik" },
  // Makanan
  { name: "French Fries", price: 25000, catIndex: 3, description: "Kentang goreng renyah" },
  { name: "Chicken Wings", price: 38000, catIndex: 3, description: "Sayap ayam goreng, 6 pcs" },
  { name: "Nasi Goreng Spesial", price: 45000, catIndex: 3, description: "Nasi goreng dengan telur" },
  { name: "Spaghetti Bolognese", price: 48000, catIndex: 3, description: "Spaghetti saus bolognese" },
  { name: "Ayam Geprek", price: 40000, catIndex: 3, description: "Ayam goreng tepung + sambal geprek" },
  { name: "Smoked Beef Sandwich", price: 45000, catIndex: 3, description: "Roti lapis daging asap + keju" },
  { name: "Tuna Melt", price: 42000, catIndex: 3, description: "Roti lapis tuna leleh keju" },
  // Dessert
  { name: "Cheesecake", price: 38000, catIndex: 4, description: "Cheesecake creamy" },
  { name: "Choco Lava", price: 35000, catIndex: 4, description: "Kue cokelat dengan lelehan di dalam" },
  { name: "Tiramisu", price: 42000, catIndex: 4, description: "Tiramisu klasik Italia" },
  { name: "Red Velvet Cake", price: 40000, catIndex: 4, description: "Red velvet cake cream cheese" },
  { name: "Banana Split", price: 32000, catIndex: 4, description: "Pisang + es krim + cokelat" },
  { name: "Ice Cream", price: 18000, catIndex: 4, description: "Satu scoop es krim vanilla" },
];

// ─── Ingredients (bahan baku) per outlet ───
// unit, stock_quantity, min_stock_alert, cost_per_unit (per satuan)
const INGREDIENTS: { name: string; unit: string; stock: number; minStock: number; cost: number }[] = [
  { name: "Espresso Beans", unit: "gram", stock: 5000, minStock: 1000, cost: 80 },
  { name: "Susu UHT", unit: "ml", stock: 20000, minStock: 4000, cost: 20 },
  { name: "Susu Oat", unit: "ml", stock: 8000, minStock: 2000, cost: 30 },
  { name: "Gula Aren", unit: "ml", stock: 10000, minStock: 2000, cost: 20 },
  { name: "Gula Pasir", unit: "gram", stock: 10000, minStock: 2000, cost: 15 },
  { name: "Bubuk Matcha", unit: "gram", stock: 3000, minStock: 500, cost: 300 },
  { name: "Bubuk Taro", unit: "gram", stock: 3000, minStock: 500, cost: 150 },
  { name: "Bubuk Red Velvet", unit: "gram", stock: 3000, minStock: 500, cost: 150 },
  { name: "Bubuk Cokelat", unit: "gram", stock: 5000, minStock: 1000, cost: 100 },
  { name: "Teh Hijau", unit: "gram", stock: 3000, minStock: 500, cost: 50 },
  { name: "Teh Hitam", unit: "gram", stock: 5000, minStock: 1000, cost: 40 },
  { name: "Sirup Vanila", unit: "ml", stock: 5000, minStock: 1000, cost: 50 },
  { name: "Sirup Karamel", unit: "ml", stock: 5000, minStock: 1000, cost: 50 },
  { name: "Es Batu", unit: "pcs", stock: 500, minStock: 100, cost: 500 },
  { name: "Air Mineral 600ml", unit: "pcs", stock: 200, minStock: 50, cost: 4000 },
  { name: "Jeruk", unit: "pcs", stock: 200, minStock: 50, cost: 5000 },
  { name: "Tepung Terigu", unit: "gram", stock: 20000, minStock: 4000, cost: 12 },
  { name: "Butter", unit: "gram", stock: 10000, minStock: 2000, cost: 40 },
  { name: "Cokelat Compound", unit: "gram", stock: 8000, minStock: 2000, cost: 60 },
  { name: "Cream Cheese", unit: "gram", stock: 5000, minStock: 1000, cost: 60 },
  { name: "Blueberry", unit: "gram", stock: 3000, minStock: 500, cost: 100 },
  { name: "Almond Slice", unit: "gram", stock: 2000, minStock: 500, cost: 120 },
  { name: "Telur", unit: "pcs", stock: 300, minStock: 100, cost: 2500 },
  { name: "Kentang", unit: "gram", stock: 15000, minStock: 3000, cost: 20 },
  { name: "Ayam Fillet", unit: "gram", stock: 15000, minStock: 3000, cost: 40 },
  { name: "Nasi", unit: "gram", stock: 15000, minStock: 3000, cost: 10 },
  { name: "Spaghetti", unit: "gram", stock: 8000, minStock: 2000, cost: 30 },
  { name: "Saus Bolognese", unit: "gram", stock: 5000, minStock: 1000, cost: 40 },
  { name: "Sambal Geprek", unit: "gram", stock: 5000, minStock: 1000, cost: 20 },
  { name: "Smoked Beef", unit: "gram", stock: 5000, minStock: 1000, cost: 80 },
  { name: "Tuna", unit: "gram", stock: 5000, minStock: 1000, cost: 70 },
  { name: "Keju Slice", unit: "pcs", stock: 300, minStock: 100, cost: 1500 },
  { name: "Minyak Goreng", unit: "ml", stock: 15000, minStock: 3000, cost: 15 },
  { name: "Tepung Roti", unit: "gram", stock: 5000, minStock: 1000, cost: 15 },
  { name: "Pisang", unit: "pcs", stock: 200, minStock: 50, cost: 3000 },
  { name: "Es Krim Vanila", unit: "gram", stock: 10000, minStock: 2000, cost: 40 },
  // Packaging
  { name: "Cup 16oz", unit: "pcs", stock: 3000, minStock: 500, cost: 1500 },
  { name: "Lid Cup", unit: "pcs", stock: 3000, minStock: 500, cost: 300 },
  { name: "Straw", unit: "pcs", stock: 3000, minStock: 500, cost: 200 },
];

// ─── Resep per produk (produk → [{bahan, qty}]) ───
// Bahan mengacu ke nama INGREDIENTS di atas.
const RECIPES: Record<string, { name: string; qty: number }[]> = {
  Espresso: [
    { name: "Espresso Beans", qty: 18 },
    { name: "Cup 16oz", qty: 1 },
  ],
  Americano: [
    { name: "Espresso Beans", qty: 18 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  Cappuccino: [
    { name: "Espresso Beans", qty: 18 },
    { name: "Susu UHT", qty: 100 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  "Cafe Latte": [
    { name: "Espresso Beans", qty: 18 },
    { name: "Susu UHT", qty: 150 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  "Vanilla Latte": [
    { name: "Espresso Beans", qty: 18 },
    { name: "Susu UHT", qty: 150 },
    { name: "Sirup Vanila", qty: 15 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  "Caramel Macchiato": [
    { name: "Espresso Beans", qty: 18 },
    { name: "Susu UHT", qty: 150 },
    { name: "Sirup Karamel", qty: 15 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  Mocha: [
    { name: "Espresso Beans", qty: 18 },
    { name: "Susu UHT", qty: 150 },
    { name: "Bubuk Cokelat", qty: 20 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  "Kopi Susu Gula Aren": [
    { name: "Espresso Beans", qty: 18 },
    { name: "Susu UHT", qty: 150 },
    { name: "Gula Aren", qty: 30 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  "Vietnam Drip": [
    { name: "Espresso Beans", qty: 20 },
    { name: "Susu UHT", qty: 50 },
    { name: "Gula Aren", qty: 20 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  Affogato: [
    { name: "Espresso Beans", qty: 18 },
    { name: "Es Krim Vanila", qty: 100 },
    { name: "Cup 16oz", qty: 1 },
  ],
  "Matcha Latte": [
    { name: "Bubuk Matcha", qty: 12 },
    { name: "Susu UHT", qty: 200 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  "Taro Latte": [
    { name: "Bubuk Taro", qty: 20 },
    { name: "Susu UHT", qty: 200 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  "Red Velvet": [
    { name: "Bubuk Red Velvet", qty: 20 },
    { name: "Susu UHT", qty: 200 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  Chocolate: [
    { name: "Bubuk Cokelat", qty: 25 },
    { name: "Susu UHT", qty: 200 },
    { name: "Cup 16oz", qty: 1 },
  ],
  "Green Tea": [
    { name: "Teh Hijau", qty: 5 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
  ],
  "Teh Tarik": [
    { name: "Teh Hitam", qty: 8 },
    { name: "Susu UHT", qty: 80 },
    { name: "Gula Pasir", qty: 20 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  "Lemon Tea": [
    { name: "Teh Hitam", qty: 5 },
    { name: "Jeruk", qty: 1 },
    { name: "Gula Pasir", qty: 25 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  "Fresh Orange": [
    { name: "Jeruk", qty: 3 },
    { name: "Cup 16oz", qty: 1 },
    { name: "Lid Cup", qty: 1 },
    { name: "Straw", qty: 1 },
  ],
  "Air Mineral": [{ name: "Air Mineral 600ml", qty: 1 }],
  "Butter Croissant": [
    { name: "Tepung Terigu", qty: 100 },
    { name: "Butter", qty: 50 },
  ],
  "Almond Croissant": [
    { name: "Tepung Terigu", qty: 100 },
    { name: "Butter", qty: 50 },
    { name: "Almond Slice", qty: 20 },
  ],
  "Choco Croissant": [
    { name: "Tepung Terigu", qty: 100 },
    { name: "Butter", qty: 50 },
    { name: "Cokelat Compound", qty: 30 },
  ],
  "Roti Cokelat": [
    { name: "Tepung Terigu", qty: 80 },
    { name: "Cokelat Compound", qty: 25 },
  ],
  "Blueberry Muffin": [
    { name: "Tepung Terigu", qty: 80 },
    { name: "Blueberry", qty: 30 },
    { name: "Telur", qty: 1 },
  ],
  "Pain au Chocolat": [
    { name: "Tepung Terigu", qty: 100 },
    { name: "Butter", qty: 40 },
    { name: "Cokelat Compound", qty: 30 },
  ],
  Bagel: [
    { name: "Tepung Terigu", qty: 100 },
    { name: "Telur", qty: 1 },
  ],
  "French Fries": [
    { name: "Kentang", qty: 150 },
    { name: "Minyak Goreng", qty: 20 },
  ],
  "Chicken Wings": [
    { name: "Ayam Fillet", qty: 200 },
    { name: "Tepung Roti", qty: 20 },
    { name: "Minyak Goreng", qty: 30 },
  ],
  "Nasi Goreng Spesial": [
    { name: "Nasi", qty: 200 },
    { name: "Telur", qty: 1 },
    { name: "Minyak Goreng", qty: 15 },
  ],
  "Spaghetti Bolognese": [
    { name: "Spaghetti", qty: 150 },
    { name: "Saus Bolognese", qty: 80 },
  ],
  "Ayam Geprek": [
    { name: "Ayam Fillet", qty: 200 },
    { name: "Tepung Roti", qty: 20 },
    { name: "Sambal Geprek", qty: 20 },
    { name: "Minyak Goreng", qty: 30 },
  ],
  "Smoked Beef Sandwich": [
    { name: "Smoked Beef", qty: 100 },
    { name: "Keju Slice", qty: 1 },
    { name: "Tepung Terigu", qty: 50 },
  ],
  "Tuna Melt": [
    { name: "Tuna", qty: 100 },
    { name: "Keju Slice", qty: 1 },
    { name: "Tepung Terigu", qty: 50 },
  ],
  Cheesecake: [
    { name: "Cream Cheese", qty: 150 },
    { name: "Tepung Terigu", qty: 50 },
    { name: "Gula Pasir", qty: 30 },
  ],
  "Choco Lava": [
    { name: "Cokelat Compound", qty: 80 },
    { name: "Tepung Terigu", qty: 60 },
    { name: "Telur", qty: 2 },
    { name: "Gula Pasir", qty: 40 },
  ],
  Tiramisu: [
    { name: "Cream Cheese", qty: 150 },
    { name: "Bubuk Cokelat", qty: 15 },
    { name: "Gula Pasir", qty: 30 },
  ],
  "Red Velvet Cake": [
    { name: "Tepung Terigu", qty: 120 },
    { name: "Bubuk Red Velvet", qty: 20 },
    { name: "Cream Cheese", qty: 100 },
    { name: "Gula Pasir", qty: 50 },
  ],
  "Banana Split": [
    { name: "Pisang", qty: 1 },
    { name: "Es Krim Vanila", qty: 100 },
    { name: "Cokelat Compound", qty: 20 },
  ],
  "Ice Cream": [{ name: "Es Krim Vanila", qty: 100 }],
};

// ─── Modifiers (kopi) ───
// {name, delta, group, applyToCat} — diterapkan ke semua produk kategori kopi.
const COFFEE_MODIFIERS: { name: string; delta: number; group: string }[] = [
  { name: "Extra Shot", delta: 5000, group: "Ekstra" },
  { name: "Oat Milk", delta: 8000, group: "Susu" },
  { name: "Whipped Cream", delta: 5000, group: "Topping" },
  { name: "Vanilla Syrup", delta: 5000, group: "Sirup" },
  { name: "Caramel Syrup", delta: 5000, group: "Sirup" },
  { name: "Less Ice", delta: 0, group: "Es" },
];

// ─── Helper: upsert roles ───
async function upsertRoles(companyId: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const name of ROLE_NAMES) {
    const { data: existing } = await supabase
      .from("roles")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", name)
      .maybeSingle();
    if (existing) {
      map[name] = existing.id;
      continue;
    }
    const { data, error } = await supabase
      .from("roles")
      .insert({ company_id: companyId, name })
      .select()
      .single();
    if (error) {
      console.error(`❌ Gagal insert role ${name}:`, error.message);
      process.exit(1);
    }
    map[name] = data.id;
  }
  return map;
}

// ─── Helper: upsert role-menu access ───
async function upsertMenuAccess(roleMap: Record<string, string>) {
  const { data: menus } = await supabase.from("menus").select("id, slug");
  if (!menus || menus.length === 0) {
    console.error("❌ Menu tidak ditemukan. Jalankan semua migration dulu.");
    process.exit(1);
  }
  const menuMap = Object.fromEntries(menus.map((m) => [m.slug, m.id]));
  for (const [roleName, slugs] of Object.entries(ACCESS_MAP)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;
    for (const slug of slugs) {
      const menuId = menuMap[slug];
      if (!menuId) {
        console.warn(`⚠️  Menu slug '${slug}' tidak ada di tabel menus, dilewati.`);
        continue;
      }
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
          can_create: true,
          can_edit: true,
          can_delete: true,
        });
      }
    }
  }
}

// ─── Helper: upsert akun owners (portal /owner) + set companies.owner_id ───
async function seedOwnerAccount(companyId: string) {
  const { data: existingOwner } = await supabase
    .from("owners")
    .select("id")
    .eq("email", OWNER_EMAIL)
    .maybeSingle();

  let ownerId = existingOwner?.id;
  if (!ownerId) {
    const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);
    const { data, error } = await supabase
      .from("owners")
      .insert({
        email: OWNER_EMAIL,
        name: OWNER_NAME,
        password_hash: passwordHash,
        is_active: true,
        email_verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      console.error("❌ Gagal membuat akun owners:", error.message);
      process.exit(1);
    }
    ownerId = data.id;
    console.log(`✅ Akun owners dibuat: ${OWNER_EMAIL}`);
  } else {
    console.log(`ℹ️  Akun owners ${OWNER_EMAIL} sudah ada`);
  }

  const { data: company } = await supabase
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .maybeSingle();

  if (company && !company.owner_id) {
    const { error } = await supabase
      .from("companies")
      .update({ owner_id: ownerId })
      .eq("id", companyId);
    if (error) {
      console.error("❌ Gagal set companies.owner_id:", error.message);
      process.exit(1);
    }
    console.log("✅ companies.owner_id BUILD di-set ke akun owners");
  } else {
    console.log("ℹ️  companies.owner_id BUILD sudah terisi, dilewati");
  }
}

// ─── Helper: seed pricing tiers per outlet ───
async function seedTiers(
  companyId: string,
  outletId: string
): Promise<{ dineIn: string; takeAway: string }> {
  const tiers = [
    { name: "Dine In", slug: "dine-in", sort_order: 1 },
    { name: "Take Away", slug: "take-away", sort_order: 2 },
  ];
  const result: { dineIn: string; takeAway: string } = { dineIn: "", takeAway: "" };
  for (const t of tiers) {
    const { data: existing } = await supabase
      .from("pricing_tiers")
      .select("id")
      .eq("company_id", companyId)
      .eq("outlet_id", outletId)
      .eq("slug", t.slug)
      .maybeSingle();
    let id = existing?.id;
    if (!id) {
      const { data, error } = await supabase
        .from("pricing_tiers")
        .insert({ company_id: companyId, outlet_id: outletId, name: t.name, slug: t.slug, is_active: true, sort_order: t.sort_order })
        .select()
        .single();
      if (error) {
        console.error(`❌ Gagal insert tier ${t.slug}:`, error.message);
        process.exit(1);
      }
      id = data.id;
    }
    if (t.slug === "dine-in") result.dineIn = id;
    else result.takeAway = id;
  }
  return result;
}

// ─── Helper: seed dining tables ───
async function seedTables(companyId: string, outletId: string) {
  for (let i = 1; i <= 10; i++) {
    const name = `Meja ${i}`;
    const { data: existing } = await supabase
      .from("dining_tables")
      .select("id")
      .eq("company_id", companyId)
      .eq("outlet_id", outletId)
      .eq("name", name)
      .maybeSingle();
    if (!existing) {
      await supabase.from("dining_tables").insert({
        company_id: companyId,
        outlet_id: outletId,
        name,
        status: "available",
      });
    }
  }
}

// ─── Helper: seed users per outlet ───
async function seedOutletUsers(
  companyId: string,
  outletId: string,
  outletSlug: string,
  roleMap: Record<string, string>,
  pinHash: string
) {
  const users = [
    { username: `kepala-${outletSlug}`, name: `Kepala Cabang ${outletSlug}`, role: "Kepala Cabang" },
    { username: `admin-${outletSlug}`, name: `Admin ${outletSlug}`, role: "Admin" },
    { username: `kasir-${outletSlug}-1`, name: `Kasir ${outletSlug} 1`, role: "Kasir" },
    { username: `kasir-${outletSlug}-2`, name: `Kasir ${outletSlug} 2`, role: "Kasir" },
    { username: `kasir-${outletSlug}-3`, name: `Kasir ${outletSlug} 3`, role: "Kasir" },
  ];
  for (const u of users) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("company_id", companyId)
      .eq("username", u.username)
      .maybeSingle();
    let userId = existing?.id;
    if (!userId) {
      const { data, error } = await supabase
        .from("users")
        .insert({
          company_id: companyId,
          role_id: roleMap[u.role],
          name: u.name,
          username: u.username,
          pin_hash: pinHash,
          all_outlets: false,
          status: "active",
        })
        .select()
        .single();
      if (error) {
        console.error(`❌ Gagal insert user ${u.username}:`, error.message);
        process.exit(1);
      }
      userId = data.id;
    }
    const { data: linked } = await supabase
      .from("user_outlets")
      .select("user_id")
      .eq("user_id", userId)
      .eq("outlet_id", outletId)
      .maybeSingle();
    if (!linked) {
      await supabase.from("user_outlets").insert({ user_id: userId, outlet_id: outletId });
    }
  }
}

// ─── Helper: seed menu data (categories, products, ingredients, recipes, modifiers, tiers) ───
async function seedOutletMenu(companyId: string, outletId: string) {
  // Categories
  const catMap: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("company_id", companyId)
      .eq("outlet_id", outletId)
      .eq("name", c.name)
      .maybeSingle();
    if (existing) {
      catMap[c.name] = existing.id;
      continue;
    }
    const { data, error } = await supabase
      .from("categories")
      .insert({ company_id: companyId, outlet_id: outletId, name: c.name, sort_order: c.sort_order })
      .select()
      .single();
    if (error) {
      console.error(`❌ Gagal insert kategori ${c.name}:`, error.message);
      process.exit(1);
    }
    catMap[c.name] = data.id;
  }

  // Pricing tiers (dibutuhkan untuk product_tier_prices & modifier_tier_prices)
  const tiers = await seedTiers(companyId, outletId);

  // Products
  const productMap: Record<string, string> = {};
  for (const p of PRODUCTS) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("company_id", companyId)
      .eq("outlet_id", outletId)
      .eq("name", p.name)
      .maybeSingle();
    let productId = existing?.id;
    if (!productId) {
      const { data, error } = await supabase
        .from("products")
        .insert({
          company_id: companyId,
          outlet_id: outletId,
          category_id: catMap[CATEGORIES[p.catIndex].name],
          name: p.name,
          price: p.price,
          description: p.description,
          is_active: true,
        })
        .select()
        .single();
      if (error) {
        console.error(`❌ Gagal insert produk ${p.name}:`, error.message);
        process.exit(1);
      }
      productId = data.id;
    }
    productMap[p.name] = productId;

    // Product tier prices (base price untuk kedua tier)
    for (const tierId of [tiers.dineIn, tiers.takeAway]) {
      const { data: hasTier } = await supabase
        .from("product_tier_prices")
        .select("id")
        .eq("product_id", productId)
        .eq("tier_id", tierId)
        .maybeSingle();
      if (!hasTier) {
        await supabase.from("product_tier_prices").insert({ product_id: productId, tier_id: tierId, price: p.price });
      }
    }
  }

  // Ingredients
  const ingredientMap: Record<string, string> = {};
  for (const ing of INGREDIENTS) {
    const { data: existing } = await supabase
      .from("ingredients")
      .select("id")
      .eq("company_id", companyId)
      .eq("outlet_id", outletId)
      .eq("name", ing.name)
      .maybeSingle();
    if (existing) {
      ingredientMap[ing.name] = existing.id;
      continue;
    }
    const { data, error } = await supabase
      .from("ingredients")
      .insert({
        company_id: companyId,
        outlet_id: outletId,
        name: ing.name,
        unit: ing.unit,
        stock_quantity: ing.stock,
        min_stock_alert: ing.minStock,
        cost_per_unit: ing.cost,
        is_active: true,
      })
      .select()
      .single();
    if (error) {
      console.error(`❌ Gagal insert ingredient ${ing.name}:`, error.message);
      process.exit(1);
    }
    ingredientMap[ing.name] = data.id;
  }

  // Recipes
  for (const [productName, rows] of Object.entries(RECIPES)) {
    const productId = productMap[productName];
    if (!productId) continue;
    for (const r of rows) {
      const ingredientId = ingredientMap[r.name];
      if (!ingredientId) {
        console.warn(`⚠️  Ingredient '${r.name}' untuk ${productName} tidak ada di daftar bahan.`);
        continue;
      }
      const { data: existing } = await supabase
        .from("product_recipes")
        .select("id")
        .eq("product_id", productId)
        .eq("ingredient_id", ingredientId)
        .maybeSingle();
      if (!existing) {
        await supabase.from("product_recipes").insert({
          product_id: productId,
          ingredient_id: ingredientId,
          quantity_used: r.qty,
        });
      }
    }
  }

  // Modifiers (hanya untuk produk kategori Minuman Kopi)
  for (const p of PRODUCTS) {
    if (p.catIndex !== 0) continue;
    const productId = productMap[p.name];
    if (!productId) continue;
    for (const m of COFFEE_MODIFIERS) {
      const { data: existing } = await supabase
        .from("modifiers")
        .select("id")
        .eq("product_id", productId)
        .eq("name", m.name)
        .maybeSingle();
      let modifierId = existing?.id;
      if (!modifierId) {
        const { data, error } = await supabase
          .from("modifiers")
          .insert({ product_id: productId, name: m.name, price_delta: m.delta, group_name: m.group })
          .select()
          .single();
        if (error) {
          console.error(`❌ Gagal insert modifier ${m.name} (${p.name}):`, error.message);
          process.exit(1);
        }
        modifierId = data.id;
      }
      for (const tierId of [tiers.dineIn, tiers.takeAway]) {
        const { data: hasTier } = await supabase
          .from("modifier_tier_prices")
          .select("id")
          .eq("modifier_id", modifierId)
          .eq("tier_id", tierId)
          .maybeSingle();
        if (!hasTier) {
          await supabase.from("modifier_tier_prices").insert({ modifier_id: modifierId, tier_id: tierId, price_delta: m.delta });
        }
      }
    }
  }
}

// ─── Main ───
async function seed() {
  console.log("🌱 Mulai seeding BUILD COFFEE...\n");

  // 1. Company
  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("code", COMPANY_CODE)
    .maybeSingle();

  let companyId = existingCompany?.id;
  if (!companyId) {
    const passwordHash = await bcrypt.hash(COMPANY_PASSWORD, 10);
    const { data: company, error } = await supabase
      .from("companies")
      .insert({ code: COMPANY_CODE, name: COMPANY_NAME, password_hash: passwordHash, status: "active" })
      .select()
      .single();
    if (error) {
      console.error("❌ Gagal membuat company:", error.message);
      process.exit(1);
    }
    companyId = company.id;
    console.log(`✅ Company ${COMPANY_NAME} (${COMPANY_CODE}) dibuat, password: ${COMPANY_PASSWORD}`);
  } else {
    console.log(`ℹ️  Company ${COMPANY_CODE} sudah ada, lanjut upsert data.`);
  }

  // 2. Roles + menu access
  const roleMap = await upsertRoles(companyId);
  await upsertMenuAccess(roleMap);
  console.log("✅ 4 role + role-menu access siap");

  // 3. Owner user (all_outlets)
  const pinHash = await bcrypt.hash("123456", 10);
  const { data: existingOwner } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("username", "owner")
    .maybeSingle();
  if (!existingOwner) {
    const { error } = await supabase.from("users").insert({
      company_id: companyId,
      role_id: roleMap["Owner"],
      name: "Owner BUILD",
      username: "owner",
      pin_hash: pinHash,
      all_outlets: true,
      status: "active",
    });
    if (error) {
      console.error("❌ Gagal membuat Owner:", error.message);
      process.exit(1);
    }
  }
  console.log("✅ Owner BUILD siap (username: owner, PIN: 123456, akses semua outlet)");

  // 3b. Akun owners untuk portal /owner
  await seedOwnerAccount(companyId);

  // 4. Outlets + users + menu data
  for (const outlet of OUTLETS) {
    const { data: existingOutlet } = await supabase
      .from("outlets")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", outlet.name)
      .maybeSingle();

    let outletId = existingOutlet?.id;
    if (!outletId) {
      const { data, error } = await supabase
        .from("outlets")
        .insert({
          company_id: companyId,
          name: outlet.name,
          address: outlet.address,
          qr_menu_slug: outlet.qrSlug,
          status: "active",
        })
        .select()
        .single();
      if (error) {
        console.error(`❌ Gagal membuat outlet ${outlet.name}:`, error.message);
        process.exit(1);
      }
      outletId = data.id;
      console.log(`✅ Outlet ${outlet.name} dibuat (QR: /menu/${outlet.qrSlug})`);
    } else {
      console.log(`ℹ️  Outlet ${outlet.name} sudah ada`);
    }

    await seedOutletUsers(companyId, outletId, outlet.qrSlug.replace("build-", ""), roleMap, pinHash);
    await seedOutletMenu(companyId, outletId);
    await seedTables(companyId, outletId);
    console.log(`✅ ${outlet.name}: 5 user + ${CATEGORIES.length} kategori + ${PRODUCTS.length} produk + ${INGREDIENTS.length} bahan + 10 meja + modifiers siap`);
  }

  // 5. Summary
  console.log("\n🎉 Seeding BUILD COFFEE selesai!\n");
  console.log("📋 Informasi Login Tenant:");
  console.log("   ┌──────────────────────────┬──────────────────────────────────────────┐");
  console.log("   │ BUILD                     │ Kode: BUILD                             │");
  console.log("   │                           │ Password: build123                       │");
  console.log("   ├──────────────────────────┼──────────────────────────────────────────┤");
  console.log("   │ Owner (semua outlet)      │ username: owner | PIN: 123456            │");
  console.log("   ├──────────────────────────┼──────────────────────────────────────────┤");
  console.log("   │ Tembalang                 │ kepala-tembalang, admin-tembalang, kasir-tembalang-1..3 │");
  console.log("   │ Banyumanik                │ kepala-banyumanik, admin-banyumanik, kasir-banyumanik-1..3 │");
  console.log("   │ Pleburan                  │ kepala-pleburan, admin-pleburan, kasir-pleburan-1..3 │");
  console.log("   └──────────────────────────┴──────────────────────────────────────────┘");
  console.log("   PIN: 123456 untuk semua user\n");
  console.log("   📋 Akun Portal Owner (/owner):");
  console.log("   ┌──────────┬─────────────────────────┬───────────────┐");
  console.log("   │ Portal   │ Email                   │ Password      │");
  console.log("   ├──────────┼─────────────────────────┼───────────────┤");
  console.log("   │ /owner   │ owner@build.test        │ build12345    │");
  console.log("   └──────────┴─────────────────────────┴───────────────┘");
  console.log("   QR Menu: /menu/build-tembalang, /menu/build-banyumanik, /menu/build-pleburan\n");
}

seed().catch((err) => {
  console.error("❌ Seed gagal:", err);
  process.exit(1);
});