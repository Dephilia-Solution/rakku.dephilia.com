"use client";

import { useEffect, useState } from "react";
import { MerchantLink as Link } from "@/lib/merchant-runtime";
import { AlertTriangle, Clock, X } from "lucide-react";
import { usePlan } from "./PlanProvider";
import type { PlanLimitKey } from "@rakku/shared-types";

const LIMIT_LABEL: Record<PlanLimitKey, string> = {
  outlets: "outlet",
  employees: "karyawan",
  products: "produk",
  ingredients: "bahan baku",
  transactions: "transaksi bulan ini",
};
const TRIAL_NOTICE_SESSION_KEY = "rakku-trial-notice-shown";

export default function PlanBanner() {
  const { summary } = usePlan();
  const [now, setNow] = useState<number | null>(null);
  const [showTrialNotice, setShowTrialNotice] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!summary.is_trial) return;

    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(TRIAL_NOTICE_SESSION_KEY) === "1";
      if (!alreadyShown) window.sessionStorage.setItem(TRIAL_NOTICE_SESSION_KEY, "1");
    } catch {
      alreadyShown = false;
    }

    if (alreadyShown) return;
    const timer = window.setTimeout(() => setShowTrialNotice(true), 0);
    return () => window.clearTimeout(timer);
  }, [summary.is_trial]);

  const wrapper =
    "mb-4 rounded-xl border px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4";

  if (summary.is_trial) {
    if (!showTrialNotice) return null;

    const daysLeft =
      now && summary.trial_ends_at
        ? Math.max(
            0,
            Math.ceil(
              (new Date(summary.trial_ends_at).getTime() - now) / 86_400_000
            )
          )
        : null;

    return (
      <div className={`${wrapper} relative bg-primary-50 border-primary-100 text-forest pr-11`}>
        <Clock size={18} className="shrink-0" />
        <div className="flex-1">
          <b>Trial Pro aktif.</b>{" "}
          {daysLeft !== null
            ? `Sisa ${daysLeft} hari lagi.`
            : "Nikmati semua fitur Pro."}{" "}
          Setelah berakhir, akun otomatis turun ke paket Free.
        </div>
        <Link
          href="/subscription"
          className="shrink-0 rounded-lg bg-forest text-white px-3 py-1.5 text-xs font-semibold hover:bg-forest-dark text-center"
        >
          Lihat paket
        </Link>
        <button
          type="button"
          onClick={() => setShowTrialNotice(false)}
          aria-label="Tutup informasi trial"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-forest/70 transition-colors hover:bg-primary-100 hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (summary.status === "expired" || summary.status === "grace") {
    return (
      <div className={`${wrapper} bg-amber-50 border-amber-200 text-amber-800`}>
        <AlertTriangle size={18} className="shrink-0" />
        <div className="flex-1">
          <b>Langganan berakhir.</b>{" "}
          {summary.status === "grace" && summary.grace_ends_at
            ? "Masa tenggang aktif — segera perpanjang."
            : "Akun berjalan dengan paket Free."}
        </div>
        <Link
          href="/subscription"
          className="shrink-0 rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700 text-center"
        >
          Perpanjang
        </Link>
      </div>
    );
  }

  const nearLimit = (
    Object.keys(LIMIT_LABEL) as PlanLimitKey[]
  ).filter((key) => {
    const max = summary.limits[key];
    if (max < 0) return false;
    return summary.usage[key] >= Math.floor(max * 0.8);
  });

  if (nearLimit.length === 0) return null;

  return (
    <div className={`${wrapper} bg-amber-50 border-amber-200 text-amber-800`}>
      <AlertTriangle size={18} className="shrink-0" />
      <div className="flex-1">
        <b>Kuota hampir penuh:</b>{" "}
        {nearLimit
          .map((key) => {
            const max = summary.limits[key];
            return `${LIMIT_LABEL[key]} ${summary.usage[key]}/${max}`;
          })
          .join(" · ")}
        .
      </div>
      <Link
        href="/subscription"
        className="shrink-0 rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700 text-center"
      >
        Upgrade
      </Link>
    </div>
  );
}
