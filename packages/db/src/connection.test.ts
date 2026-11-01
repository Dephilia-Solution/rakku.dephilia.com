import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getDefaultAutoSelectFamily,
  getDefaultAutoSelectFamilyAttemptTimeout,
  setDefaultAutoSelectFamily,
  setDefaultAutoSelectFamilyAttemptTimeout,
} from "node:net";
import { closeDatabase, createAdminClient } from "./index";

test("database clients allow high-latency address attempts while preserving operator networking settings", async () => {
  const originalUrl = process.env.DATABASE_URL;
  const originalTimeout = getDefaultAutoSelectFamilyAttemptTimeout();
  const originalFamily = getDefaultAutoSelectFamily();
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/network-regression";
  try {
    setDefaultAutoSelectFamily(true);
    setDefaultAutoSelectFamilyAttemptTimeout(250);
    createAdminClient();
    assert.ok(getDefaultAutoSelectFamilyAttemptTimeout() >= 1500);
    assert.equal(getDefaultAutoSelectFamily(), true);

    await closeDatabase();
    setDefaultAutoSelectFamily(false);
    setDefaultAutoSelectFamilyAttemptTimeout(3000);
    createAdminClient();
    assert.equal(getDefaultAutoSelectFamilyAttemptTimeout(), 3000);
    assert.equal(getDefaultAutoSelectFamily(), false);
  } finally {
    await closeDatabase();
    setDefaultAutoSelectFamilyAttemptTimeout(originalTimeout);
    setDefaultAutoSelectFamily(originalFamily);
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  }
});
