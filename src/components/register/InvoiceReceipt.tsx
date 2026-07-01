"use client";

import { useRef } from "react";
import { formatCurrency } from "@/lib/dummy-data";
import { Printer, X } from "lucide-react";

interface InvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  modifier_label: string | null;
}

interface InvoiceReceiptProps {
  orderNumber: number;
  customerName: string;
  cashierName: string | null;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
  orderType: string;
  createdAt: string;
  onClose?: () => void;
}

export default function InvoiceReceipt({
  orderNumber,
  customerName,
  cashierName,
  items,
  subtotal,
  taxAmount,
  total,
  paymentMethod,
  orderType,
  createdAt,
  onClose,
}: InvoiceReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="no-print flex items-center justify-between px-6 py-4 border-b border-neutral-200">
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

      <div className="px-6 py-4 overflow-y-auto">
        <div ref={printRef} className="max-w-sm mx-auto print:max-w-full print:mx-0">
          {/* Header */}
          <div className="text-center mb-6 print:mb-4">
            <h2 className="font-display font-bold text-lg text-neutral-900 print:text-base">
              STOCKO
            </h2>
            <p className="text-xs text-neutral-400">Invoice #{orderNumber}</p>
          </div>

          {/* Info */}
          <div className="text-xs text-neutral-600 space-y-0.5 mb-4 print:mb-3">
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
              <span className="font-medium text-neutral-900 capitalize">{orderType.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between">
              <span>Pembayaran</span>
              <span className="font-medium text-neutral-900 capitalize">
                {paymentMethod === "cash" ? "Tunai" : paymentMethod === "qris" ? "QRIS" : "Kartu"}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-neutral-300 mb-4 print:mb-3" />

          {/* Items */}
          <div className="space-y-2 mb-4 print:mb-3">
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
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-neutral-300 mb-3 print:mb-2" />

          {/* Totals */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Pajak (10%)</span>
              <span className="font-mono">{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-display font-bold text-neutral-900 pt-1 border-t border-neutral-900">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 print:mt-4 text-[10px] text-neutral-400">
            <p>Terima kasih atas kunjungan Anda</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          @page { margin: 12mm; size: auto; }
        }
      `}</style>
    </>
  );
}
