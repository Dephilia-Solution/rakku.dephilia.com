"use client";

import { useEffect } from "react";

export default function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let disposed = false;
    let changed = false;

    (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          changed = true;
        }
      } catch {
        // ignore - nothing to clean up
      }

      try {
        const keys = await caches.keys();
        if (keys.length > 0) {
          await Promise.all(keys.map((key) => caches.delete(key)));
          changed = true;
        }
      } catch {
        // ignore - nothing to clean up
      }

      if (changed && !disposed) {
        window.location.reload();
      }
    })();

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}