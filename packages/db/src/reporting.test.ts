import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isWithinJakartaRange,
  jakartaDateKey,
  jakartaDateKeyMinusDays,
  jakartaDayStart,
  jakartaMonthKey,
  jakartaRangeBounds,
} from "../../shared-types/src/reporting";

test("Jakarta day/month boundaries are independent of the host time zone", () => {
  const now = new Date("2026-10-17T18:30:00.000Z"); // 18 Oct 01:30 WIB
  assert.equal(jakartaDateKey(now), "2026-10-18");
  assert.equal(jakartaMonthKey(now), "2026-10");
  assert.equal(jakartaDayStart(now).toISOString(), "2026-10-17T17:00:00.000Z");
  assert.equal(jakartaDateKeyMinusDays(now, 1), "2026-10-17");
  const today = jakartaRangeBounds("today", now);
  assert.equal(today.start, "2026-10-17T17:00:00.000Z");
  assert.equal(today.end, "2026-10-18T17:00:00.000Z");
  const yesterday = jakartaRangeBounds("yesterday", now);
  assert.equal(yesterday.start, "2026-10-16T17:00:00.000Z");
  assert.equal(yesterday.end, "2026-10-17T17:00:00.000Z");
  const month = jakartaRangeBounds("month", now);
  assert.equal(month.start, "2026-09-30T17:00:00.000Z");
  assert.equal(month.end, "2026-10-18T17:00:00.000Z");
});

test("range membership is half-open and handles leap day/month rollover", () => {
  const now = new Date("2028-02-29T16:59:59.000Z"); // 29 Feb 23:59:59 WIB
  assert.equal(jakartaDateKey(now), "2028-02-29");
  assert.equal(isWithinJakartaRange("2028-02-28T17:00:00.000Z", "today", now), true);
  assert.equal(isWithinJakartaRange("2028-02-29T17:00:00.000Z", "today", now), false);
  assert.equal(isWithinJakartaRange("2028-02-28T17:00:00.000Z", "yesterday", now), false);
  assert.equal(isWithinJakartaRange("2028-02-28T16:59:59.000Z", "yesterday", now), true);
  const week = jakartaRangeBounds("week", new Date("2026-03-02T03:00:00.000Z"));
  assert.equal(week.start, "2026-02-23T17:00:00.000Z");
  assert.equal(week.end, "2026-03-02T17:00:00.000Z");
  assert.equal(jakartaRangeBounds("all", now).start, null);
});
