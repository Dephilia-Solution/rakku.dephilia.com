/**
 * Seed foto produk BUILD COFFEE dari Wikimedia Commons.
 *
 * Untuk setiap produk BUILD:
 *  1. Ambil filename Commons dari mapping (nama produk → file foto).
 *  2. Download thumbnail (Special:FilePath?width=800) → kompres sharp
 *     (800px, webp q80) → upload ke Silos (SILOS_API_URL/SILOS_API_KEY)
 *     → set image_url + image_silo_id.
 *  3. Kalau file gagal, fallback ke foto generic per kategori.
 *
 * Idempotent default: produk yang sudah punya image_url dilewati.
 * Gunakan `--force` untuk reseed semua (hapus file Silos lama dulu).
 * Jalankan: npx tsx scripts/seed-build-images.ts [--force]
 */

import { createClient } from "@supabase/supabase-js";
import { uploadFile, deleteFile } from "@rakku/silos-client";
import sharp from "sharp";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Muat env secara cascade: root .env.local dulu, lalu .env.local per-app.
for (const envPath of [
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, "../apps/owner/.env.local"),
  path.resolve(__dirname, "../apps/pos/.env.local"),
]) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FORCE = process.argv.includes("--force");
const DOWNLOAD_DELAY_MS = 400;

const COMMONS_URL = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=800`;

// Mapping produk BUILD → filename di Wikimedia Commons (terverifikasi ada).
const PRODUCT_IMAGE_FILES: Record<string, string> = {
  // Minuman Kopi
  Espresso: "Espresso shot.jpg",
  Americano: "Espresso Americano.jpeg",
  Cappuccino: "Cappuccino 6.jpg",
  "Cafe Latte": "Latte - Garden Café Brighton 2023-12-30.jpg",
  "Vanilla Latte": "Vanilla Iced Latte - Caffè Nero 2025-08-09.jpg",
  "Caramel Macchiato": "Caramel Latte Macchiato.jpg",
  Mocha: "Caffè Mocha by Phil.jpg",
  "Kopi Susu Gula Aren": "Es Kopi Susu Gula Aren.jpg",
  "Vietnam Drip": "Foto Vietnam Drip.jpg",
  Affogato: "GT-Affogato-al-caffe.jpg",
  // Minuman Non-Kopi
  "Matcha Latte": "Matcha green tea latte art.jpg",
  "Taro Latte": "Taro flavored milk tea.jpg",
  "Red Velvet": "Rose Latte (3328579214).jpg",
  Chocolate: "Cup of Hot Chocolate.jpg",
  "Green Tea": "White cup with green tea in it.jpg",
  "Teh Tarik": "Teh tarik 3.jpg",
  "Lemon Tea": "Iced lemon tea - Rawlab Juice & Tea.jpg",
  "Fresh Orange": "Orange juice 1 edit1.jpg",
  "Air Mineral": "Botol air mineral.jpg",
  // Roti & Pastry
  "Butter Croissant": "Croissants au beurre (18953292873).jpg",
  "Almond Croissant": "Almond croissant - Bread & Milk 2024-06-27.jpg",
  "Choco Croissant": "Chocolate croissant at Baker and Cook - 09-03-2020.jpg",
  "Roti Cokelat": "Pain au chocolat Luc Viatour.jpg",
  "Blueberry Muffin": "Blueberry muffin - GAIL's 2025-03-10.jpg",
  "Pain au Chocolat": "Pain au Chocolat.jpg",
  Bagel: "Bagel-Plain-Alt.jpg",
  // Makanan
  "French Fries": "French Fries.JPG",
  "Chicken Wings": "Chicken Wings with Montreal Seasoning.jpg",
  "Nasi Goreng Spesial": "Nasi goreng indonesia.jpg",
  "Spaghetti Bolognese": "Spaghetti Bolognese.jpg",
  "Ayam Geprek": "Ayam geprek dan lalapan.jpg",
  "Smoked Beef Sandwich": "Montreal Style Smoked Meat Sandwich.jpg",
  "Tuna Melt": "Tuna melt sandwich with fries.jpg",
  // Dessert
  Cheesecake: "Cheesecake with slice cut out.jpg",
  "Choco Lava": "Chocolate lava cake.jpg",
  Tiramisu: "Tiramisu dessert.jpg",
  "Red Velvet Cake": "Red Velvet Cake Waldorf Astoria.jpg",
  "Banana Split": "Banana split 1.jpg",
  "Ice Cream": "Ice Cream Dessert.JPG",
};

// Fallback per kategori (filename generic).
const CATEGORY_FALLBACKS: Record<string, string> = {
  "Minuman Kopi": "Cappuccino 6.jpg",
  "Minuman Non-Kopi": "Matcha green tea latte art.jpg",
  "Roti & Pastry": "Croissants au beurre (18953292873).jpg",
  Makanan: "Nasi goreng indonesia.jpg",
  Dessert: "Tiramisu dessert.jpg",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cache download per filename — satu file hanya di-download sekali
// untuk semua produk dengan nama yang sama (117 produk = 39 file unik).
const downloadCache = new Map<string, Buffer | null>();

async function getImageBuffer(file: string): Promise<Buffer | null> {
  if (downloadCache.has(file)) return downloadCache.get(file) ?? null;

  let buffer: Buffer | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(COMMONS_URL(file));
      if (res.status === 429) {
        await sleep(2500 * (attempt + 1));
        continue;
      }
      if (!res.ok) break;
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      break;
    } catch {
      // retry
    }
  }

  downloadCache.set(file, buffer);
  await sleep(DOWNLOAD_DELAY_MS);
  return buffer;
}

type SeedRow = {
  id: string;
  name: string;
  image_url: string | null;
  image_silo_id: string | null;
  categories: { name: string } | null;
};

async function seedProductImages() {
  console.log(`${FORCE ? "♻️" : "🖼️"} Mulai seed foto produk BUILD${FORCE ? " (--force: semua produk)" : ""}...\n`);

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
    .select("id, name, image_url, image_silo_id, categories(name)")
    .eq("company_id", company.id);

  const all = (products ?? []) as unknown as SeedRow[];
  const rows = FORCE ? all : all.filter((p) => !p.image_url);

  if (rows.length === 0) {
    console.log("ℹ️  Tidak ada produk yang perlu di-seed.");
    return;
  }

  console.log(`ℹ️  ${rows.length} produk akan di-seed foto.\n`);

  let okCount = 0;
  let fallbackCount = 0;
  let failCount = 0;

  for (const product of rows) {
    const categoryName = product.categories?.name ?? "";
    let file = PRODUCT_IMAGE_FILES[product.name];
    let usedFallback = false;

    if (!file) {
      file = CATEGORY_FALLBACKS[categoryName] ?? "";
      usedFallback = true;
    }

    if (!file) {
      console.warn(`⚠️  ${product.name}: tidak ada file (produk & kategori tidak terpetakan).`);
      failCount++;
      continue;
    }

    let buffer = await getImageBuffer(file);
    if (!buffer && !usedFallback) {
      const fallbackFile = CATEGORY_FALLBACKS[categoryName];
      if (fallbackFile && fallbackFile !== file) {
        buffer = await getImageBuffer(fallbackFile);
        usedFallback = true;
      }
    }

    if (!buffer) {
      console.warn(`⚠️  ${product.name}: download gagal (file & fallback).`);
      failCount++;
      continue;
    }

    // Hapus file Silos lama saat reseed
    if (product.image_silo_id) {
      try {
        await deleteFile(product.image_silo_id);
      } catch {
        // lanjutkan walau gagal hapus (file lama mungkin sudah hilang)
      }
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

    const uploaded = await uploadFile({
      file: compressed,
      filename: `${product.id}-seed.webp`,
      contentType: "image/webp",
    });

    const { error: updateError } = await supabase
      .from("products")
      .update({ image_url: uploaded.url, image_silo_id: uploaded.id })
      .eq("id", product.id);

    if (updateError) {
      console.warn(`❌ ${product.name}: update image_url gagal → ${updateError.message}`);
      failCount++;
      continue;
    }

    if (usedFallback) fallbackCount++;
    else okCount++;

    console.log(`✅ ${product.name} → ${uploaded.url}`);
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
