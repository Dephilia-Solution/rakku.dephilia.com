"use client";

import { useState } from "react";
import {
  Tax,
  ProductDiscount,
  OrderDiscount,
} from "@rakku/shared-types";
import {
  PageHeader,
  Tabs,
  Badge,
  Toggle,
  showToast,
} from "@rakku/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import TaxFormSlideOver from "@/components/charges/TaxFormSlideOver";
import DiscountFormSlideOver from "@/components/charges/DiscountFormSlideOver";
import { Plus, Pencil, Trash2, Percent, Landmark } from "lucide-react";

type TabKey = "pajak" | "produk" | "order";

interface Props {
  initialTaxes: Tax[];
  initialProductDiscounts: ProductDiscount[];
  initialOrderDiscounts: OrderDiscount[];
  productNames: Record<string, string>;
  initialTab?: TabKey;
}

function formatValue(type: "percentage" | "fixed", value: number) {
  return type === "percentage"
    ? `${value}%`
    : `Rp ${value.toLocaleString("id-ID")}`;
}

export default function TaxDiscountsClient({
  initialTaxes,
  initialProductDiscounts,
  initialOrderDiscounts,
  productNames,
  initialTab = "pajak",
}: Props) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [taxes, setTaxes] = useState(initialTaxes);
  const [productDiscounts, setProductDiscounts] = useState(
    initialProductDiscounts
  );
  const [orderDiscounts, setOrderDiscounts] = useState(initialOrderDiscounts);

  const [showTaxForm, setShowTaxForm] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<
    (ProductDiscount | OrderDiscount) | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    kind: "tax" | "product" | "order";
  } | null>(null);

  const fetchTaxes = async () => {
    try {
      const res = await fetch("/api/admin/taxes");
      if (res.ok) setTaxes((await res.json()) ?? []);
    } catch {
      showToast("error", "Gagal memuat data pajak");
    }
  };

  const fetchDiscounts = async () => {
    try {
      const res = await fetch("/api/admin/discounts");
      if (res.ok) {
        const data = await res.json();
        setProductDiscounts(data.productDiscounts ?? []);
        setOrderDiscounts(data.orderDiscounts ?? []);
      }
    } catch {
      showToast("error", "Gagal memuat data diskon");
    }
  };

  const handleAdd = () => {
    if (tab === "pajak") {
      setEditingTax(null);
      setShowTaxForm(true);
    } else {
      setEditingDiscount(null);
      setShowDiscountForm(true);
    }
  };

  const handleToggleTax = async (tax: Tax) => {
    try {
      const res = await fetch("/api/admin/taxes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tax.id, is_active: !tax.is_active }),
      });
      if (res.ok) {
        setTaxes((prev) =>
          prev.map((t) =>
            t.id === tax.id ? { ...t, is_active: !t.is_active } : t
          )
        );
        showToast(
          "success",
          `${tax.name} ${tax.is_active ? "dinonaktifkan" : "diaktifkan"}`
        );
      }
    } catch {
      showToast("error", "Gagal mengubah status");
    }
  };

  const handleToggleDiscount = async (
    discount: ProductDiscount | OrderDiscount,
    scope: "product" | "order"
  ) => {
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: discount.id,
          scope,
          is_active: !discount.is_active,
        }),
      });
      if (res.ok) {
        if (scope === "product") {
          setProductDiscounts((prev) =>
            prev.map((d) =>
              d.id === discount.id ? { ...d, is_active: !d.is_active } : d
            )
          );
        } else {
          setOrderDiscounts((prev) =>
            prev.map((d) =>
              d.id === discount.id ? { ...d, is_active: !d.is_active } : d
            )
          );
        }
        showToast(
          "success",
          `${discount.name} ${discount.is_active ? "diblokir" : "diizinkan"}`
        );
      }
    } catch {
      showToast("error", "Gagal mengubah status");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const { id, kind } = pendingDelete;
    try {
      const url =
        kind === "tax"
          ? `/api/admin/taxes?id=${id}`
          : `/api/admin/discounts?id=${id}&scope=${kind}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Berhasil dihapus");
        if (kind === "tax") fetchTaxes();
        else fetchDiscounts();
      } else {
        const data = await res.json();
        showToast("error", data.error ?? "Gagal menghapus");
      }
    } catch {
      showToast("error", "Gagal menghapus");
    }
  };

  const now = new Date();
  const inPeriod = (start: string, end: string) =>
    now >= new Date(start) && now <= new Date(end);

  const discountList = (
    list: (ProductDiscount | OrderDiscount)[],
    scope: "product" | "order"
  ) => {
    if (list.length === 0) {
      return (
        <div className="text-center py-12 text-on-surface-variant text-sm bg-surface-container-lowest rounded-xl">
          <Percent size={32} className="mx-auto mb-2 opacity-50" />
          Belum ada {scope === "product" ? "diskon produk" : "diskon pesanan"}.
          Klik &quot;Tambah&quot; untuk memulai.
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {list.map((d) => {
          const active = inPeriod(d.start_date, d.end_date);
          return (
            <div
              key={d.id}
              className="bg-surface-container-lowest rounded-xl p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-on-surface">
                    {d.name}
                  </p>
                  <Badge variant={active ? "active" : "inactive"}>
                    {active ? "Berjalan" : "Kadaluarsa"}
                  </Badge>
                </div>
                <p className="text-xs text-on-surface-variant font-mono mt-0.5">
                  {formatValue(d.type, d.value)}
                  {scope === "product" &&
                    (d as ProductDiscount).product_id &&
                    ` — ${
                      productNames[(d as ProductDiscount).product_id] ??
                      "Produk"
                    }`}
                </p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  {new Date(d.start_date).toLocaleDateString("id-ID")} —{" "}
                  {new Date(d.end_date).toLocaleDateString("id-ID")}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Toggle
                  checked={d.is_active}
                  onChange={() => handleToggleDiscount(d, scope)}
                  ariaLabel={`Status ${d.name}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setEditingDiscount(d);
                    setShowDiscountForm(true);
                  }}
                  aria-label={`Edit ${d.name}`}
                  className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPendingDelete({ id: d.id, kind: scope })
                  }
                  aria-label={`Hapus ${d.name}`}
                  className="p-2 text-error hover:bg-error-container/20 rounded-full transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Pajak & Diskon"
        subtitle="Atur pajak dan diskon yang berlaku di kasir."
        actions={
          <button
            type="button"
            onClick={handleAdd}
            className="px-4 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 hover:bg-primary/90 transition-all"
          >
            <Plus size={16} />
            Tambah
          </button>
        }
      />

      <Tabs
        className="mb-5"
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: "pajak", label: "Pajak", count: taxes.length },
          { key: "produk", label: "Diskon Produk", count: productDiscounts.length },
          { key: "order", label: "Diskon Pesanan", count: orderDiscounts.length },
        ]}
      />

      {tab === "pajak" &&
        (taxes.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant text-sm bg-surface-container-lowest rounded-xl">
            <Landmark size={32} className="mx-auto mb-2 opacity-50" />
            Belum ada pajak. Klik &quot;Tambah&quot; untuk memulai.
          </div>
        ) : (
          <div className="space-y-2">
            {taxes.map((tax) => (
              <div
                key={tax.id}
                className="bg-surface-container-lowest rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-on-surface">
                      {tax.name}
                    </p>
                    <Badge variant="info">
                      {formatValue(tax.type, tax.value)}
                    </Badge>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Urutan: {tax.sort_order}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Toggle
                    checked={tax.is_active}
                    onChange={() => handleToggleTax(tax)}
                    ariaLabel={`Status ${tax.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTax(tax);
                      setShowTaxForm(true);
                    }}
                    aria-label={`Edit ${tax.name}`}
                    className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ id: tax.id, kind: "tax" })}
                    aria-label={`Hapus ${tax.name}`}
                    className="p-2 text-error hover:bg-error-container/20 rounded-full transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {tab === "produk" && discountList(productDiscounts, "product")}
      {tab === "order" && discountList(orderDiscounts, "order")}

      <TaxFormSlideOver
        open={showTaxForm}
        onClose={() => {
          setShowTaxForm(false);
          setEditingTax(null);
        }}
        tax={editingTax}
        onSuccess={() => {
          setShowTaxForm(false);
          setEditingTax(null);
          fetchTaxes();
        }}
      />
      <DiscountFormSlideOver
        open={showDiscountForm}
        onClose={() => {
          setShowDiscountForm(false);
          setEditingDiscount(null);
        }}
        discount={editingDiscount}
        scope={tab === "order" ? "order" : "product"}
        onSuccess={() => {
          setShowDiscountForm(false);
          setEditingDiscount(null);
          fetchDiscounts();
        }}
      />
      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          handleDelete();
          setPendingDelete(null);
        }}
        title={pendingDelete?.kind === "tax" ? "Hapus Pajak" : "Hapus Diskon"}
        message="Apakah kamu yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan."
      />
    </div>
  );
}
