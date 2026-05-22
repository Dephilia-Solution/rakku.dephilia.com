"use client";

import { useState } from "react";
import { useCartStore, useCartTotals } from "@/lib/store/cartStore";
import { formatCurrency } from "@/lib/dummy-data";
import { showToast } from "@/components/shared/Toast";
import { createOrder } from "@/lib/supabase/queries.client";
import { PaymentMethod } from "@/types";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Banknote, QrCode, CreditCard, X, CheckCircle } from "lucide-react";

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

  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const { subtotal, taxAmount, total } = useCartTotals();
  const clear = useCartStore((s) => s.clear);

  const isMobile = useIsMobile();

  const change = cashAmount ? Number(cashAmount) - total : 0;
  const isCashEnough = change >= 0;

  const quickAmounts = [5000, 10000, 20000, 50000];

  const handleSubmit = async () => {
    if (!method) return;
    setIsSubmitting(true);

    try {
      await createOrder({
        orderType,
        paymentMethod: method,
        items,
        subtotal,
        taxAmount,
        total,
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsSubmitting(false);
        clear();
        onClose();
        setMethod(null);
        setCashAmount("");
        showToast("success", "Transaksi berhasil!");
      }, 1500);
    } catch {
      showToast("error", "Gagal menyimpan transaksi");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <>
      {isSuccess ? (
        <div className="py-16 px-8 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mb-4">
            <CheckCircle size={40} className="text-success" />
          </div>
          <p className="font-display font-bold text-lg text-neutral-900">
            Transaksi Berhasil!
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <h3 className="font-display font-semibold text-base text-neutral-900">
              Pembayaran
            </h3>
            <button
              onClick={onClose}
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

                <div className="flex gap-2">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      onClick={() =>
                        setCashAmount((prev) =>
                          (Number(prev) + amt).toString()
                        )
                      }
                      className="flex-1 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 rounded-lg py-2 text-neutral-600 transition-colors"
                    >
                      +{formatCurrency(amt)}
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
                !method || (method === "cash" && (!cashAmount || !isCashEnough))
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
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
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
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-md">
          {content}
        </div>
      </div>
    </div>
  );
}
