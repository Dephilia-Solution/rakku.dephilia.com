import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./query";

export type SessionKind = "owner" | "pos" | "pending" | "verify_email";
export async function issueSession(db: DatabaseClient, kind: SessionKind, subject: string, seconds: number) {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new Error("Invalid session duration");
  const [row] = await db.execute(sql`insert into app_private.auth_sessions(kind,subject_id,expires_at)
    values(${kind},${subject}::uuid,now() + ${seconds} * interval '1 second') returning id`);
  return String(row.id);
}
export async function isSessionActive(db: DatabaseClient, id: string | undefined, kind: SessionKind, subject: string) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  const rows = await db.execute(sql`select id from app_private.auth_sessions where id=${id}::uuid
    and kind=${kind} and subject_id=${subject}::uuid and revoked_at is null and expires_at>now()`);
  return rows.length === 1;
}
export async function revokeSession(db: DatabaseClient, id: string | undefined) {
  if (id) await db.execute(sql`update app_private.auth_sessions set revoked_at=coalesce(revoked_at,now()) where id=${id}::uuid`);
}
export async function revokeSubjectSessions(db: DatabaseClient, kind: SessionKind, subject: string) {
  await db.execute(sql`update app_private.auth_sessions set revoked_at=now() where kind=${kind}
    and subject_id=${subject}::uuid and revoked_at is null`);
}
// The guarded UPDATE is the one-time consumption boundary, even for simultaneous requests.
export async function consumeSession(db: DatabaseClient, id: string, kind: SessionKind, subject: string) {
  const rows = await db.execute(sql`update app_private.auth_sessions set revoked_at=now()
    where id=${id}::uuid and kind=${kind} and subject_id=${subject}::uuid
      and revoked_at is null and expires_at>now() returning id`);
  if (rows.length !== 1) throw new Error("Session expired or already consumed");
}
export async function allowAuthAttempt(db: DatabaseClient, key: string, maxAttempts: number, windowSeconds: number) {
  const hash = createHash("sha256").update(key).digest("hex");
  const [row] = await db.execute(sql`insert into app_private.auth_rate_limits(key_hash,attempts,expires_at)
    values(${hash},1,now()+${windowSeconds} * interval '1 second') on conflict(key_hash) do update
    set attempts=case when app_private.auth_rate_limits.expires_at<=now() then 1 else app_private.auth_rate_limits.attempts+1 end,
    expires_at=case when app_private.auth_rate_limits.expires_at<=now() then excluded.expires_at else app_private.auth_rate_limits.expires_at end
    returning attempts`);
  return Number(row.attempts) <= maxAttempts;
}
export async function resetAuthAttempts(db: DatabaseClient, key: string) {
  const hash = createHash("sha256").update(key).digest("hex");
  await db.execute(sql`update app_private.auth_rate_limits set attempts=0,expires_at=now() where key_hash=${hash}`);
}
