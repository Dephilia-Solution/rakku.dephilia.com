# PRD v5.0 — Rakku POS: Modul Inventory & Operasional untuk Kedai Kecil & Cafe

**Status:** Draft siap implementasi
**Melengkapi:** `PRD.md` & `DOCS.md` (kondisi v4.0 — monorepo 3-app: owner, pos, superadmin)
**Scope:** Kedai kecil & cafe (bukan resto skala penuh — lihat Bagian 4 untuk batasan eksplisit)
**Tanggal:** 15 Agustus 2026

---

## 1. Ringkasan Eksekutif

Rakku v4.0 sudah punya mesin POS transaksional yang matang: multi-tenant, RBAC dinamis, tier pricing, pajak & diskon, split bill, draft order, PWA, dan laporan omzet. Tapi meski nama produknya "POS/inventory", **belum ada satupun modul inventory di v4.0** — tidak ada tabel bahan baku, resep, stok, atau HPP. `products` di skema saat ini murni barang jadi untuk dijual, bukan hasil racikan dari bahan yang perlu dilacak stoknya.

v5.0 menutup gap itu, dengan scope yang sengaja dipersempit ke kebutuhan **kedai kecil & cafe** — bukan resto skala penuh. Artinya: stok bahan baku sederhana + resep, pengeluaran operasional, pelanggan & loyalty ringan, menu digital QR — tanpa reservasi meja, KDS multi-station, atau logistik delivery.

## 2. Metodologi: Bagaimana PRD Ini Diturunkan dari DOCS.md

DOCS.md adalah dokumentasi *as-built* (bagaimana sistem dibangun), bukan PRD (kenapa & apa yang harus dibangun). Untuk menyusun PRD ini, langkah yang dipakai:

1. **Baseline fitur existing** — Bagian 1 & 8 DOCS.md (fitur utama + rute per app) dianggap sebagai requirement yang sudah terpenuhi.
2. **Ekstraksi persona dari struktur RBAC & pemisahan app** — 3 app (owner/pos/superadmin) + role dinamis (Owner, Kepala Cabang, Admin, Kasir) langsung memetakan ke persona pengguna nyata.
3. **Ekstraksi user journey dari Bagian 16 (Alur Lengkap End-to-End)** — jadi dasar user story yang sudah tervalidasi karena sudah berjalan di produksi.
4. **Baca histori versi** (v1 → v2.1 → v3 owner self-service → v4 monorepo) — pola ini menunjukkan produk memang dikembangkan bertahap per milestone, jadi v5.0 melanjutkan pola yang sama.
5. **Cross-check nama produk vs skema database** — di sinilah gap terbesar ditemukan: "POS/**inventory**" tapi Bagian 7.2 DOCS.md sama sekali tidak punya tabel stok/bahan baku. Ini jadi requirement inti v5.0.
6. **Terapkan batasan scope yang diminta** ("kedai kecil & cafe, bukan resto") untuk menyaring fitur mana yang masuk vs sengaja dikeluarkan (Bagian 4).

## 3. Gap Analysis

| Kebutuhan operasional kedai/cafe | Ada di v4.0? | Catatan |
|---|---|---|
| Kontrol stok bahan baku (kopi, susu, gula, cup, dll) | ❌ | `products` = barang jadi, tanpa resep/bahan |
| HPP (harga pokok penjualan) otomatis per produk | ❌ | `products.price` cuma harga jual |
| Catat pengeluaran operasional (galon, listrik, plastik) | ❌ | — |
| Menu digital via QR (tanpa install app) | ❌ | — |
| Multi-tenant, RBAC, tier pricing, pajak/diskon, split bill, PWA, laporan omzet | ✅ | Sudah matang, tidak perlu disentuh |

## 4. Batasan Scope

