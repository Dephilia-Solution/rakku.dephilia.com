"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Tax,
  ProductDiscount,
  OrderDiscount,
} from "@rakku/shared-types";
import {
  Tabs,
  Badge,
  Toggle,
} from "@rakku/ui";
import { useMerchantRequest, useMerchantToast } from "@/lib/merchant-runtime";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import TaxFormSlideOver from "@/components/charges/TaxFormSlideOver";
import DiscountFormSlideOver from "@/components/charges/DiscountFormSlideOver";
import {
  Plus,
  Pencil,
  Trash2,
  Percent,
  Landmark,
  Loader2,
} from "lucide-react";

type TabKey = "pajak" | "produk" | "order";

interface Props {
  outletId: string;
  initialTab?: string;
}

function formatValue(type: "percentage" | "fixed", value: number) {
  return type === "percentage"
    ? `${value}%`
    : `Rp ${value.toLocaleString("id-ID")}`;
}

/** Tab pajak & diskon dari workspace outlet. */
export default function OutletChargesSection({ outletId, initialTab }: Props) {
  const request = useMerchantRequest();
  const showToast = useMerchantToast();
  const [tab, setTab] = useState<TabKey>(initialTab === "produk" || initialTab === "order" ? initialTab : "pajak");
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscount[]>([]);
  const [orderDiscounts, setOrderDiscounts] = useState<OrderDiscount[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

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

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = `outlet_id=${encodeURIComponent(outletId)}`;
      const [taxRes, discRes, prodRes] = await Promise.all([
        request(`/api/owner/taxes?${q}`, { signal }),
        request(`/api/owner/discounts?${q}`, { signal }),
        request(`/api/owner/products?${q}`, { signal }),
      ]);
      if (taxRes.ok) {
        const data = await taxRes.json();
        if (signal?.aborted) return;
        setTaxes(data.taxes ?? []);
      }
      if (discRes.ok) {
        const data = await discRes.json();
        if (signal?.aborted) return;
        setProductDiscounts(data.productDiscounts ?? []);
        setOrderDiscounts(data.orderDiscounts ?? []);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        if (signal?.aborted) return;
        const names: Record<string, string> = {};
        for (const p of data.products ?? []) names[p.id] = p.name;
        setProductNames(names);
      }
    } catch {
      if (signal?.aborted) return;
      showToast("error", "Gagal memuat data");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [outletId, request, showToast]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

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
      const res = await request(`/api/owner/taxes/${tax.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !tax.is_active }),
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
      const res = await request(
        `/api/owner/discounts/${discount.id}?scope=${scope}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !discount.is_active }),
        }
      );
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
          ? `/api/owner/taxes/${id}`
          : `/api/owner/discounts/${id}?scope=${kind}`;
      const res = await request(url, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Berhasil dihapus");
        void fetchData();
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
                  onClick={() => setPendingDelete({ id: d.id, kind: scope })}
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
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Pajak & Diskon</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Atur pajak dan diskon yang berlaku di kasir outlet ini.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-on-primary shadow-md shadow-primary/20 flex items-center gap-1.5 hover:bg-primary/90 transition-all"
        >
          <Plus size={14} />
          Tambah
        </button>
      </div>

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: "pajak", label: "Pajak", count: taxes.length },
          { key: "produk", label: "Diskon Produk", count: productDiscounts.length },
          { key: "order", label: "Diskon Pesanan", count: orderDiscounts.length },
        ]}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24 text-on-surface-variant">
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : (
        <>
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
                        onClick={() =>
                          setPendingDelete({ id: tax.id, kind: "tax" })
                        }
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
        </>
      )}

      <TaxFormSlideOver
        open={showTaxForm}
        onClose={() => {
          setShowTaxForm(false);
          setEditingTax(null);
        }}
        outletId={outletId}
        tax={editingTax}
        onSuccess={() => {
          setShowTaxForm(false);
          setEditingTax(null);
          void fetchData();
        }}
      />
      <DiscountFormSlideOver
        open={showDiscountForm}
        onClose={() => {
          setShowDiscountForm(false);
          setEditingDiscount(null);
        }}
        outletId={outletId}
        discount={editingDiscount}
        scope={tab === "order" ? "order" : "product"}
        onSuccess={() => {
          setShowDiscountForm(false);
          setEditingDiscount(null);
          void fetchData();
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
