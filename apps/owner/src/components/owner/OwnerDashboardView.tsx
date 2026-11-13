"use client";

import { useEffect, useState } from "react";
import type { OwnerDashboardAnalytics, OwnerDashboardRange } from "@rakku/shared-types";
import { MerchantLink as Link, useMerchantRequest, useMerchantRuntime } from "@/lib/merchant-runtime";
import { useOutletScope } from "@/components/outlet/OutletScopeProvider";
import { usePlan } from "@/components/billing/PlanProvider";
import { OwnerEmpty, OwnerError, OwnerPageHeader, OwnerSection, OwnerSkeleton } from "@/components/ui/OwnerPrimitives";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, RefreshCw } from "lucide-react";

export interface OwnerDashboardViewProps { owner: { name: string }; initialAnalytics: OwnerDashboardAnalytics }
const money = (value: number) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
const number = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
const shortDate = (date: string) => new Date(`${date}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
const paymentLabels: Record<string, string> = { cash: "Tunai", qris: "QRIS", card: "Kartu", later: "Bayar nanti", unknown: "Lainnya" };
const queryKey = (range: string, outlet: string) => `${range}:${outlet}`;

/** Both merchant and public demo use this presentation; only the request adapter differs. */
export function OwnerDashboardView({ owner, initialAnalytics }: OwnerDashboardViewProps) {
  const request = useMerchantRequest();
  const runtime = useMerchantRuntime();
  const { outlets } = useOutletScope();
  const { summary } = usePlan();
  const [range, setRange] = useState<OwnerDashboardRange>(initialAnalytics.range);
  const [outletId, setOutletId] = useState(initialAnalytics.outletId);
  const [attempt, setAttempt] = useState(0);
  const key = `${queryKey(range, outletId)}:${attempt}`;
  const initialKey = `${queryKey(initialAnalytics.range, initialAnalytics.outletId)}:0`;
  const [result, setResult] = useState<{ key: string; data?: OwnerDashboardAnalytics; error?: string } | null>(null);
  useEffect(() => {
    if (key === initialKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ range, outlet_id: outletId });
    void (async () => {
      try {
        const response = await request(`/api/owner/dashboard?${params}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (controller.signal.aborted || runtime?.active() === false) return;
        setResult(response.ok ? { key, data } : { key, error: data.error ?? "Dashboard belum dapat dimuat." });
      } catch {
        if (!controller.signal.aborted && runtime?.active() !== false) setResult({ key, error: "Dashboard belum dapat dimuat. Periksa koneksi dan coba lagi." });
      }
    })();
    return () => controller.abort();
  }, [key, initialKey, range, outletId, request, runtime, initialAnalytics.generatedAt]);
  const resolved = key === initialKey ? { data: initialAnalytics, error: undefined } : result?.key === key ? result : null;
  const data = resolved?.data;
  const loading = !resolved;
  const reportsHref = `/reports?range=${range}&outlet=${encodeURIComponent(outletId === "all" ? "" : outletId)}`;
  return <div className="space-y-6">
    <OwnerPageHeader title={`Halo, ${owner.name}!`} eyebrow="Ringkasan bisnis" description="Penjualan, performa outlet, dan hal yang perlu Anda tindak lanjuti."
      actions={<button type="button" className="owner-button owner-button--secondary" disabled={loading} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Perbarui</button>} />
    <div className="owner-dashboard-filters">
      <div aria-label="Periode dashboard" className="flex min-w-0 gap-1 rounded-xl border border-surface-container bg-white p-1">
        {([ ["today", "Hari ini"], ["week", "7 hari"], ["month", "Bulan ini"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)} className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${range === value ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container-low"}`}>{label}</button>)}
      </div>
      <select value={outletId} onChange={event => setOutletId(event.target.value)} aria-label="Outlet dashboard" className="min-h-12 min-w-0 rounded-xl border border-surface-container bg-white px-4 text-base sm:max-w-xs">
        <option value="all">Seluruh outlet</option>{outlets.map(outlet => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
      </select>
      <span className="text-xs text-on-surface-variant sm:ml-auto">Zona waktu WIB · Order selesai</span>
    </div>
    {resolved?.error && <OwnerError message={resolved.error} retry={() => setAttempt(value => value + 1)} />}
    {loading && <><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0,1,2,3].map(value => <div key={value} className="owner-panel"><OwnerSkeleton rows={1} /></div>)}</div><div className="owner-panel min-h-[340px]"><OwnerSkeleton rows={3} /></div></>}
    {data && <>
      <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
        <Metric label="Penjualan" value={money(data.summary.revenue)} change={data.summary.changePercent.revenue} href={reportsHref} primary />
        <Metric label="Transaksi selesai" value={number(data.summary.transactions)} change={data.summary.changePercent.transactions} href={reportsHref} />
        <Metric label="Rata-rata transaksi" value={money(data.summary.averageOrder)} change={data.summary.changePercent.averageOrder} href={reportsHref} />
        <Metric label="Outlet aktif" value={`${data.outletCounts.active} / ${data.outletCounts.total}`} note="Status administratif outlet" href="/outlets" />
      </div>
      <details className="text-xs leading-relaxed text-on-surface-variant"><summary className="min-h-11 cursor-pointer py-3">{data.period.label} · {shortDate(data.trend[0]?.date ?? data.period.start.slice(0, 10))}–{shortDate(data.trend.at(-1)?.date ?? data.period.start.slice(0,10))} · Cara angka dihitung</summary><p className="max-w-3xl pb-3">Penjualan adalah total order selesai setelah diskon, termasuk pajak; bukan rekonsiliasi uang masuk. Perbandingan memakai periode sebelumnya dengan jumlah hari yang sama{!data.period.previousAvailable ? " (tidak tersedia dalam batas histori paket)" : ""}.</p></details>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <OwnerSection title="Tren penjualan" description="Total penjualan dan transaksi per tanggal, termasuk hari tanpa penjualan." actions={<Link className="owner-button owner-button--quiet" href={reportsHref}>Lihat laporan<ArrowRight size={14} /></Link>}>
          <SalesTrend data={data} />
        </OwnerSection>
        <OwnerSection title="Produk terlaris" description="Diurutkan berdasarkan jumlah unit terjual dalam periode ini.">
          {!data.topProducts.length ? <OwnerEmpty title="Belum ada produk terjual" description="Produk terlaris akan muncul setelah ada transaksi selesai." /> : <ol className="divide-y divide-surface-container">{data.topProducts.map((product, index) => <li key={product.name} className="flex min-w-0 items-center gap-3 py-4"><span className="text-xs tabular-nums text-on-surface-variant">{String(index+1).padStart(2,"0")}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{product.name}</p><p className="mt-1 text-xs text-on-surface-variant">{number(product.quantity)} unit terjual</p></div><span className="text-xs font-semibold tabular-nums">{money(product.revenue)}</span></li>)}</ol>}
          <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">Nilai produk memakai subtotal item; belum termasuk pajak/diskon tingkat order.</p>
        </OwnerSection>
      </div>
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2">
        <OwnerSection title="Performa outlet" description="Status aktif berasal dari pengaturan outlet, bukan indikator perangkat online.">
          {!data.outlets.length ? <OwnerEmpty title="Belum ada outlet" description="Tambahkan outlet untuk mulai melihat performa bisnis." action={<Link href="/outlets" className="owner-button owner-button--primary">Kelola outlet</Link>} /> : <div className="space-y-4">{data.outlets.map(outlet => <Link key={outlet.id} href={`/outlets/${outlet.id}`} className="block rounded-lg py-2 focus-visible:outline-primary"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold break-words">{outlet.name}</p><p className="mt-1 text-xs text-on-surface-variant">{number(outlet.transactions)} transaksi · {outlet.status === "active" ? "Aktif" : "Nonaktif"}</p></div><span className="text-sm font-semibold tabular-nums">{money(outlet.revenue)}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container-low"><div className="h-full rounded-full bg-primary/70" style={{ width: `${data.summary.revenue ? outlet.revenue/data.summary.revenue*100 : 0}%` }} /></div></Link>)}</div>}
        </OwnerSection>
        <OwnerSection title="Metode pembayaran" description="Nilai order menurut metode pembayaran utama; bukan alokasi split bill atau saldo yang diterima.">
          {!data.payments.length ? <OwnerEmpty title="Belum ada pembayaran" description="Distribusi metode muncul dari order selesai pada periode terpilih." /> : <ul className="divide-y divide-surface-container">{data.payments.map(payment => <li key={payment.method} className="flex items-center justify-between gap-3 py-4"><div><p className="text-sm font-semibold">{paymentLabels[payment.method]}</p><p className="mt-1 text-xs text-on-surface-variant">{number(payment.transactions)} transaksi</p></div><div className="text-right"><p className="text-sm font-semibold tabular-nums">{money(payment.revenue)}</p><p className="mt-1 text-xs text-on-surface-variant">{data.summary.revenue ? number(payment.revenue / data.summary.revenue * 100) : 0}% penjualan</p></div></li>)}</ul>}
        </OwnerSection>
      </div>
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <OwnerSection title="Perlu perhatian" description={`${data.lowStockTotal} bahan mencapai stok minimum. Snapshot stok saat ini, mengikuti outlet terpilih.`}>
          {!data.lowStock.length ? <OwnerEmpty title="Stok berada di atas batas minimum" description="Bahan aktif dengan stok rendah akan muncul di sini." /> : <ul className="divide-y divide-surface-container">{data.lowStock.slice(0,6).map(item => <li key={item.id}><Link href={`/outlets/${item.outletId}?tab=bahan`} className="flex min-h-16 items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-on-surface-variant">{item.outletName} · Minimum {number(item.minimum)} {item.unit}</p></div><div className="flex items-center gap-2"><span className={`text-sm font-semibold tabular-nums ${item.quantity <= 0 ? "text-error" : "text-amber-800"}`}>{number(item.quantity)} {item.unit}</span><ChevronRight size={15} /></div></Link></li>)}</ul>}
          {data.lowStockTotal > 6 && <Link href="/outlets" className="owner-button owner-button--quiet mt-3">Lihat bahan di seluruh outlet<ArrowRight size={14} /></Link>}
        </OwnerSection>
        <div className="space-y-5">
          <OwnerSection title="Pembelian bahan" description="Berdasarkan tanggal pembelian pada periode terpilih.">
            {data.purchases ? <><strong className="block text-2xl font-bold tracking-tight tabular-nums">{money(data.purchases.total)}</strong><p className="mt-2 text-sm text-on-surface-variant">{number(data.purchases.count)} pembelian tercatat</p><Link href={outletId !== "all" ? `/outlets/${outletId}?tab=bahan` : "/outlets"} className="owner-button owner-button--quiet mt-4">Kelola pembelian<ArrowRight size={14} /></Link></> : <p className="text-sm text-on-surface-variant">Ringkasan pembelian tersedia pada paket dengan inventori lanjutan. <Link href="/subscription" className="inline-flex min-h-11 items-center font-semibold text-primary">Lihat paket</Link></p>}
          </OwnerSection>
          <OwnerSection title={`Paket ${summary.plan.name}`} description="Kuota perusahaan, tidak mengikuti filter dashboard.">
            <p className="text-sm text-on-surface-variant"><strong className="font-semibold text-on-surface">{number(summary.usage.transactions)}</strong> / {summary.limits.transactions < 0 ? "tanpa batas" : number(summary.limits.transactions)} transaksi bulan ini</p>
            <Link href="/subscription" className="owner-button owner-button--secondary mt-4">Detail langganan<ArrowRight size={14} /></Link>
          </OwnerSection>
        </div>
      </div>
    </>}
  </div>;
}

function Metric({ label, value, change, href, primary, note }: { label: string; value: string; change?: number | null; href: string; primary?: boolean; note?: string }) {
  return <Link href={href} className={`owner-panel block transition-colors hover:border-primary/40 ${primary ? "!border-primary/20 !bg-[#eef6ef]" : ""}`}>
    <div className="flex items-start justify-between gap-2"><p className="text-xs sm:text-sm text-on-surface-variant">{label}</p><ArrowUpRight size={16} className="shrink-0 text-on-surface-variant" /></div>
    <p className={`mt-4 break-words text-[clamp(1.25rem,2.1vw,1.8rem)] font-bold leading-tight tracking-tight tabular-nums ${primary ? "text-primary" : "text-on-surface"}`}>{value}</p>
    <div className="mt-3 flex flex-wrap items-center gap-1 text-[11px] leading-relaxed text-on-surface-variant">{note ?? (change == null ? "Belum ada pembanding" : <><span className={`inline-flex items-center font-semibold ${change < 0 ? "text-error" : "text-primary"}`}>{change < 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}{number(Math.abs(change))}%</span><span>vs periode sebelumnya</span></>)}</div>
  </Link>;
}

export function SalesTrend({ data }: { data: OwnerDashboardAnalytics }) {
  const [metric, setMetric] = useState<"revenue" | "transactions">("revenue");
  const [selected, setSelected] = useState<number | null>(null);
  const values = data.trend;
  const maximum = Math.max(1,...values.map(row => row[metric]));
  const xy = (index: number) => [values.length === 1 ? 350 : 20 + index / (values.length-1)*660, 190-values[index][metric]/maximum*165];
  const points = values.map((_, index) => xy(index).join(",")).join(" ");
  const current = selected !== null ? values[selected] : null;
  return <div>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-on-surface-variant">Puncak: {metric === "revenue" ? money(maximum === 1 && !data.summary.revenue ? 0 : maximum) : number(maximum === 1 && !data.summary.transactions ? 0 : maximum)}</p><div className="flex gap-1">{([ ["revenue","Penjualan"], ["transactions","Transaksi"] ] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={metric===value} onClick={() => {setMetric(value);setSelected(null);}} className={`rounded-lg px-3 text-xs font-semibold ${metric===value?"bg-primary/10 text-primary":"text-on-surface-variant"}`}>{label}</button>)}</div></div>
    <svg viewBox="0 0 700 220" role="group" aria-label="Grafik harian, fokus pada titik untuk membaca nilai" className="h-[210px] w-full overflow-visible" onPointerLeave={() => setSelected(null)}>
      {[25,80,135,190].map(y=><line key={y} x1="20" x2="680" y1={y} y2={y} stroke="#e7ede8" strokeDasharray="4 5" />)}
      {values.length > 1 && <polygon points={`20,190 ${points} 680,190`} fill="#2e7d32" opacity=".05" />}
      <polyline points={points} fill="none" stroke="#2e7d32" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {values.map((row,index) => {const [x,y]=xy(index);return <g key={row.date} tabIndex={0} role="img" aria-label={`${shortDate(row.date)}: ${money(row.revenue)}, ${row.transactions} transaksi`} onFocus={()=>setSelected(index)} onBlur={()=>setSelected(null)} onPointerEnter={()=>setSelected(index)}>
        <circle cx={x} cy={y} r={15} fill="transparent" /><circle cx={x} cy={y} r={selected===index||values.length===1?5:3} fill="#2e7d32" stroke="white" strokeWidth="2" /><title>{`${shortDate(row.date)}: ${money(row.revenue)} · ${row.transactions} transaksi`}</title>
      </g>;})}
    </svg>
    <div className="flex justify-between text-[11px] text-on-surface-variant">{values.filter((_,index)=>index===0 || index===values.length-1 || values.length>4 && index===Math.floor(values.length/2)).map(row=><span key={row.date}>{shortDate(row.date)}</span>)}</div>
    <select aria-label="Detail tanggal grafik" value={selected ?? ""} onChange={event=>setSelected(event.target.value === "" ? null : Number(event.target.value))} className="mt-3 min-h-11 w-full rounded-lg border border-surface-container bg-white px-3 text-base md:hidden"><option value="">Pilih tanggal untuk melihat detail</option>{values.map((row,index)=><option key={row.date} value={index}>{shortDate(row.date)} · {metric === "revenue" ? money(row.revenue) : `${row.transactions} transaksi`}</option>)}</select>
    <p aria-live="polite" className="mt-4 min-h-10 rounded-lg bg-surface-container-low px-3 py-2 text-xs leading-relaxed text-on-surface-variant">{current ? `${shortDate(current.date)} · ${money(current.revenue)} · ${number(current.transactions)} transaksi` : "Arahkan, sentuh, atau fokus pada titik grafik untuk melihat rinciannya."}</p>
    {!data.summary.transactions && <p className="mt-3 text-sm text-on-surface-variant">Belum ada transaksi selesai pada periode ini.</p>}
  </div>;
}
