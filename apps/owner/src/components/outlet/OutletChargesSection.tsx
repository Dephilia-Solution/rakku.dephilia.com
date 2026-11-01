"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Tax,
  ProductDiscount,
  OrderDiscount,
} from "@rakku/shared-types";
import {
  Tabs,
  Badge,
} from "@rakku/ui";
import { useMerchantRequest, useMerchantRuntime, useMerchantToast } from "@/lib/merchant-runtime";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { OwnerEmpty, OwnerError, OwnerSection, OwnerSkeleton } from "@/components/ui/OwnerPrimitives";
import {
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

const editorLoading = () => <OwnerSkeleton rows={2} />;
const TaxFormSlideOver = dynamic(() => import("@/components/charges/TaxFormSlideOver"), { loading: editorLoading });
const DiscountFormSlideOver = dynamic(() => import("@/components/charges/DiscountFormSlideOver"), { loading: editorLoading });
const iconClass = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors";

function ChargeToggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg disabled:opacity-50">
    <span aria-hidden="true" className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${checked ? "bg-primary" : "bg-surface-container-high"}`}><span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} /></span>
  </button>;
}

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
  const isActive = useMerchantRuntime()?.active;
  const [tab, setTab] = useState<TabKey>(initialTab === "produk" || initialTab === "order" ? initialTab : "pajak");
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscount[]>([]);
  const [orderDiscounts, setOrderDiscounts] = useState<OrderDiscount[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    if (signal?.aborted || isActive?.() === false) return;
    if (!outletId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const q = `outlet_id=${encodeURIComponent(outletId)}`;
      const [taxRes, discRes, prodRes] = await Promise.all([
        request(`/api/owner/taxes?${q}`, { signal }),
        request(`/api/owner/discounts?${q}`, { signal }),
        request(`/api/owner/products?${q}`, { signal }),
      ]);
      for (const response of [taxRes, discRes, prodRes]) {
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Gagal memuat pajak dan diskon");
        }
      }
      if (taxRes.ok) {
        const data = await taxRes.json();
        if (signal?.aborted || isActive?.() === false) return;
        setTaxes(data.taxes ?? []);
      }
      if (discRes.ok) {
        const data = await discRes.json();
        if (signal?.aborted || isActive?.() === false) return;
        setProductDiscounts(data.productDiscounts ?? []);
        setOrderDiscounts(data.orderDiscounts ?? []);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        if (signal?.aborted || isActive?.() === false) return;
        const names: Record<string, string> = {};
        for (const p of data.products ?? []) names[p.id] = p.name;
        setProductNames(names);
      }
    } catch (error) {
      if (signal?.aborted || isActive?.() === false) return;
      setLoadError(error instanceof Error ? error.message : "Gagal memuat pajak dan diskon. Silakan coba lagi.");
    } finally {
      if (!signal?.aborted && isActive?.() !== false) setLoading(false);
    }
  }, [outletId, request, isActive]);

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
    if (busyId || isActive?.() === false) return;
    setBusyId(tax.id);
    try {
      const res = await request(`/api/owner/taxes/${tax.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !tax.is_active }),
      });
      if (isActive?.() === false) return;
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
      } else {
        const data = await res.json();
        if (isActive?.() === false) return;
        showToast("error", data.error ?? "Gagal mengubah status");
      }
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Gagal mengubah status");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleDiscount = async (
    discount: ProductDiscount | OrderDiscount,
    scope: "product" | "order"
  ) => {
    if (busyId || isActive?.() === false) return;
    setBusyId(discount.id);
    try {
      const res = await request(
        `/api/owner/discounts/${discount.id}?scope=${scope}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !discount.is_active }),
        }
      );
      if (isActive?.() === false) return;
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
      } else {
        const data = await res.json();
        if (isActive?.() === false) return;
        showToast("error", data.error ?? "Gagal mengubah status");
      }
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Gagal mengubah status");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || isActive?.() === false) return;
    const { id, kind } = pendingDelete;
    try {
      const url =
        kind === "tax"
          ? `/api/owner/taxes/${id}`
          : `/api/owner/discounts/${id}?scope=${kind}`;
      const res = await request(url, { method: "DELETE" });
      if (isActive?.() === false) return;
      if (res.ok) {
        showToast("success", "Berhasil dihapus");
        void fetchData();
      } else {
        const data = await res.json();
        if (isActive?.() === false) return;
        showToast("error", data.error ?? "Gagal menghapus");
      }
    } catch {
      if (isActive?.() === false) return;
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
        <OwnerEmpty title={`Belum ada ${scope === "product" ? "diskon produk" : "diskon pesanan"}`} description="Tambahkan diskon dan tentukan periode berlakunya di kasir." action={<button type="button" onClick={handleAdd} className="owner-button owner-button--primary"><Plus size={16} />Tambah Diskon</button>} />
      );
    }
    return (
      <div className="grid gap-3">
        {list.map((d) => {
          const active = inPeriod(d.start_date, d.end_date);
          return (
            <div
              key={d.id}
              className="min-w-0 rounded-xl border border-surface-container p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-on-surface break-words">
                    {d.name}
                  </p>
                  <Badge variant={active ? "active" : "inactive"}>
                    {active ? "Berjalan" : now < new Date(d.start_date) ? "Terjadwal" : "Kadaluarsa"}
                  </Badge>
                </div>
                <p className="text-sm text-on-surface tabular-nums mt-2 break-words">
                  {formatValue(d.type, d.value)}
                  {scope === "product" &&
                    (d as ProductDiscount).product_id &&
                    ` — ${
                      productNames[(d as ProductDiscount).product_id] ??
                      "Produk"
                    }`}
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {new Date(d.start_date).toLocaleDateString("id-ID")} —{" "}
                  {new Date(d.end_date).toLocaleDateString("id-ID")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-surface-container pt-2 lg:shrink-0 lg:border-0 lg:pt-0">
                <span className="mr-auto text-xs text-on-surface-variant lg:mr-1">{d.is_active ? "Diizinkan" : "Diblokir"}</span>
                <ChargeToggle
                  checked={d.is_active}
                  onChange={() => handleToggleDiscount(d, scope)}
                  label={`Status ${d.name}`}
                  disabled={!!busyId}
                />
                <button
                  type="button"
                  onClick={() => {
                    setEditingDiscount(d);
                    setShowDiscountForm(true);
                  }}
                  aria-label={`Edit ${d.name}`}
                  className={iconClass}
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete({ id: d.id, kind: scope })}
                  aria-label={`Hapus ${d.name}`}
                  className={`${iconClass} text-error`}
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
    <OwnerSection title="Pajak & Diskon" description="Atur pajak dan diskon yang berlaku di kasir outlet ini." actions={
        <button
          type="button"
          onClick={handleAdd}
          className="owner-button owner-button--primary"
        >
          <Plus size={14} />
          {tab === "pajak" ? "Tambah Pajak" : "Tambah Diskon"}
        </button>
      }>

      <div className="mb-5 max-w-full overflow-x-auto pb-1">
      <Tabs
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: "pajak", label: "Pajak", count: taxes.length },
          { key: "produk", label: "Diskon Produk", count: productDiscounts.length },
          { key: "order", label: "Diskon Pesanan", count: orderDiscounts.length },
        ]}
      />
      </div>

      {loading ? (
        <OwnerSkeleton />
      ) : loadError ? (
        <OwnerError message={loadError} retry={() => void fetchData()} />
      ) : (
        <>
          {tab === "pajak" &&
            (taxes.length === 0 ? (
              <OwnerEmpty title="Belum ada pajak" description="Tambahkan pajak dan atur urutan penerapannya pada transaksi." action={<button type="button" onClick={handleAdd} className="owner-button owner-button--primary"><Plus size={16} />Tambah Pajak</button>} />
            ) : (
              <div className="grid gap-3">
                {taxes.map((tax) => (
                  <div
                    key={tax.id}
                    className="min-w-0 rounded-xl border border-surface-container p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-on-surface break-words">
                          {tax.name}
                        </p>
                        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold tabular-nums text-primary">
                          {formatValue(tax.type, tax.value)}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Urutan: {tax.sort_order}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-surface-container pt-2 lg:shrink-0 lg:border-0 lg:pt-0">
                      <span className="mr-auto text-xs text-on-surface-variant lg:mr-1">{tax.is_active ? "Aktif" : "Nonaktif"}</span>
                      <ChargeToggle
                        checked={tax.is_active}
                        onChange={() => handleToggleTax(tax)}
                        label={`Status ${tax.name}`}
                        disabled={!!busyId}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTax(tax);
                          setShowTaxForm(true);
                        }}
                        aria-label={`Edit ${tax.name}`}
                        className={iconClass}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({ id: tax.id, kind: "tax" })
                        }
                        aria-label={`Hapus ${tax.name}`}
                        className={`${iconClass} text-error`}
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

      {showTaxForm && <TaxFormSlideOver
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
      />}
      {showDiscountForm && <DiscountFormSlideOver
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
      />}
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
    </OwnerSection>
  );
}
