"use client";
import { useEffect, useRef } from "react";

/** Refresh shared devices after cookie changes, cross-tab logout and browser history restore. */
export default function SessionBoundary({ app, pathname }: { app: "owner" | "pos" | "superadmin"; pathname: string }) {
  const identity = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (pathname === "/demo" || pathname.startsWith("/demo/")) return;
    if ("caches" in window) void caches.keys().then(keys => Promise.all(keys
      .filter(key => !["static-resources", "images"].includes(key) && !key.includes("precache"))
      .map(key => caches.delete(key)))).catch(() => {});
    let disposed = false;
    let checking = false;
    const endpoint = app === "owner" ? "/api/auth/owner/session" : app === "pos" ? "/api/auth/tenant/session" : "/api/superadmin/auth/session";
    const check = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok && response.status !== 401) return;
        const data = await response.json();
        if (disposed) return;
        const current = app === "owner" ? data.owner?.session_id ?? null : data.session_id ?? null;
        if (identity.current !== undefined && identity.current !== current) { location.reload(); return; }
        identity.current = current;
        const path = location.pathname;
        const guestPage = app === "pos" ? path === "/login" || path.startsWith("/login/")
          : ["/login", "/register", "/check-email", "/forgot-password", "/reset-password", "/activate"].includes(path);
        if (current && guestPage) location.replace(data.redirect ?? (app === "owner" ? data.owner?.company_id ? "/" : "/onboarding" : app === "pos" ? "/register" : "/companies"));
        if (app === "owner" && path === "/onboarding" && data.owner?.company_id) location.replace("/");
      } catch { /* A network failure cannot authenticate a user or make an offline sale. */ }
      finally { checking = false; }
    };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) location.reload(); else void check(); };
    const focus = () => void check();
    window.addEventListener("pageshow", restore);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    void check();
    return () => { disposed = true; window.removeEventListener("pageshow", restore); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [app, pathname]);
  return null;
}
