import { NextRequest, NextResponse } from "next/server";
import { getPendingLoginFromCookies, signPendingLogin, setPendingLoginCookie } from "@/lib/auth/pending-login";
import { getActiveOutlets } from "@/lib/auth/company";

export async function GET() {
  const pending = await getPendingLoginFromCookies();

  if (!pending) {
    return NextResponse.json({ error: "Sesi login tidak ditemukan" }, { status: 401 });
  }

  const outlets = await getActiveOutlets(pending.company_id);

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
    return NextResponse.json({ error: "Outlet tidak valid" }, { status: 400 });
  }

  const token = await signPendingLogin({
    ...pending,
    outlet_id: outlet.id,
    outlet_name: outlet.name,
  });

  return NextResponse.json(
    { outlet_name: outlet.name, outlet_id: outlet.id },
    {
      status: 200,
      headers: { "Set-Cookie": setPendingLoginCookie(token) },
    }
  );
}
