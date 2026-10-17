import { test } from "node:test";
import assert from "node:assert/strict";
import { demoHref, demoLogicalPath } from "./runtime/navigation";

test("merchant destinations preserve query/resource routes and are always demo-prefixed", () => {
  assert.equal(demoHref("owner", "/outlets"), "/demo/owner/outlets");
  assert.equal(demoHref("pos", "/register"), "/demo/pos/register");
  assert.equal(demoHref("pos", "/products"), "/demo/pos/products");
  assert.equal(demoHref("owner", "/products/add?outlet=fixture%3Ataman"), "/demo/owner/products/add?outlet=fixture%3Ataman");
  assert.equal(demoHref("pos", "/orders/demo:123/invoice"), "/demo/pos/orders/demo:123/invoice");
  assert.equal(demoHref("pos", "/demo/owner/subscription"), "/demo/owner/subscription");
  assert.equal(demoHref("owner", "/demo/menu/taman"), "/demo/menu/taman");
  assert.equal(demoHref("owner", "#"), "#");
});

test("logical pathname keeps the original sidebar selection and legacy product routes resolve correctly", () => {
  assert.equal(demoLogicalPath("owner", "/demo/owner/outlets"), "/outlets");
  assert.equal(demoLogicalPath("pos", "/demo/pos/products/fixture:123/edit"), "/products/fixture:123/edit");
  assert.equal(demoHref("pos", "/admin/products"), "/demo/pos/products");
  assert.equal(demoHref("pos", "/admin/products/fixture:123/edit"), "/demo/pos/products/fixture:123/edit");
  assert.equal(demoHref("owner", "/taxes"), "/demo/owner/tax-discounts?tab=pajak");
  assert.equal(demoHref("pos", "/discounts"), "/demo/pos/tax-discounts?tab=produk");
});

test("switching between actual app origins stays in one sandbox; foreign URLs/API destinations reject", () => {
  const origins = { owner: "https://app.rakku.invalid", pos: "https://pos.rakku.invalid" };
  assert.equal(demoHref("owner", "https://pos.rakku.invalid", origins), "/demo/pos/login/select-outlet");
  assert.equal(demoHref("pos", "https://app.rakku.invalid/subscription", origins), "/demo/owner/subscription");
  for (const href of ["https://vessel.invalid/payment", "//foreign.invalid", "javascript:alert(1)", "/api/owner/outlets", "https://app.rakku.invalid/api/owner/outlets"]) {
    assert.throws(() => demoHref("owner", href, origins));
  }
});
