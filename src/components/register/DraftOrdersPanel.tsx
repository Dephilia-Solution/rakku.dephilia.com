"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/dummy-data";
import { Clock, ShoppingBag, X } from "lucide-react";

interface DraftOrder {
  id: string;
  customer_name: string;
  total_price: number;
  created_at: string;
  pricing_tier_id: string | null;
  order_items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    modifier_label: string | null;
    note: string | null;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onSelectDraft: (draft: DraftOrder) => void;
  onDraftChange?: () => void;
}

export default function DraftOrdersPanel({ isOpen, onClose, onSelectDraft, onDraftChange }: Props) {
  const [drafts, setDrafts] = useState<DraftOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders/draft");
      if (res.ok) {
        const data = await res.json();
        setDrafts(data);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchDrafts();
  }, [isOpen]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/orders/draft?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
        onDraftChange?.();
      }
    } catch {}
  };

  const handleSelect = (draft: DraftOrder) => {
    onSelectDraft(draft);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-neutral-500" />
              <h3 className="font-display font-semibold text-base text-neutral-900">
                Pesanan Draft
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600"
            >
              <X size={18} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag size={32} className="mx-auto text-neutral-300 mb-2" />
              <p className="text-sm text-neutral-400">Belum ada pesanan draft</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3 cursor-pointer hover:bg-primary-50 transition-colors"
                  onClick={() => handleSelect(draft)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {draft.customer_name}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {draft.order_items.length} item &middot;{" "}
                      {new Date(draft.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="font-mono text-sm font-semibold text-neutral-900 whitespace-nowrap">
                      {formatCurrency(draft.total_price)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(draft.id);
                      }}
                      className="w-10 h-10 rounded-lg hover:bg-red-100 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
