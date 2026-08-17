# PROMPT — Implementasi Rakku v5.0 (Inventory & Operasional Kedai/Cafe)

> Tempel prompt ini ke AI coding agent (Claude Code atau sejenis) yang punya akses ke repo Rakku. Jalankan **satu milestone per sesi**, jangan loncat.

## 0. Konteks Wajib Dibaca Duluan

Sebelum menulis kode apapun:

1. Baca `DOCS.md` di root repo — pahami arsitektur monorepo (`apps/owner`, `apps/pos`, `apps/superadmin`, `packages/*`), pola auth 4-step tenant login, cookie session, dan konvensi RBAC (`role_menu_access`).
2. Baca `PRD_V5_CAFE.md` (dokumen requirement lengkap untuk pekerjaan ini) — semua skema tabel, endpoint, dan spesifikasi fitur ada di sana. Jangan improvisasi di luar itu tanpa konfirmasi dulu.
3. Lihat pola kode yang **sudah ada** sebagai referensi sebelum bikin yang baru:
   - Pola CRUD + SlideOver: `apps/pos/src/components/charges/TaxFormSlideOver.tsx` dan `apps/owner/src/app/(dashboard)/tax-discounts/`
   - Pola tab dengan badge count: `apps/owner/src/app/(dashboard)/employees/page.tsx`
   - Pola badge di nav (polling): `apps/pos/src/hooks/useDraftCount.ts`
   - Pola query scoped company+outlet: `apps/pos/src/lib/supabase/queries.server.ts`
   - Pola form mobile bottom-action-bar: `ProductForm.tsx` + `useNavMode()`

## 1. Aturan Non-negotiable

- **Jangan ubah file migration lama** (001–015). Migration baru mulai dari `016_ingredients_and_recipes.sql`, urut sesuai Bagian 8 `PRD_V5_CAFE.md`.
- Semua tabel baru **wajib** punya `company_id` + `outlet_id` untuk app-level scoping. RLS tetap mati — jangan aktifkan, ikuti konvensi existing.
- Interface TypeScript baru masuk ke `packages/shared-types/src/common.ts` (atau file baru `inventory.ts` di package yang sama) — jangan definisikan interface lokal di dalam app kalau dipakai lintas app.
- Reuse komponen `@rakku/ui` (`Badge`, `Toast`, `SlideOver`, `Tabs`, `PageHeader`, `FormField`, `Toggle`, `EmptyState`, `QtyControl`) — jangan bikin versi baru kecuali komponen itu benar-benar tidak cukup, dan kalau iya, tambahkan ke `@rakku/ui`, bukan lokal per app.
- Delete selalu lewat `ConfirmDialog`, tidak ada delete langsung tanpa konfirmasi.
- Fitur yang murni operasional harian (pembelian, opname) **cukup dibangun di `apps/pos`** — Owner cukup dapat visibility read-only lewat `/reports`, jangan duplikasi CRUD penuh di `apps/owner` kecuali diminta.
- Field `cost_per_unit` dan turunannya (HPP, laba) **tidak boleh dikirim ke response API untuk role Kasir** kecuali role itu diberi akses eksplisit — filter di server, bukan cuma disembunyikan di UI.
- Menu baru wajib didaftarkan ke tabel `menus`, TIDAK usah di-seed otomatis ke `role_menu_access` — biarkan Owner atur sendiri lewat panel "Kelola Role" (konsisten dengan keputusan v3.0 yang sudah ada, lihat `DOCS.md` §14.10).
- Setelah tiap milestone selesai dan lolos test manual, **update `DOCS.md`** — tambahkan section baru (misal "17. V5.0 — Inventory & Operasional Kedai/Cafe"), jangan hapus histori versi sebelumnya. Ikuti gaya penulisan section 14/15 yang sudah ada.
- Stok **boleh minus** — jangan blokir checkout hanya karena stok kurang. Tampilkan warning non-blocking saja.

## 2. Urutan Eksekusi — Milestone

### Milestone 1 — Ingredients + Recipe (CRUD dasar, belum ada potong stok)

Tugas:
- [x] Migration `017_ingredients_and_recipes.sql` (lihat SQL lengkap di PRD §8)
- [x] `@rakku/shared-types`: interface `Ingredient`, `ProductRecipe`
- [x] `apps/pos/api/admin/ingredients` (GET/POST/PATCH/DELETE) + `apps/pos/api/admin/recipes` (GET/POST/DELETE)
- [x] Halaman `apps/pos/(dashboard)/ingredients` (list + search, pola sama seperti `/products`) + `add`/`[id]/edit`
- [x] Komponen `RecipeManagerSlideOver` dipasang di `ProductForm.tsx` (tambah/edit resep saat kelola produk)
- [x] Tambahkan menu baru "Bahan Baku" ke tabel `menus` (slug: `ingredients`)