### In-scope (v5.0)
- Inventory bahan baku + resep (BOM) per produk
- Potong stok otomatis saat order selesai
- Stock opname manual & pencatatan pembelian/restock
- Notifikasi stok menipis
- Pencatatan pengeluaran operasional harian
- Laporan laba rugi sederhana (omzet − HPP − pengeluaran)
- Menu digital via QR (view-only di fase pertama)
- Manajemen meja sederhana (status kosong/terisi, bukan denah kompleks)

### Eksplisit di luar scope (karena ini skala resto, bukan kedai/cafe)
- Reservasi & booking meja online
- Kitchen Display System (KDS) real-time multi-station dengan course-firing
- Transfer stok antar outlet / central kitchen
- Payroll & HR penuh (absensi, slip gaji, cuti)
- Integrasi armada delivery/kurir sendiri
- Forecasting demand berbasis AI
- Manajemen supplier kompleks (kontrak, tender, PO approval berjenjang)
- Cetak tiket dapur/bar terpisah dari struk customer
- QR self-order (customer pesan langsung dari HP, bukan cuma lihat menu)
- Integrasi payment gateway QRIS otomatis
- Waste/bahan rusak tracking

## 5. Persona

| Persona | Kebutuhan utama |
|---|---|
| **Owner** (1–3 outlet kedai/cafe) | Lihat laba real (bukan cuma omzet), pantau stok tanpa harus ke lokasi, atur harga resep |
| **Kasir/Barista** | Input stok cepat, catat pengeluaran kecil, kelola meja |
| **Pelanggan** | Lihat menu tanpa install app |

## 6. Daftar Fitur & Prioritas

| # | Fitur | Prioritas | Alasan |
|---|---|---|---|
| F1 | Inventory bahan baku (ingredients) | P0 | Fondasi semua fitur stok |
| F2 | Resep/BOM per produk | P0 | Tanpa ini stok tidak bisa kepotong otomatis |
| F3 | Potong stok otomatis saat order selesai | P0 | Nilai inti "inventory" di nama produk |
| F5 | Pencatatan pengeluaran operasional | P0 | Perlu untuk laba rugi akurat |
| F6 | Laporan laba rugi sederhana | P0 | Owner butuh angka laba, bukan cuma omzet |
| F7 | Stock opname manual | P1 | Koreksi selisih fisik vs sistem |
| F8 | Pencatatan pembelian/restock bahan | P1 | Sumber update stok & cost |
| F9 | Notifikasi stok menipis | P1 | Cegah kehabisan bahan saat jam ramai |
| F11 | Menu digital QR (view-only) | P1 | Trend cafe kekinian, murah diimplementasi |
| F13 | Manajemen meja sederhana | P2 | Hanya relevan cafe dengan tempat duduk |

> Catatan: F12 (tiket dapur), F14 (QR self-order), F15 (QRIS otomatis), F16 (waste tracking) **di luar scope v5.0** — tercantum di Bagian 4.

## 7. Spesifikasi Detail — Fitur P0

### F1+F2 — Inventory Bahan Baku & Resep
**User story:** Sebagai Owner, saya ingin mendaftarkan bahan baku (nama, satuan, stok awal, harga beli per satuan) lalu menghubungkannya ke resep tiap produk, supaya sistem tahu 1 cup Kopi Susu = 18gr kopi + 150ml susu + 1 cup + 1 tutup.

**Acceptance criteria:**
- CRUD ingredient: nama, unit (gram/ml/pcs/kg/liter), stok saat ini, ambang batas stok minimum, cost per unit
- Produk resale langsung (air mineral kemasan, dll) tetap bisa dilacak: dibuatkan 1 ingredient dengan unit `pcs`, resep = 1 ingredient x qty 1 — jangan buat mekanisme kedua yang terpisah, pakai pola resep yang sama supaya konsisten
- 1 produk boleh punya 0 (belum diatur) atau banyak baris resep
- Produk tanpa resep tetap bisa dijual normal, sekadar tidak memotong stok apapun

### F3 — Potong Stok Otomatis
**User story:** Sebagai sistem, saat order berstatus `completed`, saya otomatis mengurangi stok tiap bahan sesuai resep × qty terjual, dan mencatat jejaknya.

