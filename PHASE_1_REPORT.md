# Fase 1 — Dependency dan pemeriksaan isolasi environment

17 Oktober 2026 · perubahan lokal pada branch codex/production-hardening.

**Implementasi source fase 1 selesai; isolasi resource aktif belum selesai.** Tidak ada migration, provisioning/rotasi credential, seed, email nyata, transaksi provider atau deployment aktif yang dijalankan. Resource yang dibagi masih menjadi blocker peluncuran.

## Perubahan aktual

| Bagian | Sebelum fase 1 | Sesudah fase 1 |
|---|---|---|
| Next.js Owner/POS/Landing | 14.2.35 | 16.4.2 |
| Next.js Superadmin | 16.4.0 | 16.4.2 |
| React / React DOM semua app dan shared UI/demo | 18.x | 19.3.1, types 19.3.0 |
| Drizzle | 0.45.1 | 0.45.4 |
| sharp | 0.35.3 | 0.35.5 |
| Neon Auth SDK | 0.5.0-beta | 0.6.0-beta; Managed Auth aktif tidak diubah |
| Lint | next lint / ESLint 8 dan config Next 14 | ESLint 9.39.5 + flat config Next 16.4.2 |
| Environment audit | Mewajibkan URL/secret lokal sama dengan sumber bersama | Menolak resource lintas target yang sama, mismatch profil, role/TLS yang salah dan secret terekspos |

Request props params/searchParams yang masih sinkron telah dimigrasikan: server memakai await, client demo memakai React.use sebelum lookup. Owner/POS memakai proxy.ts dengan origin/token-purpose/header guards yang dipertahankan; pemeriksaan registry/ownership tetap di server. Scripts dev/build memakai Webpack eksplisit agar konfigurasi Serwist dan transform POS tetap berlaku. Landing sekarang memiliki typecheck dan direktori build terisolasi.

React 19 type namespace diperbaiki. Fungsi fetch admin yang dipanggil sebelum deklarasi menjadi function declaration; alokasi split memakai accumulator immutable dengan urutan pembulatan tetap; banner quota mempunyai clock state. Offline retry tetap full document reload untuk mencoba koneksi kembali. Ini perubahan kompatibilitas, bukan implementasi RBAC/subscription fase berikutnya.

Lockfile diperbarui beserta dependency turunan. Override postcss-selector-parser ke 7.1.6 menutup advisory parser. API-key plugin dipin 1.7.6 mengikuti Better Auth yang dipin Neon SDK; better-call pada parent UI diselaraskan ke 1.4.0 agar peer plugin/core cocok. Dependency 2.0.2 parent UI tidak ditemukan dipakai dalam runtime bundle paket tersebut saat pemeriksaan; seluruh peer sekarang cocok. Login Managed Auth nyata tetap membutuhkan acceptance staging.

## Hasil audit dependency

Audit mentah sebelum perubahan pada fase ini: **58 temuan** — 2 critical, 36 high, 18 moderate, 2 low. Angka ini berasal dari pengambilan terbaru, sehingga berbeda dari snapshot audit awal.

Audit mentah sesudah perubahan: **1 high, 0 critical/moderate/low**, yaitu GHSA-vfj7-8cjw-p6xm pada braces 3.0.3. Registry dan advisory resmi belum menyediakan fixed release. Advisory tidak di-ignore dan versi paket tidak dipalsukan.

Mitigasi source tersedia melalui pnpm patchedDependencies dan patches/braces@3.0.3.patch:

- Parser menolak nesting terlalu dalam sebelum recursive stringify/walk.
- Compile/expand/stringify memvalidasi AST secara iteratif, membatasi kedalaman/node count serta menolak siklus sebelum rekursi.
- Tiga regression tests membuktikan penolakan pola 5.000 tingkat balanced/unbalanced, parentheses, AST buatan/cyclic, serta menjaga normal glob expansion/compile/stringify.

Patch ini menutup jalur stack exhaustion yang diuji; audit berbasis versi tetap high. Jangan menyebut hasilnya audit nol temuan. Periksa rilis upstream dan ganti/hapus patch hanya setelah advisory tertutup serta regression/build lulus. Source aplikasi tidak ditemukan memanggil braces/micromatch/glob terhadap input request; paket masuk melalui tooling/glob dependency. Ini mempersempit exposure yang ditemukan, bukan bukti tidak ada jalur lain.

ESLint 9 dan sejumlah React Email subpackages masih diberi label deprecated oleh registry. Rules baru react-hooks/set-state-in-effect dan react-hooks/refs ditampilkan sebagai warning selama migrasi; React Compiler tidak diaktifkan. Rules Hooks/Next/TypeScript lain tetap error. Refactor warning/tooling lifecycle tetap tercatat untuk fase 8.

## Environment checker dan kondisi saat ini

Source baru: scripts/lib/environment-policy.ts dan scripts/neon-env-check.ts, dengan tiga template audit tanpa credential pada config/environments. Petunjuk resource, file precedence, secret distribution dan batas bukti ada di config/environments/README.md.

Checker read-only memeriksa:

