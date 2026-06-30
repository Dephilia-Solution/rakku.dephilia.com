"use client";

import { useEffect, useState } from "react";

/**
 * SessionRefresher Component
 *
 * Automatically refreshes the session every 5 minutes to prevent
 * idle timeout. This ensures users stay logged in during active use
 * while still providing security protection against abandoned sessions.
 *
 * The refresh interval (5 minutes) is well below the idle timeout (30 minutes),
 * providing a safety margin while minimizing unnecessary API calls.
 */
export function SessionRefresher() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show the component briefly to indicate it's working (for development)
    const showTimer = setTimeout(() => setIsVisible(true), 1000);
    const hideTimer = setTimeout(() => setIsVisible(false), 4000);

    // Refresh every 5 minutes (300,000 ms)
    const refreshInterval = 5 * 60 * 1000;

    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/auth/tenant/refresh", {
          method: "POST",
        });

        if (!response.ok) {
          // Session is invalid - redirect to login will happen on next navigation
          console.warn("[SessionRefresher] Session refresh failed");
        }
      } catch (error) {
        console.error("[SessionRefresher] Failed to refresh session:", error);
      }
    }, refreshInterval);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearInterval(interval);
    };
  }, []);

  // Render nothing in production (background operation)
  // In development, show a subtle indicator
  if (process.env.NODE_ENV === "development" && isVisible) {
    return (
      <div className="fixed bottom-20 right-4 bg-green-500 text-white px-2 py-1 rounded text-xs z-50 opacity-50">
        Session active
      </div>
    );
  }

  return null;
}
