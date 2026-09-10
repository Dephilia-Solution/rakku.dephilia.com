"use client";

import { AlertTriangle, TrendingUp } from "lucide-react";
import { usePlan } from "./PlanProvider";

export default function LimitBanner() {
  const { summary, upgradeUrl } = usePlan();

  const max = summary.limits.transactions;
  if (max < 0) return null;

  const used = summary.usage.transactions;
  const percent = Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const graceEndsAt = summary.transaction_grace_ends_at;

  const wrapper =
    "mx-4 mt-4 rounded-xl border px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 lg:mx-8";

  if (used >= max) {
    const blocked = !graceEndsAt || new Date(graceEndsAt).getTime() < Date.now();
    return (
      <div
        className={`${wrapper} ${
          blocked
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-amber-50 border-amber-200 text-amber-800"
        }`}
      >
        <AlertTriangle size={18} className="shrink-0" />
        <div className="flex-1">
          <b>Kuota transaksi habis ({used}/{max}).</b>{" "}
          {blocked
            ? "Transaksi baru diblokir. Upgrade paket untuk lanjut berjualan."
            : `Masih bisa berjualan sampai masa tenggang berakhir${
                graceEndsAt
                  ? ` (${new Date(graceEndsAt).toLocaleDateString("id-ID")})`
                  : ""
              }.`}
        </div>
        <a
          href={upgradeUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700 text-center"
        >
          Upgrade
        </a>
      </div>
    );
  }

  if (percent >= 80) {
    return (
      <div className={`${wrapper} bg-amber-50 border-amber-200 text-amber-800`}>
        <TrendingUp size={18} className="shrink-0" />
        <div className="flex-1">
          <b>Kuota transaksi hampir penuh:</b> {used}/{max} bulan ini.
        </div>
        <a
          href={upgradeUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700 text-center"
        >
          Upgrade
        </a>
      </div>
    );
  }

  return null;
}