- DB identity yang sama meskipun memakai pooler/direct atau role berbeda; endpoint Auth, secret auth/cron, provider key/account dan public app URL yang sama lintas development/staging/production.
- Secret auth yang dipakai ulang antar-purpose, role runtime/migrator, endpoint migrator direct, verified TLS, HTTPS remote, target label dan obsolete/public-secret variables.
- Konsistensi konfigurasi file aplikasi terhadap profil target serta larangan migration credentials dalam runtime app.
- Secret yang masuk file tracked dan file credential yang tidak di-ignore. Error hanya berisi kode/label/nama variabel; tidak mencetak nilai URL/secret/fingerprint.

Hasil konfigurasi lokal: **ditolak, 8 snapshots / 61 diagnostics**. Ini bukan 61 vulnerability unik: banyak diagnostic adalah pasangan penggunaan resource yang sama di beberapa file/app. Kelompok utamanya adalah tiga profil isolasi belum tersedia, target environment belum dideklarasikan, resource DB/Auth/secret/provider key dibagi antara konfigurasi development dan production, serta secret lintas purpose.

Tidak ada file credential aktif yang diubah untuk membuat checker terlihat lulus. Provision resource, pemisahan Auth/provider, rotasi secret aktif, privilege DB, allowed origins, callback dan verifikasi konfigurasi platform masih harus dilakukan melalui rollout tersendiri. Metadata account/mode dan perbandingan URL/key tidak dapat membuktikan kontrak atau kepemilikan akun provider. Checker lokal tidak membaca secret store deployment; variabel proses platform dapat mengalahkan file lokal.

## Verifikasi fase 1

| Pemeriksaan | Hasil |
|---|---|
| test:env | 12 lulus, fixture sintetis |
| test:dependencies | 3 lulus, paket braces yang terpasang dari graph tooling aktual |
| test:auth | 3 lulus |
| test:db | 26 lulus, seluruh migration pada PGlite memory |
| test:demo | 74 domain + 3 network-policy lulus |
| Lint seluruh 5 task workspace | Lulus; 0 error, 49 warning migrasi (Owner29/POS15/Admin5) |
| Typecheck scripts | Lulus |
| Typecheck seluruh 18 task workspace | Lulus seluruhnya |
| Build Owner/POS/Superadmin/Landing | Lulus pada Next 16.4.2; Serwist berhasil dibundle |
| test:auth:http | 20 assertion lulus, termasuk entry demo; transport DB/Auth/provider diblokir |
| Demo routed browser acceptance | 5/5 suite lulus pada loopback 127.0.0.1 port3550/3551 |
| env:check | Gagal sebagaimana mestinya untuk konfigurasi yang masih dibagi |
| pnpm peers check | Tidak ada peer dependency issue |
| Managed Auth/merchant positive flow, provider sandbox, PostgreSQL concurrency, restore drill | Belum dijalankan |

Build memakai RAKKU_BUILD_DIRECTORY=.next-hardening-phase1. Output bukan artefak deployment; DB/Auth/provider diarahkan ke loopback port tertutup. Tidak ada build normal/dev yang dihapus atau dihentikan.

Percobaan browser pertama gagal pada readiness localhost:3000/demo; pemeriksaan HTTP terisolasi kemudian membuktikan route demo merespons 200. Pengulangan browser dengan alamat numerik dan port terpisah lulus 5/5; penyebab binding/resolusi localhost belum dipastikan. Artefak acceptance ada di C:/Users/alifd/AppData/Local/Temp/opencode/rakku-routed-demo-0bjBpx. Server yang dibuat runner sudah ditutup; proses server milik pekerjaan lain tidak dihentikan.

## Kompatibilitas dan rollout

Next16 memerlukan request APIs async, Node >=20.9 dan baseline browser modern: Chrome/Edge/Firefox 111+, Safari 16.4+. Pengujian lokal memakai Node 24.11.1 dan Chromium Playwright. Transform ES2017 serta browserslist lama pada POS tidak membuktikan kompatibilitas Android/WebView lama; acceptance perangkat/printer tetap wajib pada fase 9.

Sebelum rilis, selesaikan isolasi environment dan acceptance merchant/Managed Auth/provider di staging. Build ulang memakai konfigurasi target yang telah diverifikasi. Jangan deploy hasil build terisolasi. Foundation migration 0005–0008 tetap harus diterapkan melalui urutan staging/rollout yang ditinjau; fase 1 tidak menambah migration DB.

Rollback dependency/source/lockfile harus berpasangan. Jangan memulihkan framework rentan untuk dijadikan rilis publik. Jika ditemukan regresi, hentikan rollout dan forward-fix pada versi didukung; jangan drop registry, intent, receipt, cost snapshot atau ledger. Perubahan fase 1 belum di-commit terpisah karena workspace berisi foundation serta pekerjaan paralel; pisahkan patch/commit setelah meninjau diff, tanpa membuang perubahan pihak lain.

## Kelanjutan

Prompt siap pakai fase 2–9 ada di NEXT_PHASE_PROMPTS.md. Langkah implementasi lokal berikutnya adalah **fase 2: RBAC CRUD**. Prasyarat staging dari fase 1 tetap terbuka dan tidak boleh dianggap selesai saat fase berikutnya dimulai.

Referensi primer: [Upgrade Next16](https://nextjs.org/docs/app/guides/upgrading/version-16), [support policy](https://nextjs.org/support-policy), [ESLint Next](https://nextjs.org/docs/app/api-reference/config/eslint), [Drizzle advisory](https://github.com/advisories/GHSA-gpj5-g38j-94v9), [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Versi/fixed release dan hasil audit diperiksa ulang terhadap metadata registry saat fase ini.
