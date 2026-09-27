"use client";

import { useCallback } from "react";
import { formatCurrency } from "@/lib/format";
import { AppliedTax, AppliedDiscount } from "@rakku/shared-types";
import { Printer, X } from "lucide-react";

interface InvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  modifier_label: string | null;
  note: string | null;
}

interface InvoiceReceiptProps {
  orderNumber: number;
  customerName: string;
  cashierName: string | null;
  tableName?: string | null;
  items: InvoiceItem[];
  subtotal: number;
  appliedTaxes: AppliedTax[];
  appliedDiscounts: AppliedDiscount[];
  total: number;
  paymentMethod: string;
  orderType: string;
  createdAt: string;
  onClose?: () => void;
  cashAmount?: number;
  change?: number;
}

function buildReceiptHtml(props: InvoiceReceiptProps) {
  const {
    orderNumber, customerName, cashierName, tableName, items,
    subtotal, appliedTaxes, appliedDiscounts, total, paymentMethod, orderType,
    createdAt, cashAmount, change,
  } = props;

  const paymentLabel =
    paymentMethod === "cash" ? "Tunai" :
    paymentMethod === "qris" ? "QRIS" :
    paymentMethod === "card" ? "Kartu" : paymentMethod;

  const itemRows = items
    .map(
      (item) => `
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
    ${item.note ? `<tr><td colspan="2" style="font-size:8px;color:#888;font-style:italic;padding:0 0 4px 12px;">Catatan: ${item.note}</td></tr>` : ""}`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice #${orderNumber}</title>
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
    <p>Invoice #${orderNumber}</p>
  </div>

  <div class="divider"></div>

  <table class="info-table">
    <tr><td>Tanggal</td><td>${createdAt}</td></tr>
    <tr><td>Customer</td><td>${customerName}</td></tr>
    ${tableName ? `<tr><td>Meja</td><td>${tableName}</td></tr>` : ""}
    ${cashierName ? `<tr><td>Kasir</td><td>${cashierName}</td></tr>` : ""}
    <tr><td>Tipe</td><td style="text-transform:capitalize">${orderType.replace(/_/g, " ")}</td></tr>
    <tr><td>Pembayaran</td><td>${paymentLabel}</td></tr>
  </table>

  <div class="divider"></div>

  <table class="items">
    ${itemRows}
  </table>

  <div class="divider"></div>

  <table class="totals-table">
    <tr><td>Subtotal</td><td>${formatCurrency(subtotal)}</td></tr>
    ${appliedDiscounts.map((d) => `<tr><td>${d.name}</td><td>-${formatCurrency(d.amount)}</td></tr>`).join("")}
    ${appliedTaxes.map((t) => `<tr><td>${t.name}${t.type === 'percentage' ? ` (${t.value}%)` : ''}</td><td>${formatCurrency(t.amount)}</td></tr>`).join("")}
    ${cashAmount != null ? `<tr><td>Uang Tunai</td><td>${formatCurrency(cashAmount)}</td></tr>` : ""}
    ${change != null ? `<tr><td>Kembalian</td><td>${formatCurrency(change)}</td></tr>` : ""}
    <tr class="grand-total">
      <td>Total</td>
      <td>${formatCurrency(total)}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <div class="footer">
    <p>Terima kasih atas kunjungan Anda</p>
  </div>
</body>
</html>`;
}

export default function InvoiceReceipt(props: InvoiceReceiptProps) {
  const {
    orderNumber, customerName, cashierName, tableName, items,
    subtotal, appliedTaxes, appliedDiscounts, total, paymentMethod, orderType,
    createdAt, onClose, cashAmount, change,
  } = props;

  const handlePrint = useCallback(() => {
    const html = buildReceiptHtml(props);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "-9999px";
    iframe.style.bottom = "-9999px";
    iframe.style.width = "58mm";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      alert("Izinkan pop-up untuk mencetak invoice");
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    const cleanup = () => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };
    if (iframe.contentWindow) {
      iframe.contentWindow.onafterprint = cleanup;
    }
    setTimeout(cleanup, 1000);
  }, [props]);

  const paymentLabel =
    paymentMethod === "cash" ? "Tunai" :
    paymentMethod === "qris" ? "QRIS" :
    paymentMethod === "card" ? "Kartu" : paymentMethod;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
        <h3 className="font-display font-semibold text-base text-neutral-900">
          Invoice
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="bg-forest text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-forest-dark transition-colors flex items-center gap-1.5"
          >
            <Printer size={15} />
            Print
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-4 overflow-y-auto flex-1">
        <div className="max-w-[58mm] mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="font-display text-xl font-bold text-neutral-900">
              RAKKU
            </h2>
            <p className="text-xs text-neutral-400">Invoice #{orderNumber}</p>
          </div>

          {/* Info */}
          <div className="text-xs text-neutral-600 space-y-0.5 mb-4">
            <div className="flex justify-between">
              <span>Tanggal</span>
              <span className="font-medium text-neutral-900">{createdAt}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer</span>
              <span className="font-medium text-neutral-900">{customerName}</span>
            </div>
            {tableName && (
              <div className="flex justify-between">
                <span>Meja</span>
                <span className="font-medium text-neutral-900">{tableName}</span>
              </div>
            )}
            {cashierName && (
              <div className="flex justify-between">
                <span>Kasir</span>
                <span className="font-medium text-neutral-900">{cashierName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tipe</span>
              <span className="font-medium text-neutral-900 capitalize">
                {orderType.replace("_", " ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Pembayaran</span>
              <span className="font-medium text-neutral-900 capitalize">
                {paymentLabel}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-neutral-300 mb-4" />

          {/* Items */}
          <div className="space-y-2 mb-4">
            {items.map((item, idx) => (
              <div key={idx} className="text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-900 font-medium flex-1">
                    {item.product_name}
                  </span>
                  <span className="font-mono text-neutral-900 ml-2">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-400 pl-2">
                  <span>
                    {item.quantity}x {formatCurrency(item.unit_price)}
                    {item.modifier_label && ` — ${item.modifier_label}`}
                  </span>
                </div>
                {item.note && (
                  <div className="text-neutral-400 italic pl-2">
                    Catatan: {item.note}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-neutral-300 mb-3" />

          {/* Totals */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {appliedDiscounts.map((d, i) => (
              <div key={i} className="flex justify-between text-success">
                <span>{d.name}</span>
                <span className="font-mono">-{formatCurrency(d.amount)}</span>
              </div>
            ))}
            {appliedTaxes.map((t, i) => (
              <div key={i} className="flex justify-between text-neutral-600">
                <span>{t.name}{t.type === "percentage" ? ` (${t.value}%)` : ""}</span>
                <span className="font-mono">{formatCurrency(t.amount)}</span>
              </div>
            ))}
            {cashAmount != null && (
              <div className="flex justify-between text-neutral-600">
                <span>Uang Tunai</span>
                <span className="font-mono">{formatCurrency(cashAmount)}</span>
              </div>
            )}
            {change != null && (
              <div className="flex justify-between text-neutral-600">
                <span>Kembalian</span>
                <span className="font-mono">{formatCurrency(change)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-display font-bold text-neutral-900 pt-1 border-t border-neutral-900">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 text-[10px] text-neutral-400">
            <p>Terima kasih atas kunjungan Anda</p>
          </div>
        </div>
      </div>
    </div>
  );
}
