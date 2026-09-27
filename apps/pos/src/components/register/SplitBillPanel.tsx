"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { SplitPayment, PaymentMethod, CartItem } from "@rakku/shared-types";
import { formatCurrency } from "@/lib/format";
import { X, Plus, Minus } from "lucide-react";

interface SplitBillPanelProps {
  items: CartItem[];
  total: number;
  onSplitChange: (payments: SplitPayment[]) => void;
}

const paymentMethods: { value: PaymentMethod; label: string; title: string }[] = [
  { value: "cash", label: "T", title: "Tunai" },
  { value: "qris", label: "Q", title: "QRIS" },
  { value: "card", label: "K", title: "Kartu" },
];

const personAccents = [
  "bg-primary-50 text-forest border-primary-100",
  "bg-blue-50 text-blue-600 border-blue-100",
  "bg-amber-50 text-amber-600 border-amber-100",
  "bg-purple-50 text-purple-600 border-purple-100",
  "bg-rose-50 text-rose-500 border-rose-100",
  "bg-cyan-50 text-cyan-600 border-cyan-100",
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

export default function SplitBillPanel({ items, total, onSplitChange }: SplitBillPanelProps) {
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
    <div className="space-y-3">
      <div className="bg-white rounded-xl p-3 border border-neutral-200">
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

      <div className="grid gap-2 sm:grid-cols-2">
        {persons.map((person, idx) => {
          const personTotal = getPersonTotal(person);
          const accent = personAccents[idx % personAccents.length];
          const initial = person.name?.trim()
            ? person.name.trim().charAt(0).toUpperCase()
            : String(idx + 1);
          return (
            <div
              key={person.id}
              className="bg-white rounded-xl p-3 border border-neutral-200 space-y-2"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border flex-shrink-0 ${accent}`}
                >
                  {initial}
                </div>
                <input
                  type="text"
                  value={person.name}
                  onChange={(e) => updatePerson(person.id, { name: e.target.value })}
                  placeholder="Nama (opsional)"
                  className="flex-1 min-w-0 bg-transparent border-b border-neutral-200 px-1 py-1 text-base text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest"
                />
                {persons.length > 2 && (
                  <button
                    onClick={() => removePerson(person.id)}
                    aria-label={`Hapus orang ${idx + 1}`}
                    className="w-10 h-10 rounded-lg text-neutral-300 hover:text-danger hover:bg-red-50 active:scale-95 flex items-center justify-center flex-shrink-0 transition-all"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="flex gap-1">
                {paymentMethods.map((pm) => (
                  <button
                    key={pm.value}
                    onClick={() => updatePerson(person.id, { method: pm.value })}
                    aria-label={pm.title}
                    title={pm.title}
                    aria-pressed={person.method === pm.value}
                    className={`w-10 h-10 rounded-lg text-xs font-bold transition-colors ${
                      person.method === pm.value
                        ? "bg-forest text-white"
                        : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 active:bg-neutral-300"
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                <span className="text-xs text-neutral-400">Total</span>
                <span className="font-mono text-sm font-semibold text-neutral-900">
                  {formatCurrency(personTotal)}
                </span>
              </div>

              <div className="space-y-1">
                {person.items.filter((pi) => pi.quantity > 0).map((pi) => {
                  const cartItem = items.find((i) => i.id === pi.cartItemId);
                  if (!cartItem) return null;
                  const label = cartItem.modifier_label ? `${cartItem.product.name} (${cartItem.modifier_label})` : cartItem.product.name;
                  return (
                    <div key={pi.cartItemId} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600 truncate flex-1">{label}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => removeItemFromPerson(person.id, pi.cartItemId)}
                          aria-label={`Kurangi ${label}`}
                          className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center active:scale-90 transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-7 text-center font-mono text-sm">{pi.quantity}</span>
                        <button
                          onClick={() => addItemToPerson(person.id, pi.cartItemId)}
                          aria-label={`Tambah ${label}`}
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
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={addPerson}
        className="w-full flex items-center justify-center gap-1.5 text-sm text-forest font-medium py-3 border border-dashed border-neutral-300 rounded-xl hover:bg-neutral-50 active:scale-[0.98] transition-all cursor-pointer"
      >
        <Plus size={16} />
        Tambah Orang
      </button>

      {!allAssigned && (
        <p role="status" className="text-xs text-amber-600 text-center">
          Semua item harus terbagi ke orang
        </p>
      )}
    </div>
  );
}