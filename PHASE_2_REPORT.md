# Fase 2 — RBAC CRUD dan isolasi akses

17 Oktober 2026 · perubahan lokal pada branch `codex/production-hardening`.

**Implementasi source fase 2 selesai secara lokal; acceptance staging belum dijalankan.** Tidak ada migration pada database aktif, provisioning, email, provider, rotasi secret atau deployment. Prasyarat isolasi environment fase 1 masih terbuka dan tetap menjadi blocker peluncuran.

## Ringkasan perubahan

| Bagian | Sebelum fase 2 | Sesudah fase 2 |
|---|---|---|
| POS authorization | Hanya `can_view`; method tulis tidak dibedakan | Registry method + path eksplisit V/C/E/D; unknown endpoint ditolak |
| Grant storage | Empat kolom ada, nullable, UI hanya mengubah `can_view` | Migration 0009 snapshot semua flag, normalisasi NULL, `NOT NULL`, revision + audit |
| Legacy grant | Tampilan hanya menu | Snapshot read-only, impact report, tanpa backfill otomatis |
| Owner role editor | Satu checkbox menu | Matriks V/C/E/D, simpan atomik per role, revision conflict |
| Superadmin matrix | Satu checkbox `can_view` | Matriks V/C/E/D, scoped per company, kontrak yang sama |
| Perubahan grant | Tidak memengaruhi sesi | Trigger mencabut sesi POS pengguna role dalam transaksi yang sama |
| Demo | Menu-level saja | Fixture/editor/projection memakai grant V/C/E/D dan revision |

## Data, migration dan recovery

- `packages/db/migrations/0009_role_grants.sql` bersifat additive dan mengandalkan transaksi migration runner (tanpa `BEGIN`/`COMMIT` sendiri). Penerapan manual harus dibungkus transaksi.
- `app_private.role_grants_0009_snapshot` menyimpan setiap baris lama, termasuk NULL, V=false dan mutation flag tanpa V. Tabel ini tanpa FK cascade dan RLS platform-only.
- `role_menu_access` dinormalisasi menjadi boolean ketat: NULL menjadi false; default baru adalah false. Normalisasi tidak memberi CRUD baru dan tidak mencabut sesi.
- `roles.grants_revision` adalah counter opaque. Trigger `invalidate_role_grants` menaikkan revision dan mencabut sesi POS role terkait pada INSERT/UPDATE/DELETE grant, termasuk raw SQL. Identical save/rename tidak mencabut.
- `app_private.role_grants_audit` menyimpan before/after, revision, actor dan timestamp untuk setiap save API yang mengubah grant.
- `packages/db/src/roles-access.ts` menyediakan `getRoleGrants`, `saveRoleGrants`, `deleteRole` dan default onboarding eksplisit. Full replacement memakai lock role, validasi menu/duplikat/boolean, requirement V untuk C/E/D, expected revision, audit dan rollback atomik.
- Onboarding baru memakai ID role yang baru dibuat: Owner mendapat CRUD penuh untuk 11 slug yang didukung; Kasir mendapat register penuh, orders V/E/D tanpa create, serta reports dan tax-discounts view-only. Tidak ada backfill berdasarkan nama role lama.

### Dampak legacy read-only

`config/rbac/impact-read-only.sql` hanya membaca: aggregate flag, pemakaian per menu, dan review queue per company/role ID tanpa nama/PII/nilai baris. `config/rbac/README.md` memuat kebijakan, urutan rollout, privilege, verifikasi snapshot dan rollback per role. Reviewer harus menentukan grant baru secara eksplisit; tidak ada konversi otomatis `can_view` menjadi C/E/D.

## Enforcement POS

Registry berada di `packages/auth-utils/src/access-policy.ts`; evaluator server berada di `apps/pos/src/lib/auth/authorize.ts`. `apps/pos/src/lib/db.ts` memanggil policy sebelum tenant client dipakai, sehingga pengecekan terjadi sebelum query tenant pertama dan sebelum upload/email/provider. Proxy tetap menimpa metadata path/method dari client.

