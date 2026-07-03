import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, dateRange } = await request.json();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .order("created_at", { ascending: false });

  const today = new Date();
  const filtered = (orders ?? []).filter((o) => {
    const d = new Date(o.created_at);
    if (dateRange === "today") return d.toDateString() === today.toDateString();
    if (dateRange === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return d.toDateString() === y.toDateString();
    }
    if (dateRange === "week") {
      const w = new Date(today);
      w.setDate(w.getDate() - 7);
      return d >= w;
    }
    return true;
  });

  const totalRevenue = filtered.reduce((s: number, o: { total_price: number }) => s + Number(o.total_price), 0);
  const totalTransactions = filtered.length;

  const itemCounts: Record<string, number> = {};
  filtered.forEach((o: { order_items: Array<{ product_name: string; quantity: number }> }) =>
    o.order_items?.forEach((i: { product_name: string; quantity: number }) => {
      itemCounts[i.product_name] = (itemCounts[i.product_name] || 0) + i.quantity;
    })
  );
  const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];

  const rangeLabel =
    dateRange === "today" ? "Hari Ini"
    : dateRange === "yesterday" ? "Kemarin"
    : dateRange === "week" ? "7 Hari Terakhir"
    : "Semua Waktu";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 24px; margin: 0;">${session.company_name}</h1>
    <p style="color: #666; margin: 4px 0 0;">${session.outlet_name}</p>
    <p style="color: #999; font-size: 13px; margin: 4px 0 0;">Laporan Penjualan — ${rangeLabel}</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <tr>
      <td style="background: #f5f5f5; padding: 16px; text-align: center; border-radius: 12px;">
        <p style="color: #666; font-size: 12px; margin: 0;">Total Transaksi</p>
        <p style="font-size: 28px; font-weight: bold; margin: 4px 0 0;">${totalTransactions}</p>
      </td>
      <td style="width: 12px;"></td>
      <td style="background: #f5f5f5; padding: 16px; text-align: center; border-radius: 12px;">
        <p style="color: #666; font-size: 12px; margin: 0;">Total Pendapatan</p>
        <p style="font-size: 28px; font-weight: bold; margin: 4px 0 0; color: #15803d;">Rp ${totalRevenue.toLocaleString("id-ID")}</p>
      </td>
    </tr>
  </table>

  ${topItem ? `
  <div style="background: #f5f5f5; padding: 12px 16px; border-radius: 12px; margin-bottom: 24px;">
    <p style="color: #666; font-size: 12px; margin: 0;">Item Terlaris</p>
    <p style="font-size: 16px; font-weight: bold; margin: 2px 0 0;">${topItem[0]} (${topItem[1]})</p>
  </div>
  ` : ""}

  <h3 style="font-size: 14px; margin-bottom: 12px;">Daftar Transaksi</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr style="border-bottom: 1px solid #e5e5e5;">
        <th style="text-align: left; padding: 8px; font-size: 12px; color: #999;">Order</th>
        <th style="text-align: left; padding: 8px; font-size: 12px; color: #999;">Waktu</th>
        <th style="text-align: right; padding: 8px; font-size: 12px; color: #999;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${filtered.slice(0, 20).map((o: { order_number: number; created_at: string; total_price: number }) => `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 8px; font-size: 13px; font-weight: 500;">#${o.order_number}</td>
        <td style="padding: 8px; font-size: 13px; color: #666;">${new Date(o.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
        <td style="padding: 8px; font-size: 13px; text-align: right; font-family: monospace;">Rp ${Number(o.total_price).toLocaleString("id-ID")}</td>
      </tr>
      `).join("")}
      ${filtered.length > 20 ? `<tr><td colspan="3" style="padding: 8px; text-align: center; color: #999; font-size: 12px;">... dan ${filtered.length - 20} transaksi lainnya</td></tr>` : ""}
    </tbody>
  </table>

  <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; color: #999; font-size: 12px;">
    <p>Dikirim dari Rakku POS</p>
  </div>
</body>
</html>`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: `Rakku POS <${process.env.RESEND_FROM_EMAIL || "noreply@rakku.app"}>`,
      to: email,
      subject: `Laporan Penjualan ${rangeLabel} — ${session.company_name}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal mengirim email" }, { status: 500 });
  }
}
