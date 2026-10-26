"use client";

import { useEffect } from "react";
import type { OwnerDashboardOutlet } from "@rakku/shared-types";
import { Tabs } from "@rakku/ui";
import { MerchantLink as Link, useRouter, useSearchParams } from "@/lib/merchant-runtime";
import { useOutletScope } from "@/components/outlet/OutletScopeProvider";
import OutletInfoSection from "@/components/outlet/OutletInfoSection";
import OutletProductsSection from "@/components/outlet/OutletProductsSection";
import OutletIngredientsSection from "@/components/outlet/OutletIngredientsSection";
import OutletTablesSection from "@/components/outlet/OutletTablesSection";
import OutletChargesSection from "@/components/outlet/OutletChargesSection";
import OutletStaffSection from "@/components/outlet/OutletStaffSection";
import { Building2 } from "lucide-react";

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
  const searchParams = useSearchParams();
  const { outlets, setActiveOutletId } = useOutletScope();
  useEffect(() => { setActiveOutletId(outlet.id); }, [outlet.id, setActiveOutletId]);

  const live = outlets.find((o) => o.id === outlet.id) ?? outlet;
  const status = live.status;

  const resolveTab = (): TabKey => {
    for (const source of [searchParams.get("tab"), initialTab]) {
      if (source && (TAB_KEYS as readonly string[]).includes(source)) {
        return source as TabKey;
      }
    }
    return DEFAULT_TAB;
  };
  const tab = resolveTab();

  const changeTab = (key: string) => {
    if (!TAB_KEYS.includes(key as TabKey)) return;
    if (key === tab) return;
    router.replace(`/outlets/${outlet.id}?tab=${key}`);
  };

  const changeOutlet = (id: string) => {
    if (id === outlet.id) return;
    setActiveOutletId(id);
    router.replace(`/outlets/${id}?tab=${tab}`);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <Link
            href="/outlets"
            className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface mb-2 transition-colors"
          >
            ← Semua Outlet
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="font-display text-[1.65rem] leading-tight font-bold text-on-surface">
                {live.name}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                    status === "active"
                      ? "bg-success/10 text-success"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {status === "active" ? "Aktif" : "Nonaktif"}
                </span>
                {live.products_count !== undefined && (
                  <span className="text-xs text-on-surface-variant">
                    {live.products_count} produk · {live.tables_count ?? 0} meja ·{" "}
                    {live.employee_count} staf
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Switcher outlet */}
        {outlets.length > 1 && (
          <div className="relative w-full lg:w-auto lg:max-w-[240px]">
            <select
              value={outlet.id}
              onChange={(e) => changeOutlet(e.target.value)}
              aria-label="Ganti outlet"
              className="w-full min-h-11 appearance-none bg-surface-container-lowest border border-surface-container rounded-xl pl-4 pr-10 py-2.5 text-base md:text-sm font-semibold text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs">
              ▾
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 pb-1 -mx-1 px-1 overflow-x-auto">
        <Tabs
          active={tab}
          onChange={changeTab}
          tabs={TAB_KEYS.map((key) => ({ key, label: TAB_LABELS[key] }))}
        />
      </div>

      {/* Content */}
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
  );
}
