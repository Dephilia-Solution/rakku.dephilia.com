"use client";

import { useState, useEffect } from "react";
import { usePlanOptional } from "@/components/billing/PlanProvider";

interface IngredientStock {
  stock_quantity: number;
  min_stock_alert: number;
}

export function useLowStockCount() {
  const plan = usePlanOptional();
  const enabled = plan
    ? Boolean(plan.summary.features?.inventory_advanced)
    : true;
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLowStockCount(0);
      return;
    }

    const fetchLowStock = async () => {
      try {
        const res = await fetch("/api/admin/ingredients");
        if (res.ok) {
          const data: IngredientStock[] = await res.json();
          const count = data.filter(
            (ing) =>
              Number(ing.min_stock_alert) > 0 &&
              Number(ing.stock_quantity) <= Number(ing.min_stock_alert)
          ).length;
          setLowStockCount(count);
        }
      } catch {}
    };
    fetchLowStock();
    const interval = setInterval(fetchLowStock, 30000);
    return () => clearInterval(interval);
  }, [enabled]);

  return lowStockCount;
}
