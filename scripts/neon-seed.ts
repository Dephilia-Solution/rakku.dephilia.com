import { config } from "dotenv";
import { createAdminClient, closeDatabase } from "@rakku/db";

config({ path: process.env.NEON_ENV_FILE || ".env.local" });
async function main() {
  const db = createAdminClient();
  await db.transaction(async tx => {
    const menus = await tx.from("menus").upsert([
      { slug: "register", name: "Kasir", icon: "ShoppingCart", path: "/register", sort_order: 1 },
      { slug: "orders", name: "Pesanan", icon: "ClipboardList", path: "/orders", sort_order: 2 },
      { slug: "reports", name: "Laporan", icon: "BarChart3", path: "/reports", sort_order: 3 },
      { slug: "products", name: "Produk", icon: "Package", path: "/products", sort_order: 4 },
      { slug: "tax-discounts", name: "Pajak & Diskon", icon: "Percent", path: "/tax-discounts", sort_order: 5 },
      { slug: "ingredients", name: "Bahan Baku", icon: "Boxes", path: "/ingredients", sort_order: 6 },
      { slug: "tables", name: "Meja", icon: "Grid3X3", path: "/tables", sort_order: 7 },
      { slug: "expenses", name: "Pengeluaran", icon: "Wallet", path: "/expenses", sort_order: 8 },
      { slug: "purchases", name: "Pembelian", icon: "ShoppingBag", path: "/purchases", sort_order: 9 },
    ], { onConflict: "slug", ignoreDuplicates: true });
    if (menus.error) throw new Error(menus.error.message);
    const pro = { multi_outlet: true, custom_roles: true, profit_loss: true, email_reports: true,
      inventory_advanced: true, remove_qr_branding: true };
    const plans = await tx.from("plans").upsert([
      { slug: "free", name: "Free", description: "Untuk kedai kecil yang baru mulai", sort_order: 1 },
      { slug: "pro", name: "Pro", description: "Untuk cafe yang sedang berkembang", price_monthly: 99000,
        price_yearly: 990000, max_outlets: 3, max_employees: 15, max_products: 500, max_ingredients: -1,
        max_transactions_month: 5000, report_history_days: 365, email_reports_month: 100, storage_mb: 1024, features: pro, sort_order: 2 },
      { slug: "business", name: "Business", description: "Untuk bisnis multi-cabang", price_monthly: 249000,
        price_yearly: 2490000, max_outlets: -1, max_employees: -1, max_products: -1, max_ingredients: -1,
        max_transactions_month: -1, report_history_days: -1, email_reports_month: -1, storage_mb: 5120,
        features: { ...pro, audit_log: true, priority_support: true }, sort_order: 3 },
    ], { onConflict: "slug", ignoreDuplicates: true });
    if (plans.error) throw new Error(plans.error.message);
  });
  console.log("Default menus/plans ready. Existing values were preserved.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(closeDatabase);
