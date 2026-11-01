import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./query";

export interface OwnerSessionContext {
  owner_id: string;
  session_id: string;
  email: string;
  name: string;
  phone: string | null;
  company_id: string | null;
  company_name: string | null;
  company_slug: string | null;
  company_code: string | null;
}

/** Validate the signed owner token against live owner, company and session state in one round trip. */
export async function readActiveOwnerContext(db: DatabaseClient, input: {
  ownerId: string; sessionId: string | undefined;
}): Promise<OwnerSessionContext | null> {
  if (!input.sessionId || !/^[0-9a-f-]{36}$/i.test(input.sessionId)) return null;
  const [row] = await db.execute(sql`
    select o.id as owner_id, s.id as session_id, o.email, o.name, o.phone,
      c.id as company_id, c.name as company_name, c.slug as company_slug, c.code as company_code
    from app_private.auth_sessions s
    join public.owners o on o.id=s.subject_id and o.is_active=true and o.email_verified_at is not null
    left join public.companies c on c.owner_id=o.id
    where s.id=${input.sessionId}::uuid and s.kind='owner' and s.subject_id=${input.ownerId}::uuid
      and s.revoked_at is null and s.expires_at>now() and (c.id is null or c.status='active')
    limit 1`);
  return row ? row as OwnerSessionContext : null;
}
