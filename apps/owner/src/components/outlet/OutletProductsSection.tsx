"use client";

import { useState, useEffect, useCallback, useDeferredValue, useMemo } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { MerchantLink as Link, useMerchantRequest, useMerchantRuntime, useMerchantToast } from "@/lib/merchant-runtime";
import { ProductWithCategory, Category } from "@rakku/shared-types";
import { Badge, fieldSelectClass } from "@rakku/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { OwnerEmpty, OwnerError, OwnerSection, OwnerSkeleton } from "@/components/ui/OwnerPrimitives";
import { useOutletScope } from "./OutletScopeProvider";
import {
  Plus,
  Search,
  ImageIcon,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  FolderCog,
  Layers,
  Upload,
} from "lucide-react";

const editorLoading = () => <OwnerSkeleton rows={2} />;
const CategoryManagerSlideOver = dynamic(() => import("@/components/products/CategoryManagerSlideOver"), { loading: editorLoading });
const TierManagerSlideOver = dynamic(() => import("@/components/products/TierManagerSlideOver"), { loading: editorLoading });
const ImportExcelPanel = dynamic(() => import("./ImportExcelPanel"), { loading: editorLoading });

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
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
    setLoadError(null);
    try {
      const [prodRes, catRes, priceRes] = await Promise.all([
        request(`/api/owner/products?outlet_id=${encodeURIComponent(outletId)}`, { signal }),
        request(`/api/owner/categories?outlet_id=${encodeURIComponent(outletId)}`, { signal }),
        request(`/api/owner/product-tier-prices?outlet_id=${encodeURIComponent(outletId)}`, { signal }),
      ]);
      for (const response of [prodRes, catRes, priceRes]) {
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Gagal memuat data produk");
        }
      }
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
    } catch (error) {
      if (signal?.aborted || isActive?.() === false) return;
      setLoadError(error instanceof Error ? error.message : "Gagal memuat data produk. Silakan coba lagi.");
    } finally {
      if (!signal?.aborted && isActive?.() !== false) setLoading(false);
    }
  }, [outletId, request, isActive]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const priceRanges = useMemo(() => {
    const result = new Map<string, {min:number;max:number}>();
    for (const row of tierPrices) { const price=Number(row.price), prior=result.get(row.product_id);result.set(row.product_id,{min:Math.min(prior?.min ?? price,price),max:Math.max(prior?.max ?? price,price)}); }
    return result;
  }, [tierPrices]);
  const getPriceDisplay = (productId: string, basePrice: number): string => {
    const prices=priceRanges.get(productId);
    if (!prices) return formatRupiah(Number(basePrice));
    const {min,max}=prices;
    if (min === max) return formatRupiah(min);
    return `${formatRupiah(min)} - ${formatRupiah(max)}`;
  };

  const filtered = useMemo(() => productList.filter((p) => {
    if (categoryFilter !== "all" && p.category_id !== categoryFilter)
      return false;
    if (deferredSearch.trim()) return `${p.name} ${p.code ?? ""}`.toLocaleLowerCase("id-ID").includes(deferredSearch.trim().toLocaleLowerCase("id-ID"));
    return true;
  }),[productList,categoryFilter,deferredSearch]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/20)),currentPage=Math.min(page,pageCount);
  const visibleProducts=filtered.slice((currentPage-1)*20,currentPage*20);

  const handleToggleActive = async (product: ProductWithCategory) => {
    if (busyId || isActive?.() === false) return;
    setBusyId(product.id);
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
      } else {
        const data = await res.json();
        if (isActive?.() === false) return;
        showToast("error", data.error ?? "Gagal mengubah status produk");
      }
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Gagal mengubah status produk");
    } finally {
      setBusyId(null);
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
    <OwnerSection title="Katalog Produk" description={`Menu, kategori, dan tier harga untuk ${outletName}.`} actions={
        <>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="owner-button owner-button--secondary"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            type="button"
            onClick={() => setShowCatManager(true)}
            className="owner-button owner-button--secondary"
          >
            <FolderCog size={14} />
            Kategori
          </button>
          <button
            type="button"
            onClick={() => setShowTierManager(true)}
            className="owner-button owner-button--secondary"
          >
            <Layers size={14} />
            Tier
          </button>
          <Link
            href={`/products/add?outlet=${encodeURIComponent(outletId)}`}
            className="owner-button owner-button--primary"
          >
            <Plus size={14} />
            Tambah Produk
          </Link>
        </>
      }>

      {showImport && (
        <div className="mb-5">
          <ImportExcelPanel domain="products" outletId={outletId} outletName={outletName}
            onClose={() => setShowImport(false)}
            onImported={() => { setShowImport(false); void fetchData(); void refreshOutlets(); }} />
        </div>
      )}

      {/* Filters */}
      <div className="owner-toolbar mb-5">
        <div className="owner-search relative min-w-0">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            aria-label="Cari nama atau kode produk"
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="min-h-11 w-full border border-surface-container bg-white rounded-lg pl-11 pr-4 py-3 text-base text-on-surface placeholder:text-on-surface-variant/60 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-colors"
          />
        </div>
        <select
          aria-label="Filter kategori produk"
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className={`w-full sm:w-auto sm:max-w-[240px] ${fieldSelectClass} !text-base min-h-11 !border-surface-container`}
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
        <OwnerSkeleton />
      ) : loadError ? (
        <OwnerError message={loadError} retry={() => void fetchData()} />
      ) : filtered.length === 0 ? (
        <OwnerEmpty title={productList.length ? "Produk tidak ditemukan" : "Belum ada produk"}
          description={productList.length ? "Coba kata kunci atau kategori lain." : `Mulai tambah produk pertama untuk ${outletName}.`}
          action={productList.length ? <button type="button" onClick={() => { setSearch(""); setCategoryFilter("all"); }} className="owner-button owner-button--secondary">Reset filter</button> : <Link href={`/products/add?outlet=${encodeURIComponent(outletId)}`} className="owner-button owner-button--primary"><Plus size={16} />Tambah Produk</Link>} />
      ) : (
        <>
          {/* Desktop Table */}
          <p className="mb-3 text-xs tabular-nums text-on-surface-variant" aria-live="polite">{filtered.length} dari {productList.length} produk</p>
          <div className="rounded-xl border border-surface-container overflow-x-auto hidden lg:block">
            <table className="w-full">
              <caption className="sr-only">Katalog produk {outletName}</caption>
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container">
                  {["Produk", "Kategori", "Harga", "Status", "Aksi"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className={`text-xs font-semibold text-on-surface-variant px-4 py-3 ${
                        h === "Aksi" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {visibleProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-surface-container-low/50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <ImageIcon
                              size={16}
                              className="text-on-surface-variant"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-on-surface break-words">
                            {product.name}
                          </p>
                           {product.code && <p className="font-mono text-xs text-on-surface-variant">{product.code}</p>}
                          {product.description && (
                            <p className="text-xs text-on-surface-variant truncate max-w-[220px]">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-on-surface-variant">
                      {product.category_name}
                    </td>
                    <td className="px-4 py-4 tabular-nums text-sm font-semibold text-on-surface">
                      {getPriceDisplay(product.id, product.price)}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={product.is_active ? "active" : "inactive"}>
                        {product.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/products/${product.id}/edit?outlet=${encodeURIComponent(outletId)}`}
                          aria-label={`Edit ${product.name}`}
                          className="min-h-11 min-w-11 inline-flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors"
                        >
                          <Pencil size={18} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(product)}
                          disabled={!!busyId}
                          aria-label={`Ubah status ${product.name}`}
                          className="min-h-11 min-w-11 inline-flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors disabled:opacity-50"
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
                          className="min-h-11 min-w-11 inline-flex items-center justify-center text-error hover:bg-error-container/20 rounded-lg transition-colors"
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
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:hidden">
            {visibleProducts.map((product) => (
              <article
                key={product.id}
                className="min-w-0 border border-surface-container rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
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
                      <p className="text-sm font-semibold text-on-surface break-words">
                        {product.name}
                      </p>
                      {product.code && <p className="font-mono text-xs break-all text-on-surface-variant">{product.code}</p>}
                      <p className="text-xs text-on-surface-variant">
                        {product.category_name}
                      </p>
                    </div>
                    <Badge variant={product.is_active ? "active" : "inactive"}>
                      {product.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                </div>
                </div>
                  {product.description && <p className="text-xs leading-relaxed text-on-surface-variant break-words">{product.description}</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-surface-container pt-3">
                    <span className="tabular-nums text-sm font-semibold text-on-surface">
                      {getPriceDisplay(product.id, product.price)}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <Link
                        href={`/products/${product.id}/edit?outlet=${encodeURIComponent(outletId)}`}
                        aria-label={`Edit ${product.name}`}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors"
                      >
                        <Pencil size={18} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(product)}
                        disabled={!!busyId}
                        aria-label={`Ubah status ${product.name}`}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors disabled:opacity-50"
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
                        className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 text-error hover:bg-error-container/20 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
              </article>
            ))}
          </div>
          {pageCount>1 && <nav aria-label="Halaman katalog produk" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-on-surface-variant">Halaman {currentPage} dari {pageCount} · 20 produk per halaman</p><div className="flex gap-2"><button type="button" className="owner-button owner-button--secondary" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Sebelumnya</button><button type="button" className="owner-button owner-button--secondary" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>Berikutnya</button></div></nav>}
        </>
      )}

      {showCatManager && <CategoryManagerSlideOver
        open={showCatManager}
        onClose={() => setShowCatManager(false)}
        outletId={outletId}
        categories={catList}
        onCategoriesChange={setCatList}
      />}
      {showTierManager && <TierManagerSlideOver
        open={showTierManager}
        onClose={() => {
          setShowTierManager(false);
          fetchData();
        }}
        outletId={outletId}
      />}

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
    </OwnerSection>
  );
}
