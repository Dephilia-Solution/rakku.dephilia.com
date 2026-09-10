"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ProductWithCategory, Category } from "@rakku/shared-types";
import { formatCurrency } from "@/lib/format";
import { showToast, Badge, EmptyState, PageHeader, fieldSelectClass } from "@rakku/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CategoryManagerSlideOver from "@/components/products/CategoryManagerSlideOver";
import TierManagerSlideOver from "@/components/products/TierManagerSlideOver";
import {
  toggleProductActive,
  deleteProduct,
} from "@/lib/supabase/queries.client";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Props {
  products: ProductWithCategory[];
  categories: Category[];
  productTierPrices: { product_id: string; tier_id: string; price: number }[];
}

export default function AdminProductsClient({
  products: initialProducts,
  categories: initialCategories,
  productTierPrices,
}: Props) {
  const router = useRouter();
  const [productList, setProductList] = useState(initialProducts);
  const [catList, setCatList] = useState(initialCategories);
  const [showCatManager, setShowCatManager] = useState(false);
  const [showTierManager, setShowTierManager] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const getProductTierPriceDisplay = (productId: string): string => {
    const prices = productTierPrices
      .filter((p) => p.product_id === productId)
      .map((p) => p.price);
    if (prices.length === 0) return "-";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return formatCurrency(min);
    return `${formatCurrency(min)} - ${formatCurrency(max)}`;
  };

  const filtered = productList.filter((p) => {
    if (categoryFilter !== "all" && p.category_id !== categoryFilter)
      return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleToggleActive = async (product: ProductWithCategory) => {
    const newActive = !product.is_active;
    try {
      await toggleProductActive(product.id, newActive);
      setProductList((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, is_active: newActive } : p
        )
      );
      showToast(
        "success",
        `${product.name} ${newActive ? "diaktifkan" : "dinonaktifkan"}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah status produk";
      showToast("error", msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      setProductList((prev) => prev.filter((p) => p.id !== id));
      showToast("success", "Produk berhasil dihapus");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus produk";
      showToast("error", msg);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Produk"
        subtitle="Kelola menu, kategori, dan tier harga outlet Anda."
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
              href="/products/add"
              className="px-4 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 hover:bg-primary/90 transition-all"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Tambah Produk</span>
              <span className="sm:hidden">Tambah</span>
            </Link>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-surface-container-lowest border-none rounded-lg pl-11 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary outline-none transition-all"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
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

      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl">
          <EmptyState
            icon={Package}
            title="Belum ada produk"
            description="Mulai tambah produk pertama Anda"
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
                {paginated.map((product) => (
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
                      {getProductTierPriceDisplay(product.id)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={product.is_active ? "active" : "inactive"}>
                        {product.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/products/${product.id}/edit`}
                          aria-label={`Edit ${product.name}`}
                          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                        >
                          <Pencil size={18} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(product)}
                          aria-label={
                            product.is_active
                              ? `Nonaktifkan ${product.name}`
                              : `Aktifkan ${product.name}`
                          }
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
            {paginated.map((product) => (
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
                      {getProductTierPriceDisplay(product.id)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/products/${product.id}/edit`}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-1">
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span>Tampil</span>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-surface-container-lowest border-none rounded-lg px-2 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span>dari {filtered.length} produk</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Halaman sebelumnya"
                  className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
                  )
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-on-surface-variant">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPage(p)}
                        className={`min-w-[36px] h-9 rounded-lg text-sm font-semibold transition-colors ${
                          page === p
                            ? "bg-primary text-on-primary"
                            : "text-on-surface-variant hover:bg-surface-container"
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Halaman berikutnya"
                  className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <CategoryManagerSlideOver
        open={showCatManager}
        onClose={() => setShowCatManager(false)}
        categories={catList}
        onCategoriesChange={setCatList}
      />
      <TierManagerSlideOver
        open={showTierManager}
        onClose={() => {
          setShowTierManager(false);
          router.refresh();
        }}
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
