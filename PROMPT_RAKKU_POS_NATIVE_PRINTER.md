# PROMPT PENGEMBANGAN — rakku (Rakku POS) v4.1
## Native Android Wrapper (Capacitor) + Koneksi Printer Thermal Bluetooth SPP

> **Dokumen ini adalah brief/prompt lengkap untuk AI coding agent** (OpenCode) yang akan mengeksekusi implementasi. Tempel/beri dokumen ini ke agent sebagai instruksi kerja utama, bersama `DOCS.md` (v4.0 — Bagian 15, Monorepo 3-App) sebagai referensi kondisi eksisting. Dokumen ini adalah lanjutan dari `PROMPT_RAKKU_V4_MONOREPO_SPLIT.md` — mengasumsikan migrasi monorepo sudah selesai (Fase 1-7 sudah ✅).
>
> **Base version:** rakku v4.0 — `apps/pos` adalah PWA murni (Serwist), print masih lewat `window.print()` di komponen `InvoiceReceipt`, tidak ada akses printer thermal Bluetooth sama sekali.
> **Target version:** v4.1 — `apps/pos` tetap PWA (web tidak berubah), tapi ditambah **native Android shell (Capacitor)** yang membungkus WebView yang sama, dengan plugin Bluetooth Serial (SPP) untuk connect & print langsung ke printer thermal — sekaligus memperbaiki force-close di Android 8 karena WebView native Capacitor tidak lagi bergantung pada Chrome/WebView system yang outdated.

---

## 0. CARA MENGGUNAKAN DOKUMEN INI (baca dulu, agent)

1. Baca `DOCS.md` Bagian 13 (PWA) dan Bagian 15 (Monorepo v4.0) dulu — itu kondisi `apps/pos` saat ini.
2. Ini **menambah platform baru** (Android native shell), **bukan** migrasi struktural dan **bukan** rewrite. `apps/pos` yang sudah ada (Next.js App Router, semua route, semua logic bisnis) **tidak berubah sama sekali** — Capacitor hanya membungkusnya.
3. **Prinsip paling penting: satu codebase, dua target.** Kode React/Next.js yang sama harus tetap jalan normal di browser biasa (`pos.rakku.com` via Chrome) DAN di dalam shell native Android. Jangan pernah membuat fork/branch kode terpisah untuk "versi native" — selalu pakai runtime check (`Capacitor.isNativePlatform()`), bukan build-time flag yang bikin dua codebase.
4. Kerjakan **satu fase per sesi/PR**, urut sesuai Bagian 7. Jangan lompat fase. Tiap fase harus menghasilkan sistem yang tetap **bisa dijalankan** di kedua target (web PWA tetap jalan seperti biasa, shell native belum tentu lengkap tapi tidak crash).
5. Fitur print thermal ini **hanya relevan di shell native Android**. Di browser desktop/mobile biasa, perilaku existing (`window.print()`) harus **tetap seperti sekarang, tidak boleh rusak**.
6. Jangan sentuh `apps/owner`, `apps/superadmin`, atau `packages/` kecuali disebutkan eksplisit (lihat Bagian 5.4 soal `packages/ui` untuk komponen status printer yang mungkin reusable).
7. Update `DOCS.md` di akhir tiap fase (tambah bagian baru "Bagian 16 — v4.1 Native Printer (Capacitor)", jangan hapus riwayat lama).

---

## 1. RINGKASAN EKSEKUTIF

`apps/pos` sudah punya implementasi PWA yang solid (Serwist, installable, offline fallback). Tapi PWA murni berjalan di dalam browser engine, dan **browser tidak pernah diizinkan mengakses Bluetooth Classic/SPP** — ini bukan bug, tapi batasan spesifikasi Web Bluetooth API itu sendiri (hanya expose BLE/GATT, bukan SPP). Printer thermal murah yang dipakai sekarang (kelas EPPOS/Xprinter/Goojprt, sama seperti yang dipakai Pawoon) adalah **Bluetooth Classic SPP**, sehingga secara teknis **mustahil** diakses dari PWA browser dalam kondisi apa pun.