**Acceptance criteria:**
- Trigger di endpoint yang sama dengan `POST /api/admin/orders` (create completed order) dan saat draft di-restore lalu dibayar
- Untuk tiap `order_item`, cari `product_recipes` produk terkait → untuk tiap ingredient, `stock_quantity -= quantity_used * item.quantity`
- Insert baris `stock_movements` (type=`sale_deduction`, reference_id=order_id) untuk audit trail — jangan overwrite stok tanpa jejak
- Stok boleh minus (kedai kecil sering nombok dulu baru opname) — jangan blokir transaksi hanya karena stok kurang, cukup tampilkan warning di UI kasir

### F5 — Pengeluaran Operasional
**User story:** Sebagai Kasir/Owner, saya catat pengeluaran kecil harian (galon, listrik, plastik) supaya masuk hitungan laba rugi.

**Acceptance criteria:**
- CRUD expense: kategori (dropdown + custom), nominal, deskripsi, tanggal
- Muncul di laporan laba rugi periode terkait

### F6 — Laporan Laba Rugi Sederhana
**User story:** Sebagai Owner, saya ingin lihat laba bersih (bukan cuma omzet) per periode.

**Acceptance criteria:**
- Formula: `Laba Kotor = Omzet − HPP` (HPP = Σ cost_per_unit × quantity_used dari resep tiap item terjual), `Laba Bersih = Laba Kotor − Total Pengeluaran`
- Tab baru di `/reports` (apps/owner) — **role-gated**, Kasir TIDAK melihat tab ini secara default (data margin sensitif secara komersial)
- Filter periode sama seperti laporan existing (Hari ini/Kemarin/7 Hari/Semua + outlet)

## 8. Perubahan Skema Database (Migration 016+)

```sql
-- 016_ingredients_and_recipes.sql
CREATE TABLE ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id),
  name text NOT NULL,
  unit text NOT NULL, -- gram, ml, pcs, kg, liter
  stock_quantity numeric(12,2) NOT NULL DEFAULT 0,
  min_stock_alert numeric(12,2) NOT NULL DEFAULT 0,
  cost_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  quantity_used numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, ingredient_id)
);

-- 017_stock_movements.sql
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  type text NOT NULL, -- purchase, sale_deduction, adjustment
  quantity_change numeric(12,2) NOT NULL, -- + atau -
  reference_id uuid, -- order_id / purchase_id, nullable
  note text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
 
-- 018_ingredient_purchases.sql
CREATE TABLE ingredient_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id),
  supplier_name text,
  total_amount numeric(14,2) NOT NULL,
  purchase_date timestamptz NOT NULL DEFAULT now(),
  note text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ingredient_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES ingredient_purchases(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  quantity numeric(12,2) NOT NULL,
  unit_cost numeric(12,2) NOT NULL,
  subtotal numeric(14,2) NOT NULL
);

-- 020_expenses.sql
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id),
  category text NOT NULL,
  amount numeric(12,2) NOT NULL,
  description text,
  expense_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 021_qr_menu_and_tables.sql
ALTER TABLE outlets ADD COLUMN qr_menu_slug text UNIQUE;
ALTER TABLE orders ADD COLUMN source text NOT NULL DEFAULT 'pos'; -- pos, qr_self_order
ALTER TABLE orders ADD COLUMN table_id uuid;

CREATE TABLE dining_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  outlet_id uuid NOT NULL REFERENCES outlets(id),
  name text NOT NULL, -- "Meja 1"
  status text NOT NULL DEFAULT 'available', -- available, occupied
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES dining_tables(id);
```

> Semua tabel baru ikut pola existing: `company_id` + `outlet_id` wajib untuk app-level scoping (RLS tetap mati, konsisten dengan keputusan v1–v4).

## 9. Endpoint API Baru

**apps/pos — `/api/admin/`**

