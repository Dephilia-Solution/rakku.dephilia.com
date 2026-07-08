"use client";

import { useState, useEffect } from "react";
import { useCartStore, useCartTotals, useCartGroupedByProduct } from "@/lib/store/cartStore";
import { formatCurrency } from "@/lib/dummy-data";
import { showToast, EmptyState } from "@rakku/ui";
import ItemDetailModal from "@/components/register/ItemDetailModal";
import { Product, CartItem } from "@rakku/shared-types";
import { Trash2, ShoppingBag, X, Clock, Send, Pencil, ChevronRight, Minus, Plus } from "lucide-react";

interface OrderSidebarProps {
  onCheckout: () => void;
  isDrawer?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenDraft?: () => void;
  onEditItem?: (itemId: string) => void;
  refreshKey?: number;
  initialDraftCount?: number;
}

export default function OrderSidebar({
  onCheckout,
  isDrawer = false,
  isOpen = false,
  onClose,
  onOpenDraft,
  onEditItem,
  refreshKey,
  initialDraftCount = 0,
}: OrderSidebarProps) {
  const items = useCartStore((s) => s.items);
  const customerName = useCartStore((s) => s.customerName);
  const setCustomerName = useCartStore((s) => s.setCustomerName);
  const incrementQty = useCartStore((s) => s.incrementQty);
  const decrementQty = useCartStore((s) => s.decrementQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);
  const { subtotal, appliedTaxes, appliedDiscounts, total } = useCartTotals();
  const groupedCart = useCartGroupedByProduct();

  const [draftCount, setDraftCount] = useState(initialDraftCount);
  const [detailItem, setDetailItem] = useState<{ product: Product; variants: CartItem[] } | null>(null);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyVal, setEditingQtyVal] = useState<string>("");

  const savingDraft = useCartStore((s) => s.savingDraft);
  const saveAsDraft = useCartStore((s) => s.saveAsDraft);

  const handleSaveDraft = async () => {
    if (!customerName.trim()) {
      showToast("error", "Nama customer wajib diisi");
      return;
    }
    const success = await saveAsDraft();
    if (success) {
      showToast("success", "Pesanan disimpan sebagai draft!");
      clear();
      if (isDrawer && onClose) onClose();
    } else {
      showToast("error", "Gagal menyimpan draft");
    }
  };

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
  }, [refreshKey]);

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
                className="relative w-10 h-10 rounded-lg border border-forest/40 text-forest hover:bg-forest/5 transition-colors flex items-center justify-center"
                title="Pesanan Draft"
              >
                {draftCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shadow-sm">
                    {draftCount > 99 ? "99+" : draftCount}
                  </span>
                )}
                <Clock size={18} />
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={clear}
                className="w-10 h-10 rounded-lg text-neutral-400 hover:text-danger hover:bg-red-50 transition-colors flex items-center justify-center"
                title="Clear cart"
              >
                <Trash2 size={18} />
              </button>
            )}
            {isDrawer && onClose && (
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600"
              >
                <X size={18} />
              </button>
            )}
          </div>
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
          groupedCart.map(({ category, products }) => (
            <div key={category} className="mb-4">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                {category}
              </div>
              {products.map(({ product, variants, totalQty, subtotal: productSubtotal }) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-neutral-200 mb-2 overflow-hidden"
                >
                  <button
                    onClick={() => setDetailItem({ product, variants })}
                    className="w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-neutral-900 truncate">
                        {product.name}
                      </span>
                      <span className="text-xs text-neutral-400 whitespace-nowrap">
                        {totalQty > 0 && `(${totalQty})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-forest">
                        {formatCurrency(productSubtotal)}
                      </span>
                      <ChevronRight size={14} className="text-neutral-300" />
                    </div>
                  </button>
                  <div className="px-3 pb-2 space-y-1">
                    {variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between text-xs pl-2"
                      >
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                decrementQty(v.id);
                              }}
                              className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-700 transition-colors active:scale-90"
                            >
                              <Minus size={14} />
                            </button>
                            {editingQtyId === v.id ? (
                              <input
                                type="number"
                                value={editingQtyVal}
                                onChange={(e) => setEditingQtyVal(e.target.value)}
                                onBlur={() => {
                                  const newQty = parseInt(editingQtyVal, 10);
                                  if (isNaN(newQty) || newQty <= 0) {
                                    removeItem(v.id);
                                  } else if (newQty !== v.quantity) {
                                    const diff = newQty - v.quantity;
                                    if (diff > 0) {
                                      for (let i = 0; i < diff; i++) incrementQty(v.id);
                                    } else {
                                      for (let i = 0; i < Math.abs(diff); i++) decrementQty(v.id);
                                    }
                                  }
                                  setEditingQtyId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  if (e.key === "Escape") setEditingQtyId(null);
                                }}
                                className="w-10 h-9 text-center font-semibold text-sm text-neutral-900 bg-neutral-100 rounded-lg border border-neutral-300 outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                                autoFocus
                              />
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingQtyId(v.id);
                                  setEditingQtyVal(String(v.quantity));
                                }}
                                className="min-w-[2rem] h-9 text-center font-semibold text-sm text-neutral-900 cursor-text hover:bg-neutral-100 rounded px-1.5 transition-colors"
                              >
                                {v.quantity}
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                incrementQty(v.id);
                              }}
                              className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-700 transition-colors active:scale-90"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <span className="text-neutral-600 truncate ml-1">
                            {v.modifier_label
                              ? v.modifier_label
                              : "Regular"}
                          </span>
                          {v.note && (
                            <span className="text-neutral-400 italic truncate ml-1">
                              — {v.note}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <span className="font-mono text-neutral-700">
                            {formatCurrency(v.subtotal)}
                          </span>
                          <div className="flex items-center gap-0.5">
                            {onEditItem && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditItem(v.id);
                                }}
                                className="w-8 h-8 rounded-lg text-neutral-300 hover:text-forest hover:bg-neutral-100 transition-colors flex items-center justify-center"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItem(v.id);
                              }}
                              className="w-8 h-8 rounded-lg text-neutral-300 hover:text-danger hover:bg-red-50 transition-colors flex items-center justify-center"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
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
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-base text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
          />
        </div>
        <div className="flex justify-between text-sm text-neutral-600">
          <span>Subtotal</span>
          <span className="font-mono">{formatCurrency(subtotal)}</span>
        </div>
        {appliedDiscounts.map((discount, i) => (
          <div key={i} className="flex justify-between text-sm text-success">
            <span>{discount.name}</span>
            <span className="font-mono">-{formatCurrency(discount.amount)}</span>
          </div>
        ))}
        {appliedTaxes.map((tax, i) => (
          <div key={i} className="flex justify-between text-sm text-neutral-600">
            <span>{tax.name} {tax.type === "percentage" ? `(${tax.value}%)` : ""}</span>
            <span className="font-mono">{formatCurrency(tax.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between text-base font-display font-bold text-neutral-900 pt-1 border-t border-neutral-200">
          <span>Total</span>
          <span className="font-mono">{formatCurrency(total)}</span>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSaveDraft}
            disabled={items.length === 0 || !customerName.trim() || savingDraft}
            className="flex-1 bg-neutral-100 text-neutral-700 rounded-xl px-4 py-3 font-semibold text-sm hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {savingDraft ? (
              <div className="w-4 h-4 border-2 border-neutral-400/30 border-t-neutral-600 rounded-full animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Bayar Nanti
          </button>
          <button
            onClick={onCheckout}
            disabled={items.length === 0 || !customerName.trim()}
            className="flex-1 bg-forest text-white rounded-xl px-4 py-3 font-semibold text-sm hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Payment
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {isDrawer ? (
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
      ) : (
        <div className="w-[380px] border-l border-neutral-200 bg-white flex flex-col h-full hidden lg:flex">
          {content}
        </div>
      )}

      {detailItem && (
        <ItemDetailModal
          product={detailItem.product}
          variants={detailItem.variants}
          onClose={() => setDetailItem(null)}
        />
      )}
    </>
  );
}
