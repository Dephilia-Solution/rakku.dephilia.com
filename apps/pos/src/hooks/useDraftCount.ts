"use client";

import { useState, useEffect } from "react";

export function useDraftCount() {
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    const fetchDraftCount = async () => {
      try {
        const res = await fetch("/api/admin/orders/draft");
        if (res.ok) {
          const data = await res.json();
          setDraftCount(data.length);
        }
      } catch {}
    };
    fetchDraftCount();
    const interval = setInterval(fetchDraftCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return draftCount;
}
