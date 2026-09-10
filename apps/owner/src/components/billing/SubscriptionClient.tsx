"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@rakku/ui";
import { Check, Sparkles } from "lucide-react";
import type {
  Plan,
  PlanFeatureKey,
  PlanLimitKey,
  SubscriptionInvoice,
  UsageSummary,
} from "@rakku/shared-types";

interface InvoiceRow extends SubscriptionInvoice {
  plans?: { name: string } | { name: string }[] | null;
}

const LIMIT_ROWS: { key: PlanLimitKey; label: string }[] = [
  { key: "outlets", label: "Outlet" },
  { key: "employees", label: "Karyawan" },
  { key: "products", label: "Produk" },
  { key: "ingredients", label: "Bahan baku" },
  { key: "transactions", label: "Transaksi bulan ini" },
];

const FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  multi_outlet: "Multi-outlet & filter lintas outlet",
  custom_roles: "Role custom + access matrix",
  profit_loss: "Laporan laba rugi (HPP)",
  email_reports: "Kirim laporan via email",
  inventory_advanced: "Pembelian, opname, alert stok",
  remove_qr_branding: "QR menu tanpa branding Rakku",
  audit_log: "Audit log tenant",
  priority_support: "Prioritas support",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  success: "Berhasil",
  expired: "Kadaluarsa",
  failed: "Gagal",
  cancelled: "Dibatalkan",
};

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatLimit(value: number) {
  return value < 0 ? "Unlimited" : String(value);
}

function invoicePlanName(invoice: InvoiceRow): string {
  if (!invoice.plans) return "-";
  const plan = Array.isArray(invoice.plans) ? invoice.plans[0] : invoice.plans;
  return plan?.name ?? "-";
}

function statusLabel(summary: UsageSummary) {
  if (summary.is_trial) return "Trial Pro";
  if (summary.status === "grace") return "Masa tenggang";
  if (summary.status === "expired") return "Berakhir";
  if (summary.status === "cancelled") return "Dibatalkan";
  return "Aktif";
}