**Definition of done:** Owner/Admin bisa bikin ingredient baru, hubungkan ke resep produk, angka `cost_per_unit` tersimpan tapi belum berpengaruh ke mana-mana (itu Milestone 4).

### Milestone 2 — Potong Stok Otomatis

Tugas:
- [x] Migration `018_stock_movements.sql`
- [x] Modifikasi `POST /api/admin/orders` (dan flow restore-draft-lalu-bayar): setelah order berhasil `completed`, loop `order_items` → cari `product_recipes` → kurangi `ingredients.stock_quantity` → insert `stock_movements` (type=`sale_deduction`)
- [x] Pastikan ini terjadi dalam **transaksi yang sama** dengan insert order (atau best-effort dengan retry/log kalau setup DB tidak mendukung transaksi lintas tabel — dokumentasikan pilihannya)
- [ ] Tampilkan badge/indikator "stok akan berkurang" di `ItemDetailModal` register (opsional, nice-to-have)

**Definition of done:** Jual 1 Kopi Susu → stok kopi & susu di tabel `ingredients` berkurang sesuai resep, ada baris baru di `stock_movements`.

### Milestone 3 — Pengeluaran Operasional

Tugas:
- [x] Migration `020_expenses.sql`
- [x] `apps/pos/api/admin/expenses` CRUD
- [x] Halaman `/expenses`

**Definition of done:** Kasir/Owner bisa catat pengeluaran (kategori, nominal, deskripsi, tanggal) dan melihat riwayatnya.

### Milestone 4 — Laporan Laba Rugi

Tugas:
- [x] `GET /api/owner/reports/profit-loss` — hitung HPP dari join `order_items` × `product_recipes` × `ingredients.cost_per_unit`, dikurangi `expenses` periode terkait
- [x] Tab baru "Laba Rugi" di `apps/owner/(dashboard)/reports` — **role-gated ke Owner saja**, JANGAN tampilkan di `apps/pos/reports` (Kasir)
- [x] Kartu: Total Omzet, Total HPP, Laba Kotor, Total Pengeluaran, Laba Bersih

**Definition of done:** Owner login → `/reports` → tab "Laba Rugi" → angka laba bersih muncul dan masuk akal (omzet − HPP − pengeluaran).

### Milestone 5 — Stock Opname, Pembelian, Alert Stok Menipis

Tugas:
- [x] `POST /api/admin/ingredients/[id]/adjust` (opname manual)
- [x] Migration `018_ingredient_purchases.sql` + endpoint `/api/admin/purchases`
- [x] Halaman `/purchases`, `/purchases/add`
- [x] Hook `useLowStockCount()` (pola sama `useDraftCount`) — badge di menu "Bahan Baku" kalau ada ingredient di bawah `min_stock_alert`

**Definition of done:** Input pembelian bahan → stok & `cost_per_unit` ter-update (last cost). Opname manual tercatat di `stock_movements` type `adjustment`.

### Milestone 6 - Menu QR + Manajemen Meja

Tugas:
- [x] Migration `021_qr_menu_and_tables.sql` (kolom `qr_menu_slug`, `orders.source`, `orders.table_id`, tabel `dining_tables`)
- [x] Endpoint `/api/admin/tables` CRUD + toggle status + generate otomatis (`POST /api/admin/tables/generate`)
- [x] Halaman `/tables` + pilih meja saat checkout (`orders.table_id` tersimpan, status meja jadi `occupied`)
- [x] Halaman publik `apps/pos/(public)/menu/[slug]/page.tsx` - **tanpa auth**, hanya baca produk aktif + kategori, mobile-first, tanpa harga sensitif/cost
- [x] Endpoint publik `GET /api/public/menu/[slug]`
- [x] Generate & tampilkan QR code di `/settings` (Owner) yang link ke `/menu/[slug]`

**Definition of done:** Scan QR dari HP - buka menu tanpa login - lihat produk & harga per kategori, responsive. Meja bisa dibuat massal (Generate), kasir bisa pilih meja saat checkout.

> **Scope v5.0 selesai di Milestone 6.** Item nice-to-have lama (tiket dapur, QR self-order, QRIS otomatis, waste) tidak masuk scope dan tidak dikerjakan.

## 3. Setelah Tiap Milestone

- Jalankan `pnpm lint` & `pnpm build` sebelum lapor selesai
- Test manual pakai akun testing existing (`RAKKU`/`rakku123`, PIN `123456`)
- Update `DOCS.md` dengan section baru
- Laporkan ringkas: apa yang selesai, asumsi apa yang diambil kalau ada keputusan yang PRD tidak cover eksplisit
