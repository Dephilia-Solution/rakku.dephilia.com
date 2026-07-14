"use client";

import { useCallback } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Printer, ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";
import type { OwnerOrderWithItems } from "@/lib/supabase/queries.data";

function buildReceiptHtml(order: OwnerOrderWithItems) {
  const paymentLabel =
    order.payment_method === "cash" ? "Tunai" :
    order.payment_method === "qris" ? "QRIS" :
    order.payment_method === "card" ? "Kartu" : order.payment_method;

  const itemRows = order.items
    .map((item) => `
    <tr>
      <td colspan="2" style="font-size:9px;padding:2px 0;">
        <strong>${item.product_name}</strong>
      </td>
    </tr>
    <tr>
      <td style="font-size:8px;color:#555;padding:0 0 4px 8px;">
        ${item.quantity}x ${formatCurrency(item.unit_price)}
        ${item.modifier_label ? ` — ${item.modifier_label}` : ""}
      </td>
      <td style="font-size:8px;color:#555;text-align:right;padding:0 0 4px 0;">
        ${formatCurrency(item.subtotal)}
      </td>
    </tr>
    ${item.note ? `<tr><td colspan="2" style="font-size:8px;color:#888;font-style:italic;padding:0 0 4px 12px;">Catatan: ${item.note}</td></tr>` : ""}`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice #${order.order_number}</title>
  <style>
    @page { margin: 0; size: 58mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Consolas', monospace;
      width: 58mm;
      padding: 6mm 4mm;
      color: #222;
      font-size: 9px;
      line-height: 1.35;
    }
    .header { text-align: center; margin-bottom: 8px; }
    .header h1 { font-size: 14px; font-weight: bold; letter-spacing: 1px; }
    .header p { font-size: 8px; color: #555; }
    .divider { border-top: 1px dashed #999; margin: 5px 0; }
    .info-table { width: 100%; font-size: 8px; }
    .info-table td { padding: 1px 0; }
    .info-table td:last-child { text-align: right; }
    table.items { width: 100%; border-collapse: collapse; }
    .totals-table { width: 100%; font-size: 9px; }
    .totals-table td { padding: 2px 0; }
    .totals-table td:last-child { text-align: right; font-family: 'Courier New', monospace; }
    .grand-total { font-size: 11px; font-weight: bold; }
    .grand-total td { padding-top: 4px; border-top: 1px solid #222; }
    .footer { text-align: center; margin-top: 10px; font-size: 8px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RAKKU</h1>
    <p>${order.outlet_name || ""}</p>
    <p>Invoice #${order.order_number}</p>
  </div>

  <div class="divider"></div>

  <table class="info-table">
    <tr><td>Tanggal</td><td>${formatDate(order.created_at)}</td></tr>
    <tr><td>Customer</td><td>${order.customer_name}</td></tr>
    ${order.cashier_name ? `<tr><td>Kasir</td><td>${order.cashier_name}</td></tr>` : ""}
    <tr><td>Tipe</td><td style="text-transform:capitalize">${order.order_type.replace(/_/g, " ")}</td></tr>
    <tr><td>Pembayaran</td><td>${paymentLabel}</td></tr>
  </table>

  <div class="divider"></div>

  <table class="items">
    ${itemRows}
  </table>

  <div class="divider"></div>

  <table class="totals-table">
    <tr><td>Subtotal</td><td>${formatCurrency(order.subtotal)}</td></tr>
    ${(order.discounts ?? []).map((d) => `<tr><td>${d.name}</td><td>-${formatCurrency(d.amount)}</td></tr>`).join("")}
    ${(order.taxes ?? []).map((t) => `<tr><td>${t.name}${t.type === "percentage" ? ` (${t.value}%)` : ""}</td><td>${formatCurrency(t.amount)}</td></tr>`).join("")}
    <tr class="grand-total">
      <td>Total</td>
      <td>${formatCurrency(order.total_price)}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <div class="footer">
    <p>Terima kasih atas kunjungan Anda</p>
  </div>
</body>
</html>`;
}

export default function InvoicePageClient({ order }: { order: OwnerOrderWithItems }) {
  const handlePrint = useCallback(() => {
    const html = buildReceiptHtml(order);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Izinkan pop-up untuk mencetak invoice");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [order]);

  const paymentLabel =
    order.payment_method === "cash"
      ? "Tunai"
      : order.payment_method === "qris"
      ? "QRIS"
      : order.payment_method === "card"
      ? "Kartu"
      : order.payment_method;

  const orderTypeLabel = order.order_type.replace("_", " ");

  return (
    <div className="min-h-screen bg-neutral-50 -m-4 lg:-m-8">
      {/* Toolbar */}
      <div className="no-print sticky top-0 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between z-10">
        <Link
          href="/orders"
          className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft size={16} />
          Kembali
        </Link>
        <button
          onClick={handlePrint}
          className="bg-forest text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-forest-dark transition-colors flex items-center gap-1.5"
        >
          <Printer size={15} />
          Print
        </button>
      </div>

      {/* Invoice Content */}
      <div className="invoice-card max-w-md mx-auto bg-white p-6 sm:p-8 my-4 shadow-sm rounded-2xl sm:my-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-neutral-900 tracking-wide">RAKKU</h1>
          <p className="text-sm text-neutral-400 mt-1">
            <span className="inline-flex items-center gap-1">
              <Building2 size={12} />
              {order.outlet_name || "Outlet"}
            </span>
          </p>
          <p className="text-sm text-neutral-400 mt-0.5">Invoice #{order.order_number}</p>
        </div>

        <div className="text-sm text-neutral-600 space-y-1 mb-6">
          <div className="flex justify-between">
            <span>Tanggal</span>
            <span className="font-medium text-neutral-900">{formatDate(order.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span>Customer</span>
            <span className="font-medium text-neutral-900">{order.customer_name}</span>
          </div>
          {order.cashier_name && (
            <div className="flex justify-between">
              <span>Kasir</span>
              <span className="font-medium text-neutral-900">{order.cashier_name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Tipe</span>
            <span className="font-medium text-neutral-900 capitalize">{orderTypeLabel}</span>
          </div>
          <div className="flex justify-between">
            <span>Pembayaran</span>
            <span className="font-medium text-neutral-900">{paymentLabel}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-neutral-300 mb-4" />

        <div className="space-y-3 mb-4">
          {order.items.map((item) => (
            <div key={item.id} className="text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-900 font-medium">{item.product_name}</span>
                <span className="font-mono text-neutral-900">{formatCurrency(item.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-neutral-400 pl-2 mt-0.5">
                <span>
                  {item.quantity}x {formatCurrency(item.unit_price)}
                  {item.modifier_label && ` — ${item.modifier_label}`}
                </span>
              </div>
              {item.note && (
                <div className="text-xs text-neutral-400 italic pl-2">
                  Catatan: {item.note}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-neutral-300 mb-3" />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(order.subtotal)}</span>
          </div>
          {(order.discounts ?? []).map((d, i) => (
            <div key={i} className="flex justify-between text-green-600">
              <span>{d.name}</span>
              <span className="font-mono">-{formatCurrency(d.amount)}</span>
            </div>
          ))}
          {(order.taxes ?? []).map((t, i) => (
            <div key={i} className="flex justify-between text-neutral-600">
              <span>{t.name}{t.type === "percentage" ? ` (${t.value}%)` : ""}</span>
              <span className="font-mono">{formatCurrency(t.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between text-lg font-bold text-neutral-900 pt-2 border-t border-neutral-900">
            <span>Total</span>
            <span className="font-mono">{formatCurrency(order.total_price)}</span>
          </div>
        </div>

        <div className="text-center mt-8 text-xs text-neutral-400">
          <p>Terima kasih atas kunjungan Anda</p>
        </div>
      </div>
    </div>
  );
}
