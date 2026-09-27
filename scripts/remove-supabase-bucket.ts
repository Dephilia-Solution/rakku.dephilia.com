/**
 * Hapus bucket `product-images` beserta seluruh datanya dari Supabase Storage.
 * Dipakai karena Supabase memblokir DML langsung ke storage tables via SQL.
 *
 * IRREVERSIBLE — semua file gambar lama di bucket terhapus permanen.
 * Jalankan: npx tsx scripts/remove-supabase-bucket.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Error: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "product-images";

async function removeBucket() {
  // Cek apakah bucket masih ada
  const { data: bucket, error: bucketError } = await supabase.storage
    .getBucket(BUCKET);

  if (bucketError || !bucket) {
    console.log(`ℹ️  Bucket '${BUCKET}' tidak ditemukan atau sudah dihapus.`);
    return;
  }

  console.log(`🗑️  Mengosongkan isi bucket '${BUCKET}'...`);
  const { error: emptyError } = await supabase.storage.emptyBucket(BUCKET);
  if (emptyError) {
    console.error(`❌ Gagal mengosongkan bucket: ${emptyError.message}`);
    process.exit(1);
  }

  console.log(`🗑️  Menghapus bucket '${BUCKET}'...`);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { error: deleteError } = await supabase.storage.deleteBucket(BUCKET);
    if (!deleteError) {
      console.log(`✅ Bucket '${BUCKET}' dan seluruh datanya berhasil dihapus.`);
      return;
    }
    if (attempt === 5) {
      console.error(`❌ Gagal menghapus bucket: ${deleteError.message}`);
      process.exit(1);
    }
    console.log(`   (percobaan ${attempt} gagal — retry dalam 2 detik...)`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

removeBucket().catch((err) => {
  console.error("❌ Gagal:", err);
  process.exit(1);
});
