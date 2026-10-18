import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowsApiPolicy,
  hasMenuCapability,
  resolveApiPolicy,
  type MenuGrant,
} from "./access-policy";

function grant(menu: string, flags: Partial<Omit<MenuGrant, "menu">> = {}): MenuGrant {
  return { menu, can_view: true, can_create: false, can_edit: false, can_delete: false, ...flags };
}
function allowed(path: string, method: string, grants: MenuGrant[]) {
  const policy = resolveApiPolicy(path, method);
  assert.ok(policy, `expected a policy for ${method} ${path}`);
  return allowsApiPolicy(policy, grants);
}

test("unknown paths and methods deny by default, and HEAD follows GET", () => {
  assert.equal(resolveApiPolicy("/api/admin/unknown", "GET"), null);
  assert.equal(resolveApiPolicy("/api/admin/products", "OPTIONS"), null);
  assert.equal(resolveApiPolicy("/api/auth/tenant/session", "GET"), null);
  assert.ok(resolveApiPolicy("/api/admin/products", "HEAD"));
});

test("view-only cannot mutate product, ingredient, expense, tax or table resources", () => {
  const view = [grant("products"), grant("ingredients"), grant("expenses"), grant("tax-discounts"), grant("tables")];
  assert.equal(allowed("/api/admin/products", "GET", view), true);
  assert.equal(allowed("/api/admin/products", "POST", view), false);
  assert.equal(allowed("/api/admin/products", "PATCH", view), false);
  assert.equal(allowed("/api/admin/products", "DELETE", view), false);
  assert.equal(allowed("/api/admin/ingredients", "POST", view), false);
  assert.equal(allowed("/api/admin/expenses", "PATCH", view), false);
  assert.equal(allowed("/api/admin/taxes", "DELETE", view), false);
  assert.equal(allowed("/api/admin/tables", "DELETE", view), false);
});

test("creator, editor and deleter grants are independent", () => {
  const creator = [grant("products", { can_create: true })];
  assert.equal(allowed("/api/admin/products", "POST", creator), true);
  assert.equal(allowed("/api/admin/products", "PATCH", creator), false);
  assert.equal(allowed("/api/admin/products", "DELETE", creator), false);
  const editor = [grant("products", { can_edit: true })];
  assert.equal(allowed("/api/admin/products", "PUT", editor), true);
  assert.equal(allowed("/api/admin/products/upload", "POST", editor), true);
  assert.equal(allowed("/api/admin/product-tier-prices", "POST", editor), true);
  assert.equal(allowed("/api/admin/products", "DELETE", editor), false);
  const deleter = [grant("products", { can_delete: true })];
  assert.equal(allowed("/api/admin/products", "DELETE", deleter), true);
  assert.equal(allowed("/api/admin/products", "POST", deleter), false);
});

test("a mutation grant is ineffective without view, including legacy rows", () => {
  const legacy = [grant("products", { can_view: false, can_create: true, can_edit: true, can_delete: true })];
  assert.equal(allowed("/api/admin/products", "GET", legacy), false);
  assert.equal(allowed("/api/admin/products", "POST", legacy), false);
  assert.equal(allowed("/api/admin/products", "PATCH", legacy), false);
  assert.equal(allowed("/api/admin/products", "DELETE", legacy), false);
});

test("register reads remain available while register writes require create/edit/delete", () => {
  const registerView = [grant("register")];
  assert.equal(allowed("/api/admin/products", "GET", registerView), true);
  assert.equal(allowed("/api/admin/taxes/active", "GET", registerView), true);
  assert.equal(allowed("/api/admin/orders/draft", "GET", registerView), true);
  assert.equal(allowed("/api/admin/orders", "POST", registerView), false);
  assert.equal(allowed("/api/admin/orders/draft", "PATCH", registerView), false);
  assert.equal(allowed("/api/admin/orders/qris/123", "GET", registerView), false);
  assert.equal(allowed("/api/admin/orders", "POST", [grant("register", { can_create: true })]), true);
});

test("tax/discount aliases and recipes allow either owning menu", () => {
  assert.equal(allowed("/api/admin/taxes", "POST", [grant("taxes", { can_create: true })]), true);
  assert.equal(allowed("/api/admin/discounts", "DELETE", [grant("tax-discounts", { can_delete: true })]), true);
  assert.equal(allowed("/api/admin/taxes", "POST", [grant("taxes")]), false);
  assert.equal(allowed("/api/admin/recipes", "POST", [grant("ingredients", { can_create: true })]), true);
  assert.equal(allowed("/api/admin/recipes", "DELETE", [grant("products", { can_delete: true })]), true);
  assert.equal(allowed("/api/admin/recipes", "DELETE", [grant("products", { can_edit: true })]), false);
});

test("report email requires both report view and create", () => {
  assert.equal(allowed("/api/reports/send-email", "POST", [grant("reports")]), false);
  assert.equal(allowed("/api/reports/send-email", "POST", [grant("reports", { can_create: true })]), true);
});

test("QRIS mutation-shaped reads and destructive cancellation require matching actions", () => {
  assert.equal(allowed("/api/admin/orders/qris/abc", "GET", [grant("orders")]), false);
  assert.equal(allowed("/api/admin/orders/qris/abc", "GET", [grant("orders", { can_edit: true })]), true);
  assert.equal(allowed("/api/admin/orders/qris/abc/retry", "POST", [grant("register", { can_edit: true })]), true);
  assert.equal(allowed("/api/admin/orders/qris/abc/cancel", "POST", [grant("orders", { can_delete: true })]), true);
  assert.equal(allowed("/api/admin/orders/qris/abc/cancel", "POST", [grant("orders", { can_edit: true })]), false);
});

