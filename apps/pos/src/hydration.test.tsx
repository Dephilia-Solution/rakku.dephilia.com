import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { renderToString } from "react-dom/server";
import type { ProductDiscount, UsageSummary } from "@rakku/shared-types";
import PlanProvider from "@pos/components/billing/PlanProvider";
import LimitBanner from "@pos/components/billing/LimitBanner";
import TaxDiscountsClient from "./app/(dashboard)/tax-discounts/TaxDiscountsClient";
import PurchasesClient from "./app/(dashboard)/purchases/PurchasesClient";

const { createElement } = React;

test("render awal POS tidak bergantung jam atau zona waktu server", () => {
  const discount = {
    id: "discount-1", name: "Diskon", type: "percentage", value: 10,
    is_active: true, start_date: "2026-11-06T17:30:00Z", end_date: "2026-11-07T17:30:00Z",
  } as ProductDiscount;
  const summary = {
    limits: { transactions: 100 }, usage: { transactions: 100 },
    transaction_grace_ends_at: "2026-11-07T17:30:00Z", features: {},
  } as UsageSummary;
  const purchases = [{
    id: "purchase-1", supplier_name: "Supplier", total_amount: 1000,
    purchase_date: "2026-11-06T17:30:00Z", note: null, items: [],
  }];
  const render = () => [
    renderToString(createElement(TaxDiscountsClient, {
      initialTaxes: [], initialProductDiscounts: [discount], initialOrderDiscounts: [], productNames: {}, initialTab: "produk",
    })),
    renderToString(createElement(PlanProvider, { summary, upgradeUrl: "/subscription" } as React.ComponentProps<typeof PlanProvider>, createElement(LimitBanner))),
    renderToString(createElement(PurchasesClient, { purchases })),
  ];
  const previousTZ = process.env.TZ;
  const previousNow = Date.now;
  // tsx compiles source-only workspace UI using the classic JSX runtime here.
  const scope = globalThis as unknown as Record<string, unknown>;
  const previousReact = scope.React;
  try {
    scope.React = React;
    process.env.TZ = "UTC";
    Date.now = () => Date.parse("2026-11-06T16:00:00Z");
    const server = render();
    process.env.TZ = "America/New_York";
    Date.now = () => Date.parse("2026-11-08T18:00:00Z");
    assert.deepEqual(render(), server);
    assert.match(server[0], /Memeriksa periode/);
    assert.match(server[1], /Memeriksa masa tenggang transaksi/);
    assert.match(server[2], /7 Nov 2026/);
  } finally {
    Date.now = previousNow;
    if (previousReact === undefined) delete scope.React;
    else scope.React = previousReact;
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
});
