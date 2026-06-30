import { NextRequest, NextResponse } from "next/server";
import { getPendingLoginFromCookies, signPendingLogin, setPendingLoginCookie } from "@/lib/auth/pending-login";
import { getActiveOutlets } from "@/lib/auth/company";
import { logAuthEvent } from "@/lib/auth/audit-log";

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  if (realIp) return realIp;
  if (cfConnectingIp) return cfConnectingIp;

  return request.headers.get("host") || "unknown";
}

export async function GET(request: NextRequest) {
  const pending = await getPendingLoginFromCookies();

  if (!pending) {
    return NextResponse.json({ error: "Sesi login tidak ditemukan" }, { status: 401 });
  }

  const outlets = await getActiveOutlets(pending.company_id);

  // Log outlet listing event
  await logAuthEvent({
    company_id: pending.company_id,
    outlet_id: null,
    user_id: null,
    event_type: "outlet_select",
    success: true,
    ip_address: getClientIp(request),
    user_agent: request.headers.get("user-agent") || undefined,
    metadata: { action: "list_outlets", count: outlets.length },
  });

  return NextResponse.json({ outlets, company_name: pending.company_name });
}

export async function POST(request: NextRequest) {
  const { outlet_id } = await request.json();
  const pending = await getPendingLoginFromCookies();

  if (!pending) {
    return NextResponse.json({ error: "Sesi login tidak ditemukan" }, { status: 401 });
  }

  const outlets = await getActiveOutlets(pending.company_id);
  const outlet = outlets.find((o) => o.id === outlet_id);
  if (!outlet) {
    // Log failed outlet selection
    await logAuthEvent({
      company_id: pending.company_id,
      outlet_id: outlet_id,
      user_id: null,
      event_type: "outlet_select",
      success: false,
      ip_address: getClientIp(request),
      user_agent: request.headers.get("user-agent") || undefined,
      failure_reason: "outlet_not_found",
      metadata: { requested_outlet_id: outlet_id },
    });
    return NextResponse.json({ error: "Outlet tidak valid" }, { status: 400 });
  }

  const token = await signPendingLogin({
    ...pending,
    outlet_id: outlet.id,
    outlet_name: outlet.name,
  });

  // Log successful outlet selection
  await logAuthEvent({
    company_id: pending.company_id,
    outlet_id: outlet.id,
    user_id: null,
    event_type: "outlet_select",
    success: true,
    ip_address: getClientIp(request),
    user_agent: request.headers.get("user-agent") || undefined,
    metadata: { outlet_name: outlet.name },
  });

  return NextResponse.json(
    { outlet_name: outlet.name, outlet_id: outlet.id },
    {
      status: 200,
      headers: { "Set-Cookie": setPendingLoginCookie(token) },
    }
  );
}
