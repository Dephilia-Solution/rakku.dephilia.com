# Fase 9 — Pilot merchant dan launch gate

17 Oktober 2026 · dokumen/acceptance plan lokal.

**Keputusan: NO-GO untuk public launch.** Tidak ada akun staging sintetis,
transaksi uang nyata, email merchant, printer, QRIS sandbox, custom domain,
consent production atau deployment yang dijalankan. Dokumen ini menyiapkan
acceptance dan keputusan berbukti, bukan menyatakan kesiapan.

## Deliverable

- `config/pilot/README.md`:
  - scope pilot terbatas dan larangan uang nyata sebelum provider/settlement disetujui;
  - matrix Owner/POS/Superadmin state, direct URL, reload, history, multi-tab,
    BFCache, service worker, dua akun satu perangkat, offline;
  - flow cash/split/draft/QRIS, purchase/expense/stock/HPP, withdrawal,
    settlement, receipt, reports, quota;
  - device/browser matrix: Chrome/Edge/Firefox 111+, Safari 16.4+, Android/iPhone/tablet, printer 58/80mm, cash drawer, QRIS, touch;
  - custom domain/HTTPS/cookie/origin, Terms/Privacy human review, consent,
    support/incident/on-call;
  - template go/no-go, stop criteria, rollback/emergency pause, metrics review.
- `config/operations/README.md`: restore drill, RPO/RTO proposal, incident,
  credential rotation, retention, redaction dan emergency checkout pause.
- `PHASE_1_REPORT.md`–`PHASE_8_REPORT.md` sebagai evidence/limitasi fase sebelumnya.

## Status acceptance

| Area | Status |
|---|---|
| Owner/POS/Superadmin positive flows | **Belum dijalankan** di staging |
| Merchant cash/split/draft/QRIS | **Belum dijalankan** dengan perangkat/akun nyata |
| Refund/void approval, cash close, step-up | **Belum diimplementasikan lengkap** |
| Settlement/withdrawal beberapa siklus | **Belum dijalankan**; statement/bank/provider belum terbukti |
| Printer 58/80mm, cash drawer, QRIS device | **Belum diuji** |
| Custom domain/HTTPS/cookie/origin | **Belum diverifikasi** |
| Terms/Privacy/consent/legal review | Dokumen ada; **review manusia belum** |
| Backup/PITR/restore/alert/CI runner | **Belum diverifikasi** |
| Two-connection PostgreSQL harness | Disiapkan; lokal **SKIPPED**, CI belum dijalankan |
| Browser/device matrix | **Kosong/belum diisi** |

## Go/no-go

**NO-GO.** Alasan berbukti:

1. Environment fase 1 masih dibagi; `env:check` menolak konfigurasi aktif.
2. Kontrak provider signature/cancel/refund/settlement dan sandbox belum terbukti.
3. RBAC, subscription, provider jobs, settlement, reports dan quotas baru diuji
   lokal (PGlite/demo), belum acceptance staging/browser.
4. Dua koneksi PostgreSQL, restore/PITR, alert delivery, CI runner dan privilege
   runtime belum dijalankan.
5. Refund/void, cash close, step-up, storage quota penuh dan device acceptance
   belum lengkap.
6. Legal/consent, support/on-call dan batas pilot belum disetujui manusia.

## Prasyarat sebelum pilot

- Isolasi DB/Auth/provider/secret staging dan backup/restore point teruji.
- Provider sandbox: create/status/webhook/signature/cancel/refund/lookup sesuai
  kontrak; settlement statement nyata.
- Acceptance Owner/POS/Superadmin, perangkat/printer/QRIS, shared device/PWA,
  offline, multi-tab dan BFCache.
- Minimal beberapa siklus settlement/rekonsiliasi cocok; exception dan withdrawal
  approval dengan bukti.
- CI GitHub lulus, restore drill tervalidasi, alert delivery diterima, step-up
  tersedia untuk tindakan sensitif.
- Legal/Privacy/Terms/consent versioning dan support/incident disetujui.

## Rollback/stop

Pause checkout via `pnpm ops:checkout-pause -- --enable`, hentikan worker/approval,
jangan hapus inbox/DLQ/ledger/settlement/exception, komunikasikan ke merchant,
forward-fix, replay job yang ditinjau. Ekspansi pilot dihentikan pada mismatch
ledger/settlement/stock, dead-letter berulang, kebocoran tenant, auth abuse,
kegagalan QRIS/printer atau environment terbukti shared.

## Kesimpulan

Source hardening fase 1–8 tersedia lokal dan regression lokal lulus, tetapi
**belum ada dasar berbukti untuk public launch**. Pilot hanya boleh dimulai
setelah acceptance staging/device/provider dan blocker operasional di atas
ditutup dengan bukti yang dapat diaudit.
