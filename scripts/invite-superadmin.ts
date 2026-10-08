import { config } from "dotenv";
import { createAdminClient, closeDatabase } from "@rakku/db";
import { issueSuperadminInvite } from "@rakku/db/invitations";
import { sendEmail } from "../packages/echo-client/src";

config({ path: ".env.local" });
async function main() {
  const email = process.argv[2];
  const origin = process.env.SUPERADMIN_URL;
  if (!email || !origin) throw new Error("Usage: pnpm admin:invite email@example.com (SUPERADMIN_URL required)");
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("SUPERADMIN_URL must use HTTPS");
  const invite = await issueSuperadminInvite(createAdminClient(), email);
  const activation = new URL("/activate", url);
  // Fragment avoids leaking the invitation credential into request/access logs.
  activation.hash = `token=${invite.token}`;
  await sendEmail({ to: invite.email, subject: "Aktivasi Superadmin Rakku",
    html: `<p>Anda diundang sebagai Superadmin Rakku.</p><p><a href="${activation.href}">Aktifkan akun dan buat password baru</a></p><p>Link berlaku 24 jam dan hanya dapat digunakan satu kali.</p>` });
  console.log(`Invitation sent to ${invite.email}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(closeDatabase);