Aplikasi lain (Pawoon) bisa connect karena dia native Android app dengan akses langsung ke `android.bluetooth.BluetoothAdapter`. Untuk mencapai hal yang sama tanpa membongkar seluruh aplikasi, jalan yang realistis adalah membungkus `apps/pos` dengan **Capacitor** — shell native Android yang me-render WebView berisi aplikasi Next.js yang sama persis, ditambah **plugin native Bluetooth Serial** yang menjembatani JavaScript ke `BluetoothAdapter` asli.

**Efek samping yang diharapkan:** masalah force-close di Android 8 juga ikut teratasi, karena WebView Capacitor di-bundle sendiri (tidak bergantung pada versi Chrome/WebView system Android yang sering outdated dan tidak ter-update di device lawas).

**Tujuan v4.1:**
1. `apps/pos` bisa di-build jadi APK Android native (via Capacitor) tanpa mengubah kode web yang ada.
2. Halaman baru `/settings/printer` — lihat status koneksi printer, scan/pilih device Bluetooth berpasangan, dan test print.
3. Fungsi print thermal aktual: generate ESC/POS command dari data order/invoice, kirim ke printer via Bluetooth SPP.
4. Fallback aman: di web browser (non-native), semua ini tidak tampil/aktif — perilaku `window.print()` existing tetap jalan.

**Yang TIDAK berubah:** logic bisnis apa pun (cart, pricing, tax/discount, RBAC, 4-step login), skema database, tampilan web browser existing, `apps/owner`, `apps/superadmin`.

---

## 2. KONDISI SAAT INI (ringkasan dari DOCS.md v4.0)

| Aspek | Kondisi sekarang |
|---|---|
| Platform `apps/pos` | PWA murni (Next.js + Serwist service worker), diakses lewat browser/Add to Home Screen |
| Print struk | `window.print()` di komponen `InvoiceReceipt` — buka dialog print browser, tidak ada kontrol langsung ke printer thermal |
| Akses Bluetooth | Tidak ada sama sekali |
| Android 8 | PWA force close (diduga kuat: Web Bluetooth API + WebView/Chrome system outdated yang tidak lagi ter-update vendor) |
| Printer thermal existing | Bluetooth Classic SPP (dikonfirmasi — sama seperti yang dipakai aplikasi Pawoon di device yang sama) |
| Distribusi `apps/pos` | Install dari browser only (tidak ada APK) |

**Kesimpulan:** kebutuhan akses Bluetooth SPP native ini di luar kapabilitas PWA dalam kondisi apa pun (bukan soal versi Chrome atau implementasi kurang lengkap) — perlu native shell.

---

