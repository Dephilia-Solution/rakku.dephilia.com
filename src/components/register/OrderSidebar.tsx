"use client";

import { useState, useEffect } from "react";
import { useCartStore, useCartTotals, useCartGroupedArray } from "@/lib/store/cartStore";
import { formatCurrency } from "@/lib/dummy-data";
import QtyControl from "@/components/shared/QtyControl";
import EmptyState from "@/components/shared/EmptyState";
import { Trash2, ShoppingBag, X, Clock } from "lucide-react";

interface OrderSidebarProps {
  onCheckout: () => void;
  isDrawer?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenDraft?: () => void;
}

export default function OrderSidebar({
  onCheckout,
  isDrawer = false,
  isOpen = false,
  onClose,
  onOpenDraft,
}: OrderSidebarProps) {
  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const customerName = useCartStore((s) => s.customerName);
  const setCustomerName = useCartStore((s) => s.setCustomerName);
  const incrementQty = useCartStore((s) => s.incrementQty);
  const decrementQty = useCartStore((s) => s.decrementQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);
  const { subtotal, taxRate, taxAmount, total } = useCartTotals();
  const groupedCart = useCartGroupedArray();

  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    const fetchDraftCount = async () => {
      try {
        const res = await fetch("/api/admin/orders/draft");
        if (res.ok) {
          const data = await res.json();
          setDraftCount(data.length);
        }
      } catch {}
    };
    fetchDraftCount();
    const interval = setInterval(fetchDraftCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const content = (
    <>
      <div className="px-5 py-4 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-semibold text-base text-neutral-900">
            Current Order
          </h2>
          <div className="flex items-center gap-2">
            {onOpenDraft && (
              <button
                onClick={onOpenDraft}
                className="relative p-1.5 rounded-lg border border-forest/40 text-forest hover:bg-forest/5 transition-colors"
                title="Pesanan Draft"
              >
                {draftCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shadow-sm">
                    {draftCount > 99 ? "99+" : draftCount}
                  </span>
                )}
                <Clock size={16} />
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={clear}
                className="text-neutral-400 hover:text-danger transition-colors"
                title="Clear cart"
              >
                <Trash2 size={16} />
              </button>
            )}
            {isDrawer && onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setOrderType("dine_in")}
            className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
              orderType === "dine_in"
                ? "bg-forest text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Walk-in
          </button>
          <button
            onClick={() => setOrderType("delivery")}
            className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
              orderType === "delivery"
                ? "bg-forest text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Delivery
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Belum ada pesanan"
            description="Klik produk dari menu untuk memulai pesanan"
          />
        ) : (
          groupedCart.map(({ category, items: catItems }) => (
            <div key={category} className="mb-4">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                {category}
              </div>
              {catItems.map((item) => (
                <div key={item.id} className="pb-3 border-b border-neutral-100 last:border-0 mb-2">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {item.product.name}
                      </p>
                      {item.modifier_label && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {item.modifier_label}
                        </p>
                      )}
                      {item.pricing_option_name && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          ({item.pricing_option_name})
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-neutral-300 hover:text-danger ml-2 mt-0.5 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <QtyControl
                      quantity={item.quantity}
                      onIncrement={() => incrementQty(item.id)}
                      onDecrement={() => decrementQty(item.id)}
                      min={1}
                    />
                    <span className="font-mono text-sm font-semibold text-neutral-900">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="px-5 py-3 border-t border-neutral-200 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nama Customer (wajib)"
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
          />
        </div>
        <div className="flex justify-between text-sm text-neutral-600">
          <span>Subtotal</span>
          <span className="font-mono">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-neutral-600">
          <span>Tax ({taxRate}%)</span>
          <span className="font-mono">{formatCurrency(taxAmount)}</span>
        </div>
        <div className="flex justify-between text-base font-display font-bold text-neutral-900 pt-1 border-t border-neutral-200">
          <span>Total</span>
          <span className="font-mono">{formatCurrency(total)}</span>
        </div>
        <button
          onClick={onCheckout}
          disabled={items.length === 0 || !customerName.trim()}
          className="w-full bg-forest text-white rounded-xl px-6 py-3 font-semibold text-sm hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          Proceed to Payment
        </button>
      </div>
    </>
  );

  if (isDrawer) {
    return (
      <>
        {isOpen && (
          <div
            className={`fixed inset-0 bg-black/40 z-[60] lg:hidden transition-opacity duration-300 ${
              isOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={onClose}
          />
        )}
        <div
          className={`fixed top-0 right-0 h-full w-[380px] max-w-[85vw] bg-white z-[60] shadow-2xl flex flex-col transition-transform duration-300 ease-out lg:hidden pb-safe ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {content}
        </div>
      </>
    );
  }

  return (
    <div className="w-[380px] border-l border-neutral-200 bg-white flex flex-col h-full hidden lg:flex">
      {content}
    </div>
  );
}
