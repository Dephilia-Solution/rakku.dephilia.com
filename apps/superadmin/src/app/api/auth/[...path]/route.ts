import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/server";
import { isAllowedSuperadminOrigin } from "@/lib/auth/origins";
import { getAuthorizedUser } from "@/lib/auth/require-superadmin";

const allowed = new Set(["sign-in/email", "sign-out", "get-session", "request-password-reset", "reset-password", "verify-email"]);
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const resetLink = request.method === "GET" && path.length === 2 && path[0] === "reset-password";
  if (!allowed.has(path.join("/")) && !resetLink) return NextResponse.json({ error: "Endpoint unavailable" }, { status: 404 });
  if (request.method === "POST" && ["sign-in/email", "request-password-reset", "reset-password"].includes(path.join("/")) && await getAuthorizedUser()) {
    return NextResponse.json({ error: "Sesi sudah aktif", redirect: "/companies" }, { status: 409 });
  }
  const origin = request.headers.get("origin");
  if (request.method === "POST" && (!origin || (origin !== new URL(request.url).origin && !isAllowedSuperadminOrigin(origin)))) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const handlers = getAuth().handler();
  return request.method === "GET" ? handlers.GET(request, context) : handlers.POST(request, context);
}
export const GET = handle;
export const POST = handle;
