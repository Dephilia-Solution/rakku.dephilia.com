"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { usePlan } from "./PlanProvider";
import type { PlanLimitKey } from "@rakku/shared-types";

const LIMIT_LABEL: Record<PlanLimitKey, string> = {
  outlets: "outlet",
  employees: "karyawan",
  products: "produk",
  ingredients: "bahan baku",
  transactions: "transaksi bulan ini",
};

export default function PlanBanner() {
  const { summary } = usePlan();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const wrapper =
    "mb-4 rounded-xl border px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4";

  if (summary.is_trial) {
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
      <div className={`${wrapper} bg-primary-50 border-primary-100 text-forest`}>
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
