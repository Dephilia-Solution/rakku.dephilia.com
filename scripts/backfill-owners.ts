/**
 * Backfill script — Migrasi data company existing (RAKKU, TOKOKO) ke model ownership v3.
 *
 * Membuat akun `owners` untuk user yang saat ini berperan "Owner" di tiap company,
 * lalu set `companies.owner_id` ke owner baru tsb.
 *
 * Cara pakai:
 *   npx tsx scripts/backfill-owners.ts
 *
 * Setelah jalan:
 *   - RAKKU company → owner budi@rakku.test (password: budi12345)
 *   - TOKOKO company → owner ali@rakku.test (password: ali12345)
 */

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Error: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const OWNER_BACKFILL: {
  companyCode: string;
  ownerName: string;
  ownerUsername: string;
  ownerEmail: string;
  ownerPassword: string;
}[] = [
  {
    companyCode: "RAKKU",
    ownerName: "Budi Pemilik",
    ownerUsername: "budi",
    ownerEmail: "budi@rakku.test",
    ownerPassword: "budi12345",
  },
  {
    companyCode: "TOKOKO",
    ownerName: "Ali Pemilik",
    ownerUsername: "ali",
    ownerEmail: "ali@rakku.test",
    ownerPassword: "ali12345",
  },
];

async function backfill() {
  console.log("🔄 Mulai backfill owners...\n");

  for (const cfg of OWNER_BACKFILL) {
    // 1. Cek company
    const { data: company } = await supabase
      .from("companies")
      .select("id, code, name, owner_id")
      .eq("code", cfg.companyCode)
      .maybeSingle();

    if (!company) {
      console.log(
        `⚠️  Company ${cfg.companyCode} tidak ditemukan, skip.`
      );
      continue;
    }

    if (company.owner_id) {
      console.log(
        `ℹ️  Company ${cfg.companyCode} sudah punya owner_id, skip.`
      );
      continue;
    }

    // 2. Cek apakah owner sudah ada (by email)
    const { data: existingOwner } = await supabase
      .from("owners")
      .select("id")
      .eq("email", cfg.ownerEmail)
      .maybeSingle();

    let ownerId: string;

    if (existingOwner) {
      ownerId = existingOwner.id;
      console.log(`ℹ️  Owner ${cfg.ownerEmail} sudah ada, pakai yang existing.`);
    } else {
      // 3. Buat owner baru
      const passwordHash = await bcrypt.hash(cfg.ownerPassword, 10);
      const { data: owner, error: ownerError } = await supabase
        .from("owners")
        .insert({
          email: cfg.ownerEmail,
          name: cfg.ownerName,
          password_hash: passwordHash,
          is_active: true,
          email_verified_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (ownerError || !owner) {
        console.error(
          `❌ Gagal membuat owner untuk ${cfg.companyCode}:`,
          ownerError?.message
        );
        continue;
      }
      ownerId = owner.id;
      console.log(`✅ Owner dibuat: ${cfg.ownerEmail}`);
    }

    // 4. Set companies.owner_id
    const { error: updateError } = await supabase
      .from("companies")
      .update({ owner_id: ownerId, status: "active" })
      .eq("id", company.id);

    if (updateError) {
      console.error(
        `❌ Gagal set owner_id untuk ${cfg.companyCode}:`,
        updateError.message
      );
      continue;
    }

    console.log(
      `✅ Company ${cfg.companyCode} (${company.name}) → owner ${cfg.ownerEmail}`
    );
  }

  console.log("\n🎉 Backfill selesai!");
  console.log("\n📋 Akun Owner untuk testing:");
  console.log(
    "   ┌─────────────────┬──────────────────────┬──────────────────┐"
  );
  console.log(
    "   │ Company          │ Email Owner           │ Password         │"
  );
  console.log(
    "   ├─────────────────┼──────────────────────┼──────────────────┤"
  );
  for (const cfg of OWNER_BACKFILL) {
    console.log(
      `   │ ${cfg.companyCode.padEnd(16)}│ ${cfg.ownerEmail.padEnd(21)}│ ${cfg.ownerPassword.padEnd(17)}│`
    );
  }
  console.log(
    "   └─────────────────┴──────────────────────┴──────────────────┘"
  );
  console.log("\n   Login owner di: /owner/masuk\n");
}

backfill().catch((err) => {
  console.error("❌ Backfill gagal:", err);
  process.exit(1);
});
