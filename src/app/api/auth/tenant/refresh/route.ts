import { NextRequest, NextResponse } from "next/server";
import { refreshSessionActivity, setSessionCookie } from "@/lib/auth/tenant-session";

/**
 * POST /api/auth/tenant/refresh
 *
 * Refreshes the session by updating the last_activity timestamp.
 * This should be called periodically (e.g., every 5 minutes) to prevent
 * the session from expiring due to inactivity.
 *
 * Returns:
 * - 200: Session refreshed successfully
 * - 401: Session is invalid or expired
 */
export async function POST(request: NextRequest) {
  const newToken = await refreshSessionActivity();

  if (!newToken) {
    return NextResponse.json(
      { error: "Session tidak valid atau telah kadaluarsa" },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { success: true, message: "Session refreshed" },
    {
      status: 200,
      headers: { "Set-Cookie": setSessionCookie(newToken) },
    }
  );
}
