"use client";

import { useEffect, useState } from "react";
import { showToast } from "@rakku/ui";
import { BarChart3 } from "lucide-react";

interface AnalyticsData {
  totals: {
    qrisCount: number;
    qrisGross: number;
    mdr: number;
    saldoAvailable: number;
    saldoPending: number;
    withdrawnTotal: number;
    withdrawalPending: number;
  };
  month: {
    qrisCount: number;
    qrisGross: number;
    mdr: number;
  };
  daily: { date: string; gross: number; count: number }[];
}

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatShortDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/superadmin/payments-analytics");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat analytics");
        setData(json);
      } catch {
        showToast("error", "Gagal memuat analytics");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const daily = data?.daily ?? [];
  const maxGross = Math.max(1, ...daily.map((d) => d.gross));

  const cards = [
    { label: "Transaksi QRIS", value: String(data?.totals.qrisCount ?? 0) },
    { label: "Volume QRIS (gross)", value: formatRupiah(data?.totals.qrisGross ?? 0) },
    { label: "MDR terkumpul", value: formatRupiah(data?.totals.mdr ?? 0) },
    { label: "Saldo tersedia", value: formatRupiah(data?.totals.saldoAvailable ?? 0) },
    { label: "Saldo pending", value: formatRupiah(data?.totals.saldoPending ?? 0) },
    { label: "Total ditarik", value: formatRupiah(data?.totals.withdrawnTotal ?? 0) },
    { label: "Pencairan menunggu", value: String(data?.totals.withdrawalPending ?? 0) },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-neutral-900">
          Analytics
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Volume pembayaran QRIS, MDR, saldo, dan pencairan.
        </p>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-neutral-400">
          Memuat data...
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((card) => (
              <div key={card.label} className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs text-neutral-400 uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-xl font-bold text-neutral-900 mt-1">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wider">
                QRIS bulan ini
              </p>
              <p className="text-xl font-bold text-neutral-900 mt-1">
                {data?.month.qrisCount ?? 0} transaksi
              </p>
            </div>
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wider">
                Volume bulan ini
              </p>
              <p className="text-xl font-bold text-neutral-900 mt-1">
                {formatRupiah(data?.month.qrisGross ?? 0)}
              </p>
            </div>
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wider">
                MDR bulan ini
              </p>
              <p className="text-xl font-bold text-neutral-900 mt-1">
                {formatRupiah(data?.month.mdr ?? 0)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-forest" />
              <h2 className="font-display font-semibold text-base text-neutral-900">
                Volume QRIS 14 Hari Terakhir
              </h2>
            </div>

            {daily.every((d) => d.gross === 0) ? (
              <p className="py-8 text-center text-sm text-neutral-400">
                Belum ada pembayaran QRIS dinamis pada periode ini.
              </p>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {daily.map((day) => (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
                    title={`${formatShortDate(day.date)}: ${formatRupiah(
                      day.gross
                    )} (${day.count} transaksi)`}
                  >
                    <span className="text-[9px] text-neutral-400">
                      {day.count > 0 ? day.count : ""}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-forest/80 hover:bg-forest transition-colors"
                      style={{
                        height: `${Math.max(
                          day.gross > 0 ? 4 : 0,
                          Math.round((day.gross / maxGross) * 100)
                        )}%`,
                      }}
                    />
                    <span className="text-[9px] text-neutral-400 whitespace-nowrap">
                      {formatShortDate(day.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
