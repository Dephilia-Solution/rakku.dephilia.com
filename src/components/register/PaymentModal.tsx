"use client";

import { useState } from "react";
import { useCartStore, useCartTotals, useCartGroupedArray } from "@/lib/store/cartStore";
import { formatCurrency } from "@/lib/dummy-data";
import { showToast } from "@/components/shared/Toast";
import { createOrder } from "@/lib/supabase/queries.client";
import InvoiceReceipt from "@/components/register/InvoiceReceipt";
import { PaymentMethod } from "@/types";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Banknote, QrCode, CreditCard, X } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const paymentMethods: {
  value: PaymentMethod;
  label: string;
  icon: typeof Banknote;
}[] = [
  { value: "cash", label: "Tunai", icon: Banknote },
  { value: "qris", label: "QRIS", icon: QrCode },
  { value: "card", label: "Kartu", icon: CreditCard },
];

export default function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [invoiceData, setInvoiceData] = useState<{
    orderNumber: number;
    createdAt: string;
  } | null>(null);

  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const customerName = useCartStore((s) => s.customerName);
  const setCustomerName = useCartStore((s) => s.setCustomerName);
  const { subtotal, taxAmount, total } = useCartTotals();
  const clear = useCartStore((s) => s.clear);
  const groupedCart = useCartGroupedArray();

  const isMobile = useIsMobile();

  const change = cashAmount ? Number(cashAmount) - total : 0;
  const isCashEnough = change >= 0;

  // Generate dynamic payment suggestions based on total
  const paymentSuggestions = (() => {
    const suggestions: number[] = [];

    // 1. Saran "pas" - sesuai total
    suggestions.push(total);

    // 2. Pembulatan ke atas ke pecahan terdekat (10rb, 50rb, 100rb, 200rb, 500rb)
    for (const denom of [10000, 50000, 100000, 200000, 500000]) {
      const rounded = Math.ceil(total / denom) * denom;
      if (rounded > total && rounded <= total * 3) {
        suggestions.push(rounded);
      }
    }

    // 3. Tambahkan pecahan umum yang relevan (dekat dengan total)
    const denominations = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
    const nextDenominations = denominations.filter((d) => d > total && d <= total * 2);
    suggestions.push(...nextDenominations);

    // 4. Deduplicate dan sort, ambil maksimal 6 saran
    return Array.from(new Set(suggestions)).sort((a, b) => a - b).slice(0, 6);
  })();

  const handleClose = () => {
    setIsSuccess(false);
    setInvoiceData(null);
    setMethod(null);
    setCashAmount("");
    clear();
    onClose();
  };

  const handleSubmit = async () => {
    if (!method) return;
    if (!customerName.trim()) {
      showToast("error", "Nama customer wajib diisi");
      return;
    }
    setIsSubmitting(true);

    // Get tenant session for tenant-scoped order
    let companyId: string | undefined;
    let outletId: string | undefined;
    let cashierId: string | undefined;
    try {
      const res = await fetch("/api/auth/tenant/session");
      if (res.ok) {
        const s = await res.json();
        companyId = s.company_id;
        outletId = s.outlet_id;
        cashierId = s.user_id;
      }
    } catch {}

    try {
      const order = await createOrder({
        orderType,
        paymentMethod: method,
        items,
        subtotal,
        taxAmount,
        total,
        customerName: customerName.trim(),
        status: "completed",
        paymentStatus: "paid",
        companyId,
        outletId,
        cashierId,
      });

      setInvoiceData({
        orderNumber: order.order_number,
        createdAt: new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      setIsSuccess(true);
      setIsSubmitting(false);
    } catch {
      showToast("error", "Gagal menyimpan transaksi");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <>
      {isSuccess && invoiceData ? (
        <InvoiceReceipt
          orderNumber={invoiceData.orderNumber}
          customerName={customerName}
          cashierName={null}
          items={items.map((i) => ({
            product_name: i.product.name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            subtotal: i.subtotal,
            modifier_label: i.modifier_label,
          }))}
          subtotal={subtotal}
          taxAmount={taxAmount}
          total={total}
          paymentMethod={method ?? "cash"}
          orderType={orderType}
          createdAt={invoiceData.createdAt}
          onClose={handleClose}
        />
      ) : (
        <>
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <h3 className="font-display font-semibold text-base text-neutral-900">
              Pembayaran
            </h3>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-6 py-4 space-y-5 overflow-y-auto">
            <div className="text-center">
              <p className="text-sm text-neutral-400 mb-1">Total Pembayaran</p>
              <p className="font-mono text-3xl font-bold text-neutral-900">
                {formatCurrency(total)}
              </p>
            </div>

            {/* Customer Name */}
            <div>
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                Nama Customer <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Masukkan nama customer"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
            </div>

            {/* Order Summary Grouped */}
            <div>
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
                Ringkasan Pesanan
              </p>
              <div className="bg-neutral-50 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
                {groupedCart.map(({ category, items: catItems }) => (
                  <div key={category}>
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                      {category}
                    </p>
                    {catItems.map((item) => (
                      <div key={item.id} className="flex justify-between text-xs text-neutral-700 ml-2 mb-0.5">
                        <span className="truncate">
                          {item.quantity}x {item.product.name}
                          {item.pricing_option_name && ` (${item.pricing_option_name})`}
                        </span>
                        <span className="font-mono ml-2">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
                Metode Pembayaran
              </p>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map((pm) => {
                  const Icon = pm.icon;
                  const selected = method === pm.value;
                  return (
                    <button
                      key={pm.value}
                      onClick={() => {
                        setMethod(pm.value);
                        if (pm.value !== "cash") setCashAmount("");
                      }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        selected
                          ? "border-forest bg-primary-50"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <Icon
                        size={24}
                        className={selected ? "text-forest" : "text-neutral-400"}
                      />
                      <span
                        className={`text-xs font-medium ${
                          selected ? "text-forest" : "text-neutral-600"
                        }`}
                      >
                        {pm.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {method === "cash" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                    Nominal Pembayaran
                  </label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="0"
                    className="w-full text-3xl font-mono font-bold text-neutral-900 bg-neutral-50 rounded-xl px-4 py-3 border border-neutral-200 focus:border-forest focus:ring-1 focus:ring-forest outline-none text-right"
                  />
                </div>

                <div className="flex gap-2 flex-wrap">
                  {paymentSuggestions.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCashAmount(amt.toString())}
                      className={`flex-1 min-w-[80px] text-xs font-medium rounded-lg py-2 transition-colors ${
                        cashAmount === amt.toString()
                          ? "bg-forest text-white"
                          : "bg-neutral-100 hover:bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {formatCurrency(amt)}
                    </button>
                  ))}
                </div>

                {cashAmount && Number(cashAmount) > 0 && (
                  <div className="flex justify-between text-sm bg-neutral-50 rounded-xl px-4 py-3">
                    <span className="text-neutral-600">Kembalian</span>
                    <span
                      className={`font-mono font-semibold ${
                        isCashEnough ? "text-success" : "text-danger"
                      }`}
                    >
                      {isCashEnough
                        ? formatCurrency(change)
                        : `-${formatCurrency(Math.abs(change))}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={
                !method || !customerName.trim() || (method === "cash" && (!cashAmount || !isCashEnough))
              }
              className="w-full bg-forest text-white rounded-xl px-6 py-3.5 font-semibold text-sm hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Selesaikan Transaksi"
              )}
            </button>
          </div>
        </>
      )}
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[90] flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-up pb-safe">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-neutral-300" />
          </div>
          <div className="overflow-y-auto">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-md">
          {content}
        </div>
      </div>
    </div>
  );
}
