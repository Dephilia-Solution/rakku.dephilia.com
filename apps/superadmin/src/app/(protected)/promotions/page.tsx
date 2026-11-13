"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  addSignupCalendarMonths,
  formatPromotionDate,
  isPromotionDate,
  isSignupPromotionOpen,
  type SignupPromotion,
  type SignupPromotionAudit,
  type SignupPromotionInput,
  type SignupPromotionRecipient,
} from "@rakku/shared-types";
import { showToast } from "@rakku/ui";
import { CalendarDays, Check, Eye, Gift, Info, Loader2, Pencil, Plus, RefreshCw, X } from "lucide-react";

interface PlanOption {
  id: string;
  name: string;
  slug: string;
}

interface PromotionList {
  promotions: SignupPromotion[];
  plans: PlanOption[];
}

interface PromotionDetail {
  promotion: SignupPromotion;
  recipients: SignupPromotionRecipient[];
  audit: SignupPromotionAudit[];
}

type PromotionForm = Omit<SignupPromotionInput, "duration_months"> & { duration_months: string };

const API_URL = "/api/superadmin/promotions";
const DEFAULT_END_DATE = "2026-12-31";
const inputClass = "min-h-12 w-full min-w-0 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-base text-neutral-900 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 sm:text-sm";
const buttonClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = `${buttonClass} bg-neutral-100 text-neutral-700 hover:bg-neutral-200 active:bg-neutral-200`;
const primaryButtonClass = `${buttonClass} bg-forest text-white hover:bg-forest-dark active:bg-forest-dark`;
const labelClass = "mb-1.5 block text-sm font-medium text-neutral-700";

class PromotionApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PromotionApiError(
      typeof data?.error === "string" ? data.error : "Permintaan promosi gagal. Silakan coba lagi.",
      response.status,
      typeof data?.code === "string" ? data.code : undefined,
    );
  }
  return data as T;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof PromotionApiError && error.status === 503) {
    return `Sistem promosi belum siap digunakan. Skema promosi mungkin belum tersedia. ${error.message}`;
  }
  return error instanceof Error ? error.message : fallback;
}