## 3. KEPUTUSAN ARSITEKTUR

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Native shell | **Capacitor** (bukan TWA, bukan React Native rewrite) | TWA tetap render via Chrome system → keterbatasan Web Bluetooth tetap berlaku. React Native rewrite terlalu mahal & berisiko mengubah logic bisnis. Capacitor membungkus WebView + expose native plugin, kode Next.js/React tidak berubah |
| Target Capacitor | Hanya **Android** dulu (iOS di luar scope — printer thermal SPP + iOS punya batasan MFi tersendiri, ditangani terpisah kalau/saat dibutuhkan) | Fokus ke masalah nyata yang dilaporkan |
| Plugin Bluetooth | Plugin community yang aktif maintained, wrap Bluetooth Classic SPP (bukan hanya BLE) — agent WAJIB verifikasi plugin yang dipilih benar-benar support **Classic SPP**, bukan cuma BLE, sebelum instalasi (banyak plugin Capacitor Bluetooth hanya BLE) | Requirement inti: printer existing pakai SPP |
| Loading strategy WebView | Capacitor load dari **live URL** `https://pos.rakku.com` (`server.url` di `capacitor.config.ts`), bukan static export bundled | `apps/pos` pakai Server Actions & API routes dinamis (auth cookie, dsb) — static export akan merusak fitur yang sudah ada. Live URL mode mempertahankan seluruh backend Next.js tanpa perubahan |
| Deteksi platform di kode React | `Capacitor.isNativePlatform()` dari `@capacitor/core`, dicek di runtime, bukan env var build-time | Satu build web tetap bisa dipakai baik lewat browser maupun dibuka di dalam WebView Capacitor |
| Penyimpanan printer default | `localStorage` per-device dulu (bukan Supabase) — device Android biasanya 1:1 dengan 1 printer fisik di meja kasir | Sederhana, tidak perlu migrasi skema. Bisa dipindah ke `outlet_settings` di Supabase kalau nanti butuh sinkron multi-device (dicatat sebagai catatan masa depan, bukan tugas fase ini) |
| Struk test print | Generate dari template statis di kode (bukan order asli) | Tidak butuh data order untuk verifikasi koneksi printer |
| Distribusi APK | Internal (APK signed manual / distribusi langsung ke device kasir) dulu — Play Store publish di luar scope fase ini | Kebutuhan mendesak adalah kasir bisa print, bukan distribusi publik |

---

## 4. STRUKTUR TARGET

```
apps/pos/
├── android/                          # BARU — project Android native, generated oleh Capacitor
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml   # permission BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_CONNECT, BLUETOOTH_SCAN, ACCESS_FINE_LOCATION
│   │   │   └── java/.../MainActivity.java
│   │   └── build.gradle
│   ├── build.gradle
│   └── variables.gradle              # minSdkVersion — pastikan tetap cover Android 8 (API 26)
├── capacitor.config.ts               # BARU — appId, appName, server.url = https://pos.rakku.com
├── src/
│   ├── app/
│   │   └── (dashboard)/
│   │       └── settings/
│   │           └── printer/          # BARU
│   │               ├── page.tsx              # Server component shell (guard sesuai layout dashboard existing)
│   │               └── PrinterSettingsClient.tsx  # Client: state koneksi, scan, list device, test print
│   ├── components/
│   │   └── register/
│   │       └── InvoiceReceipt.tsx    # DIUBAH — tambah cabang native print, window.print() tetap fallback
│   └── lib/
│       └── printer/                  # BARU
│           ├── capacitor-platform.ts # helper isNative() satu tempat, wrap Capacitor.isNativePlatform()
│           ├── bluetooth-bridge.ts   # wrapper di atas plugin Bluetooth Serial: scan, connect, disconnect, write, getStatus
│           ├── escpos-builder.ts     # generate raw ESC/POS command bytes (header, garis, item, total, footer, cut)
│           └── printer-store.ts      # Zustand store kecil: status koneksi, device tersimpan, riwayat log koneksi singkat
├── package.json                      # tambah @capacitor/core, @capacitor/android, @capacitor/cli, plugin bluetooth serial
└── next.config.mjs                   # TIDAK BERUBAH (Serwist config existing tetap ada, web PWA tetap jalan)
```

---

## 5. RENCANA IMPLEMENTASI PER KOMPONEN

### 5.1 Setup Capacitor di `apps/pos`

- Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` sebagai dependency `apps/pos` (bukan `packages/` — Capacitor spesifik untuk app POS, tidak dipakai `owner`/`superadmin`).
- `capacitor.config.ts`:
  - `appId`: gunakan reverse-domain, mis. `com.rakku.pos`
  - `appName`: `Rakku POS`
  - `server.url`: `https://pos.rakku.com` (production) — agent perlu buat catatan cara switch ke `http://10.0.2.2:3001` untuk testing di emulator lokal (Android emulator localhost alias)
  - `server.cleartext`: hanya `true` untuk konfigurasi dev/testing lokal, **false** di config production
