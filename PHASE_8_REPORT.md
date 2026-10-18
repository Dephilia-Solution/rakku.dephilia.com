# Fase 8 — CI, observability, backup dan security operations

17 Oktober 2026 · perubahan lokal pada branch `codex/production-hardening`.

**Tooling dan runbook tersedia lokal; CI belum dijalankan di GitHub, restore drill/alert delivery belum diuji, dan tidak ada platform yang diprovision/di-deploy.** Tidak ada secret aktif, backup, rotasi, scheduler atau alert nyata yang disentuh.

## Perubahan

| Area | Implementasi |
|---|---|
| CI | `.github/workflows/ci.yml`: frozen install, typecheck 19 package + scripts, lint, env/dependency/auth/observability/provider/DB/demo tests, build isolasi empat app, HTTP guards, audit summary |
| PostgreSQL CI | Service `postgres:17`, apply migrations disposable, `pnpm test:concurrency` dua koneksi |
| Structured logging | `@rakku/observability`: JSON event, correlation ID, error taxonomy, redaction secret/PII, 4 test |
| Trace ID | `x-request-id` dibuat/dinormalisasi di proxy Owner/POS; job/provider event membawa `correlation_id` |
| Health | `GET /api/health` Owner/POS melakukan `select 1`; 200/503 tanpa detail sensitif |
| Runtime control | Migration 0014 `runtime_flags`; `ops:checkout-pause` enable/disable/status; env override `RAKKU_CHECKOUT_PAUSED=1` |
| Ops snapshot | `ops:snapshot` / `--check`: pending/unknown payment, exception, DLQ, due job, settlement discrepancy, withdrawal, pause |
| Cleanup | `ops:cleanup` dry-run default; hanya sesi/rate-limit/job done/event processed; dead-letter dan evidence finansial dipertahankan |
| Restore verify | `ops:restore-verify`: bucket vs journal, saldo negatif, exception, DLQ, migration count |
| Supply chain | CI audit mentah + summary (critical/high tidak diketahui gagal; braces high dipatch tetap tercatat), `minimum-release-age=1440`, frozen lockfile |
| Runbook | `config/operations/README.md`: observability, retention, backup/PITR/RPO/RTO, restore drill, incident, rotation, emergency pause |

## Verifikasi aktual

| Pemeriksaan | Hasil |
|---|---|
| `pnpm --filter @rakku/db test` | 80 lulus; 2 runtime flag + 2 maintenance/cleanup |
| `pnpm test:observability` | 4 lulus |
| `pnpm test:env` / `test:dependencies` | 12 / 3 lulus |
| `pnpm test:auth` / `test:provider` | 14 / 3 lulus |
| `pnpm test:demo` | 74 + 3 lulus |
| `pnpm typecheck` + scripts | 19 task + scripts lulus |
| Build Owner/POS/Superadmin/Landing | Lulus pada `.next-hardening-phase89` |
| `pnpm test:auth:http` | 20 assertion lulus; health/webhook transport diblokir |
| GitHub Actions, restore drill, alert delivery, PITR, rotation | **Belum dijalankan** |

## Blocker tersisa

- Workflow CI belum dieksekusi di GitHub; hasil aktual runner, cache, service Postgres dan audit registry belum terbukti.
- Backup/PITR, restore drill, RPO/RTO, alert delivery, retention platform dan privilege aktual belum diverifikasi.
- Structured logging baru diadopsi pada worker/webhook/cron/health; belum seluruh route dan belum ada koneksi log drain/alert.
- Step-up/re-auth untuk bank, withdrawal, refund/void dan adjustment admin belum ada.
- `minimum-release-age` dan audit summary memerlukan verifikasi pada registry/CI nyata; advisory braces high tetap ada.
- Storage quota, refund/void, cash close dan concurrency/production acceptance dari fase 5–7/9 tetap terbuka.
