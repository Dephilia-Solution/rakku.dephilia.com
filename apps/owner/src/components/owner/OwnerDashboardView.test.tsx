import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { OwnerDashboardAnalytics } from "@rakku/shared-types";
import { SalesTrend } from "./OwnerDashboardView";

test("grafik merender isi title SVG sebagai satu string pada server", () => {
  const data = {
    trend: [
      { date: "2026-11-06", revenue: 25000, transactions: 1 },
      { date: "2026-11-07", revenue: 0, transactions: 0 },
    ],
    summary: { revenue: 25000, transactions: 1 },
  } as OwnerDashboardAnalytics;
  const warnings: unknown[][] = [];
  const previousError = console.error;
  const previousTZ = process.env.TZ;
  try {
    console.error = (...args: unknown[]) => { warnings.push(args); };
    process.env.TZ = "UTC";
    const server = renderToString(createElement(SalesTrend, { data }));
    process.env.TZ = "Asia/Tokyo";
    const clientZone = renderToString(createElement(SalesTrend, { data }));
    assert.equal(server, clientZone);
    assert.match(server, /<title>6 Nov: Rp 25\.000 · 1 transaksi<\/title>/);
    assert.match(server, /<title>7 Nov: Rp 0 · 0 transaksi<\/title>/);
    assert.deepEqual(warnings, []);
  } finally {
    console.error = previousError;
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
});
