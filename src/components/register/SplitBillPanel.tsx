"use client";

import { useState, useEffect, useMemo } from "react";
import { SplitPayment, PaymentMethod } from "@/types";
import { formatCurrency } from "@/lib/dummy-data";
import { X, Plus, Minus, Banknote, QrCode, CreditCard } from "lucide-react";

interface SplitBillPanelProps {
  total: number;
  onSplitChange: (payments: SplitPayment[]) => void;
  onCancel: () => void;
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Tunai" },
  { value: "qris", label: "QRIS" },
  { value: "card", label: "Kartu" },
];

interface SplitPerson {
  id: string;
  name: string;
  amount: number;
  method: PaymentMethod;
}

function generateId() {
  return `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function SplitBillPanel({ total, onSplitChange, onCancel }: SplitBillPanelProps) {
  const [persons, setPersons] = useState<SplitPerson[]>(() => {
    const equalShare = Math.floor(total / 2);
    return [
      { id: generateId(), name: "", amount: equalShare, method: "cash" },
      { id: generateId(), name: "", amount: total - equalShare, method: "cash" },
    ];
  });

  const splitTotal = useMemo(
    () => persons.reduce((sum, p) => sum + p.amount, 0),
    [persons]
  );
  const isBalanced = splitTotal === total;

  useEffect(() => {
    if (isBalanced) {
      onSplitChange(
        persons.map((p) => ({
          id: p.id,
          order_id: "",
          amount: p.amount,
          payment_method: p.method,
          status: "paid" as const,
          customer_name: p.name || null,
          created_at: new Date().toISOString(),
        }))
      );
    } else {
      onSplitChange([]);
    }
  }, [isBalanced, persons, onSplitChange, total]);

  const updatePerson = (id: string, updates: Partial<SplitPerson>) => {
    setPersons((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const addPerson = () => {
    const currentTotal = persons.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, total - currentTotal);
    setPersons((prev) => [
      ...prev,
      { id: generateId(), name: "", amount: remaining, method: "cash" },
    ]);
  };

  const removePerson = (id: string) => {
    if (persons.length <= 2) return;
    setPersons((prev) => prev.filter((p) => p.id !== id));
  };

  const distributeEvenly = () => {
    const count = persons.length;
    const equalShare = Math.floor(total / count);
    const remainder = total - equalShare * count;
    setPersons((prev) =>
      prev.map((p, i) => ({
        ...p,
        amount: equalShare + (i === 0 ? remainder : 0),
      }))
    );
  };

  return (
    <div className="space-y-3 bg-neutral-50 rounded-xl p-4 border border-neutral-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-neutral-900">Split Bill</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={distributeEvenly}
            className="text-xs text-forest hover:text-forest-dark font-medium"
          >
            Rata
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-neutral-400 hover:text-neutral-600"
          >
            Batal
          </button>
        </div>
      </div>

      <div className="flex justify-between text-xs text-neutral-500">
        <span>Total: {formatCurrency(total)}</span>
        <span className={isBalanced ? "text-success" : "text-danger"}>
          Terbagi: {formatCurrency(splitTotal)}
          {!isBalanced && ` (${formatCurrency(total - splitTotal)} sisa)`}
        </span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {persons.map((person, idx) => (
          <div
            key={person.id}
            className="flex items-center gap-2 bg-white rounded-xl p-2.5"
          >
            <span className="text-xs font-semibold text-neutral-400 w-5 text-center">
              {idx + 1}
            </span>
            <input
              type="text"
              value={person.name}
              onChange={(e) => updatePerson(person.id, { name: e.target.value })}
              placeholder="Nama (opsional)"
              className="w-20 bg-transparent border-b border-neutral-200 px-1 py-0.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest"
            />
            <input
              type="number"
              value={person.amount || ""}
              onChange={(e) =>
                updatePerson(person.id, { amount: Math.max(0, Number(e.target.value) || 0) })
              }
              className="w-24 bg-neutral-50 rounded-lg px-2 py-1 text-xs font-mono font-semibold text-neutral-900 text-right focus:outline-none focus:ring-1 focus:ring-forest"
            />
            <div className="flex gap-0.5">
              {paymentMethods.map((pm) => (
                <button
                  key={pm.value}
                  onClick={() => updatePerson(person.id, { method: pm.value })}
                  className={`p-1 rounded-md text-[10px] font-medium transition-colors ${
                    person.method === pm.value
                      ? "bg-forest text-white"
                      : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                  }`}
                >
                  <span className={person.method === pm.value ? "text-white" : "text-neutral-500"}>
                  {pm.label === "Tunai" ? "T" : pm.label === "QRIS" ? "Q" : "K"}
                </span>
                </button>
              ))}
            </div>
            {persons.length > 2 && (
              <button
                onClick={() => removePerson(person.id)}
                className="text-neutral-300 hover:text-danger p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addPerson}
        className="w-full flex items-center justify-center gap-1 text-xs text-forest font-medium py-2 border border-dashed border-neutral-300 rounded-xl hover:bg-white transition-colors"
      >
        <Plus size={12} />
        Tambah Orang
      </button>

      <div className="flex justify-end">
        {!isBalanced && (
          <span className="text-xs text-danger">
            Total split harus sama dengan total pesanan
          </span>
        )}
      </div>
    </div>
  );
}
