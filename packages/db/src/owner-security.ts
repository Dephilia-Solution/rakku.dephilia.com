import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./query";
import { revokeSubjectSessions } from "./sessions";
export async function consumeOwnerPasswordReset(db: DatabaseClient, tokenHash: string, passwordHash: string) {
  return db.transaction(async tx => {
    const rows = await tx.execute(sql`update public.owners set password_hash=${passwordHash}, reset_token_hash=null,
      reset_token_expires_at=null where reset_token_hash=${tokenHash} and reset_token_expires_at>now()
      and is_active=true returning id`);
    if (rows.length !== 1) throw new Error("Token tidak valid atau sudah kadaluarsa");
    await revokeSubjectSessions(tx, "owner", String(rows[0].id));
  });
}
