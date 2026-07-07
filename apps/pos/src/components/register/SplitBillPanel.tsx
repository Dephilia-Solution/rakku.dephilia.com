"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { SplitPayment, PaymentMethod, CartItem } from "@rakku/shared-types";
import { formatCurrency } from "@/lib/dummy-data";
import { X, Plus, Minus } from "lucide-react";

interface SplitBillPanelProps {
  items: CartItem[];
  total: number;
  onSplitChange: (payments: SplitPayment[]) => void;
  onCancel: () => void;
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "T" },
  { value: "qris", label: "Q" },
  { value: "card", label: "K" },
];

interface PersonItem {
  cartItemId: string;
  quantity: number;
}

interface SplitPerson {
  id: string;
  name: string;
  method: PaymentMethod;
  items: PersonItem[];
}

function generateId() {
  return `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function SplitBillPanel({ items, total, onSplitChange, onCancel }: SplitBillPanelProps) {
  const [persons, setPersons] = useState<SplitPerson[]>(() => [
    { id: generateId(), name: "", method: "cash", items: [] },
    { id: generateId(), name: "", method: "cash", items: [] },
  ]);

  const getRemainingQty = (cartItemId: string): number => {
    const cartItem = items.find((i) => i.id === cartItemId);
    if (!cartItem) return 0;
    const assigned = persons.reduce((sum, p) => {
      const pi = p.items.find((i) => i.cartItemId === cartItemId);
      return sum + (pi?.quantity ?? 0);
    }, 0);
    return cartItem.quantity - assigned;
  };

  const getPersonTotal = useCallback((person: SplitPerson): number => {
    return person.items.reduce((sum, pi) => {
      const cartItem = items.find((i) => i.id === pi.cartItemId);
      if (!cartItem) return sum;
      return sum + pi.quantity * cartItem.unit_price;
    }, 0);
  }, [items]);

  const allAssigned = useMemo(() => {
    return items.every((item) => {
      const assigned = persons.reduce((sum, p) => {
        const pi = p.items.find((i) => i.cartItemId === item.id);
        return sum + (pi?.quantity ?? 0);
      }, 0);
      return assigned === item.quantity;
    });
  }, [persons, items]);

  useEffect(() => {
    if (allAssigned) {
      onSplitChange(
        persons.map((p) => ({
          id: p.id,
          order_id: "",
          amount: getPersonTotal(p),
          payment_method: p.method,
          status: "paid" as const,
          customer_name: p.name || null,
          items: p.items
            .filter((pi) => pi.quantity > 0)
            .map((pi) => {
              const cartItem = items.find((i) => i.id === pi.cartItemId)!;
              return {
                cart_item_id: pi.cartItemId,
                product_name: cartItem.product.name,
                quantity: pi.quantity,
                unit_price: cartItem.unit_price,
                subtotal: pi.quantity * cartItem.unit_price,
              };
            }),
          created_at: new Date().toISOString(),
        }))
      );
    } else {
      onSplitChange([]);
    }
  }, [allAssigned, persons, onSplitChange, items, getPersonTotal]);

  const updatePerson = (id: string, updates: Partial<SplitPerson>) => {
    setPersons((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const addPerson = () => {
    setPersons((prev) => [
      ...prev,
      { id: generateId(), name: "", method: "cash", items: [] },
    ]);
  };

  const removePerson = (id: string) => {
    if (persons.length <= 2) return;
    setPersons((prev) => prev.filter((p) => p.id !== id));
  };

  const addItemToPerson = (personId: string, cartItemId: string) => {
    const remaining = getRemainingQty(cartItemId);
    if (remaining <= 0) return;

    setPersons((prev) =>
      prev.map((p) => {
        if (p.id !== personId) return p;
        const existing = p.items.find((i) => i.cartItemId === cartItemId);
        if (existing) {
          return {
            ...p,
            items: p.items.map((i) =>
              i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i
            ),
          };
        }
        return {
          ...p,
          items: [...p.items, { cartItemId, quantity: 1 }],
        };
      })
    );
  };

  const removeItemFromPerson = (personId: string, cartItemId: string) => {
    setPersons((prev) =>
      prev.map((p) => {
        if (p.id !== personId) return p;
        const existing = p.items.find((i) => i.cartItemId === cartItemId);
        if (!existing) return p;
        if (existing.quantity <= 1) {
          return { ...p, items: p.items.filter((i) => i.cartItemId !== cartItemId) };
        }
        return {
          ...p,
          items: p.items.map((i) =>
            i.cartItemId === cartItemId ? { ...i, quantity: i.quantity - 1 } : i
          ),
        };
      })
    );
  };

  return (
    <div className="space-y-3 bg-neutral-50 rounded-xl p-4 border border-neutral-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-neutral-900">Split Bill per Item</h4>
        <button
          onClick={onCancel}
          className="text-xs text-neutral-400 hover:text-neutral-600 px-3 py-2 rounded-lg hover:bg-neutral-100"
        >
          Batal
        </button>
      </div>

      <div className="bg-white rounded-lg p-2.5 border border-neutral-200">
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
          Daftar Pesanan
        </p>
        <div className="space-y-1">
          {items.map((item) => {
            const remaining = getRemainingQty(item.id);
            const label = item.modifier_label ? `${item.product.name} (${item.modifier_label})` : item.product.name;
            return (
              <div key={item.id} className="flex justify-between items-center text-xs">
                <span className="text-neutral-700">
                  {label} <span className="text-neutral-400">x{item.quantity}</span>
                </span>
                <span className={`font-mono text-[10px] ${remaining > 0 ? "text-amber-600" : "text-success"}`}>
                  {remaining > 0 ? `${remaining} sisa` : "✓"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs font-semibold mt-2 pt-2 border-t border-neutral-100">
          <span>Total</span>
          <span className="font-mono">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {persons.map((person, idx) => {
          const personTotal = getPersonTotal(person);
          return (
            <div
              key={person.id}
              className="bg-white rounded-xl p-2.5 border border-neutral-200"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-neutral-400 w-5 text-center">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={person.name}
                  onChange={(e) => updatePerson(person.id, { name: e.target.value })}
                  placeholder="Nama (opsional)"
                  className="flex-1 bg-transparent border-b border-neutral-200 px-1 py-0.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest"
                />
                <div className="flex gap-1">
                  {paymentMethods.map((pm) => (
                    <button
                      key={pm.value}
                      onClick={() => updatePerson(person.id, { method: pm.value })}
                      className={`w-10 h-10 rounded-lg text-xs font-bold transition-colors ${
                        person.method === pm.value
                          ? "bg-forest text-white"
                          : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
                {persons.length > 2 && (
                  <button
                    onClick={() => removePerson(person.id)}
                    className="w-9 h-9 rounded-lg text-neutral-300 hover:text-danger hover:bg-red-50 flex items-center justify-center"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="space-y-1 ml-7">
                {person.items.filter((pi) => pi.quantity > 0).map((pi) => {
                  const cartItem = items.find((i) => i.id === pi.cartItemId);
                  if (!cartItem) return null;
                  const label = cartItem.modifier_label ? `${cartItem.product.name} (${cartItem.modifier_label})` : cartItem.product.name;
                  return (
                    <div key={pi.cartItemId} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600 truncate flex-1">{label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => removeItemFromPerson(person.id, pi.cartItemId)}
                          className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center active:scale-90 transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-7 text-center font-mono text-sm">{pi.quantity}</span>
                        <button
                          onClick={() => addItemToPerson(person.id, pi.cartItemId)}
                          className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center active:scale-90 transition-colors"
                          disabled={getRemainingQty(pi.cartItemId) <= 0}
                        >
                          <Plus size={14} />
                        </button>
                        <span className="font-mono text-xs text-neutral-500 w-16 text-right">
                          {formatCurrency(pi.quantity * cartItem.unit_price)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-1">
                  {items.filter((item) => getRemainingQty(item.id) > 0).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {items.filter((item) => getRemainingQty(item.id) > 0).map((item) => {
                        const label = item.modifier_label ? `${item.product.name} (${item.modifier_label})` : item.product.name;
                        return (
                          <button
                            key={item.id}
                            onClick={() => addItemToPerson(person.id, item.id)}
                            className="text-xs bg-neutral-50 hover:bg-forest hover:text-white text-neutral-600 px-3 py-2 rounded-full border border-neutral-200 transition-colors leading-none"
                          >
                            + {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1 border-t border-neutral-100">
                  <span className="text-xs font-semibold font-mono text-neutral-900">
                    {formatCurrency(personTotal)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={addPerson}
        className="w-full flex items-center justify-center gap-1.5 text-sm text-forest font-medium py-3 border border-dashed border-neutral-300 rounded-xl hover:bg-white transition-colors"
      >
        <Plus size={16} />
        Tambah Orang
      </button>

      {!allAssigned && (
        <p className="text-xs text-amber-600 text-center">
          Semua item harus terbagi ke orang
        </p>
      )}
    </div>
  );
}
