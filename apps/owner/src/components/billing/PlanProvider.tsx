"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { PlanFeatureKey, UsageSummary } from "@rakku/shared-types";
import UpgradeModal from "./UpgradeModal";

interface PlanContextValue {
  summary: UsageSummary;
  hasFeature: (feature: PlanFeatureKey) => boolean;
  openUpgrade: (message?: string) => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) {
    throw new Error("usePlan harus dipakai di dalam PlanProvider");
  }
  return ctx;
}

export default function PlanProvider({
  summary,
  children,
}: {
  summary: UsageSummary;
  children: React.ReactNode;
}) {
  const [message, setMessage] = useState<string | null>(null);

  const openUpgrade = useCallback((customMessage?: string) => {
    setMessage(customMessage ?? "Fitur ini tersedia di paket Pro.");
  }, []);

  const value = useMemo<PlanContextValue>(
    () => ({
      summary,
      hasFeature: (feature) => Boolean(summary.features?.[feature]),
      openUpgrade,
    }),
    [summary, openUpgrade]
  );

  return (
    <PlanContext.Provider value={value}>
      {children}
      {message !== null && (
        <UpgradeModal message={message} onClose={() => setMessage(null)} />
      )}
    </PlanContext.Provider>
  );
}
