"use client";

import { useEffect, useRef } from "react";
import { formatCurrency, formatDate } from "@/lib/dummy-data";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface OrderItem {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  modifier_label: string | null;
  subtotal: number;
}

interface OrderData {
  id: string;
  order_number: number;
  order_type: string;
  payment_method: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_price: number;
  customer_name: string;
  cashier_name: string | null;
  created_at: string;
  order_items: OrderItem[];
}

export default function InvoicePageClient({ order }: { order: OrderData }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

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
    <div className="min-h-screen bg-neutral-50">
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
      <div ref={printRef} className="max-w-md mx-auto bg-white p-6 sm:p-8 my-4 shadow-sm rounded-2xl sm:my-8">
        <div className="text-center mb-6">
          <h1 className="font-display font-bold text-xl text-neutral-900">STOCKO</h1>
          <p className="text-sm text-neutral-400 mt-1">Invoice #{order.order_number}</p>
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
          {order.order_items.map((item) => (
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
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-neutral-300 mb-3" />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Pajak ({order.tax_rate}%)</span>
            <span className="font-mono">{formatCurrency(order.tax_amount)}</span>
          </div>
          <div className="flex justify-between text-lg font-display font-bold text-neutral-900 pt-2 border-t border-neutral-900">
            <span>Total</span>
            <span className="font-mono">{formatCurrency(order.total_price)}</span>
          </div>
        </div>

        <div className="text-center mt-8 text-xs text-neutral-400">
          <p>Terima kasih atas kunjungan Anda</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          @page { margin: 12mm; size: auto; }
        }
      `}</style>
    </div>
  );
}