- Jalankan `npx cap add android` untuk generate folder `android/`.
- **Verifikasi cookie/session tetap jalan di WebView**: cookie `session`/`pending_login` (JWT, `POS_JWT_SECRET`) yang dipakai auth existing HARUS tetap terkirim normal saat app dibuka dalam WebView Capacitor yang me-load live URL HTTPS. Ini biasanya aman karena WebView modern Android mendukung cookie standar untuk HTTPS origin, tapi WAJIB ditest manual di Fase 2 sebelum lanjut — kalau ada masalah `SameSite`/`Secure` cookie flag, itu perlu diperbaiki di level cookie-setting existing (`tenant-session.ts`), bukan di-workaround di sisi Capacitor.
- `minSdkVersion` di `android/variables.gradle` harus tetap mencakup **API 26 (Android 8.0)** — jangan naikkan minimum tanpa alasan, karena device Android 8 yang bermasalah itu justru target yang mau diperbaiki.

### 5.2 Plugin Bluetooth Serial (SPP)

- Agent riset & pilih plugin Capacitor community yang secara eksplisit support **Bluetooth Classic SPP** (bukan BLE-only). Kriteria pemilihan:
  - Aktif maintained (commit/release dalam ~setahun terakhir)
  - Mendukung Capacitor 6/7 (sesuaikan versi Capacitor yang diinstall)
  - API minimal: `scan()`/`list()` device paired, `connect(address)`, `disconnect()`, `write(bytes)`, `isConnected()`
- Tambahkan permission yang dibutuhkan di `AndroidManifest.xml`: `BLUETOOTH`, `BLUETOOTH_ADMIN` (Android ≤11), `BLUETOOTH_CONNECT` + `BLUETOOTH_SCAN` (Android 12+, API 31+, runtime permission), dan `ACCESS_FINE_LOCATION` (masih disyaratkan sebagian versi Android untuk Bluetooth discovery meski app tidak pakai lokasi sungguhan — sertakan penjelasan ke user kenapa permission ini diminta, hindari kebingungan kasir saat instalasi).
- Runtime permission request (Android 12+) harus di-handle sebelum scan pertama kali dijalankan — tampilkan dialog permintaan izin native, bukan langsung gagal silent.

### 5.3 `lib/printer/capacitor-platform.ts`

```
isNative(): boolean       // wrap Capacitor.isNativePlatform()
getPlatform(): string     // 'android' | 'web' — untuk debugging/diagnostic
```
Satu-satunya tempat kode lain melakukan pengecekan native vs web. Jangan panggil `Capacitor.isNativePlatform()` langsung di banyak file.

### 5.4 `lib/printer/bluetooth-bridge.ts`

Wrapper tipis di atas plugin dari 5.2, dengan API internal yang stabil (supaya kalau ganti plugin di masa depan, hanya file ini yang berubah):

```
listPairedDevices(): Promise<PrinterDevice[]>   // { name, address }
connect(address: string): Promise<void>
disconnect(): Promise<void>
isConnected(): Promise<boolean>
write(bytes: Uint8Array): Promise<void>
onConnectionChange(callback): Unsubscribe        // untuk update UI real-time
```

- Setiap fungsi WAJIB guard `isNative()` di awal — kalau dipanggil dari web browser biasa, lempar error yang jelas (`PrinterNotAvailableError`) alih-alih mencoba akses plugin yang tidak ada. Komponen UI yang memanggil ini harus menangani error tersebut dengan sopan (sembunyikan fitur, bukan crash).
- Simpan MAC address printer default terpilih di `localStorage` (key jelas, mis. `rakku_pos_printer_device`), dibaca lagi saat halaman register/orders dibuka untuk auto-reconnect.

### 5.5 `lib/printer/escpos-builder.ts`

Generate raw command bytes ESC/POS dari data struk (bukan string biasa — printer thermal butuh command bytes untuk formatting: bold, center, cut kertas, dsb). Fungsi minimal:

