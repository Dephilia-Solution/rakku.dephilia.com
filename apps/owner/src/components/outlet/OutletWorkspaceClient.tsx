"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { OwnerDashboardOutlet } from "@rakku/shared-types";
import { MerchantLink as Link, useRouter, useSearchParams, useMerchantRuntime } from "@/lib/merchant-runtime";
import { useOutletScope } from "@/components/outlet/OutletScopeProvider";
import OutletInfoSection from "@/components/outlet/OutletInfoSection";
import { OwnerPageHeader, OwnerSkeleton } from "@/components/ui/OwnerPrimitives";
import { ArrowLeft, ChevronDown } from "lucide-react";

const loading = () => <OwnerSkeleton rows={3} />;
const OutletProductsSection = dynamic(() => import("./OutletProductsSection"), { loading });
const OutletIngredientsSection = dynamic(() => import("./OutletIngredientsSection"), { loading });
const OutletTablesSection = dynamic(() => import("./OutletTablesSection"), { loading });
const OutletChargesSection = dynamic(() => import("./OutletChargesSection"), { loading });
const OutletStaffSection = dynamic(() => import("./OutletStaffSection"), { loading });

const TAB_KEYS = ["info", "produk", "bahan", "meja", "pajak", "staf"] as const;
type TabKey = (typeof TAB_KEYS)[number];
const DEFAULT_TAB: TabKey = "produk";

const TAB_LABELS: Record<TabKey, string> = {
  info: "Informasi",
  produk: "Produk",
  bahan: "Bahan Baku",
  meja: "Meja",
  pajak: "Pajak & Diskon",
  staf: "Staf",
};

interface Props {
  outlet: OwnerDashboardOutlet;
  initialTab?: string;
}

/** Workspace per outlet: semua pengelolaan outlet dalam satu halaman. */
export default function OutletWorkspaceClient({ outlet, initialTab }: Props) {
  const router = useRouter();
  const runtime = useMerchantRuntime();
  const searchParams = useSearchParams();
  const { outlets, setActiveOutletId } = useOutletScope();
  useEffect(() => { setActiveOutletId(outlet.id); }, [outlet.id, setActiveOutletId]);

  const live = outlets.find((o) => o.id === outlet.id) ?? outlet;
  const status = live.status;

  const readTab = (search: string, fallback?: string): TabKey => {
    const selected = new URLSearchParams(search).get("tab") ?? fallback;
    return selected && (TAB_KEYS as readonly string[]).includes(selected) ? selected as TabKey : DEFAULT_TAB;
  };
  const [tab, setTabState] = useState<TabKey>(() => readTab(typeof window === "undefined" ? `?tab=${searchParams.get("tab") ?? initialTab ?? ""}` : window.location.search, initialTab));
  useEffect(() => {
    const sync = () => setTabState(readTab(window.location.search, initialTab));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [outlet.id, initialTab]);
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const navigation = navigationRef.current;
    const selected = navigation?.querySelector<HTMLElement>(`#outlet-tab-${tab}`);
    if (!navigation || !selected) return;
    const offset = selected.getBoundingClientRect().left - navigation.getBoundingClientRect().left;
    if (offset < 0) navigation.scrollLeft += offset;
    else if (offset + selected.offsetWidth > navigation.clientWidth) navigation.scrollLeft += offset + selected.offsetWidth - navigation.clientWidth;
  }, [tab]);

  const changeTab = (key: string) => {
    if (!TAB_KEYS.includes(key as TabKey)) return;
    if (key === tab) return;
    setTabState(key as TabKey);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    url.searchParams.delete("charge");
    window.history.replaceState(window.history.state, "", url);
  };

  const changeOutlet = (id: string) => {
    if (id === outlet.id) return;
    setActiveOutletId(id);
    router.replace(`/outlets/${id}?tab=${tab}`);
  };

  return (
    <div className="min-w-0">
      <OwnerPageHeader
        title={live.name}
        description="Kelola operasional dan pengaturan outlet dalam satu tempat."
        eyebrow={<Link href="/outlets" className="inline-flex min-h-11 items-center gap-2 hover:text-primary"><ArrowLeft size={15} />Semua Outlet</Link>}
        actions={outlets.length > 1 ? (
          <div className="relative w-full sm:w-64 sm:max-w-full">
            <select
              value={outlet.id}
              onChange={(e) => changeOutlet(e.target.value)}
              aria-label="Ganti outlet"
              className="w-full min-h-11 appearance-none bg-white border border-surface-container rounded-lg pl-4 pr-10 py-2.5 text-base text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          </div>
        ) : undefined}
      >
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold ${status === "active" ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-primary" : "bg-on-surface-variant"}`} />
            {status === "active" ? "Aktif" : "Nonaktif"}
          </span>
          {live.products_count !== undefined && <span className="tabular-nums">{live.products_count} produk · {live.tables_count ?? 0} meja · {live.employee_count} staf</span>}
        </div>
      </OwnerPageHeader>

      <div className="sticky top-0 z-20 mb-6 min-w-0 border-b border-surface-container bg-[#f6f8f7]/95 pt-1 backdrop-blur-sm">
        <nav ref={navigationRef} aria-label="Bagian outlet" className="max-w-full overflow-x-auto overscroll-x-contain">
          <div role="tablist" aria-label="Pengaturan outlet" className="flex w-max min-w-full gap-1">
            {TAB_KEYS.map((key) => <button key={key} type="button" role="tab" id={`outlet-tab-${key}`} aria-selected={tab === key} aria-controls="outlet-tab-content" tabIndex={tab === key ? 0 : -1}
              onClick={() => changeTab(key)}
              onKeyDown={(event) => {
                const index = TAB_KEYS.indexOf(key);
                const next = event.key === "ArrowRight" ? (index + 1) % TAB_KEYS.length : event.key === "ArrowLeft" ? (index + TAB_KEYS.length - 1) % TAB_KEYS.length : event.key === "Home" ? 0 : event.key === "End" ? TAB_KEYS.length - 1 : -1;
                if (next < 0) return;
                event.preventDefault();
                changeTab(TAB_KEYS[next]);
                document.getElementById(`outlet-tab-${TAB_KEYS[next]}`)?.focus();
              }}
              className={`min-h-12 shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
              {TAB_LABELS[key]}
            </button>)}
          </div>
        </nav>
      </div>

      <div id="outlet-tab-content" role="tabpanel" aria-labelledby={`outlet-tab-${tab}`} className="min-w-0">
      {tab === "info" && <OutletInfoSection key={outlet.id} outlet={live} />}
      {tab === "produk" && (
        <OutletProductsSection key={outlet.id} outletId={outlet.id} outletName={live.name} />
      )}
      {tab === "bahan" && (
        <OutletIngredientsSection key={outlet.id} outletId={outlet.id} outletName={live.name} />
      )}
      {tab === "meja" && (
        <OutletTablesSection key={outlet.id} outletId={outlet.id} outletName={live.name} />
      )}
      {tab === "pajak" && (
        <OutletChargesSection key={outlet.id} outletId={outlet.id} initialTab={searchParams.get("charge") ?? undefined} />
      )}
      {tab === "staf" && (
        <OutletStaffSection key={outlet.id} outletId={outlet.id} outletName={live.name} />
      )}
      </div>
    </div>
  );
}
