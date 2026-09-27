"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductWithCategory, Category } from "@rakku/shared-types";
import {
  PageHeader,
  Badge,
  EmptyState,
  fieldSelectClass,
  showToast,
} from "@rakku/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CategoryManagerSlideOver from "@/components/products/CategoryManagerSlideOver";
import TierManagerSlideOver from "@/components/products/TierManagerSlideOver";
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
  Building2,
  Loader2,
} from "lucide-react";

interface OutletOption {
  id: string;
  name: string;
}

interface Props {
  outlets: OutletOption[];
}

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export default function OwnerProductsClient({ outlets }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const outletParam = searchParams.get("outlet");
  const outletId =
    outletParam && outlets.find((o) => o.id === outletParam)
      ? outletParam
      : (outlets[0]?.id ?? "");
  const outletName = outlets.find((o) => o.id === outletId)?.name ?? "";

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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [prodRes, catRes, priceRes] = await Promise.all([
        fetch(`/api/owner/products?outlet_id=${encodeURIComponent(outletId)}`),
        fetch(`/api/owner/categories?outlet_id=${encodeURIComponent(outletId)}`),
        fetch(`/api/owner/product-tier-prices?outlet_id=${encodeURIComponent(outletId)}`),
      ]);
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProductList(data.products ?? []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCatList(data.categories ?? []);
      }
      if (priceRes.ok) {
        const data = await priceRes.json();
        setTierPrices(data.prices ?? []);
      }
    } catch {
      showToast("error", "Gagal memuat data produk");
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOutletChange = (id: string) => {
    router.replace(`/products?outlet=${encodeURIComponent(id)}`);
  };

  const getPriceDisplay = (productId: string): string => {
    const prices = tierPrices
      .filter((p) => p.product_id === productId)
      .map((p) => p.price);
    if (prices.length === 0) return "-";
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
    try {
      const res = await fetch("/api/owner/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, is_active: !product.is_active }),
      });
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
      showToast("error", "Gagal mengubah status produk");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/owner/products?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProductList((prev) => prev.filter((p) => p.id !== id));
        showToast("success", "Produk berhasil dihapus");
      } else {
        const data = await res.json();
        showToast("error", data.error ?? "Gagal menghapus");
      }
    } catch {
      showToast("error", "Gagal menghapus produk");
    }
  };

  if (outlets.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <PageHeader title="Produk" />
        <EmptyState
          icon={Building2}
          title="Belum ada outlet"
          description="Buat outlet terlebih dahulu sebelum mengelola produk"
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Produk"
        subtitle="Kelola menu, kategori, dan tier harga per outlet."
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowCatManager(true)}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-all flex items-center gap-2"
            >
              <FolderCog size={16} />
              <span className="hidden sm:inline">Kategori</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTierManager(true)}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-all flex items-center gap-2"
            >
              <Layers size={16} />
              <span className="hidden sm:inline">Tier</span>
            </button>
            <Link
              href={`/products/add?outlet=${encodeURIComponent(outletId)}`}
              className="px-4 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 hover:bg-primary/90 transition-all"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Tambah Produk</span>
              <span className="sm:hidden">Tambah</span>
            </Link>
          </>
        }
      />

      {/* Outlet Selector + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative w-full sm:max-w-[220px]">
          <Building2
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
          />
          <select
            value={outletId}
            onChange={(e) => handleOutletChange(e.target.value)}
            aria-label="Pilih outlet"
            className={`${fieldSelectClass} !pl-11 font-semibold`}
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
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
            className="w-full bg-surface-container-lowest border-none rounded-lg pl-11 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary outline-none transition-all"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={`w-full sm:w-auto ${fieldSelectClass}`}
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
                      {getPriceDisplay(product.id)}
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
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-mono text-sm font-bold text-primary">
                      {getPriceDisplay(product.id)}
                    </span>
                    <div className="flex items-center gap-1">
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