| Endpoint | Method | Fungsi |
|---|---|---|
| `/ingredients` | GET/POST/PATCH/DELETE | CRUD bahan baku |
| `/ingredients/[id]/adjust` | POST | Stock opname (set stok baru → hitung selisih → insert stock_movement type=adjustment) |
| `/recipes` | GET/POST/DELETE | CRUD resep per produk (`?product_id=`) |
| `/purchases` | GET/POST | Catat pembelian/restock bahan (auto update stok + cost) |
| `/expenses` | GET/POST/PATCH/DELETE | CRUD pengeluaran |
| `/tables` | GET/POST/PATCH/DELETE | CRUD meja + toggle status |

**apps/pos — public (tanpa auth)**

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/public/menu/[slug]` | GET | Data menu untuk QR (produk aktif + kategori, tanpa data sensitif) |

**apps/owner — `/api/owner/`**

| Endpoint | Method | Fungsi |
|---|---|---|
| `/ingredients` | GET | Read-only lintas outlet (opsional, untuk visibility Owner) |
| `/reports/profit-loss` | GET | Laporan laba rugi (omzet − HPP − pengeluaran) |

## 10. Halaman & Komponen Baru

| App | Rute | Deskripsi |
|---|---|---|
| pos | `/ingredients`, `/ingredients/add`, `/ingredients/[id]/edit` | CRUD bahan baku, badge stok menipis di nav (pola sama `useDraftCount`) |
| pos | `/purchases`, `/purchases/add` | Riwayat & input pembelian bahan |
| pos | `/expenses` | CRUD pengeluaran |
| pos | `/tables` | Kelola meja sederhana |
| pos | `(public)/menu/[slug]` | Halaman menu QR, tanpa layout dashboard, mobile-first |
| pos | Komponen `RecipeManagerSlideOver` di `ProductForm` | Atur resep saat tambah/edit produk (pola sama `TierManagerSlideOver`) |
| owner | `/reports` tab baru "Laba Rugi" | Role-gated, hanya Owner |

## 11. Asumsi & Keputusan Desain (perlu dikonfirmasi ulang saat implementasi)

- **Metode costing:** pakai *last cost* (harga beli terakhir) untuk `cost_per_unit`, bukan weighted average — lebih sederhana untuk kedai kecil, cukup akurat untuk skala ini. Bisa ditingkatkan ke average cost belakangan kalau perlu.
- **QR menu fase 1 = view-only**, belum self-checkout — hindari kompleksitas race condition & pending-order queue. QR self-order, tiket dapur, QRIS otomatis, dan waste tracking **di luar scope v5.0**.
- **Stok boleh minus** — jangan blokir transaksi kasir karena kehabisan stok sistem; cukup warning. Kedai kecil sering jual dulu, opname belakangan.
- **Laporan laba rugi hanya untuk Owner** — Kasir tidak lihat margin/cost demi alasan komersial, konsisten dengan pola akses existing (Owner-only untuk `/settings` company password).
- **Ingredients & resep di-scope per outlet** (tidak ada stock transfer antar outlet) — sesuai batasan "bukan resto/central kitchen" di Bagian 4.

## 12. Roadmap (selesai di M6)

| Milestone | Fitur | Prioritas |
|---|---|---|
| M1 | F1+F2 — Ingredients + Recipe (CRUD, tanpa potong stok dulu) | P0 |
| M2 | F3 — Potong stok otomatis + stock_movements | P0 |
| M3 | F5 — Pengeluaran operasional | P0 |
| M4 | F6 — Laporan laba rugi | P0 |
| M5 | F7+F8+F9 — Opname, pembelian/restock, alert stok menipis | P1 |
| M6 | F11+F13 — Menu QR view-only + manajemen meja | P1/P2 |

## 13. Metrik Keberhasilan

- Stok sistem vs stok fisik selisih < 5% saat opname mingguan (menandakan potong stok otomatis akurat)
- Owner bisa cek laba bersih (bukan cuma omzet) dalam ≤ 2 klik dari dashboard
- Setidaknya 1 kedai/cafe uji coba pakai menu QR tanpa keluhan "ribet"
