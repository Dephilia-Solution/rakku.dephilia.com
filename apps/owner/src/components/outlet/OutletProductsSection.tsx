"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { MerchantLink as Link, useMerchantRequest, useMerchantRuntime, useMerchantToast } from "@/lib/merchant-runtime";
import { ProductWithCategory, Category } from "@rakku/shared-types";
import { Badge, EmptyState, fieldSelectClass } from "@rakku/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CategoryManagerSlideOver from "@/components/products/CategoryManagerSlideOver";
import TierManagerSlideOver from "@/components/products/TierManagerSlideOver";
import ImportExcelPanel from "@/components/outlet/ImportExcelPanel";
import { useOutletScope } from "./OutletScopeProvider";
import {
  Plus,
  Search,
  ImageIcon,
  Pencil,
  Package,
  Eye,
  EyeOff,
  Trash2,
  FolderCog,
  Layers,
  Upload,
  Loader2,
} from "lucide-react";

interface Props {
  outletId: string;
  outletName: string;
}

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

/** Tab produk dari workspace outlet (katalog, kategori, tier). */
export default function OutletProductsSection({ outletId, outletName }: Props) {
  const request = useMerchantRequest();
  const { refreshOutlets } = useOutletScope();
  const showToast = useMerchantToast();
  const isActive = useMerchantRuntime()?.active;

  const [productList, setProductList] = useState<ProductWithCategory[]>([]);
  const [catList, setCatList] = useState<Category[]>([]);
  const [tierPrices, setTierPrices] = useState<
    { product_id: string; tier_id: string; price: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCatManager, setShowCatManager] = useState(false);
  const [showTierManager, setShowTierManager] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted || isActive?.() === false) return;
    if (!outletId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [prodRes, catRes, priceRes] = await Promise.all([
        request(`/api/owner/products?outlet_id=${encodeURIComponent(outletId)}`, { signal }),
        request(`/api/owner/categories?outlet_id=${encodeURIComponent(outletId)}`, { signal }),
        request(`/api/owner/product-tier-prices?outlet_id=${encodeURIComponent(outletId)}`, { signal }),
      ]);
      if (prodRes.ok) {
        const data = await prodRes.json();
        if (signal?.aborted || isActive?.() === false) return;
        setProductList(data.products ?? []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        if (signal?.aborted || isActive?.() === false) return;
        setCatList(data.categories ?? []);
      }
      if (priceRes.ok) {
        const data = await priceRes.json();
        if (signal?.aborted || isActive?.() === false) return;
        setTierPrices(data.prices ?? []);
      }
    } catch {
      if (signal?.aborted || isActive?.() === false) return;
      showToast("error", "Gagal memuat data produk");
    } finally {
      if (!signal?.aborted && isActive?.() !== false) setLoading(false);
    }
  }, [outletId, request, showToast, isActive]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const getPriceDisplay = (productId: string, basePrice: number): string => {
    const prices = tierPrices
      .filter((p) => p.product_id === productId)
      .map((p) => p.price);
    if (prices.length === 0) return formatRupiah(Number(basePrice));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return formatRupiah(min);
    return `${formatRupiah(min)} - ${formatRupiah(max)}`;
  };

  const filtered = productList.filter((p) => {
    if (categoryFilter !== "all" && p.category_id !== categoryFilter)
      return false;
    if (search) return p.name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const handleToggleActive = async (product: ProductWithCategory) => {
    if (isActive?.() === false) return;
    try {
      const res = await request("/api/owner/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, is_active: !product.is_active }),
      });
      if (isActive?.() === false) return;
      if (res.ok) {
        setProductList((prev) =>
          prev.map((p) =>
            p.id === product.id ? { ...p, is_active: !p.is_active } : p
          )
        );
        showToast(
          "success",
          `${product.name} ${product.is_active ? "dinonaktifkan" : "diaktifkan"}`
        );
      }
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Gagal mengubah status produk");
    }
  };

  const handleDelete = async (id: string) => {
    if (isActive?.() === false) return;
    try {
      const res = await request(`/api/owner/products?id=${id}`, {
        method: "DELETE",
      });
      if (isActive?.() === false) return;
      if (res.ok) {
        setProductList((prev) => prev.filter((p) => p.id !== id));
        showToast("success", "Produk berhasil dihapus");
        void refreshOutlets();
      } else {
        const data = await res.json();
        if (isActive?.() === false) return;
        showToast("error", data.error ?? "Gagal menghapus");
      }
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Gagal menghapus produk");
    }
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Katalog Produk</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Menu, kategori, dan tier harga untuk {outletName}.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="min-h-11 px-3.5 py-2 rounded-lg text-xs font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high active:bg-surface-container-high transition-all flex items-center gap-1.5"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            type="button"
            onClick={() => setShowCatManager(true)}
            className="min-h-11 px-3.5 py-2 rounded-lg text-xs font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high active:bg-surface-container-high transition-all flex items-center gap-1.5"
          >
            <FolderCog size={14} />
            Kategori
          </button>
          <button
            type="button"
            onClick={() => setShowTierManager(true)}
            className="min-h-11 px-3.5 py-2 rounded-lg text-xs font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high active:bg-surface-container-high transition-all flex items-center gap-1.5"
          >
            <Layers size={14} />
            Tier
          </button>
          <Link
            href={`/products/add?outlet=${encodeURIComponent(outletId)}`}
            className="min-h-11 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-on-primary shadow-md shadow-primary/20 flex items-center gap-1.5 hover:bg-primary/90 active:bg-primary/90 transition-all"
          >
            <Plus size={14} />
            Tambah Produk
          </Link>
        </div>
      </div>

      {showImport && (
        <div className="mb-5">
          <ImportExcelPanel domain="products" outletId={outletId} outletName={outletName}
            onClose={() => setShowImport(false)}
            onImported={() => { setShowImport(false); void fetchData(); void refreshOutlets(); }} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-lowest border-none rounded-lg pl-11 pr-4 py-3 text-base md:text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary outline-none transition-all"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={`w-full sm:w-auto ${fieldSelectClass} !text-base md:!text-sm`}
        >
          <option value="all">Semua Kategori</option>
          {catList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-on-surface-variant">
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl">
          <EmptyState
            icon={Package}
            title="Belum ada produk"
            description={`Mulai tambah produk pertama untuk ${outletName}`}
          />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container">
                  {["Produk", "Kategori", "Harga", "Status", "Aksi"].map((h) => (
                    <th
                      key={h}
                      className={`text-label-caps uppercase text-on-surface-variant px-6 py-4 ${
                        h === "Aksi" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {filtered.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-surface-container-low/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon
                              size={16}
                              className="text-on-surface-variant"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate">
                            {product.name}
                          </p>
                          {product.description && (
                            <p className="text-xs text-on-surface-variant truncate max-w-[220px]">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">
                      {product.category_name}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-on-surface">
                      {getPriceDisplay(product.id, product.price)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={product.is_active ? "active" : "inactive"}>
                        {product.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/products/${product.id}/edit?outlet=${encodeURIComponent(outletId)}`}
                          aria-label={`Edit ${product.name}`}
                          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                        >
                          <Pencil size={18} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(product)}
                          aria-label="Ubah status"
                          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                        >
                          {product.is_active ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(product.id)}
                          aria-label={`Hapus ${product.name}`}
                          className="p-2 text-error hover:bg-error-container/20 rounded-full transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="bg-surface-container-lowest rounded-xl p-4 flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={18} className="text-on-surface-variant" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {product.category_name}
                      </p>
                    </div>
                    <Badge variant={product.is_active ? "active" : "inactive"}>
                      {product.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-start gap-2 mt-2">
                    <span className="font-mono text-sm font-bold text-primary">
                      {getPriceDisplay(product.id, product.price)}
                    </span>
                    <div className="flex items-center gap-2 self-end">
                      <Link
                        href={`/products/${product.id}/edit?outlet=${encodeURIComponent(outletId)}`}
                        aria-label={`Edit ${product.name}`}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                      >
                        <Pencil size={18} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(product)}
                        aria-label="Ubah status"
                        className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                      >
                        {product.is_active ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(product.id)}
                        aria-label={`Hapus ${product.name}`}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 text-error hover:bg-error-container/20 rounded-full transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <CategoryManagerSlideOver
        open={showCatManager}
        onClose={() => setShowCatManager(false)}
        outletId={outletId}
        categories={catList}
        onCategoriesChange={setCatList}
      />
      <TierManagerSlideOver
        open={showTierManager}
        onClose={() => {
          setShowTierManager(false);
          fetchData();
        }}
        outletId={outletId}
      />

      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) handleDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        title="Hapus Produk"
        message="Apakah kamu yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan."
      />
    </div>
  );
}
