import "server-only";
import { createAdminClient } from "@rakku/db";
import { requireSuperadmin } from "./require-superadmin";

// Authenticated composition boundary for existing admin route handlers.
// Creation ALWAYS verifies the Neon session and current application membership.
export async function createClient() {
  const user = await requireSuperadmin();
  const client = createAdminClient();
  return Object.assign(Object.create(client) as typeof client, {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  });
}
