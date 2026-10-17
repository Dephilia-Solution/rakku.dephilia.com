"use client";

import { useState, useEffect } from "react";
import { useMerchantRequest } from "@pos/lib/merchant-runtime";

export function useDraftCount() {
  const request = useMerchantRequest();
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    const fetchDraftCount = async () => {
      try {
        const res = await request("/api/admin/orders/draft");
        if (res.ok) {
          const data = await res.json();
          setDraftCount(data.length);
        }
      } catch {}
    };
    fetchDraftCount();
    const interval = setInterval(fetchDraftCount, 30000);
    return () => clearInterval(interval);
  }, [request]);

  return draftCount;
}
