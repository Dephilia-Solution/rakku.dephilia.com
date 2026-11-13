import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldIndexSite } from "./indexing";

test("preview deployments are never indexable", () => {
  assert.equal(shouldIndexSite("preview", undefined), false);
  assert.equal(shouldIndexSite("preview", "true"), false);
});

test("site indexing can be disabled for a personal production deployment", () => {
  assert.equal(shouldIndexSite("production", "false"), false);
  assert.equal(shouldIndexSite(undefined, " FALSE "), false);
});

test("production stays indexable when explicitly enabled or not configured", () => {
  assert.equal(shouldIndexSite("production", "true"), true);
  assert.equal(shouldIndexSite("production", undefined), true);
});
