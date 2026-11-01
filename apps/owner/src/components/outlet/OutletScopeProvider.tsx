"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { OwnerDashboardOutlet } from "@rakku/shared-types";
import {
  useMerchantRequest,
  useMerchantRuntime,
  useMerchantToast,
} from "@/lib/merchant-runtime";

const ACTIVE_OUTLET_STORAGE_KEY = "rakku-active-outlet";

interface OutletScopeContextValue {
  outlets: OwnerDashboardOutlet[];
  activeOutletId: string | null;
  activeOutlet: OwnerDashboardOutlet | null;
  setActiveOutletId: (id: string | null) => void;
  refreshOutlets: () => Promise<void>;
}

const OutletScopeContext = createContext<OutletScopeContextValue | null>(null);

export function useOutletScope(): OutletScopeContextValue {
  const ctx = useContext(OutletScopeContext);
  if (!ctx) {
    throw new Error("useOutletScope harus dipakai di dalam OutletScopeProvider");
  }
  return ctx;
}

/**
 * Sumber tunggal daftar outlet + outlet aktif untuk seluruh shell owner.
 * Daftar awal diberikan server-side (layout/demo shell), mutasi lalu
 * memanggil refreshOutlets() agar semua halaman ikut segar.
 */
export default function OutletScopeProvider({
  initialOutlets,
  preferenceScope,
  children,
}: {
  initialOutlets: OwnerDashboardOutlet[];
  preferenceScope: string;
  children: React.ReactNode;
}) {
  const request = useMerchantRequest();
  const showToast = useMerchantToast();
  const runtime = useMerchantRuntime();
  const isActive = runtime?.active;
  const isDemo = Boolean(runtime);
  const storageKey = `${ACTIVE_OUTLET_STORAGE_KEY}:${preferenceScope}`;
  const [outlets, setOutlets] = useState(initialOutlets);
  const [previousInitial, setPreviousInitial] = useState(initialOutlets);
  if (previousInitial !== initialOutlets) {
    setPreviousInitial(initialOutlets);
    setOutlets(initialOutlets);
  }
  const [rawActiveId, setRawActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setRawActiveId(isDemo ? null : window.localStorage.getItem(storageKey));
    } catch {
      setRawActiveId(null);
    }
    setHydrated(true);
  }, [isDemo, storageKey]);

  const activeOutletId = useMemo(() => {
    if (hydrated && rawActiveId && outlets.some((o) => o.id === rawActiveId)) {
      return rawActiveId;
    }
    return outlets[0]?.id ?? null;
  }, [hydrated, rawActiveId, outlets]);

  const setActiveOutletId = useCallback((id: string | null) => {
    setRawActiveId(id);
    if (isDemo) return;
    try {
      if (id) {
        window.localStorage.setItem(storageKey, id);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Storage bisa gagal (private mode / kuota); pilihan tetap bekerja untuk sesi ini.
    }
  }, [isDemo, storageKey]);

  const refreshOutlets = useCallback(async () => {
    if (isActive?.() === false) return;
    try {
      const res = await request("/api/owner/outlets");
      if (isActive?.() === false) return;
      if (res.ok) {
        const data = await res.json();
        if (isActive?.() === false) return;
        setOutlets(data.outlets ?? []);
      }
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Gagal memuat data outlet");
    }
  }, [request, showToast, isActive]);

  const activeOutlet = useMemo(
    () => outlets.find((o) => o.id === activeOutletId) ?? null,
    [outlets, activeOutletId]
  );

  const value = useMemo<OutletScopeContextValue>(
    () => ({
      outlets,
      activeOutletId,
      activeOutlet,
      setActiveOutletId,
      refreshOutlets,
    }),
    [outlets, activeOutletId, activeOutlet, setActiveOutletId, refreshOutlets]
  );

  return (
    <OutletScopeContext.Provider value={value}>
      {children}
    </OutletScopeContext.Provider>
  );
}
