"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useModalHistory } from "@/hooks/useModalHistory";
import Image from "next/image";
import { ProductWithCategory, Category, Modifier, PricingTier } from "@rakku/shared-types";
import { formatCurrency } from "@/lib/dummy-data";
import { showToast, Badge, EmptyState } from "@rakku/ui";
import {
  toggleProductActive,
  createProduct,
  updateProduct,
  deleteModifier,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/supabase/queries.client";
import { uploadProductImage } from "@/lib/supabase/storage";
import {
  Plus,
  Search,
  ImageIcon,
  Pencil,
  X,
  Check,
  Package,
  Eye,
  EyeOff,
  Trash2,
  Upload,
  GripHorizontal,
  Settings,
} from "lucide-react";

interface Props {
  products: ProductWithCategory[];
  categories: Category[];
  modifiers: (Modifier & { tier_prices?: { modifier_id: string; tier_id: string; price_delta: number }[] })[];
  pricingTiers: PricingTier[];
  productTierPrices: { product_id: string; tier_id: string; price: number }[];
}

export default function AdminProductsClient({ products: initialProducts, categories: initialCategories, modifiers: initialModifiers, pricingTiers: initialPricingTiers, productTierPrices: initialProductTierPrices }: Props) {
  const [productList, setProductList] = useState(initialProducts);
  const [modifierList, setModifierList] = useState(initialModifiers);
  const [catList, setCatList] = useState(initialCategories);
  const [pricingTiers] = useState<PricingTier[]>(initialPricingTiers);
  const [productTierPrices, setProductTierPrices] = useState(initialProductTierPrices);
  const [modifierTierDeltas, setModifierTierDeltas] = useState<Record<string, Record<string, number>>>(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const mod of initialModifiers) {
      if (mod.tier_prices) {
        map[mod.id] = {};
        for (const tp of mod.tier_prices) {
          map[mod.id][tp.tier_id] = tp.price_delta;
        }
      }
    }
    return map;
  });
  const [showCatModal, setShowCatModal] = useState(false);
  const [catNewName, setCatNewName] = useState("");
  const [catEditId, setCatEditId] = useState<string | null>(null);
  const [catEditName, setCatEditName] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [form, setForm] = useState({
    name: "",
    category_id: "",
    description: "",
    is_active: true,
  });
  const [tierPrices, setTierPrices] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productModifiers, setProductModifiers] = useState<(typeof initialModifiers)[number][]>([]);
  const [newProductModifiers, setNewProductModifiers] = useState<Array<{name: string, group_name: string, tierDeltas: Record<string, number>}>>([]);
  const [modifierForm, setModifierForm] = useState<{ name: string; group_name: string; tierDeltas: Record<string, string> }>({ name: "", group_name: "", tierDeltas: {} });

  const closeProductForm = useCallback(() => {
    setShowForm(false);
    setEditingProduct(null);
  }, []);

  const { handleCloseAndPop: closeProductFormWithHistory } = useModalHistory(showForm, closeProductForm);

  useEffect(() => {
    if (editingProduct) {
      setProductModifiers(modifierList.filter((m) => m.product_id === editingProduct.id));
      setNewProductModifiers([]);
      const existingTierPrices = productTierPrices.filter((p) => p.product_id === editingProduct.id);
      const tp: Record<string, string> = {};
      for (const tier of pricingTiers) {
        const found = existingTierPrices.find((p) => p.tier_id === tier.id);
        tp[tier.id] = found ? String(found.price) : "";
      }
      setTierPrices(tp);
    } else {
      setProductModifiers([]);
      setNewProductModifiers([]);
      const tp: Record<string, string> = {};
      for (const tier of pricingTiers) {
        tp[tier.id] = "";
      }
      setTierPrices(tp);
    }
    const mf: Record<string, string> = {};
    for (const tier of pricingTiers) {
      mf[tier.id] = "";
    }
    setModifierForm({ name: "", group_name: "", tierDeltas: mf });
  }, [editingProduct, modifierList, pricingTiers, productTierPrices]);

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

  const handleEdit = (product: ProductWithCategory) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      category_id: product.category_id,
      description: product.description ?? "",
      is_active: product.is_active,
    });
    setSelectedFile(null);
    setPreviewUrl(product.image_url);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingProduct(null);
    setForm({
      name: "",
      category_id: catList[0]?.id ?? "",
      description: "",
      is_active: true,
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setShowForm(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showToast("error", "Format file harus JPG, PNG, atau WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("error", "Ukuran file maksimal 2MB");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!form.name) {
      showToast("error", "Nama produk harus diisi");
      return;
    }
    const hasAnyTierPrice = Object.values(tierPrices).some((v) => v !== "" && Number(v) >= 0);
    if (pricingTiers.length > 0 && !hasAnyTierPrice) {
      showToast("error", "Minimal satu harga tier harus diisi");
      return;
    }
    setSaving(true);

    try {
      let companyId: string | undefined;
      let outletId: string | undefined;
      try {
        const res = await fetch("/api/auth/tenant/session");
        if (res.ok) {
          const s = await res.json();
          companyId = s.company_id;
          outletId = s.outlet_id;
        }
      } catch {}

      const firstTierPrice = Object.values(tierPrices).find((v) => v !== "" && Number(v) >= 0);
      const basePrice = firstTierPrice ? Number(firstTierPrice) : 0;

      if (editingProduct) {
        const updates: Record<string, string | number | boolean | null> = {
          name: form.name,
          price: basePrice,
          category_id: form.category_id,
          description: form.description,
          is_active: form.is_active,
        };

        if (selectedFile) {
          setUploadProgress(true);
          const imageUrl = await uploadProductImage(editingProduct.id, selectedFile);
          updates.image_url = imageUrl;
          setUploadProgress(false);
        }

        await updateProduct(editingProduct.id, updates);

        const tierPriceArray = Object.entries(tierPrices)
          .filter(([, v]) => v !== "" && Number(v) >= 0)
          .map(([tierId, price]) => ({ tier_id: tierId, price: Number(price) }));
        await fetch("/api/admin/product-tier-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: editingProduct.id, prices: tierPriceArray }),
        });

        setProductTierPrices((prev) => {
          const filtered = prev.filter((p) => p.product_id !== editingProduct.id);
          return [...filtered, ...tierPriceArray.map((p) => ({ product_id: editingProduct.id, tier_id: p.tier_id, price: p.price }))];
        });

        setProductList((prev) =>
          prev.map((p) =>
            p.id === editingProduct.id
              ? {
                  ...p,
                  ...updates,
                  category_name:
                    catList.find((c) => c.id === form.category_id)?.name ?? "",
                }
              : p
          )
        );
        showToast("success", "Produk berhasil diupdate");
      } else {
        const data = await createProduct({
          name: form.name,
          price: basePrice,
          category_id: form.category_id,
          description: form.description,
          is_active: form.is_active,
          companyId,
          outletId,
        });

        let imageUrl: string | null = null;
        if (selectedFile) {
          setUploadProgress(true);
          imageUrl = await uploadProductImage(data.id, selectedFile);
          await updateProduct(data.id, { image_url: imageUrl });
          setUploadProgress(false);
        }

        const tierPriceArray = Object.entries(tierPrices)
          .filter(([, v]) => v !== "" && Number(v) >= 0)
          .map(([tierId, price]) => ({ tier_id: tierId, price: Number(price) }));
        if (tierPriceArray.length > 0) {
          await fetch("/api/admin/product-tier-prices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: data.id, prices: tierPriceArray }),
          });
        }

        setProductTierPrices((prev) => [
          ...prev,
          ...tierPriceArray.map((p) => ({ product_id: data.id, tier_id: p.tier_id, price: p.price })),
        ]);

        const newProduct: ProductWithCategory = {
          id: data.id,
          name: data.name,
          price: basePrice,
          category_id: data.category_id,
          image_url: imageUrl,
          is_active: data.is_active,
          description: data.description,
          category_name:
            catList.find((c) => c.id === data.category_id)?.name ?? "",
        };
        setProductList((prev) => [...prev, newProduct]);

        if (newProductModifiers.length > 0) {
          for (const mod of newProductModifiers) {
            try {
              const prices = Object.entries(mod.tierDeltas)
                .filter(([, v]) => v !== undefined)
                .map(([tierId, delta]) => ({ tier_id: tierId, price_delta: delta }));
              const res = await fetch("/api/admin/modifiers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product_id: data.id, name: mod.name, group_name: mod.group_name || null, prices }),
              });
              if (res.ok) {
                const created = await res.json();
                setModifierList((prev) => [...prev, created]);
              }
            } catch {}
          }
          setNewProductModifiers([]);
        }

        showToast("success", "Produk berhasil ditambahkan");
      }

      setShowForm(false);
      setEditingProduct(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      showToast("error", message);
    } finally {
      setSaving(false);
      setUploadProgress(false);
    }
  };

  const handleToggleActive = async (product: ProductWithCategory) => {
    const newActive = !product.is_active;
    try {
      await toggleProductActive(product.id, newActive);
      setProductList((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, is_active: newActive } : p
        )
      );
      showToast("success", `${product.name} ${newActive ? "diaktifkan" : "dinonaktifkan"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah status produk";
      showToast("error", msg);
    }
  };

  const handleAddModifier = async () => {
    const name = modifierForm.name.trim();
    if (!name) {
      showToast("error", "Nama add-on harus diisi");
      return;
    }

    const group_name = modifierForm.group_name.trim() || null;

    const tierDeltas: Record<string, number> = {};
    for (const [tierId, val] of Object.entries(modifierForm.tierDeltas)) {
      const n = Number(val);
      if (!isNaN(n)) tierDeltas[tierId] = n;
    }

    if (editingProduct) {
      try {
        const prices = Object.entries(tierDeltas).map(([tierId, delta]) => ({ tier_id: tierId, price_delta: delta }));
        const res = await fetch("/api/admin/modifiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: editingProduct.id, name, group_name, prices }),
        });
        if (res.ok) {
          const created = await res.json();
          setModifierList((prev) => [...prev, created]);
          setModifierTierDeltas((prev) => ({ ...prev, [created.id]: tierDeltas }));
        }
        const mf: Record<string, string> = {};
        for (const tier of pricingTiers) mf[tier.id] = "";
        setModifierForm({ name: "", group_name: "", tierDeltas: mf });
        showToast("success", "Add-on berhasil ditambahkan");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menambah add-on";
        showToast("error", msg);
      }
    } else {
      setNewProductModifiers((prev) => [...prev, { name, group_name: group_name ?? "", tierDeltas }]);
      const mf: Record<string, string> = {};
      for (const tier of pricingTiers) mf[tier.id] = "";
      setModifierForm({ name: "", group_name: "", tierDeltas: mf });
      showToast("success", "Add-on ditambahkan (akan disimpan saat produk dibuat)");
    }
  };

  const handleDeleteModifier = async (mod: Modifier) => {
    try {
      await deleteModifier(mod.id);
      setModifierList((prev) => prev.filter((m) => m.id !== mod.id));
      showToast("success", "Add-on berhasil dihapus");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus add-on";
      showToast("error", msg);
    }
  };

  const handleCatAdd = async () => {
    const name = catNewName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/auth/tenant/session");
      let companyId = "";
      let outletId = "";
      if (res.ok) {
        const s = await res.json();
        companyId = s.company_id;
        outletId = s.outlet_id;
      }
      const data = await createCategory(name, companyId, outletId);
      setCatList((prev) => [...prev, { id: data.id, name: data.name, sort_order: data.sort_order }]);
      setForm((prev) => ({ ...prev, category_id: data.id }));
      setCatNewName("");
      showToast("success", "Kategori berhasil ditambahkan");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menambah kategori";
      showToast("error", msg);
    }
  };

  const handleCatStartEdit = (cat: Category) => {
    setCatEditId(cat.id);
    setCatEditName(cat.name);
  };

  const handleCatSaveEdit = async () => {
    if (!catEditId || !catEditName.trim()) return;
    try {
      await updateCategory(catEditId, catEditName.trim());
      setCatList((prev) => prev.map((c) => (c.id === catEditId ? { ...c, name: catEditName.trim() } : c)));
      setCatEditId(null);
      setCatEditName("");
      showToast("success", "Kategori berhasil diupdate");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengupdate kategori";
      showToast("error", msg);
    }
  };

  const handleCatDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      setCatList((prev) => prev.filter((c) => c.id !== id));
      if (form.category_id === id) {
        setForm((prev) => ({ ...prev, category_id: catList.find((c) => c.id !== id)?.id ?? "" }));
      }
      showToast("success", "Kategori berhasil dihapus");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus kategori";
      showToast("error", msg);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="font-display font-bold text-xl sm:text-2xl text-neutral-900">
          Produk
        </h1>
        <button
          onClick={handleNew}
          className="w-full sm:w-auto bg-forest text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Tambah Produk
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 sm:py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full sm:w-auto bg-white border border-neutral-200 rounded-xl px-4 py-2.5 sm:py-2 text-sm text-neutral-600 focus:outline-none focus:border-forest"
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
        <EmptyState icon={Package} title="Belum ada produk" description="Mulai tambah produk pertama Anda" />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  {["Produk", "Kategori", "Harga", "Status", "Aksi"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {product.image_url ? (
                            <Image src={product.image_url} alt={product.name} width={40} height={40} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon size={16} className="text-neutral-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-neutral-400 truncate max-w-[200px]">{product.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{product.category_name}</td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-neutral-900">{getProductTierPriceDisplay(product.id)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={product.is_active ? "active" : "inactive"}>
                        {product.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(product)}
                          className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-700 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleToggleActive(product)}
                          className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-700 transition-colors">
                          {product.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
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
              <div key={product.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {product.image_url ? (
                    <Image src={product.image_url} alt={product.name} width={48} height={48} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={18} className="text-neutral-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">{product.name}</p>
                      <p className="text-xs text-neutral-400">{product.category_name}</p>
                    </div>
                    <Badge variant={product.is_active ? "active" : "inactive"}>
                      {product.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-mono text-sm font-bold text-forest">{getProductTierPriceDisplay(product.id)}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(product)}
                        className="w-9 h-9 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-700 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleToggleActive(product)}
                        className="w-9 h-9 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-700 transition-colors">
                        {product.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  {product.description && (
                    <p className="text-xs text-neutral-400 mt-1 truncate">{product.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm overflow-y-auto overscroll-contain" onClick={closeProductFormWithHistory}>
          <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
            <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-md w-full sm:max-w-md mobile-slide-up pb-safe sm:pb-0 max-h-[90dvh] sm:max-h-none overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-neutral-300" />
              </div>

              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-200">
                <h3 className="font-display font-semibold text-base text-neutral-900">
                  {editingProduct ? "Edit Produk" : "Tambah Produk"}
                </h3>
                <button onClick={closeProductFormWithHistory}
                  className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              {/* Image Upload */}
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {previewUrl ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-100">
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video rounded-xl bg-neutral-100 border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center cursor-pointer hover:border-forest hover:bg-primary-50 transition-all"
                  >
                    <Upload size={28} className="text-neutral-300 mb-2" />
                    <p className="text-xs text-neutral-400">Klik untuk upload gambar</p>
                    <p className="text-[10px] text-neutral-300 mt-1">Max 2MB. JPG, PNG, WebP</p>
                  </button>
                )}
                {uploadProgress && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-forest rounded-full animate-pulse" style={{ width: "60%" }} />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Nama Produk</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Cafe Latte"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest" />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Kategori</label>
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-forest">
                  {catList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCatModal(true)}
                  className="text-xs text-forest font-medium mt-1.5 hover:underline flex items-center gap-1"
                >
                  <Settings size={12} />
                  Atur Kategori
                </button>
              </div>

              {pricingTiers.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Harga per Tier</label>
                  <div className="space-y-2">
                    {pricingTiers.map((tier) => (
                      <div key={tier.id} className="flex items-center gap-2">
                        <span className="text-sm text-neutral-600 w-24 flex-shrink-0">{tier.name}</span>
                        <input
                          type="number"
                          value={tierPrices[tier.id] ?? ""}
                          onChange={(e) => setTierPrices({ ...tierPrices, [tier.id]: e.target.value })}
                          placeholder="0"
                          className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-mono text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Deskripsi</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Deskripsi produk..." rows={2}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest resize-none" />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Produk Aktif</span>
                <button onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  className={`w-11 h-6 rounded-full transition-colors relative ${form.is_active ? "bg-forest" : "bg-neutral-300"}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-all ${form.is_active ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>

              {/* ── ADD-ONS / MODIFIER ── */}
              <div className="border-t border-neutral-200 pt-4 mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <GripHorizontal size={14} className="text-neutral-400" />
                  <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Add-ons / Modifier
                  </span>
                </div>

                {productModifiers.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {productModifiers.map((mod) => (
                      <div key={mod.id} className="bg-neutral-50 rounded-xl px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-neutral-900 truncate">{mod.name}</span>
                            {mod.group_name && (
                              <span className="text-[10px] text-neutral-500 bg-neutral-200 px-1.5 py-0.5 rounded">
                                {mod.group_name}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteModifier(mod)}
                            className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {pricingTiers.map((tier) => {
                            const delta = modifierTierDeltas[mod.id]?.[tier.id] ?? mod.price_delta ?? 0;
                            return (
                              <span key={tier.id} className="text-[10px] font-mono text-forest bg-primary-50 px-1.5 py-0.5 rounded">
                                {tier.name}: +{formatCurrency(delta)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {newProductModifiers.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {newProductModifiers.map((mod, idx) => (
                      <div key={idx} className="bg-primary-50 rounded-xl px-3 py-2 border border-primary-200">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-neutral-900 truncate">{mod.name}</span>
                            {mod.group_name && (
                              <span className="text-[10px] text-neutral-500 bg-white px-1.5 py-0.5 rounded">
                                {mod.group_name}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setNewProductModifiers((prev) => prev.filter((_, i) => i !== idx))}
                            className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {pricingTiers.map((tier) => (
                            <span key={tier.id} className="text-[10px] font-mono text-forest bg-white px-1.5 py-0.5 rounded">
                              {tier.name}: +{formatCurrency(mod.tierDeltas[tier.id] ?? 0)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <input
                    type="text"
                    value={modifierForm.name}
                    onChange={(e) => setModifierForm({ ...modifierForm, name: e.target.value })}
                    placeholder="Nama add-on"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                  />
                  <input
                    type="text"
                    value={modifierForm.group_name}
                    onChange={(e) => setModifierForm({ ...modifierForm, group_name: e.target.value })}
                    placeholder="Grup (opsional, misal: Telur, Tingkat, Sambal)"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                  />
                  {pricingTiers.length > 0 && (
                    <div className="space-y-1.5">
                      {pricingTiers.map((tier) => (
                        <div key={tier.id} className="flex items-center gap-2">
                          <span className="text-xs text-neutral-500 w-24 flex-shrink-0">{tier.name}</span>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-mono">+</span>
                            <input
                              type="number"
                              value={modifierForm.tierDeltas[tier.id] ?? ""}
                              onChange={(e) => setModifierForm({ ...modifierForm, tierDeltas: { ...modifierForm.tierDeltas, [tier.id]: e.target.value } })}
                              placeholder="0"
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-6 pr-3 py-2 text-sm font-mono text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleAddModifier}
                    className="w-full py-2 rounded-xl bg-forest text-white text-sm font-semibold hover:bg-forest-dark active:scale-[0.97] transition-all flex items-center justify-center gap-1"
                  >
                    <Plus size={16} />
                    Tambah Add-on
                  </button>
                </div>
              </div>

            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-neutral-200 bg-white flex gap-2">
              <button onClick={closeProductFormWithHistory}
                className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-3 hover:bg-neutral-200 transition-colors active:scale-[0.98]">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-forest text-white rounded-xl py-3 text-sm font-semibold hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Simpan
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {showCatModal && (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
          <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-white sm:rounded-2xl shadow-md w-full sm:max-w-sm sm:p-6 p-4 pb-safe">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-semibold text-base text-neutral-900">Atur Kategori</h3>
                <button onClick={() => { setShowCatModal(false); setCatNewName(""); setCatEditId(null); }}
                  className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600">
                  <X size={16} />
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={catNewName}
                  onChange={(e) => setCatNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCatAdd()}
                  placeholder="Nama kategori baru..."
                  className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                />
                <button
                  onClick={handleCatAdd}
                  disabled={!catNewName.trim()}
                  className="bg-forest text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus size={15} />
                  Tambah
                </button>
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {catList.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-6">Belum ada kategori</p>
                ) : (
                  catList
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((cat) => (
                      <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-neutral-50 group">
                        {catEditId === cat.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={catEditName}
                              onChange={(e) => setCatEditName(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleCatSaveEdit()}
                              className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:border-forest"
                              autoFocus
                            />
                            <button onClick={handleCatSaveEdit}
                              className="w-7 h-7 rounded-lg bg-forest text-white flex items-center justify-center">
                              <Check size={13} />
                            </button>
                            <button onClick={() => setCatEditId(null)}
                              className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-400 flex items-center justify-center">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-neutral-900 truncate">{cat.name}</span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleCatStartEdit(cat)}
                                className="w-7 h-7 rounded-lg hover:bg-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700 transition-colors">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => handleCatDelete(cat.id)}
                                className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
