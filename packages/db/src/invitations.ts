import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { type DatabaseClient } from "./query";

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error("Invalid email");
  return normalized;
}
export async function issueSuperadminInvite(client: DatabaseClient, email: string) {
  const normalized = normalizeEmail(email);
  const token = randomBytes(32).toString("base64url");
  const hash = hashInviteToken(token);
  await client.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${normalized}, 0))`);
    const active = await tx.execute(sql`select 1 from app_private.superadmins where email = ${normalized}`);
    if (active.length) throw new Error("Superadmin already exists; use Managed Better Auth password reset");
    await tx.execute(sql`update app_private.superadmin_invites set expires_at = now() where email = ${normalized} and used_at is null`);
    await tx.execute(sql`insert into app_private.superadmin_invites(email,token_hash,expires_at)
      values(${normalized},${hash},now() + interval '24 hours')`);
  });
  return { email: normalized, token };
}
export async function findSuperadminInvite(client: DatabaseClient, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const rows = await client.execute(sql`select id, email from app_private.superadmin_invites
    where token_hash = ${hashInviteToken(token)} and used_at is null and expires_at > now()`);
  return rows[0] as { id: string; email: string } | undefined ?? null;
}
export async function activateSuperadminInvite(client: DatabaseClient, token: string, user: { id: string; email: string }) {
  await client.transaction(async tx => {
    const rows = await tx.execute(sql`select id, email from app_private.superadmin_invites
      where token_hash = ${hashInviteToken(token)} and used_at is null and expires_at > now() for update`);
    const invite = rows[0];
    if (!invite || invite.email !== normalizeEmail(user.email)) throw new Error("Invitation invalid or already used");
    await tx.execute(sql`insert into app_private.superadmins(auth_subject,email) values(${user.id},${invite.email})`);
    await tx.execute(sql`update app_private.superadmin_invites set used_at = now(), auth_subject = ${user.id} where id = ${invite.id}`);
  });
}
