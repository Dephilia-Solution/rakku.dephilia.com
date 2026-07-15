"use client";

import { useCallback, useState } from "react";
import { formatCurrency } from "@/lib/dummy-data";
import { AppliedTax, AppliedDiscount } from "@rakku/shared-types";
import { Printer, X, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { isNative } from "@/lib/printer/capacitor-platform";
import {
  getSavedDevice,
  isConnected,
  autoReconnect,
  write,
} from "@/lib/printer/bluetooth-bridge";
import { buildOrderReceipt } from "@/lib/printer/escpos-builder";
import { ReceiptData } from "@/lib/printer/types";
import { showToast } from "@rakku/ui";

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
    orderNumber, customerName, cashierName, items,
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

type PrintState = "idle" | "sending" | "success" | "error";

export default function InvoiceReceipt(props: InvoiceReceiptProps) {
  const {
    orderNumber, customerName, cashierName, items,
    subtotal, appliedTaxes, appliedDiscounts, total, paymentMethod, orderType,
    createdAt, onClose, cashAmount, change,
  } = props;

  const [printState, setPrintState] = useState<PrintState>("idle");
  const [printError, setPrintError] = useState<string>("");

  const handlePrint = useCallback(async () => {
    if (!isNative()) {
      const html = buildReceiptHtml(props);
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Izinkan pop-up untuk mencetak invoice");
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }

    const saved = getSavedDevice();
    if (!saved) {
      showToast("error", "Printer belum diatur. Buka Pengaturan Printer untuk menyambungkan.");
      return;
    }

    let connected = false;
    try {
      connected = await isConnected();
      if (!connected) {
        connected = await autoReconnect();
      }
    } catch {
      connected = false;
    }

    if (!connected) {
      showToast("error", `Printer "${saved.name}" tidak terhubung. Buka Pengaturan Printer.`);
      return;
    }

    setPrintState("sending");
    setPrintError("");
    try {
      const receiptData: ReceiptData = {
        orderNumber,
        customerName,
        cashierName,
        items,
        subtotal,
        appliedTaxes,
        appliedDiscounts,
        total,
        paymentMethod,
        orderType,
        createdAt,
        cashAmount,
        change,
      };
      const bytes = buildOrderReceipt(receiptData);
      await write(bytes);
      setPrintState("success");
      setTimeout(() => setPrintState("idle"), 3000);
    } catch (err) {
      setPrintState("error");
      const msg = err instanceof Error ? err.message : "Gagal mencetak struk";
      setPrintError(msg);
      showToast("error", msg);
      setTimeout(() => setPrintState("idle"), 5000);
    }
  }, [props, orderNumber, customerName, cashierName, items, subtotal, appliedTaxes, appliedDiscounts, total, paymentMethod, orderType, createdAt, cashAmount, change]);

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
            disabled={printState === "sending"}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${
              printState === "success"
                ? "bg-success text-white"
                : printState === "error"
                  ? "bg-danger text-white"
                  : "bg-forest text-white hover:bg-forest-dark"
            }`}
          >
            {printState === "sending" ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Mencetak...
              </>
            ) : printState === "success" ? (
              <>
                <CheckCircle2 size={15} />
                Tercetak
              </>
            ) : printState === "error" ? (
              <>
                <XCircle size={15} />
                Gagal
              </>
            ) : (
              <>
                <Printer size={15} />
                Print
              </>
            )}
          </button>
          {printState === "error" && printError && (
            <div className="text-xs text-danger mr-2 max-w-[160px] truncate" title={printError}>
              {printError}
            </div>
          )}
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
