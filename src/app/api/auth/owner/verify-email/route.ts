import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { verifyOwnerEmail } from "@/lib/supabase/queries.owner";
import { signOwnerSession } from "@/lib/auth/owner-session";

const VERIFY_SECRET = new TextEncoder().encode(
  process.env.TENANT_JWT_SECRET || "dev-secret-change-in-production-min-32-chars!!"
);

interface VerifyPayload {
  owner_id: string;
  email: string;
  name: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/owner/masuk?error=invalid_token", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, VERIFY_SECRET);
    const { owner_id, email } = payload as unknown as VerifyPayload;

    const { error } = await verifyOwnerEmail(owner_id);

    if (error) {
      return NextResponse.redirect(new URL("/owner/masuk?error=verify_failed", request.url));
    }

    const session = {
      owner_id,
      email,
      name: (payload as unknown as VerifyPayload).name,
      company_id: null,
      company_name: null,
      company_slug: null,
    };

    const jwt = await signOwnerSession(session);

    const response = NextResponse.redirect(
      new URL("/owner/onboarding", request.url)
    );
    response.cookies.set("owner_session", jwt, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL("/owner/masuk?error=invalid_token", request.url));
  }
}