| Endpoint group | Method → capability |
|---|---|
| Products, categories, modifiers, pricing options/tiers | GET view via `products ∨ register`; POST create; PATCH/PUT edit; DELETE delete; upload/image/tier-price replacement edit |
| Recipes | GET view via `products ∨ ingredients`; POST create via either; DELETE delete via either |
| Ingredients | GET/POST/PATCH/DELETE ingredients V/C/E/D; `/adjust` edit |
| Purchases / expenses | purchases V/C; expenses V/C/E/D |
| Taxes / discounts | V/C/E/D via `tax-discounts` atau alias `taxes`/`discounts`; `/active` read juga boleh `register` |
| Tables | GET `tables ∨ register` view; POST/generate `tables` create; PATCH `tables` atau `register` edit, rename wajib `tables` edit; DELETE `tables` delete |
| Orders | POST `register` create; draft GET `register ∨ orders` view, POST create, PATCH `register ∨ orders` edit + completion `register` create, DELETE `register ∨ orders` delete; split create (route tetap 409); QRIS create `register` create + draft conversion edit, status GET/retry edit, cancel delete |
| Subscription | GET authenticated bootstrap, tanpa grant menu |
| Report email | POST wajib `reports` view **dan** create |
| Auth dan public menu | Di luar registry; tidak dapat diakses sebagai endpoint admin |

`HEAD` mengikuti `GET`. Unknown path/method, grant mutation tanpa V, grant lookup error dan endpoint yang tidak dipetakan ditolak secara default. Body-dependent checks menutup draft completion, QRIS draft conversion dan rename meja. Handler lama yang tidak menangkap error dapat menampilkan 500, tetapi mutasi tetap tidak berjalan sebelum denial; handler dengan propagasi status mengembalikan 403. Jika metadata route API hilang pada request `/api/admin` atau `/api/reports`, tenant client menolak alih-alih fail-open.

Dashboard POS juga memeriksa segmen path pertama terhadap menu `can_view` sebelum merender page. Ini menutup akses langsung ke halaman seperti `/ingredients` atau `/reports` ketika menu tidak dimiliki, sehingga SSR tidak lagi hanya mengandalkan sidebar. Page edit tetap dapat dirender untuk view-only, tetapi seluruh mutasi API ditolak oleh capability.

## UI dan kontrak

Owner:

- `GET /api/owner/roles` → `{ roles: [{ id, name, menu_access, grants, revision }], menus }`.
- `GET /api/owner/roles/:id/access` → `{ menu_access, grants, revision }`.
- `POST /api/owner/roles/:id/access` hanya menerima `{ grants, expectedRevision }`; payload toggle lama ditolak 400.
- Editor menyimpan satu role sekaligus, satu request in-flight, menahan draf saat gagal, menampilkan konflik 409 dan flag legacy tanpa V. Tidak ada optimistic request per checkbox.
- Rename/delete role memakai helper transaksional; role yang masih dipakai tidak dapat dihapus.

Superadmin:

- Matrix GET membatasi role dan grant ke `company_id` yang dipilih; kompatibilitas `access` juga scoped.
- POST memakai `{ company_id, role_id, grants, expectedRevision }`; actor berasal dari session server, bukan body.
- Managed Auth, origin guard dan membership aktif tetap menjadi boundary sebelum platform client diberikan.

Demo:

- `DemoRole` menyimpan `grants`; fixture Manager/Kasir memakai grant eksplisit dan revision.
- Role list/access endpoint demo memakai kontrak `{ grants, revision }` yang sama; stale revision 409 dan mutation tanpa V 400.
- Demo POS masih mensimulasikan visibilitas menu, bukan seluruh enforcement produksi. Demo bukan bukti acceptance merchant.

## Verifikasi aktual

