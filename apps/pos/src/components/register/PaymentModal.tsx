"use client";

import { useState, useEffect } from "react";
import { useCartStore, useCartTotals, useCartGroupedArray } from "@/lib/store/cartStore";
import { formatCurrency } from "@/lib/format";
import { showToast } from "@rakku/ui";
import { createOrder } from "@/lib/supabase/queries.client";
import InvoiceReceipt from "@/components/register/InvoiceReceipt";
import { PaymentMethod, SplitPayment } from "@rakku/shared-types";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useModalHistory } from "@/hooks/useModalHistory";
import { usePlan } from "@/components/billing/PlanProvider";
import SplitBillSheet from "@/components/register/SplitBillSheet";
import { Banknote, QrCode, CreditCard, X, Users } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderComplete?: () => void;
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

export default function PaymentModal({ isOpen, onClose, onOrderComplete }: PaymentModalProps) {
  const { openUpgrade } = usePlan();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splitBillMode, setSplitBillMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [cashierName, setCashierName] = useState<string | null>(null);

  const [invoiceData, setInvoiceData] = useState<{
    orderNumber: number;
    createdAt: string;
  } | null>(null);

  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const customerName = useCartStore((s) => s.customerName);
  const setCustomerName = useCartStore((s) => s.setCustomerName);
  const tableId = useCartStore((s) => s.tableId);
  const tableName = useCartStore((s) => s.tableName);
  const pricingTierId = useCartStore((s) => s.pricingTierId);
  const draftOrderId = useCartStore((s) => s.draftOrderId);
  const setCartSplitPayments = useCartStore((s) => s.setSplitPayments);
  const cartTotals = useCartTotals();
  const { subtotal, appliedTaxes, appliedDiscounts, total } = cartTotals;
  const clear = useCartStore((s) => s.clear);
  const groupedCart = useCartGroupedArray();

  const isMobile = useIsMobile();
  const { handleCloseAndPop } = useModalHistory(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
      setInvoiceData(null);
      setMethod(null);
      setCashAmount("");
      setSplitBillMode(false);
      setSplitPayments([]);
      setShowSplit(false);
      setCashierName(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/auth/tenant/session")
        .then((res) => res.ok ? res.json() : null)
        .then((s) => {
          if (s) setCashierName(s.user_name);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showSplit) onClose();
    };
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, showSplit]);

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

  const splitTotal = splitPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const handleCancel = () => {
    onClose();
  };

  const cancelSplit = () => {
    setSplitBillMode(false);
    setSplitPayments([]);
    setShowSplit(false);
  };

  const handleSuccessClose = () => {
    setIsSuccess(false);
    setInvoiceData(null);
    setMethod(null);
    setCashAmount("");
    setSplitBillMode(false);
    setSplitPayments([]);
    setShowSplit(false);
    setCashierName(null);
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

    // Get tenant session
    let companyId: string | undefined;
    let outletId: string | undefined;
    let cashierId: string | undefined;
    let cashierNameFromSession: string | null = null;
    try {
      const res = await fetch("/api/auth/tenant/session");
      if (res.ok) {
        const s = await res.json();
        companyId = s.company_id;
        outletId = s.outlet_id;
        cashierId = s.user_id;
        cashierNameFromSession = s.user_name;
      }
    } catch {}

    const finalSplitPayments = splitBillMode ? splitPayments : [];
    const paymentStatus = finalSplitPayments.length > 0 ? "partial" : "paid";

    try {
      let order: { order_number: number };

      if (draftOrderId) {
        // Complete existing draft
        const mappedItems = items.map((i) => ({
          product_id: i.product.id,
          product_name: i.product.name,
          unit_price: i.unit_price,
          quantity: i.quantity,
          modifier_label: i.modifier_label,
          note: i.note,
          subtotal: i.subtotal,
        }));

        const res = await fetch(`/api/admin/orders/draft?id=${draftOrderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "completed",
            payment_status: paymentStatus,
            payment_method: method,
            cashier_name: cashierNameFromSession,
            pricing_tier_id: pricingTierId,
            table_id: tableId,
            subtotal,
            tax_rate: 0,
            tax_amount: 0,
            taxes: appliedTaxes.map(t => ({ name: t.name, type: t.type, value: t.value, amount: t.amount })),
            discounts: appliedDiscounts.map(d => ({ name: d.name, type: d.type, value: d.value, amount: d.amount })),
            total_price: total,
            order_type: orderType,
            items: mappedItems,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const error = new Error(
            data.error ?? "Gagal menyelesaikan draft"
          ) as Error & { code?: string };
          error.code = data.code;
          throw error;
        }
        order = await res.json();
      } else {
        // Create new order
        order = await createOrder({
          orderType,
          paymentMethod: method,
          items,
          subtotal,
          taxAmount: 0,
          total,
          taxes: appliedTaxes.map(t => ({ name: t.name, type: t.type, value: t.value, amount: t.amount })),
          discounts: appliedDiscounts.map(d => ({ name: d.name, type: d.type, value: d.value, amount: d.amount })),
          customerName: customerName.trim(),
          tableId,
          status: "completed",
          paymentStatus,
          companyId,
          outletId,
          cashierId,
          pricingTierId,
          splitPayments: finalSplitPayments,
        });
      }

      if (finalSplitPayments.length > 0) {
        setCartSplitPayments(finalSplitPayments);
      }

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
      onOrderComplete?.();
    } catch (err) {
      const planError =
        err instanceof Error &&
        (err as Error & { code?: string }).code === "PLAN_LIMIT";
      if (planError) {
        openUpgrade((err as Error).message);
      } else {
        showToast("error", "Gagal menyimpan transaksi");
      }
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <>
      {isSuccess && invoiceData ? (
        <div className="flex flex-col flex-1 min-h-0">
          <InvoiceReceipt
            orderNumber={invoiceData.orderNumber}
            customerName={customerName}
            cashierName={cashierName}
            tableName={tableName}
            items={items.map((i) => ({
              product_name: i.product.name,
              quantity: i.quantity,
              unit_price: i.unit_price,
              subtotal: i.subtotal,
              modifier_label: i.modifier_label,
              note: i.note,
            }))}
            subtotal={subtotal}
            appliedTaxes={appliedTaxes}
            appliedDiscounts={appliedDiscounts}
            total={total}
            paymentMethod={method ?? "cash"}
            orderType={orderType}
            createdAt={invoiceData.createdAt}
            onClose={handleSuccessClose}
            cashAmount={method === "cash" ? (Number(cashAmount) || undefined) : undefined}
            change={method === "cash" ? (change >= 0 ? change : undefined) : undefined}
          />
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-200">
            <h3 className="font-display font-semibold text-base text-neutral-900">
              Pembayaran
            </h3>
            <button
              onClick={handleCancel}
              aria-label="Tutup"
              className="w-11 h-11 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600 active:scale-95 transition-all flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-5">
            <div className="text-center">
              <p className="text-sm text-neutral-400 mb-1">Total Pembayaran</p>
              <p className="font-mono text-3xl font-bold text-neutral-900">
                {formatCurrency(total)}
              </p>
            </div>

            {/* Customer Name */}
            <div>
              <label
                htmlFor="payment-customer-name"
                className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block"
              >
                Nama Customer <span className="text-danger">*</span>
              </label>
              <input
                id="payment-customer-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Masukkan nama customer"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-base text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
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
                      aria-pressed={selected}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        selected
                          ? "border-forest bg-primary-50"
                          : "border-neutral-200 hover:border-neutral-300 active:border-neutral-400"
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
                  <label
                    htmlFor="payment-cash-amount"
                    className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block"
                  >
                    Nominal Pembayaran
                  </label>
                  <input
                    id="payment-cash-amount"
                    type="number"
                    inputMode="numeric"
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
                      className={`flex-1 min-w-[80px] text-xs font-medium rounded-lg py-3 transition-colors cursor-pointer ${
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
                      className={`font-mono font-semibold flex items-center gap-1 ${
                        isCashEnough ? "text-success" : "text-danger"
                      }`}
                    >
                      {isCashEnough
                        ? formatCurrency(change)
                        : `-${formatCurrency(Math.abs(change))}`}
                      {!isCashEnough && (
                        <span className="text-[10px] text-danger">kurang</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Split Bill */}
            {splitBillMode ? (
              <div className="flex items-center justify-between gap-2 bg-neutral-50 rounded-xl px-4 py-3 border border-neutral-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Users size={16} className="text-forest flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-700">Split Bill aktif</p>
                    <p className="text-xs text-neutral-400 truncate">
                      {splitPayments.length} pembayaran · {formatCurrency(splitTotal)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => setShowSplit(true)}
                    className="text-xs font-medium text-forest hover:bg-primary-50 rounded-lg px-3 py-2 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={cancelSplit}
                    className="text-xs font-medium text-danger hover:bg-red-50 rounded-lg px-3 py-2 transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setSplitBillMode(true);
                  setShowSplit(true);
                }}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium text-neutral-600 bg-neutral-50 rounded-xl px-4 py-3.5 hover:bg-neutral-100 active:scale-[0.98] transition-all border border-dashed border-neutral-300 cursor-pointer"
              >
                <Users size={16} />
                Split Bill
              </button>
            )}
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-neutral-200 bg-white">
            <button
              onClick={handleSubmit}
              disabled={
                !method || !customerName.trim() || (method === "cash" && (!cashAmount || !isCashEnough)) ||
                (splitBillMode && splitPayments.length === 0)
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
        </div>
      )}
    </>
  );

  return (
    <>
      {isMobile ? (
        <div className="fixed inset-0 z-[90] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={handleCloseAndPop} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pembayaran"
            className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90dvh] animate-slide-up pb-safe"
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-neutral-300" />
            </div>
            <div className="flex flex-col flex-1 min-h-0">{content}</div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={handleCloseAndPop}>
          <div className="min-h-full flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Pembayaran"
              className="bg-white rounded-2xl shadow-md w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              {content}
            </div>
          </div>
        </div>
      )}

      {showSplit && (
        <SplitBillSheet
          items={items}
          total={total}
          splitPayments={splitPayments}
          onSplitChange={setSplitPayments}
          onCancel={cancelSplit}
          onContinue={() => setShowSplit(false)}
        />
      )}
    </>
  );
}