test("subscription bootstrap stays authenticated while ungranted admin data does not", () => {
  const policy = resolveApiPolicy("/api/admin/subscription", "GET");
  assert.ok(policy);
  assert.equal(allowsApiPolicy(policy, []), true);
  assert.equal(allowed("/api/admin/ingredients", "GET", []), false);
  assert.equal(hasMenuCapability([grant("tables", { can_edit: true })], "tables", "can_edit"), true);
  assert.equal(hasMenuCapability([grant("tables", { can_view: false, can_edit: true })], "tables", "can_edit"), false);
});

test("onboarding cashier defaults allow checkout but not order creation, report email or tax management", () => {
  const cashier = [
    grant("register", { can_create: true, can_edit: true, can_delete: true }),
    grant("orders", { can_edit: true, can_delete: true }),
    grant("reports"),
    grant("tax-discounts"),
  ];
  assert.equal(allowed("/api/admin/orders", "POST", cashier), true);
  assert.equal(allowed("/api/admin/products", "GET", cashier), true);
  assert.equal(allowed("/api/admin/orders/draft", "GET", cashier), true);
  assert.equal(allowed("/api/admin/orders/draft", "DELETE", cashier), true);
  assert.equal(allowed("/api/admin/orders/qris/abc/retry", "POST", cashier), true);
  assert.equal(allowed("/api/reports/send-email", "POST", cashier), false);
  assert.equal(allowed("/api/admin/taxes", "POST", cashier), false);
  assert.equal(allowed("/api/admin/ingredients", "GET", cashier), false);
});

test("every inventory merchant route and method has an explicit policy", () => {
  const cases: [string, string][] = [
    ["/api/admin/products", "GET"], ["/api/admin/products", "POST"], ["/api/admin/products", "PATCH"], ["/api/admin/products", "PUT"], ["/api/admin/products", "DELETE"],
    ["/api/admin/products/upload", "POST"], ["/api/admin/products/image", "DELETE"],
    ["/api/admin/categories", "POST"], ["/api/admin/categories", "PATCH"], ["/api/admin/categories", "PUT"], ["/api/admin/categories", "DELETE"],
    ["/api/admin/modifiers", "GET"], ["/api/admin/modifiers", "POST"], ["/api/admin/modifiers", "PATCH"], ["/api/admin/modifiers", "DELETE"],
    ["/api/admin/pricing-options", "GET"], ["/api/admin/pricing-options", "POST"], ["/api/admin/pricing-options", "PATCH"], ["/api/admin/pricing-options", "DELETE"],
    ["/api/admin/pricing-tiers", "GET"], ["/api/admin/pricing-tiers", "POST"], ["/api/admin/pricing-tiers", "PATCH"], ["/api/admin/pricing-tiers", "PUT"], ["/api/admin/pricing-tiers", "DELETE"],
    ["/api/admin/product-tier-prices", "POST"], ["/api/admin/modifier-tier-prices", "POST"],
    ["/api/admin/recipes", "GET"], ["/api/admin/recipes", "POST"], ["/api/admin/recipes", "DELETE"],
    ["/api/admin/ingredients", "GET"], ["/api/admin/ingredients", "POST"], ["/api/admin/ingredients", "PATCH"], ["/api/admin/ingredients", "DELETE"],
    ["/api/admin/ingredients/123/adjust", "POST"],
    ["/api/admin/purchases", "GET"], ["/api/admin/purchases", "POST"],
    ["/api/admin/expenses", "GET"], ["/api/admin/expenses", "POST"], ["/api/admin/expenses", "PATCH"], ["/api/admin/expenses", "DELETE"],
    ["/api/admin/taxes", "GET"], ["/api/admin/taxes", "POST"], ["/api/admin/taxes", "PATCH"], ["/api/admin/taxes", "DELETE"],
    ["/api/admin/taxes/active", "GET"],
    ["/api/admin/discounts", "GET"], ["/api/admin/discounts", "POST"], ["/api/admin/discounts", "PATCH"], ["/api/admin/discounts", "DELETE"],
    ["/api/admin/discounts/active", "GET"],
    ["/api/admin/tables", "GET"], ["/api/admin/tables", "POST"], ["/api/admin/tables", "PATCH"], ["/api/admin/tables", "DELETE"],
    ["/api/admin/tables/generate", "POST"],
    ["/api/admin/orders", "POST"], ["/api/admin/orders/draft", "GET"], ["/api/admin/orders/draft", "POST"], ["/api/admin/orders/draft", "PATCH"], ["/api/admin/orders/draft", "DELETE"],
    ["/api/admin/orders/split", "POST"], ["/api/admin/orders/qris", "POST"], ["/api/admin/orders/qris/123", "GET"],
    ["/api/admin/orders/qris/123/retry", "POST"], ["/api/admin/orders/qris/123/cancel", "POST"],
    ["/api/admin/subscription", "GET"], ["/api/reports/send-email", "POST"],
  ];
  for (const [path, method] of cases) assert.ok(resolveApiPolicy(path, method), `${method} ${path}`);
});
