import { connect } from "./lib/neon-config";

async function main() {
  const db = connect("DATABASE_URL_UNPOOLED");
  try {
    const email = process.argv[2] || "alifdhimasctr@gmail.com";
    const membership = await db`select status,role,activated_at from app_private.superadmins where email=${email}`;
    const invitations = await db`select expires_at,used_at from app_private.superadmin_invites where email=${email} order by created_at desc limit 1`;
    console.log(JSON.stringify({ email, membership: membership[0] ?? null,
      invitation: invitations[0] ? { ...invitations[0], expired: new Date(invitations[0].expires_at).getTime() <= Date.now() } : null }));
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