function todayWib(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatDateTime(value: string): string {
  return `${new Date(value).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    second: "2-digit", hour12: false, timeZone: "Asia/Jakarta",
  })} WIB`;
}

function promotionStatus(promotion: SignupPromotion) {
  if (!promotion.is_active) return { label: "Nonaktif", style: "bg-neutral-100 text-neutral-600" };
  if (isSignupPromotionOpen(promotion)) return { label: "Aktif", style: "bg-primary-100 text-forest" };
  if (todayWib() < promotion.starts_on) return { label: "Terjadwal", style: "bg-amber-100 text-amber-800" };
  return { label: "Berakhir", style: "bg-neutral-100 text-neutral-600" };
}

function StatusBadge({ promotion }: { promotion: SignupPromotion }) {
  const status = promotionStatus(promotion);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.style}`}>{status.label}</span>;
}

function FrozenGrantsNotice() {
  return (
    <div className="flex gap-3 rounded-xl border border-primary-100 bg-primary-50 p-4 text-sm leading-relaxed text-forest">
      <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>Perubahan atau penonaktifan promo hanya berlaku untuk signup berikutnya. Paket, durasi, dan tanggal hak penerima yang sudah diberikan tetap tersimpan sesuai ketentuan saat signup.</p>
    </div>
  );
}

function Modal({ title, description, onClose, busy = false, children }: {
  title: string;
  description: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="promotion-modal-title"
      aria-describedby="promotion-modal-description"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto overscroll-contain rounded-2xl border-0 bg-white p-0 text-neutral-900 shadow-xl backdrop:bg-black/40"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-neutral-100 bg-white px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="promotion-modal-title" className="break-words font-display text-lg font-semibold">{title}</h2>
          <p id="promotion-modal-description" className="mt-1 text-sm leading-relaxed text-neutral-500">{description}</p>
        </div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Tutup dialog promosi" className={`${secondaryButtonClass} w-12 shrink-0 px-0`}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function editableConfig(promotion: SignupPromotion): SignupPromotionInput {
  return {
    name: promotion.name,
    plan_id: promotion.plan_id,
    duration_months: promotion.duration_months,
    starts_on: promotion.starts_on,
    ends_on: promotion.ends_on,
    terms: promotion.terms,
    is_active: promotion.is_active,
  };
}

function PromotionEditor({ promotion, plans, onClose, onSaved }: {
  promotion: SignupPromotion | null;
  plans: PlanOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [version, setVersion] = useState(promotion);
  const [form, setForm] = useState<PromotionForm>(() => promotion ? {
    ...editableConfig(promotion), duration_months: String(promotion.duration_months),
  } : {
    name: "Promo signup Pro",
    plan_id: plans.find((plan) => plan.slug.toLowerCase() === "pro")?.id ?? "",
    duration_months: "3",
    starts_on: todayWib(),
    ends_on: DEFAULT_END_DATE,
    terms: "Berlaku untuk pendaftaran owner baru. Manfaat dimulai saat owner mendaftar, selama durasi bulan kalender yang ditentukan. Hak yang sudah diberikan tetap berlaku meskipun promo diubah atau dinonaktifkan.",
    is_active: true,
  });
  const [previewDate, setPreviewDate] = useState(DEFAULT_END_DATE);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<SignupPromotion | null>(null);
  const [checkingRevision, setCheckingRevision] = useState(false);
  const months = Number(form.duration_months);
  const validDuration = Number.isInteger(months) && months >= 1 && months <= 24;
  const validPeriod = isPromotionDate(form.starts_on) && isPromotionDate(form.ends_on) && form.starts_on <= form.ends_on;
  const previewEnd = isPromotionDate(previewDate) && validDuration
    ? addSignupCalendarMonths(`${previewDate}T00:00:00+07:00`, months) : null;
  const previewEligible = validPeriod && isPromotionDate(previewDate) && isSignupPromotionOpen(form, `${previewDate}T00:00:00+07:00`);
  const busy = saving || checkingRevision;

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!form.name.trim() || !form.plan_id || !form.terms.trim() || !validDuration || !validPeriod) {
      setSaveError("Lengkapi nama, paket, dan ketentuan. Durasi harus 1–24 bulan kalender, dengan tanggal mulai tidak melewati tanggal akhir (YYYY-MM-DD WIB).");
      return;
    }
    const input: SignupPromotionInput = { ...form, name: form.name.trim(), terms: form.terms.trim(), duration_months: months };
    setSaving(true);
    setSaveError(null);
    setConflict(false);
    setLatest(null);
    try {
      await request<unknown>(API_URL, {
        method: version ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(version ? { ...input, id: version.id, expectedRevision: version.revision } : input),
      });
      showToast("success", version ? "Promosi diperbarui. Hak penerima lama tetap berlaku." : "Promosi berhasil dibuat.");
      onSaved();
    } catch (error) {
      const message = errorMessage(error, "Gagal menyimpan promosi.");
      setSaveError(message);
      setConflict(error instanceof PromotionApiError && error.status === 409);
      showToast("error", message);
    } finally {
      setSaving(false);
    }
  }

  async function checkLatestRevision() {
    if (!version || busy) return;
    setCheckingRevision(true);
    try {
      const data = await request<PromotionDetail>(`${API_URL}?id=${encodeURIComponent(version.id)}`);
      setLatest(data.promotion);
    } catch (error) {
      const message = errorMessage(error, "Gagal memuat revisi terbaru.");
      setSaveError(message);
      showToast("error", message);
    } finally {
      setCheckingRevision(false);
    }
  }

  return (
    <Modal title={promotion ? `Edit promosi: ${promotion.name}` : "Tambah promosi signup"} description="Periode kelayakan signup menggunakan tanggal WIB dan mencakup hari terakhir." onClose={onClose} busy={busy}>
      <form onSubmit={handleSave}>
        <fieldset disabled={busy} className="min-w-0 space-y-5 px-4 py-5 sm:px-6">
          <legend className="sr-only">Konfigurasi promosi signup</legend>
          <FrozenGrantsNotice />
          <div>
            <label htmlFor="promotion-name" className={labelClass}>Nama promosi</label>
            <input id="promotion-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="promotion-plan" className={labelClass}>Paket yang diberikan</label>
              <select id="promotion-plan" required value={form.plan_id} onChange={(event) => setForm({ ...form, plan_id: event.target.value })} className={inputClass}>
                <option value="">Pilih paket</option>
                {promotion && !plans.some((plan) => plan.id === promotion.plan_id) && <option value={promotion.plan_id}>{promotion.plan_name} (paket saat ini)</option>}
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} ({plan.slug})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="promotion-duration" className={labelClass}>Durasi (bulan kalender)</label>
              <input id="promotion-duration" type="number" inputMode="numeric" min={1} max={24} step={1} required value={form.duration_months} onChange={(event) => setForm({ ...form, duration_months: event.target.value })} aria-describedby="promotion-duration-hint" className={inputClass} />
              <p id="promotion-duration-hint" className="mt-1.5 text-xs leading-relaxed text-neutral-500">Dihitung dari waktu signup owner. Tanggal akhir bulan menyesuaikan kalender bulan tujuan.</p>
            </div>
            <div>
              <label htmlFor="promotion-start" className={labelClass}>Tanggal mulai signup (WIB)</label>
              <input id="promotion-start" type="date" min="2000-01-01" max="2100-12-31" required value={form.starts_on} onChange={(event) => setForm({ ...form, starts_on: event.target.value })} aria-describedby="promotion-period-hint" className={inputClass} />
            </div>
            <div>
              <label htmlFor="promotion-end" className={labelClass}>Tanggal terakhir signup (WIB)</label>
              <input id="promotion-end" type="date" min={isPromotionDate(form.starts_on) ? form.starts_on : "2000-01-01"} max="2100-12-31" required value={form.ends_on} onChange={(event) => setForm({ ...form, ends_on: event.target.value })} aria-describedby="promotion-period-hint" className={inputClass} />
            </div>
          </div>
          <p id="promotion-period-hint" className="text-sm leading-relaxed text-neutral-500">Nilai tanggal menggunakan YYYY-MM-DD, zona waktu WIB. Periode mencakup tanggal mulai pukul 00.00 hingga tanggal terakhir pukul 23.59.59 WIB. Deadline ini membatasi signup, bukan tanggal berakhirnya hak setiap owner.</p>
          <div>
            <label htmlFor="promotion-terms" className={labelClass}>Ketentuan promosi</label>
            <textarea id="promotion-terms" required rows={4} value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} className={`${inputClass} resize-y`} />
          </div>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="h-5 w-5 shrink-0 accent-forest" />
            <span><span className="block font-medium">Promosi diaktifkan</span><span className="mt-0.5 block text-neutral-500">Nonaktifkan untuk menghentikan pemberian hak pada signup berikutnya.</span></span>
          </label>
          <section aria-labelledby="promotion-preview-title" className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <h3 id="promotion-preview-title" className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={16} aria-hidden="true" />Pratinjau hak owner</h3>
            <label htmlFor="promotion-preview-date" className={`${labelClass} mt-4`}>Contoh tanggal signup (WIB)</label>
            <input id="promotion-preview-date" type="date" min="2000-01-01" max="2100-12-31" value={previewDate} onChange={(event) => setPreviewDate(event.target.value)} className={`${inputClass} bg-white`} />
            <div aria-live="polite" className="mt-3 space-y-2 text-sm leading-relaxed">
              {previewEnd ? <p className="font-medium text-neutral-900">{formatPromotionDate(previewDate)} → {formatPromotionDate(previewEnd)} ({months} bulan kalender)</p> : <p className="text-neutral-500">Pilih tanggal signup dan durasi yang valid untuk melihat tanggal akhir hak.</p>}
              <p className="text-neutral-600">{!form.is_active ? "Promo nonaktif; signup baru tidak mendapat hak promo." : !validPeriod ? "Lengkapi periode promo yang valid untuk memeriksa kelayakan." : !isPromotionDate(previewDate) ? "Pilih tanggal contoh untuk memeriksa kelayakan." : previewEligible ? "Tanggal signup ini termasuk periode promo (inklusif)." : "Tanggal signup ini di luar periode promo; hasil di atas hanya simulasi durasi."}</p>
              <p className="text-xs text-neutral-500">Simulasi menggunakan pukul 00.00 WIB. Hak sebenarnya mengikuti waktu signup owner, dengan durasi penuh meskipun melewati deadline promo.</p>
            </div>
          </section>
        </fieldset>
        {saveError && (
          <div role="alert" className="mx-4 mb-5 space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:mx-6">
            <p>{saveError}</p>
            {conflict && <p>Isian Anda tetap dipertahankan. Periksa revisi terbaru dan pastikan periode tidak bertumpuk dengan promo aktif lainnya.</p>}
            {conflict && version && <button type="button" disabled={busy} onClick={checkLatestRevision} className={secondaryButtonClass}>{checkingRevision ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}Periksa versi terbaru</button>}
            {latest && (
              <div className="space-y-3 border-t border-red-200 pt-3">
                <p>Versi server diperbarui {formatDateTime(latest.updated_at)}.</p>
                <details>
                  <summary className="flex min-h-12 cursor-pointer items-center font-medium underline">Lihat konfigurasi di server</summary>
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-white p-3 text-xs">{JSON.stringify(editableConfig(latest), null, 2)}</pre>
                </details>
                {latest.revision !== version?.revision ? <button type="button" disabled={busy} onClick={() => { setVersion(latest); setLatest(null); setConflict(false); setSaveError(null); }} className={secondaryButtonClass}>Pakai revisi terbaru, pertahankan isian</button> : <p>Revisi belum berubah. Periksa periode promo aktif lain sebelum menyimpan kembali.</p>}
              </div>
            )}
          </div>
        )}
        <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-neutral-100 bg-white px-4 pt-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryButtonClass}>Batal</button>
          <button type="submit" disabled={busy} className={primaryButtonClass}>{saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}{saving ? "Menyimpan..." : "Simpan promosi"}</button>
        </div>
      </form>
    </Modal>
  );
}

function auditSummary(entry: SignupPromotionAudit): string {
  if (!entry.before_config) return "Promosi dibuat";
  const before = entry.before_config;
  const after = entry.after_config;
  if (typeof before === "object" && before !== null && "is_active" in before && typeof after === "object" && after !== null && "is_active" in after && before.is_active !== after.is_active) {
    if (after.is_active === false) return "Promosi dinonaktifkan";
    if (after.is_active === true) return "Promosi diaktifkan";
  }
  return "Konfigurasi promosi diperbarui";
}

function PromotionDetails({ promotion, onClose }: { promotion: SignupPromotion; onClose: () => void }) {
  const [detail, setDetail] = useState<PromotionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await request<PromotionDetail>(`${API_URL}?id=${encodeURIComponent(promotion.id)}`, { signal: controller.signal });
        if (!controller.signal.aborted) setDetail(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          const message = errorMessage(error, "Gagal memuat detail promosi.");
          setLoadError(message);
          showToast("error", message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [promotion.id, attempt]);

  const current = detail?.promotion ?? promotion;
  const recipients = [...(detail?.recipients ?? [])].sort((a, b) => (b.applied_at ?? b.benefit_starts_at).localeCompare(a.applied_at ?? a.benefit_starts_at));
  const audit = [...(detail?.audit ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <Modal title={`Detail promosi: ${current.name}`} description="Riwayat penerima menampilkan hak yang disimpan saat signup, termasuk setelah kampanye berubah." onClose={onClose}>
      <div className="space-y-6 px-4 py-5 sm:px-6">
        {loading ? <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500"><Loader2 size={18} className="animate-spin" aria-hidden="true" />Memuat detail promosi...</div> : loadError ? <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{loadError}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className={secondaryButtonClass}>Coba lagi</button></div> : detail && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge promotion={current} /><button type="button" onClick={() => setAttempt((value) => value + 1)} className={secondaryButtonClass}><RefreshCw size={16} aria-hidden="true" />Muat ulang</button></div>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-neutral-500">Paket & durasi</dt><dd className="mt-1 font-medium">{current.plan_name} · {current.duration_months} bulan kalender</dd></div>
              <div><dt className="text-neutral-500">Total penerima</dt><dd className="mt-1 font-medium">{current.recipient_count.toLocaleString("id-ID")} owner</dd></div>
              <div><dt className="text-neutral-500">Periode signup (WIB, inklusif)</dt><dd className="mt-1 font-medium">{formatPromotionDate(current.starts_on)} – {formatPromotionDate(current.ends_on)}</dd></div>
              <div><dt className="text-neutral-500">Terakhir diperbarui</dt><dd className="mt-1">{formatDateTime(current.updated_at)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-neutral-500">Ketentuan saat ini</dt><dd className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{current.terms || "Tidak ada ketentuan tambahan."}</dd></div>
            </dl>
            <FrozenGrantsNotice />
            <section aria-labelledby="promotion-recipients-title">
              <h3 id="promotion-recipients-title" className="font-display text-base font-semibold">Penerima terbaru</h3>
              <p className="mt-1 text-sm text-neutral-500">Menampilkan {recipients.length.toLocaleString("id-ID")} dari {current.recipient_count.toLocaleString("id-ID")} penerima. Tanggal hak di bawah terpisah dari deadline promo.</p>
              {recipients.length === 0 ? <p className="mt-4 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">Belum ada penerima promo.</p> : (
                <ul className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                  {recipients.map((recipient) => (
                    <li key={`${recipient.owner_id}-${recipient.company_id ?? "owner"}-${recipient.benefit_starts_at}`} className="space-y-3 p-4 text-sm">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0"><p className="break-words font-semibold">{recipient.owner_name || recipient.owner_id}</p><p className="mt-1 break-words text-neutral-500">{recipient.company_name || "Belum ada company"}</p></div>
                        <p className="shrink-0 text-neutral-600">{recipient.plan_name} · {recipient.duration_months} bulan kalender</p>
                      </div>
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div><dt className="text-neutral-500">Mulai hak</dt><dd className="mt-1">{formatDateTime(recipient.benefit_starts_at)}</dd></div>
                        <div><dt className="text-neutral-500">Akhir hak</dt><dd className="mt-1">{formatDateTime(recipient.benefit_ends_at)}</dd></div>
                        <div className="sm:col-span-2"><dt className="text-neutral-500">Diterapkan ke company</dt><dd className="mt-1">{recipient.applied_at ? formatDateTime(recipient.applied_at) : "Belum diterapkan"}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="promotion-audit-title">
              <h3 id="promotion-audit-title" className="font-display text-base font-semibold">Ringkasan audit</h3>
              <p className="mt-1 text-sm text-neutral-500">{audit.length.toLocaleString("id-ID")} perubahan terbaru yang tersedia.</p>
              {audit.length === 0 ? <p className="mt-4 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">Belum ada riwayat perubahan.</p> : (
                <ul className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                  {audit.map((entry) => (
                    <li key={entry.id} className="p-4 text-sm">
                      <p className="font-medium">{auditSummary(entry)}</p>
                      <p className="mt-1 text-neutral-500">{formatDateTime(entry.created_at)}</p>
                      <p className="mt-1 break-all text-xs text-neutral-500">Admin: {entry.actor_id}</p>
                      <details className="mt-2">
                        <summary className="flex min-h-12 cursor-pointer items-center font-medium text-forest underline">Lihat konfigurasi sebelum & sesudah</summary>
                        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="min-w-0"><h4 className="mb-2 text-xs font-medium text-neutral-500">Sebelum</h4><pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-neutral-50 p-3 text-xs">{JSON.stringify(entry.before_config, null, 2) ?? "null"}</pre></div>
                          <div className="min-w-0"><h4 className="mb-2 text-xs font-medium text-neutral-500">Sesudah</h4><pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-neutral-50 p-3 text-xs">{JSON.stringify(entry.after_config, null, 2) ?? "null"}</pre></div>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}

function PromotionActions({ promotion, onDetail, onEdit }: { promotion: SignupPromotion; onDetail: () => void; onEdit: () => void }) {
  return <div className="flex flex-wrap gap-2"><button type="button" onClick={onDetail} aria-label={`Detail promosi ${promotion.name}`} className={secondaryButtonClass}><Eye size={16} aria-hidden="true" />Detail</button><button type="button" onClick={onEdit} aria-label={`Edit promosi ${promotion.name}`} className={secondaryButtonClass}><Pencil size={16} aria-hidden="true" />Edit</button></div>;
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<SignupPromotion[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ promotion: SignupPromotion | null } | null>(null);
  const [selected, setSelected] = useState<SignupPromotion | null>(null);

  const loadPromotions = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await request<PromotionList>(API_URL, { signal });
      if (!signal?.aborted) {
        setPromotions(Array.isArray(data.promotions) ? data.promotions : []);
        setPlans(Array.isArray(data.plans) ? data.plans : []);
      }
    } catch (error) {
      if (!signal?.aborted) {
        const message = errorMessage(error, "Gagal memuat promosi.");
        setLoadError(message);
        showToast("error", message);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void loadPromotions(controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadPromotions]);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><h1 className="font-display text-2xl font-bold text-neutral-900">Promo Pendaftaran</h1><p className="mt-1 text-sm leading-relaxed text-neutral-500">Atur paket gratis untuk owner baru, periode pendaftaran WIB, dan durasi bulan kalender.</p></div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => void loadPromotions()} disabled={loading} className={secondaryButtonClass}><RefreshCw size={16} aria-hidden="true" />Muat ulang</button>
          <button type="button" onClick={() => setEditor({ promotion: null })} disabled={loading || Boolean(loadError) || plans.length === 0} className={primaryButtonClass}><Plus size={16} aria-hidden="true" />Tambah promosi</button>
        </div>
      </div>
      <FrozenGrantsNotice />
      {loading ? <div role="status" className="flex items-center justify-center gap-2 rounded-2xl bg-white py-12 text-sm text-neutral-500 shadow-sm"><Loader2 size={18} className="animate-spin" aria-hidden="true" />Memuat promosi...</div> : loadError ? <div role="alert" className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p>{loadError}</p><button type="button" onClick={() => void loadPromotions()} className={secondaryButtonClass}>Coba lagi</button></div> : (
        <>
          {plans.length === 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Belum ada paket yang tersedia. Tambahkan atau aktifkan paket di halaman Plans untuk membuat promosi.</p>}
          {promotions.length === 0 ? <div className="rounded-2xl bg-white px-5 py-12 text-center shadow-sm"><Gift size={28} className="mx-auto mb-3 text-neutral-400" aria-hidden="true" /><h2 className="font-display text-base font-semibold text-neutral-900">Belum ada promosi signup</h2><p className="mt-2 text-sm text-neutral-500">Tambahkan promosi untuk memberikan paket gratis selama beberapa bulan kalender sejak owner mendaftar.</p></div> : (
            <>
              <p className="text-sm text-neutral-500">{promotions.length.toLocaleString("id-ID")} promosi · Status dan periode mengikuti WIB. Nonaktifkan promosi melalui Edit.</p>
              <div className="space-y-4 xl:hidden">
                {promotions.map((promotion) => (
                  <article key={promotion.id} className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words font-display font-semibold text-neutral-900">{promotion.name}</h2><StatusBadge promotion={promotion} /></div>
                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-neutral-500">Paket & durasi</dt><dd className="mt-1 text-neutral-900">{promotion.plan_name} · {promotion.duration_months} bulan kalender</dd></div>
                      <div><dt className="text-neutral-500">Penerima</dt><dd className="mt-1 text-neutral-900">{promotion.recipient_count.toLocaleString("id-ID")} owner</dd></div>
                      <div className="sm:col-span-2"><dt className="text-neutral-500">Periode signup (WIB, inklusif)</dt><dd className="mt-1 text-neutral-900">{formatPromotionDate(promotion.starts_on)} – {formatPromotionDate(promotion.ends_on)}</dd></div>
                    </dl>
                    <PromotionActions promotion={promotion} onDetail={() => setSelected(promotion)} onEdit={() => setEditor({ promotion })} />
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm xl:block">
                <table className="w-full text-sm">
                  <caption className="sr-only">Promosi signup owner, paket, periode kelayakan WIB, status, dan jumlah penerima.</caption>
                  <thead><tr className="border-b border-neutral-200">{["Promosi", "Paket / durasi", "Periode signup (WIB, inklusif)", "Penerima", "Status", "Aksi"].map((heading) => <th key={heading} scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">{heading}</th>)}</tr></thead>
                  <tbody>{promotions.map((promotion) => (
                    <tr key={promotion.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <th scope="row" className="max-w-xs break-words px-4 py-4 text-left font-semibold text-neutral-900">{promotion.name}</th>
                      <td className="px-4 py-4 text-neutral-900">{promotion.plan_name}<span className="mt-1 block text-xs text-neutral-500">{promotion.duration_months} bulan kalender</span></td>
                      <td className="px-4 py-4 text-neutral-600">{formatPromotionDate(promotion.starts_on)}<span className="block">s.d. {formatPromotionDate(promotion.ends_on)}</span></td>
                      <td className="px-4 py-4 tabular-nums text-neutral-900">{promotion.recipient_count.toLocaleString("id-ID")}</td>
                      <td className="px-4 py-4"><StatusBadge promotion={promotion} /></td>
                      <td className="px-4 py-4"><PromotionActions promotion={promotion} onDetail={() => setSelected(promotion)} onEdit={() => setEditor({ promotion })} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
      {editor && <PromotionEditor promotion={editor.promotion} plans={plans} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void loadPromotions(); }} />}
      {selected && <PromotionDetails promotion={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
