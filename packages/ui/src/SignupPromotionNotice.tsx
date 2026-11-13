"use client";

import { useEffect, useState } from "react";
import {
  formatPromotionDate,
  isPromotionDate,
  isSignupPromotionOpen,
  type PublicSignupPromotion,
} from "@rakku/shared-types";

export interface SignupPromotionNoticeProps {
  endpoint?: string;
  className?: string;
  variant?: "default" | "compact" | "plan";
  /** Restrict a plan-specific placement to a matching campaign. */
  planName?: string;
}

function isPublicSignupPromotion(value: unknown): value is PublicSignupPromotion {
  if (!value || typeof value !== "object") return false;
  const promotion = value as Record<string, unknown>;
  return typeof promotion.id === "string" && promotion.id.trim().length > 0
    && typeof promotion.name === "string" && promotion.name.trim().length > 0
    && typeof promotion.plan_name === "string" && promotion.plan_name.trim().length > 0
    && typeof promotion.duration_months === "number"
    && Number.isInteger(promotion.duration_months)
    && promotion.duration_months >= 1 && promotion.duration_months <= 24
    && isPromotionDate(promotion.starts_on) && isPromotionDate(promotion.ends_on)
    && promotion.starts_on <= promotion.ends_on
    && typeof promotion.terms === "string";
}

export default function SignupPromotionNotice({
  endpoint = "/api/public/signup-promotion",
  className = "",
  variant = "default",
  planName,
}: SignupPromotionNoticeProps) {
  const [notice, setNotice] = useState<{
    endpoint: string;
    promotion: PublicSignupPromotion;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let loading = false;
    let cutoffTimer: ReturnType<typeof setTimeout> | undefined;
    let snapshot: {
      promotion: PublicSignupPromotion;
      serverNow: number;
      requestedAt: number;
    } | null = null;

    const updateAvailability = () => {
      if (disposed) return;
      clearTimeout(cutoffTimer);
      if (!snapshot) {
        setNotice(null);
        return;
      }

      // Use server time and a monotonic clock, independent of the device's date.
      // Counting from request start also avoids extending eligibility by network latency.
      const now = snapshot.serverNow + performance.now() - snapshot.requestedAt;
      const { promotion } = snapshot;
      if (!isSignupPromotionOpen(promotion, new Date(now))) {
        setNotice(null);
        return;
      }

      setNotice({ endpoint, promotion });
      // ends_on is inclusive in WIB: hide at the following local midnight.
      const cutoff = Date.parse(`${promotion.ends_on}T00:00:00+07:00`) + 86_400_000;
      cutoffTimer = setTimeout(updateAvailability, Math.min(Math.max(1, cutoff - now), 2_147_483_647));
    };

    const load = async () => {
      if (disposed || loading) return;
      loading = true;
      const requestedAt = performance.now();
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          credentials: "omit",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Promotion unavailable");
        const data: unknown = await response.json();
        if (disposed) return;
        if (!data || typeof data !== "object") throw new Error("Invalid promotion response");
        const { promotion, serverNow } = data as Record<string, unknown>;
        const timestamp = typeof serverNow === "string" ? Date.parse(serverNow) : NaN;
        snapshot = Number.isFinite(timestamp) && isPublicSignupPromotion(promotion)
          ? { promotion, serverNow: timestamp, requestedAt }
          : null;
        updateAvailability();
      } catch {
        if (!disposed) {
          snapshot = null;
          updateAvailability();
        }
      } finally {
        loading = false;
      }
    };

    const refresh = () => {
      updateAvailability();
      if (document.visibilityState !== "hidden") void load();
    };
    void load();
    const refreshTimer = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(cutoffTimer);
      clearInterval(refreshTimer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [endpoint]);

  const promotion = notice?.endpoint === endpoint ? notice.promotion : null;
  if (!promotion || (planName && promotion.plan_name.trim().toLowerCase() !== planName.trim().toLowerCase())) return null;

  return (
    <aside
      aria-label="Promo pendaftaran"
      aria-live="polite"
      className={variant === "plan"
        ? `break-words text-[0.8rem] leading-[1.6] ${className}`
        : `break-words rounded-[10px] border border-primary/20 bg-primary/5 p-3 text-[12px] leading-[1.5] text-primary-900 ${className}`}
    >
      {variant === "plan" ? <>
        <p className="m-0 font-semibold text-lime">Gratis {promotion.duration_months} bulan untuk pengguna baru</p>
        <p className="m-0 mt-1 text-ivory/70">Daftar hingga {formatPromotionDate(promotion.ends_on)}, pukul 23.59 WIB. Masa gratis dihitung sejak daftar akun.</p>
      </> : variant === "compact" ? <>
        <p className="m-0 font-semibold">Pengguna baru? Akses {promotion.plan_name} gratis {promotion.duration_months} bulan.*</p>
        <p className="m-0 mt-1">Daftar hingga {formatPromotionDate(promotion.ends_on)}, pukul 23.59 WIB. Masa gratis dihitung sejak daftar akun.</p>
      </> : <>
        <p className="m-0 font-semibold">{promotion.name}</p>
        <p className="m-0 mt-1">
          <strong>{promotion.plan_name} gratis {promotion.duration_months} bulan kalender</strong>{" "}
          sejak pendaftaran akun.
        </p>
        <p className="m-0 mt-1">
          Daftar paling lambat {formatPromotionDate(promotion.ends_on)}, pukul 23.59 WIB.
          Batas ini untuk pendaftaran, bukan akhir masa gratis.
        </p>
      </>}
      {promotion.terms.trim() ? (
        <details className="mt-2">
          <summary className="cursor-pointer py-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            {variant === "compact" ? "* S&K berlaku" : "S&K promo"}
          </summary>
          <p className="m-0 mt-1 whitespace-pre-wrap break-words">{promotion.terms}</p>
        </details>
      ) : null}
    </aside>
  );
}
