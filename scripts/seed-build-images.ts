/**
 * Seed foto produk BUILD COFFEE dari Unsplash.
 *
 * Untuk setiap produk BUILD:
 *  1. Ambil URL foto dari mapping (nama produk → photo id Unsplash).
 *  2. Kalau URL gagal (404), fallback ke foto generic per kategori.
 *  3. Download → kompres sharp (800px, webp q80) → upload ke bucket
 *     `product-images` di path `{productId}/seed.webp` → set image_url.
 *
 * Idempotent: produk yang sudah punya image_url dilewati.
 * Jalankan: npx tsx scripts/seed-build-images.ts
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "product-images";
const IMG = (id: string) => `https://images.unsplash.com/${id}?w=800&q=80&fm=webp`;

// Mapping produk BUILD → photo id Unsplash (sudah divalidasi 200).
const PRODUCT_IMAGE_URLS: Record<string, string> = {
  // Minuman Kopi
  Espresso: IMG("photo-1509042239860-f550ce710b93"),
  Americano: IMG("photo-1461023058943-07fcbe16d735"),
  Cappuccino: IMG("photo-1541167760496-1628856ab772"),
  "Cafe Latte": IMG("photo-1495474472287-4d71bcdd2085"),
  "Vanilla Latte": IMG("photo-1521017432531-fbd92d768814"),
  "Caramel Macchiato": IMG("photo-1517701550927-30cf4ba1dba5"),
  Mocha: IMG("photo-1551024506-0bccd828d307"),
  "Kopi Susu Gula Aren": IMG("photo-1571115177098-24ec42ed204d"),
  "Vietnam Drip": IMG("photo-1447933601403-0c6688de566e"),
  Affogato: IMG("photo-1497034825429-c343d7c6a68f"),
  // Minuman Non-Kopi
  "Matcha Latte": IMG("photo-1556679343-c7306c1976bc"),
  "Taro Latte": IMG("photo-1515823064-d6e0c04616a7"),
  "Red Velvet": IMG("photo-1521305916504-4a1121188589"),
  Chocolate: IMG("photo-1578985545062-69928b1d9587"),
  "Green Tea": IMG("photo-1544787219-7f47ccb76574"),
  "Teh Tarik": IMG("photo-1554118811-1e0d58224f24"),
  "Lemon Tea": IMG("photo-1546171753-97d7676e4602"),
  "Fresh Orange": IMG("photo-1563245372-f21724e3856d"),
  "Air Mineral": IMG("photo-1523362628745-0c100150b504"),
  // Roti & Pastry
  "Butter Croissant": IMG("photo-1555507036-ab1f4038808a"),
  "Almond Croissant": IMG("photo-1523293182086-7651a899d37f"),
  "Choco Croissant": IMG("photo-1531746790731-6c087fecd65a"),
  "Roti Cokelat": IMG("photo-1504674900247-0877df9cc836"),
  "Blueberry Muffin": IMG("photo-1565958011703-44f9829ba187"),
  "Pain au Chocolat": IMG("photo-1587314168485-3236d6710814"),
  Bagel: IMG("photo-1587049352846-4a222e784d38"),
  // Makanan
  "French Fries": IMG("photo-1601004890684-d8cbf643f5f2"),
  "Chicken Wings": IMG("photo-1552332386-f8dd00dc2f85"),
  "Nasi Goreng Spesial": IMG("photo-1512058564366-18510be2db19"),
  "Spaghetti Bolognese": IMG("photo-1621996346565-e3dbc646d9a9"),
  "Ayam Geprek": IMG("photo-1562967914-608f82629710"),
  "Smoked Beef Sandwich": IMG("photo-1603133872878-684f208fb84b"),
  "Tuna Melt": IMG("photo-1541519227354-08fa5d50c44d"),
  // Dessert
  Cheesecake: IMG("photo-1571877227200-a0d98ea607e9"),
  "Choco Lava": IMG("photo-1562059390-a761a084768e"),
  Tiramisu: IMG("photo-1533134242443-d4fd215305ad"),
  "Red Velvet Cake": IMG("photo-1513104890138-7c749659a591"),
  "Banana Split": IMG("photo-1563805042-7684c019e1cb"),
  "Ice Cream": IMG("photo-1484723091739-30a097e8f929"),
};

// Fallback per kategori (photo id generic).
const CATEGORY_FALLBACKS: Record<string, string> = {
  "Minuman Kopi": IMG("photo-1509042239860-f550ce710b93"),
  "Minuman Non-Kopi": IMG("photo-1556679343-c7306c1976bc"),
  "Roti & Pastry": IMG("photo-1555507036-ab1f4038808a"),
  Makanan: IMG("photo-1504674900247-0877df9cc836"),
  Dessert: IMG("photo-1565958011703-44f9829ba187"),
};

async function downloadBuffer(url: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      // retry sekali
    }
  }
  return null;
}

async function seedProductImages() {
  console.log("🖼️  Mulai seed foto produk BUILD...\n");

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("code", "BUILD")
    .maybeSingle();

  if (!company) {
    console.error("❌ Company BUILD tidak ditemukan. Jalankan scripts/seed-build.ts dulu.");
    process.exit(1);
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, image_url, categories(name)")
    .eq("company_id", company.id);

  const rows = (products ?? []).filter(
    (p) => !p.image_url
  ) as { id: string; name: string; image_url: string | null; categories: { name: string } | null }[];

  if (rows.length === 0) {
    console.log("ℹ️  Semua produk BUILD sudah punya image_url. Tidak ada yang perlu di-seed.");
    return;
  }

  console.log(`ℹ️  ${rows.length} produk akan di-seed foto.\n`);

  let okCount = 0;
  let fallbackCount = 0;
  let failCount = 0;

  for (const product of rows) {
    const categoryName = product.categories?.name ?? "";
    let url = PRODUCT_IMAGE_URLS[product.name];
    let usedFallback = false;

    if (!url) {
      url = CATEGORY_FALLBACKS[categoryName] ?? "";
      usedFallback = true;
    }

    if (!url) {
      console.warn(`⚠️  ${product.name}: tidak ada URL (produk & kategori tidak terpetakan).`);
      failCount++;
      continue;
    }

    let buffer = await downloadBuffer(url);
    if (!buffer && !usedFallback) {
      const fallbackUrl = CATEGORY_FALLBACKS[categoryName];
      if (fallbackUrl && fallbackUrl !== url) {
        buffer = await downloadBuffer(fallbackUrl);
        usedFallback = true;
      }
    }

    if (!buffer) {
      console.warn(`⚠️  ${product.name}: download gagal (URL & fallback).`);
      failCount++;
      continue;
    }

    let compressed: Buffer;
    try {
      compressed = await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      compressed = buffer;
    }

    const filePath = `${product.id}/seed.webp`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, compressed, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.warn(`❌ ${product.name}: upload gagal → ${uploadError.message}`);
      failCount++;
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from("products")
      .update({ image_url: publicUrl })
      .eq("id", product.id);

    if (updateError) {
      console.warn(`❌ ${product.name}: update image_url gagal → ${updateError.message}`);
      failCount++;
      continue;
    }

    if (usedFallback) fallbackCount++;
    else okCount++;

    console.log(`✅ ${product.name} → ${publicUrl}`);
  }

  console.log("\n📊 Ringkasan:");
  console.log(`   ✅ Berhasil (URL mapping): ${okCount}`);
  console.log(`   🔁 Pakai fallback kategori: ${fallbackCount}`);
  console.log(`   ❌ Gagal: ${failCount}`);
  console.log("\n🎉 Seed foto selesai!\n");
}

seedProductImages().catch((err) => {
  console.error("❌ Seed foto gagal:", err);
  process.exit(1);
});