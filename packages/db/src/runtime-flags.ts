import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./query";

export const CHECKOUT_PAUSED = "checkout_paused";

export async function getRuntimeFlag(db: DatabaseClient, key: string): Promise<boolean> {
  const [row] = await db.execute(sql`select enabled from app_private.runtime_flags where key=${key}`);
  return row?.enabled === true;
}

export async function setRuntimeFlag(db: DatabaseClient, key: string, enabled: boolean, actor: string): Promise<void> {
  if (!key.trim() || key.length > 80) throw new Error("Flag key tidak valid");
  if (!actor.trim() || actor.length > 200) throw new Error("Actor tidak valid");
  await db.execute(sql`insert into app_private.runtime_flags(key,enabled,updated_by,updated_at)
    values(${key},${enabled},${actor},now())
    on conflict (key) do update set enabled=excluded.enabled, updated_by=excluded.updated_by, updated_at=now()`);
}

export async function isCheckoutPaused(db: DatabaseClient): Promise<boolean> {
  if (process.env.RAKKU_CHECKOUT_PAUSED === "1") return true;
  try {
    return await getRuntimeFlag(db, CHECKOUT_PAUSED);
  } catch {
    // Checkout cannot safely proceed when the authoritative flag cannot be read.
    return true;
  }
}