| Pemeriksaan | Hasil |
|---|---|
| `pnpm --filter @rakku/db test` | 38 lulus; migration 0001–0009 pada PGlite memory |
| `pnpm test:auth` | 14 lulus; 11 test policy + 3 test token |
| `pnpm test:demo` | 74 domain + 3 network-policy lulus |
| `pnpm typecheck` | 18/18 task lulus |
| Lint Owner/POS/Superadmin | 0 error; warning migrasi React Compiler tetap terlihat |
| `pnpm build:isolated owner pos superadmin` | Lulus pada `RAKKU_BUILD_DIRECTORY=.next-hardening-phase2`; Serwist POS terbundle |
| `pnpm test:auth:http` | 20 assertion lulus pada build terisolasi; DB/provider diblokir |
| `pnpm test:env` / `pnpm test:dependencies` | Tidak diubah fase ini; hasil fase 1 tetap berlaku |
| Two-connection PostgreSQL, browser role editor, POS denial dengan sesi nyata, staging session revocation | **Belum dijalankan** |

Cakupan policy mencakup seluruh route/method merchant yang diinventarisasi (29 route file, 67 method eksplisit). Test memeriksa view-only, creator, editor, deleter, operator/kasir, tanpa grant, alias pajak/diskon, resep, laporan, QRIS, unknown path/method, HEAD, cross-company role, stale revision, audit failure rollback, raw DML, role deletion dan RLS tabel privat. Guard page dashboard belum memiliki browser test tersendiri; verifikasi source/typecheck dilakukan. PGlite satu koneksi tidak membuktikan concurrency dua koneksi PostgreSQL.

## Rollout dan rollback

1. Selesaikan isolasi environment dan backup/restore point staging yang telah diuji. Jalankan `config/rbac/impact-read-only.sql` pada target terisolasi dan review per company/role ID.
2. Terapkan 0005 sebelum 0009 melalui role migrator. Pause edit grant selama boundary migration/release. Pastikan runtime memiliki privilege audit/snapshot dan invoker trigger yang tercantum di `config/rbac/README.md`.
3. Deploy serentak API, editor Owner/Superadmin, POS dan demo. Client lama yang hanya mengirim `menuId/canView` akan mendapat 400; jangan menambahkan fallback yang menghapus flag.
4. Uji login/PIN, view-only, operator, perubahan grant, refresh, switch-user, revoked/inactive session, cross-company/outlet dan rollback audit pada staging dengan akun sintetis.
5. Rollback aplikasi saja tidak aman: enforcer lama berbasis `can_view` akan membuka kembali mutasi. Jika diperlukan rollback, pertahankan enforcement baru atau hentikan operasi tulis terkait; jangan drop snapshot/audit/revision, dan jangan menghidupkan kembali sesi yang sudah dicabut.

## Blocker yang tersisa

- Resource environment fase 1 masih dibagi; `env:check` masih menolak konfigurasi aktif.
- Belum ada acceptance staging untuk Managed Auth/Superadmin dan sesi POS nyata setelah perubahan grant.
- Belum ada uji dua koneksi PostgreSQL untuk save grant bersamaan, raw DML vs API, menu/role deletion race dan PIN login race. Ini tetap wajib.
- Beberapa handler POS lama belum memetakan `AccessDeniedError` menjadi 403; denial tetap fail-closed tetapi status dapat berupa 500. Rapikan saat menyentuh route tersebut.
- `GET /api/admin/orders/qris/[id]` masih melakukan sinkronisasi/finalisasi provider. Fase 2 meminta capability edit, tetapi GET yang memutasi tetap menjadi risiko CSRF/semantik; pindahkan ke command/worker pada fase pembayaran.
- Demo POS belum menegakkan seluruh capability; ia hanya menampilkan kontrak UI/role.

## Kelanjutan

Prompt fase 3 ada di `NEXT_PHASE_PROMPTS.md`. Langkah berikutnya adalah **lifecycle pembayaran subscription**. Blocker staging fase 1–2 tidak boleh dianggap selesai ketika fase 3 dimulai.