```
buildTestReceipt(): Uint8Array           // struk contoh untuk test print
buildOrderReceipt(order): Uint8Array     // struk asli dari data order (dipakai integrasi ke InvoiceReceipt di fase berikutnya)
```

Sertakan command dasar: initialize printer, text align center/left, bold on/off, garis pemisah (karakter `-` berulang sesuai lebar kertas printer umum 58mm/80mm — buat konfigurasi lebar kertas sebagai pengaturan di halaman printer settings, default 58mm karena paling umum untuk printer mobile), line feed, dan partial/full cut (kalau printer support — banyak printer mobile murah tidak punya auto-cutter, jadi cut command boleh no-op aman kalau tidak didukung).

### 5.6 Halaman `/settings/printer`

Route baru di `apps/pos/src/app/(dashboard)/settings/printer/`. Ikuti pola proteksi & layout dashboard yang sudah ada (sidebar/bottom-nav existing, bukan bikin layout baru).

**`page.tsx`** — server component, guard session sama seperti halaman dashboard lain, render `PrinterSettingsClient`.

**`PrinterSettingsClient.tsx`** — isi halaman:

1. **Banner kondisi platform** — kalau dibuka dari browser web biasa (bukan shell native), tampilkan pesan jelas: fitur ini hanya tersedia di aplikasi Android Rakku POS, bukan di browser. Jangan tampilkan tombol yang akan error kalau ditekan.
2. **Status koneksi** — badge real-time: Terhubung (hijau, tampilkan nama+address device) / Terputus (abu) / Mencari... (kuning, saat proses scan/connect berlangsung).
3. **Daftar printer berpasangan** — tombol "Cari printer" memicu `listPairedDevices()`, tampilkan list radio-select, pilih satu → panggil `connect()` → simpan sebagai default di `localStorage`.
4. **Test print** — tombol yang memanggil `buildTestReceipt()` lalu `write()`. Tampilkan feedback state jelas: mengirim / berhasil / gagal dengan pesan error spesifik (bukan generic "terjadi kesalahan") — bedakan kasus: Bluetooth device mati, printer tidak terhubung, gagal kirim data.
5. **Pengaturan lebar kertas** — toggle 58mm/80mm, disimpan di `localStorage`, dipakai `escpos-builder.ts`.
6. **Info diagnostik** (untuk bantu debug lapangan) — tampilkan platform (`getPlatform()`), status Bluetooth adapter (on/off kalau plugin expose ini), dan beberapa baris log koneksi terakhir (connect/disconnect/error) dari `printer-store.ts`.

Tambahkan link ke halaman ini dari menu Settings/sidebar existing yang relevan (ikuti pola navigasi yang sudah ada, jangan bikin entri nav baru yang tidak konsisten).

### 5.7 Integrasi ke `InvoiceReceipt.tsx` (opsional, boleh fase terpisah)

Tambah cabang: kalau `isNative()` true DAN ada printer default tersimpan, tombol "Print" memanggil `buildOrderReceipt(order)` + `bluetooth-bridge.write()` alih-alih (atau selain) `window.print()`. Kalau native tapi belum ada printer terhubung, arahkan user ke `/settings/printer` dengan pesan jelas, jangan silent fail. Di web browser, `window.print()` tetap seperti sekarang — tidak ada perubahan perilaku.

**Catatan:** bagian ini secara eksplisit ditandai boleh dikerjakan di fase/PR terpisah setelah halaman printer settings selesai dan terverifikasi jalan — supaya perubahan ke `InvoiceReceipt.tsx` (komponen yang dipakai di flow pembayaran aktif) terjadi setelah fondasi printer sudah stabil, meminimalkan risiko regresi ke flow checkout.

---

## 6. ENV / CONFIG TAMBAHAN

