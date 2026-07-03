import { NextRequest, NextResponse } from "next/server";
import { getPendingLoginFromCookies, clearPendingLoginCookie } from "@/lib/auth/pending-login";
import { verifyPin, isLocked, getLockoutConfig, computeLockedUntil } from "@/lib/auth/pin";
import { signSession, setSessionCookie } from "@/lib/auth/tenant-session";
import { createAdminClient } from "@/lib/supabase/admin";
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

export async function POST(request: NextRequest) {
  const { pin, user_id } = await request.json();
  const pending = await getPendingLoginFromCookies();
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || undefined;

  if (!pending || !pending.outlet_id) {
    await logAuthEvent({
      company_id: pending?.company_id,
      outlet_id: pending?.outlet_id,
      user_id: user_id,
      event_type: "pin_verify",
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: "session_invalid",
      metadata: {},
    });
    return NextResponse.json({ error: "Sesi login tidak ditemukan" }, { status: 401 });
  }

  if (!pin || pin.length !== 6) {
    await logAuthEvent({
      company_id: pending.company_id,
      outlet_id: pending.outlet_id,
      user_id: user_id,
      event_type: "pin_verify",
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: "pin_invalid_format",
      metadata: { pin_length: pin?.length },
    });
    return NextResponse.json({ error: "PIN harus 6 digit" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("*, roles!inner(name), companies!inner(name)")
    .eq("id", user_id)
    .eq("company_id", pending.company_id)
    .single();

  if (!user) {
    await logAuthEvent({
      company_id: pending.company_id,
      outlet_id: pending.outlet_id,
      user_id: user_id,
      event_type: "pin_verify",
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: "user_not_found",
      metadata: {},
    });
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  if (user.status !== "active") {
    await logAuthEvent({
      company_id: pending.company_id,
      outlet_id: pending.outlet_id,
      user_id: user_id,
      event_type: "pin_verify",
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: "user_inactive",
      metadata: { user_status: user.status },
    });
    return NextResponse.json({ error: "Akun tidak aktif" }, { status: 403 });
  }

  if (isLocked(user.locked_until)) {
    await logAuthEvent({
      company_id: pending.company_id,
      outlet_id: pending.outlet_id,
      user_id: user_id,
      event_type: "pin_verify",
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: "pin_locked",
      metadata: { locked_until: user.locked_until },
    });
    return NextResponse.json({ error: "Akun terkunci hingga " + new Date(user.locked_until).toLocaleTimeString("id-ID") }, { status: 423 });
  }

  const pinValid = await verifyPin(pin, user.pin_hash);

  if (!pinValid) {
    const newAttempts = (user.failed_pin_attempts || 0) + 1;
    const { maxAttempts } = getLockoutConfig();

    if (newAttempts >= maxAttempts) {
      await supabase
        .from("users")
        .update({
          failed_pin_attempts: newAttempts,
          locked_until: computeLockedUntil().toISOString(),
        })
        .eq("id", user.id);

      await logAuthEvent({
        company_id: pending.company_id,
        outlet_id: pending.outlet_id,
        user_id: user_id,
        event_type: "pin_verify",
        success: false,
        ip_address: ipAddress,
        user_agent: userAgent,
        failure_reason: "locked_after_max_attempts",
        metadata: { attempts: newAttempts, max_attempts: maxAttempts },
      });

      return NextResponse.json(
        { error: "Akun terkunci 15 menit karena 5 kali salah PIN" },
        { status: 423 }
      );
    }

    await supabase
      .from("users")
      .update({ failed_pin_attempts: newAttempts })
      .eq("id", user.id);

    const remaining = maxAttempts - newAttempts;
    await logAuthEvent({
      company_id: pending.company_id,
      outlet_id: pending.outlet_id,
      user_id: user_id,
      event_type: "pin_verify",
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: "wrong_pin",
      metadata: { attempts: newAttempts, remaining_attempts: remaining },
    });
    return NextResponse.json(
      { error: `PIN salah. Sisa percobaan: ${remaining}` },
      { status: 401 }
    );
  }

  await supabase
    .from("users")
    .update({ failed_pin_attempts: 0, locked_until: null })
    .eq("id", user.id);

  const session = {
    user_id: user.id,
    company_id: pending.company_id,
    outlet_id: pending.outlet_id,
    role_id: user.role_id,
    user_name: user.name,
    company_name: (user as { companies: { name: string } }).companies?.name ?? "",
    outlet_name: pending.outlet_name ?? "",
  };

  const sessionToken = await signSession(session);

  const { data: allowedMenusRaw } = await supabase
    .from("role_menu_access")
    .select("menus!inner(slug)")
    .eq("role_id", user.role_id)
    .eq("can_view", true);

  const allowedSlug = (allowedMenusRaw as unknown as { menus: { slug: string } }[])?.[0]?.menus?.slug;
  const firstMenu = allowedSlug
    ? `/${allowedSlug === "products" ? "admin/products" : allowedSlug}`
    : "/register";

  // Log successful PIN verification and session creation
  await logAuthEvent({
    company_id: pending.company_id,
    outlet_id: pending.outlet_id,
    user_id: user.id,
    event_type: "pin_verify",
    success: true,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { first_menu: firstMenu },
  });

  await logAuthEvent({
    company_id: pending.company_id,
    outlet_id: pending.outlet_id,
    user_id: user.id,
    event_type: "shift_start",
    success: true,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {},
  });

  return NextResponse.json(
    { redirect: firstMenu },
    {
      status: 200,
      headers: {
        "Set-Cookie": [
          clearPendingLoginCookie(),
          setSessionCookie(sessionToken),
        ].join(", "),
      },
    }
  );
}