export default function SubscriptionClient({
  summary,
  plans,
  invoices,
}: {
  summary: UsageSummary;
  plans: Plan[];
  invoices: InvoiceRow[];
}) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const trialDays =
    now && summary.trial_ends_at
      ? Math.max(
          0,
          Math.ceil((new Date(summary.trial_ends_at).getTime() - now) / 86_400_000)
        )
      : null;

  const handleChoose = async (plan: Plan) => {
    if (plan.slug === "free") {
      showToast("info", "Paket Free tidak memerlukan pembayaran.");
      return;
    }
    if (plan.slug === summary.plan.slug && summary.status === "active") {
      showToast("info", "Paket ini sedang aktif.");
      return;
    }

    setCheckingOut(plan.slug);
    try {
      const res = await fetch("/api/owner/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_slug: plan.slug, billing_cycle: cycle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.invoice?.id) {
        showToast("error", data.error || "Gagal membuat pembayaran");
        return;
      }
      router.push(`/subscription/checkout/${data.invoice.id}`);
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
    } finally {
      setCheckingOut(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Langganan</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Paket aktif, pemakaian kuota, dan pilihan upgrade.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Paket aktif
            </p>
            <div className="flex items-center gap-2 mt-1">
              <h2 className="text-xl font-bold text-neutral-900">
                {summary.plan.name}
              </h2>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary-100 text-forest">
                {statusLabel(summary)}
              </span>
            </div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            {summary.is_trial && summary.trial_ends_at ? (
              <p>
                Trial berakhir{" "}
                {new Date(summary.trial_ends_at).toLocaleDateString("id-ID")}
                {trialDays !== null ? ` (${trialDays} hari lagi)` : ""}
              </p>
            ) : summary.plan_expires_at ? (
              <p>
                Aktif sampai{" "}
                {new Date(summary.plan_expires_at).toLocaleDateString("id-ID")}
              </p>
            ) : (
              <p>Tanpa tanggal berakhir</p>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          {LIMIT_ROWS.map(({ key, label }) => {
            const max = summary.limits[key];
            const used = summary.usage[key];
            const unlimited = max < 0;
            const percent = unlimited
              ? 0
              : Math.min(100, Math.round((used / Math.max(1, max)) * 100));
            const danger = !unlimited && percent >= 100;
            const warning = !unlimited && percent >= 80;

            return (
              <div key={key} className="rounded-xl bg-neutral-50 p-3">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>{label}</span>
                  <span className={danger ? "text-danger font-semibold" : warning ? "text-warning font-semibold" : ""}>
                    {used} / {formatLimit(max)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-200 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      danger ? "bg-danger" : warning ? "bg-warning" : "bg-forest"
                    }`}
                    style={{ width: unlimited ? "0%" : `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {summary.transaction_grace_ends_at ? (
          <p className="text-xs text-amber-700 mt-4">
            Masa tenggang transaksi sampai{" "}
            {new Date(summary.transaction_grace_ends_at).toLocaleDateString(
              "id-ID"
            )}{" "}
            — setelah itu transaksi baru diblokir sampai upgrade.
          </p>
        ) : null}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-display font-semibold text-lg text-neutral-900">
            Pilihan paket
          </h2>
          <div className="inline-flex rounded-xl bg-neutral-100 p-1">
            {(
              [
                { value: "monthly", label: "Bulanan" },
                { value: "yearly", label: "Tahunan (hemat 2 bln)" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                onClick={() => setCycle(option.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  cycle === option.value
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const current =
              plan.slug === summary.plan.slug &&
              summary.status !== "expired" &&
              !summary.is_trial;
            const price =
              cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
            const featureKeys = Object.keys(FEATURE_LABELS) as PlanFeatureKey[];

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border p-5 flex flex-col ${
                  current ? "border-forest shadow-sm" : "border-neutral-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-base text-neutral-900">
                    {plan.name}
                  </h3>
                  {current ? (
                    <span className="text-[11px] font-semibold text-forest bg-primary-100 px-2 py-0.5 rounded-full">
                      Aktif
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-neutral-500 mt-1 min-h-[32px]">
                  {plan.description}
                </p>
                <p className="mt-3 text-xl font-bold text-neutral-900">
                  {price === 0 ? "Gratis" : formatRupiah(price)}
                  {price > 0 ? (
                    <span className="text-xs font-normal text-neutral-500">
                      /{cycle === "yearly" ? "tahun" : "bln"}
                    </span>
                  ) : null}
                </p>

                <ul className="mt-4 space-y-1.5 text-xs text-neutral-600 flex-1">
                  <li>
                    {formatLimit(plan.max_outlets)} outlet ·{" "}
                    {formatLimit(plan.max_employees)} karyawan
                  </li>
                  <li>
                    {formatLimit(plan.max_products)} produk ·{" "}
                    {formatLimit(plan.max_ingredients)} bahan
                  </li>
                  <li>
                    {formatLimit(plan.max_transactions_month)} transaksi/bulan
                  </li>
                  {featureKeys
                    .filter((key) => plan.features?.[key])
                    .map((key) => (
                      <li key={key} className="flex items-start gap-1.5">
                        <Check size={13} className="text-forest mt-0.5 shrink-0" />
                        {FEATURE_LABELS[key]}
                      </li>
                    ))}
                </ul>

                <button
                  onClick={() => handleChoose(plan)}
                  disabled={current || checkingOut !== null || plan.slug === "free"}
                  className={`mt-4 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 ${
                    current || plan.slug === "free"
                      ? "bg-neutral-100 text-neutral-400 cursor-default"
                      : "bg-forest text-white hover:bg-forest-dark"
                  }`}
                >
                  {!current && plan.slug !== "free" ? <Sparkles size={15} /> : null}
                  {plan.slug === "free"
                    ? "Paket dasar"
                    : current
                      ? "Paket aktif"
                      : checkingOut === plan.slug
                        ? "Membuat QR..."
                        : `Bayar ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          Pembayaran via QRIS (Vessel). Setelah dibayar, paket aktif otomatis.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="font-display font-semibold text-base text-neutral-900">
            Riwayat Invoice
          </h2>
        </div>
        {invoices.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-400">
            Belum ada invoice.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400 uppercase tracking-wider">
                  <th className="px-5 py-3">No. Invoice</th>
                  <th className="px-5 py-3">Paket</th>
                  <th className="px-5 py-3">Siklus</th>
                  <th className="px-5 py-3 text-right">Nominal</th>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-neutral-50 text-sm">
                    <td className="px-5 py-3 font-mono text-xs">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-5 py-3">{invoicePlanName(invoice)}</td>
                    <td className="px-5 py-3 capitalize">
                      {invoice.billing_cycle === "yearly" ? "Tahunan" : "Bulanan"}
                    </td>
                    <td className="px-5 py-3 text-right font-mono">
                      {formatRupiah(invoice.amount)}
                    </td>
                    <td className="px-5 py-3 text-neutral-500">
                      {new Date(invoice.created_at).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          invoice.status === "success"
                            ? "bg-primary-100 text-forest"
                            : invoice.status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
