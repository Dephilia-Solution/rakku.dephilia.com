import { createTenantClient } from "@rakku/db";
import { headers } from "next/headers";
import { getTenantSessionFromCookies } from "./auth/tenant-session";
import { AccessDeniedError, assertApiAccess } from "./auth/authorize";

export function createAdminClient() {
  return createTenantClient(async () => {
    const session = await getTenantSessionFromCookies();
    if (!session) return null;
    const context = await headers();
    const apiPath = context.get("x-rakku-api-path");
    if (apiPath) {
      await assertApiAccess(session, apiPath, context.get("x-rakku-api-method") ?? "");
    } else {
      const requestPath = context.get("x-rakku-path") ?? "";
      if (requestPath.startsWith("/api/admin/") || requestPath.startsWith("/api/reports/")) {
        throw new AccessDeniedError("Endpoint tidak diizinkan");
      }
    }
    return session;
  });
}