| Item | Nilai | Catatan |
|---|---|---|
| `capacitor.config.ts` → `server.url` | `https://pos.rakku.com` | Production. Untuk dev lokal, dokumentasikan cara override sementara ke `http://10.0.2.2:3001` di README, jangan commit versi dev ke config utama |
| `android/variables.gradle` → `minSdkVersion` | 26 (Android 8.0) atau lebih rendah kalau masih perlu cover device lebih lama | Jangan naikkan tanpa alasan eksplisit |
| Signing key APK | Belum ada — agent buat catatan bahwa signing key untuk build release perlu digenerate & disimpan aman terpisah dari repo (`.gitignore` keystore file), bukan tugas otomatis agent | Keamanan distribusi APK |

Tidak ada perubahan environment variable Vercel/Next.js (`POS_JWT_SECRET`, dsb) — semuanya tetap sama karena backend tidak berubah.

---

## 7. ROADMAP FASE IMPLEMENTASI

### Fase 1 — Setup Capacitor Shell ⬜
- [ ] Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` di `apps/pos`
- [ ] `npx cap init` + `capacitor.config.ts` (appId `com.rakku.pos`, server.url production)
- [ ] `npx cap add android`, verifikasi folder `android/` ter-generate
- [ ] Set `minSdkVersion` mencakup API 26
- [ ] Build & jalankan di emulator Android 8 (API 26) — WAJIB test versi ini karena itu yang bermasalah sekarang. Verifikasi app terbuka tanpa force-close dan bisa login 4-step normal (cookie/session jalan)
- [ ] Build & jalankan juga di emulator/device Android versi lebih baru (mis. Android 12+) untuk baseline pembanding
- **Definition of Done:** APK debug bisa di-install & dibuka di Android 8 tanpa force-close, login kasir 4-step berhasil, register/checkout normal (print masih pakai `window.print()` lama, belum ada perubahan)

### Fase 2 — Plugin Bluetooth SPP + Bridge Layer ⬜
- [ ] Riset & pilih plugin Bluetooth Serial (kriteria di Bagian 5.2), catat alasan pemilihan di `DOCS.md`
- [ ] Install plugin, tambah permission di `AndroidManifest.xml`
- [ ] Implementasi `lib/printer/capacitor-platform.ts`
- [ ] Implementasi `lib/printer/bluetooth-bridge.ts` (scan, connect, disconnect, write, status listener)
- [ ] Handle runtime permission request Android 12+ dengan dialog jelas
- [ ] Test manual: dari kode sementara/console, scan device paired, connect ke printer thermal existing, kirim raw bytes sederhana, verifikasi printer benar-benar mencetak
- **Definition of Done:** bridge layer bisa connect ke printer SPP existing dan mengirim data mentah dari dalam shell native, terverifikasi dengan printer fisik

### Fase 3 — ESC/POS Builder ⬜
- [ ] Implementasi `lib/printer/escpos-builder.ts` — `buildTestReceipt()` dulu
- [ ] Test cetak struk contoh ke printer fisik, verifikasi format (align, bold, garis pemisah) tampil benar
- [ ] Sesuaikan lebar kertas default (58mm) dengan printer yang dipakai, buat konstanta yang mudah diganti ke 80mm
- **Definition of Done:** `buildTestReceipt()` menghasilkan struk yang tercetak rapi di printer fisik existing

### Fase 4 — Halaman `/settings/printer` ⬜
- [ ] `page.tsx` + `PrinterSettingsClient.tsx` sesuai Bagian 5.6
- [ ] `printer-store.ts` (Zustand) untuk state status koneksi + log singkat
- [ ] Banner kondisi non-native (browser) yang jelas dan tidak mengarah ke tombol error
- [ ] Status koneksi real-time, daftar device, pilih default, simpan ke `localStorage`
- [ ] Tombol test print terhubung ke Fase 2+3, dengan feedback state yang jelas (mengirim/berhasil/gagal + pesan spesifik)
- [ ] Pengaturan lebar kertas (58mm/80mm)
- [ ] Info diagnostik (platform, status Bluetooth adapter, log koneksi terakhir)
- [ ] Tambah link navigasi ke halaman ini dari Settings/sidebar existing
- [ ] Build ulang APK, test end-to-end di Android 8 dan Android versi baru: buka halaman, scan, connect, test print, disconnect, reconnect
- **Definition of Done:** kasir bisa membuka halaman printer, connect ke printer thermal, dan berhasil test print dari dalam app — semua terverifikasi di device fisik Android 8

### Fase 5 — Integrasi ke Flow Checkout (`InvoiceReceipt.tsx`) ⬜
- [ ] Tambah cabang native print di `InvoiceReceipt.tsx` sesuai Bagian 5.7
- [ ] `buildOrderReceipt(order)` — mapping data order asli ke format struk ESC/POS (nama outlet, item, qty, harga, diskon, pajak, total, metode bayar)
- [ ] Kalau native tapi printer belum terhubung, arahkan ke `/settings/printer` dengan pesan jelas alih-alih gagal diam
- [ ] Verifikasi perilaku web browser (non-native) sama sekali tidak berubah — `window.print()` tetap seperti v4.0
- [ ] Test end-to-end penuh: transaksi asli dari Register → bayar → cetak struk asli ke printer thermal fisik
- **Definition of Done:** transaksi asli di kasir bisa langsung tercetak ke printer thermal dari dalam app native, tanpa regresi ke flow web existing

### Fase 6 — Build Release & Distribusi Internal ⬜
- [ ] Generate signing keystore (disimpan aman, tidak masuk repo)
- [ ] Build APK release, test install di beberapa device Android 8 di lapangan (device kasir asli, bukan cuma emulator)
- [ ] Dokumentasikan cara update APK ke depan (kasir install manual APK baru, belum lewat Play Store)
- [ ] Update `DOCS.md`: tambah "Bagian 16 — v4.1 Native Printer (Capacitor)" — struktur baru, plugin yang dipakai & alasannya, cara build APK, cara test Bluetooth, known limitations (iOS belum didukung, dsb)
- **Definition of Done:** APK release terinstall dan dipakai kasir di device Android 8 asli, print struk ke printer thermal berjalan stabil di kondisi pemakaian nyata

---

## 8. CATATAN PENTING (bukan tugas fase ini, tapi perlu disadari)

- **iOS tidak tercakup di dokumen ini.** Kalau nanti ada kebutuhan printer thermal di iOS, itu pekerjaan terpisah — printer Bluetooth Classic SPP di iOS punya batasan MFi Program dari Apple yang jauh lebih ketat, kemungkinan besar perlu pendekatan berbeda (mis. printer yang expose profil BLE, atau printer Wi-Fi/LAN sebagai alternatif).
- **Distribusi Play Store** sengaja tidak masuk scope (Fase 6 hanya distribusi APK internal). Kalau nanti mau publish ke Play Store, itu proses terpisah (Play Console, review policy, dsb).
- **Penyimpanan printer default masih per-device (`localStorage`)**, bukan per-outlet di Supabase. Kalau ke depan satu outlet punya banyak device kasir yang perlu tahu printer mana yang jadi default bersama, itu perlu migrasi ke tabel `outlet_settings` — dicatat sebagai kemungkinan masa depan, bukan tugas sekarang.
- **`server.url` mode** (live URL, bukan static export) berarti app native tetap butuh koneksi internet untuk load UI (walau Serwist service worker tetap membantu caching asset di dalam WebView). Kalau ke depan dibutuhkan mode benar-benar offline-first untuk shell native, itu perlu eksplorasi terpisah (Capacitor static bundle + API calls saja) — bukan tugas fase ini.
- Printer thermal Bluetooth SPP yang berbeda merek kadang punya command ESC/POS yang sedikit berbeda (terutama command cut kertas). `escpos-builder.ts` di fase ini dioptimalkan untuk printer yang dipakai sekarang — kalau nanti ada merek printer baru yang berbeda perilaku, mungkin perlu penyesuaian kecil, bukan redesign total.

---

## 9. INSTRUKSI KHUSUS UNTUK AI AGENT

- Kerjakan **satu fase per sesi/PR**. Setiap fase diakhiri dengan: (a) daftar file yang dibuat/diubah, (b) perintah untuk build & test (termasuk perintah `npx cap sync`/`npx cap open android` yang relevan), (c) konfirmasi tidak ada regresi ke web PWA existing.
- **Jangan** ubah logic bisnis apa pun (cart, pricing, tax/discount, RBAC, 4-step login, checkout) — perubahan ke `InvoiceReceipt.tsx` di Fase 5 hanya menambah cabang native print, alur pembayaran & perhitungan tidak boleh tersentuh.
- **Jangan** ubah `next.config.mjs` / konfigurasi Serwist existing — web PWA (`pos.rakku.com` diakses browser biasa) harus tetap berfungsi identik dengan v4.0 sepanjang implementasi ini.
- **Setiap fungsi yang menyentuh Bluetooth/plugin native WAJIB di-guard** dengan `isNative()` dari `capacitor-platform.ts` — tidak boleh ada kode yang mengasumsikan plugin native selalu tersedia, karena kode yang sama tetap jalan di web browser biasa.
- **Android 8 (API 26) adalah target uji wajib di setiap fase yang menyentuh build native** — jangan anggap "jalan di emulator versi baru" sebagai cukup, karena masalah awal yang dilaporkan spesifik di Android 8.
- Kalau plugin Bluetooth Serial yang dipilih di Fase 2 ternyata tidak reliable/tidak maintained setelah dicoba, agent boleh mengganti pilihan plugin — tapi harus didokumentasikan alasan gantinya di `DOCS.md`, dan `bluetooth-bridge.ts` didesain supaya penggantian plugin tidak mengubah kode di luar file itu (lihat Bagian 5.4).
- Kalau satu fase ternyata terlalu besar untuk satu sesi, boleh dipecah lebih kecil (mis. Fase 2 dipecah: instalasi plugin dulu, baru scan, baru connect, baru write) — tapi tetap laporkan progress per sub-bagian dengan jelas.
- Setelah Fase 6 selesai, semua fitur existing `apps/pos` (login, register/kasir, orders, reports, products, categories, pricing-tiers, taxes, discounts) harus tetap berfungsi identik baik diakses lewat web browser maupun dari dalam APK native — tidak ada regresi di kedua target.

---

**Ringkasan satu paragraf untuk AI agent:** Tambahkan native Android shell (Capacitor) ke `apps/pos` yang membungkus WebView berisi aplikasi Next.js yang sama persis (live URL, bukan rewrite), lalu tambahkan plugin Bluetooth Classic SPP untuk connect ke printer thermal mobile yang sudah dipakai (yang sebelumnya mustahil diakses dari PWA browser murni). Buat halaman baru `/settings/printer` untuk lihat status koneksi, scan/pilih printer berpasangan, dan test print, lalu integrasikan ke flow cetak struk asli di `InvoiceReceipt.tsx` di fase terakhir. Setiap kode yang menyentuh Bluetooth harus di-guard runtime check `isNative()` supaya satu codebase tetap jalan baik di web browser maupun di shell native — web PWA existing tidak boleh berubah perilaku sama sekali. Android 8 (API 26) adalah target uji wajib di tiap fase karena itu perangkat yang sebelumnya force-close. Kerjakan bertahap per fase (Bagian 7): setup Capacitor dulu, lalu bridge Bluetooth, lalu ESC/POS builder, lalu halaman settings printer, lalu integrasi ke checkout asli, baru build release & distribusi internal ke device kasir.
