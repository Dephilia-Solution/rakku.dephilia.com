import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDate as ownerDate } from "./format";
import { formatDate as posDate } from "../../../pos/src/lib/format";

test("merchant timestamps retain their Jakarta business date in UTC, US and Tokyo browsers", () => {
  const previous=process.env.TZ;
  try {
    for(const zone of ["UTC","America/New_York","Asia/Tokyo"]){
      process.env.TZ=zone;
      for(const format of [ownerDate,posDate]){
        assert.match(format("2026-10-31T17:00:00.000Z"),/1 Nov 2026/);
        assert.match(format("2026-10-31T16:59:59.000Z"),/31 Okt 2026/);
        assert.equal(format("2026-11-01"),"1 Nov 2026");
      }
    }
  } finally { if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous; }
});
