"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Category, Modifier, PricingTier } from "@rakku/shared-types";
import {
  PageHeader,
  FormField,
  fieldInputClass,
  fieldSelectClass,
  Toggle,
  showToast,
} from "@rakku/ui";
import CategoryManagerSlideOver from "./CategoryManagerSlideOver";
import TierManagerSlideOver from "./TierManagerSlideOver";
import RecipeManagerSlideOver, { RecipeRow } from "./RecipeManagerSlideOver";
import { usePlan } from "@/components/billing/PlanProvider";
import { useNavMode } from "@/hooks/useNavMode";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Banknote,
  Puzzle,
  Plus,
  Trash2,
  Pencil,
  Info,
  CookingPot,
} from "lucide-react";

type ModifierWithTierPrices = Modifier & {
  tier_prices?: { modifier_id: string; tier_id: string; price_delta: number }[];
  modifier_tier_prices?: { modifier_id: string; tier_id: string; price_delta: number }[];
};

interface OwnerProductFormProps {
  mode: "add" | "edit";
  outletId: string;
  outletName: string;
  productId?: string;
  categories: Category[];
  pricingTiers: PricingTier[];
  initialProduct?: {
    name: string;
    category_id: string;
    description: string | null;
    is_active: boolean;
    image_url: string | null;
  };
  initialTierPrices?: Record<string, number>;
  initialModifiers?: ModifierWithTierPrices[];
  initialRecipes?: RecipeRow[];
}

function tierCode(name: string) {
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "TR";
}

export default function OwnerProductForm({
  mode,
  outletId,
  outletName,
  productId,
  categories: initialCategories,
  pricingTiers: initialPricingTiers,
  initialProduct,
  initialTierPrices = {},
  initialModifiers = [],
  initialRecipes = [],
}: OwnerProductFormProps) {
  const router = useRouter();
  const { openUpgrade } = usePlan();

  const [form, setForm] = useState({
    name: initialProduct?.name ?? "",
    category_id: initialProduct?.category_id ?? initialCategories[0]?.id ?? "",
    description: initialProduct?.description ?? "",
    is_active: initialProduct?.is_active ?? true,
  });
  const [catList, setCatList] = useState<Category[]>(initialCategories);
  const [tiers, setTiers] = useState<PricingTier[]>(initialPricingTiers);
  const activeTiers = tiers.filter((t) => t.is_active);
  const [tierPrices, setTierPrices] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const t of initialPricingTiers) {
      map[t.id] =
        initialTierPrices[t.id] !== undefined
          ? String(initialTierPrices[t.id])
          : "";
    }
    return map;
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialProduct?.image_url ?? null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modifiers, setModifiers] =
    useState<ModifierWithTierPrices[]>(initialModifiers);
  const [queuedModifiers, setQueuedModifiers] = useState<
    Array<{ name: string; group_name: string; tierDeltas: Record<string, number> }>
  >([]);
  const [modForm, setModForm] = useState<{
    name: string;
    group_name: string;
    tierDeltas: Record<string, string>;
  }>({ name: "", group_name: "", tierDeltas: {} });

  const [editModId, setEditModId] = useState<string | null>(null);
  const [editQueuedIdx, setEditQueuedIdx] = useState<number | null>(null);
  const [showModForm, setShowModForm] = useState(false);
  const [addingNewGroup, setAddingNewGroup] = useState(false);

  const existingGroups = useMemo(() => {
    const groups: string[] = [];
    const seen = new Set<string>();
    for (const m of modifiers) if (m.group_name && !seen.has(m.group_name)) { seen.add(m.group_name); groups.push(m.group_name); }
    for (const m of queuedModifiers) if (m.group_name && !seen.has(m.group_name)) { seen.add(m.group_name); groups.push(m.group_name); }
    return groups.sort();
  }, [modifiers, queuedModifiers]);

  const [saving, setSaving] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [showTierManager, setShowTierManager] = useState(false);

  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>(initialRecipes);
  const [showRecipeManager, setShowRecipeManager] = useState(false);

  const navMode = useNavMode();
  const isMobileBottom = navMode === "bottom";

  const listUrl = `/products?outlet=${encodeURIComponent(outletId)}`;

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

  const handleCategoriesChange = (next: Category[]) => {
    setCatList(next);
    if (!next.find((c) => c.id === form.category_id)) {
      setForm((prev) => ({ ...prev, category_id: next[0]?.id ?? "" }));
    }
  };

  const handleTiersChange = (next: PricingTier[]) => {
    setTiers(next);
    setTierPrices((prev) => {
      const map = { ...prev };
      for (const t of next) {
        if (map[t.id] === undefined) map[t.id] = "";
      }
      return map;
    });
  };

  const uploadImage = async (pid: string): Promise<string | null> => {
    if (!selectedFile) return null;
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("productId", pid);
    const res = await fetch("/api/owner/products/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Upload gambar gagal");
    }
    const { url } = await res.json();
    return url as string;
  };

  const handleAddModifier = async () => {
    const name = modForm.name.trim();
    if (!name) {
      showToast("error", "Nama add-on harus diisi");
      return;
    }
    const group_name = modForm.group_name.trim();
    const tierDeltas: Record<string, number> = {};
    for (const [tierId, val] of Object.entries(modForm.tierDeltas)) {
      const n = Number(val);
      if (!isNaN(n) && val !== "") tierDeltas[tierId] = n;
    }

    if (editQueuedIdx !== null && editModId) {
      setQueuedModifiers((prev) =>
        prev.map((m, i) =>
          i === editQueuedIdx ? { name, group_name, tierDeltas } : m
        )
      );
      resetModForm();
      showToast("success", "Add-on berhasil diupdate");
      return;
    }

    if (editModId) {
      try {
        const prices = Object.entries(tierDeltas).map(([tierId, delta]) => ({
          tier_id: tierId,
          price_delta: delta,
        }));
        const res = await fetch("/api/owner/modifiers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editModId, name, group_name: group_name || null, prices }),
        });
        if (!res.ok) throw new Error("Gagal mengupdate add-on");
        setModifiers((prev) =>
          prev.map((m) =>
            m.id === editModId
              ? { ...m, name, group_name: group_name || null, tier_prices: prices.map((p) => ({ ...p, modifier_id: editModId })) }
              : m
          )
        );
        resetModForm();
        showToast("success", "Add-on berhasil diupdate");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal mengupdate add-on";
        showToast("error", msg);
      }
      return;
    }

    if (mode === "edit" && productId) {
      try {
        const prices = Object.entries(tierDeltas).map(([tierId, delta]) => ({
          tier_id: tierId,
          price_delta: delta,
        }));
        const res = await fetch("/api/owner/modifiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: productId,
            name,
            group_name: group_name || null,
            prices,
          }),
        });
        if (!res.ok) throw new Error("Gagal menambah add-on");
        const created = await res.json();
        setModifiers((prev) => [
          ...prev,
          {
            ...created,
            tier_prices: prices.map((p) => ({
              modifier_id: created.id,
              tier_id: p.tier_id,
              price_delta: p.price_delta,
            })),
          },
        ]);
        resetModForm();
        showToast("success", "Add-on berhasil ditambahkan");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menambah add-on";
        showToast("error", msg);
      }
    } else {
      setQueuedModifiers((prev) => [...prev, { name, group_name, tierDeltas }]);
      resetModForm();
      showToast("success", "Add-on ditambahkan (disimpan bersama produk)");
    }
  };

  const handleDeleteModifier = async (mod: ModifierWithTierPrices) => {
    try {
      const res = await fetch(`/api/owner/modifiers?id=${mod.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus add-on");
      setModifiers((prev) => prev.filter((m) => m.id !== mod.id));
      showToast("success", "Add-on berhasil dihapus");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus add-on";
      showToast("error", msg);
    }
  };

  const resetModForm = () => {
    setModForm({ name: "", group_name: "", tierDeltas: {} });
    setEditModId(null);
    setEditQueuedIdx(null);
    setAddingNewGroup(false);
    setShowModForm(false);
  };

  const applySameDeltaToAllTiers = (value: string) => {
    setModForm((prev) => {
      const next: Record<string, string> = {};
      for (const t of activeTiers) next[t.id] = value;
      return { ...prev, tierDeltas: next };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast("error", "Nama produk harus diisi");
      return;
    }
    if (!form.category_id) {
      showToast("error", "Kategori wajib dipilih");
      return;
    }
    const filledPrices = Object.values(tierPrices).filter(
      (v) => v !== "" && Number(v) >= 0
    );
    if (activeTiers.length > 0 && filledPrices.length === 0) {
      showToast("error", "Minimal satu harga tier harus diisi");
      return;
    }
    setSaving(true);

    try {
      const basePrice = filledPrices.length > 0 ? Number(filledPrices[0]) : 0;
      const tierPriceArray = Object.entries(tierPrices)
        .filter(([, v]) => v !== "" && Number(v) >= 0)
        .map(([tierId, price]) => ({ tier_id: tierId, price: Number(price) }));

      let pid = productId;

      if (mode === "edit" && productId) {
        const res = await fetch("/api/owner/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: productId,
            name: form.name.trim(),
            price: basePrice,
            category_id: form.category_id,
            description: form.description,
            is_active: form.is_active,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const error = new Error(
            data.error ?? "Gagal mengupdate produk"
          ) as Error & { code?: string };
          error.code = data.code;
          throw error;
        }
        const imageUrl = await uploadImage(productId);
        if (imageUrl) {
          await fetch("/api/owner/products", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: productId, image_url: imageUrl }),
          });
        }
      } else {
        const res = await fetch("/api/owner/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outlet_id: outletId,
            name: form.name.trim(),
            price: basePrice,
            category_id: form.category_id,
            description: form.description,
            is_active: form.is_active,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const error = new Error(
            data.error ?? "Gagal menambah produk"
          ) as Error & { code?: string };
          error.code = data.code;
          throw error;
        }
        const created = await res.json();
        pid = created.id;
        const imageUrl = await uploadImage(created.id);
        if (imageUrl) {
          await fetch("/api/owner/products", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: created.id, image_url: imageUrl }),
          });
        }
      }

      if (pid && tierPriceArray.length > 0) {
        await fetch("/api/owner/product-tier-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: pid, prices: tierPriceArray }),
        });
      }

      if (mode === "add" && pid) {
        for (const mod of queuedModifiers) {
          try {
            const prices = Object.entries(mod.tierDeltas).map(
              ([tierId, delta]) => ({ tier_id: tierId, price_delta: delta })
            );
            await fetch("/api/owner/modifiers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                product_id: pid,
                name: mod.name,
                group_name: mod.group_name || null,
                prices,
              }),
            });
          } catch {}
        }
      }

      if (mode === "add" && pid) {
        for (const recipe of recipeRows) {
          if (recipe.id) continue;
          try {
            await fetch("/api/owner/recipes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                product_id: pid,
                ingredient_id: recipe.ingredient_id,
                quantity_used: recipe.quantity_used,
              }),
            });
          } catch {}
        }
      }

      showToast(
        "success",
        mode === "edit" ? "Produk berhasil diupdate" : "Produk berhasil ditambahkan"
      );
      router.push(listUrl);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      if (
        err instanceof Error &&
        (err as Error & { code?: string }).code === "PLAN_LIMIT"
      ) {
        openUpgrade(message);
      } else {
        showToast("error", message);
      }
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (extra = "") => (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      className={`px-5 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 ${extra}`}
    >
      <Check size={18} />
      {saving ? "Menyimpan..." : "Simpan Produk"}
    </button>
  );

  return (
    <div
      className={`p-4 pb-24 md:p-6 max-w-6xl mx-auto ${
        isMobileBottom ? "pt-[calc(var(--safe-top)+4.5rem)]" : ""
      }`}
    >
      <div
        className={
          isMobileBottom
            ? "fixed top-4 left-0 right-0 z-[55] px-4 pt-safe pb-2 bg-background"
            : ""
        }
      >
        <PageHeader
          backAs={
            <Link
              href={listUrl}
              aria-label="Kembali"
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
            >
              <ArrowLeft size={20} />
            </Link>
          }
          title={mode === "edit" ? "Edit Produk" : "Tambah Produk"}
          subtitle={`Outlet: ${outletName}`}
          actions={
            isMobileBottom ? null : (
              <>
                <Link
                  href={listUrl}
                  className="px-5 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-all"
                >
                  Batal
                </Link>
                {saveButton()}
              </>
            )
          }
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Media & Info */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            {previewUrl ? (
              <div className="relative bg-surface-container-lowest rounded-xl overflow-hidden border border-surface-container">
                <Image
                  src={previewUrl}
                  alt="Preview produk"
                  width={400}
                  height={400}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-lowest/90 backdrop-blur text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors"
                  >
                    Ganti
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    aria-label="Hapus foto"
                    className="w-8 h-8 rounded-lg bg-surface-container-lowest/90 backdrop-blur flex items-center justify-center text-error hover:bg-error-container/40 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-surface-container-lowest rounded-xl p-6 border-2 border-dashed border-surface-container flex flex-col items-center justify-center text-center group cursor-pointer hover:border-primary/40 transition-colors"
              >
                <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ImagePlus size={32} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-on-surface">
                  Unggah Foto Produk
                </p>
                <p className="text-xs text-on-surface-variant mt-1 max-w-[200px]">
                  Format JPG, PNG (Maks. 2MB). Rekomendasi 1:1
                </p>
              </button>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-headline-sm text-on-surface">Status Produk</h3>
              <Toggle
                checked={form.is_active}
                onChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
                label={form.is_active ? "Aktif" : "Nonaktif"}
              />
            </div>
            <div className="space-y-4">
              <FormField label="Nama Produk" htmlFor="product-name" required>
                <input
                  id="product-name"
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Contoh: Es Kopi Susu Aren"
                  className={fieldInputClass}
                />
              </FormField>

              <FormField
                label="Kategori"
                htmlFor="product-category"
                action={
                  <button
                    type="button"
                    onClick={() => setShowCatManager(true)}
                    className="text-primary text-[10px] font-bold uppercase tracking-wider hover:underline"
                  >
                    Kelola Kategori
                  </button>
                }
              >
                <select
                  id="product-category"
                  value={form.category_id}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, category_id: e.target.value }))
                  }
                  className={fieldSelectClass}
                >
                  {catList.length === 0 && (
                    <option value="">Belum ada kategori</option>
                  )}
                  {catList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Deskripsi Produk" htmlFor="product-desc">
                <textarea
                  id="product-desc"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Jelaskan detail produk, bahan, atau rasa..."
                  rows={4}
                  className={`${fieldInputClass} resize-none`}
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Add-ons */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="bg-surface-container-lowest rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-headline-sm text-on-surface flex items-center gap-2">
                <Banknote size={22} className="text-primary" />
                Pengaturan Harga
              </h3>
              <button
                type="button"
                onClick={() => setShowTierManager(true)}
                className="text-primary text-[10px] font-bold uppercase tracking-wider hover:underline"
              >
                Kelola Tier
              </button>
            </div>
            {activeTiers.length === 0 ? (
              <p className="text-sm text-on-surface-variant flex items-center gap-2">
                <Info size={16} />
                Belum ada tier aktif. Tambahkan tier lewat tombol
                &quot;Kelola Tier&quot;.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {activeTiers.map((tier) => (
                  <div key={tier.id} className="space-y-1.5">
                    <label
                      htmlFor={`tier-price-${tier.id}`}
                      className="text-label-caps uppercase text-on-surface-variant block truncate"
                      title={tier.name}
                    >
                      Harga {tier.name}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">
                        Rp
                      </span>
                      <input
                        id={`tier-price-${tier.id}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={tierPrices[tier.id] ?? ""}
                        onChange={(e) =>
                          setTierPrices((prev) => ({
                            ...prev,
                            [tier.id]: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className={`${fieldInputClass} !pl-12`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="p-6 pb-4 flex items-center justify-between">
              <h3 className="text-headline-sm text-on-surface flex items-center gap-2">
                <Puzzle size={22} className="text-primary" />
                Add-ons / Modifier
              </h3>
              {!showModForm && (
                <button
                  type="button"
                  onClick={() => setShowModForm(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
                >
                  <Plus size={16} />
                  Tambah Add-on
                </button>
              )}
            </div>

            {showModForm && (
              <div className="mx-6 mb-4 p-4 bg-surface-container-low rounded-xl space-y-3">
                <input
                  type="text"
                  value={modForm.name}
                  onChange={(e) =>
                    setModForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Nama add-on, mis. Extra Shot"
                  className={`${fieldInputClass} !bg-white`}
                  autoFocus
                />
                <div>
                  {addingNewGroup ? (
                    <input
                      type="text"
                      value={modForm.group_name}
                      onChange={(e) =>
                        setModForm((p) => ({ ...p, group_name: e.target.value }))
                      }
                      onBlur={() => {
                        if (modForm.group_name.trim()) {
                          setAddingNewGroup(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && modForm.group_name.trim()) {
                          setAddingNewGroup(false);
                        }
                        if (e.key === "Escape") {
                          setModForm((p) => ({ ...p, group_name: "" }));
                          setAddingNewGroup(false);
                        }
                      }}
                      placeholder="Nama grup baru..."
                      className={`${fieldInputClass} !bg-white`}
                      autoFocus
                    />
                  ) : (
                    <select
                      value={modForm.group_name}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setAddingNewGroup(true);
                          setModForm((p) => ({ ...p, group_name: "" }));
                        } else {
                          setModForm((p) => ({ ...p, group_name: e.target.value }));
                        }
                      }}
                      className={`${fieldSelectClass} !bg-white`}
                    >
                      <option value="">Tidak ada grup</option>
                      {existingGroups.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                      <option value="__new__">+ Buat grup baru</option>
                    </select>
                  )}
                </div>
                {activeTiers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeTiers.map((tier) => (
                      <div
                        key={tier.id}
                        className="flex items-center gap-1.5 bg-surface-container-lowest rounded-lg px-2.5 py-1.5"
                        title={tier.name}
                      >
                        <span className="text-[10px] font-bold text-on-surface-variant">
                          {tierCode(tier.name)}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-semibold">
                          Rp
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={modForm.tierDeltas[tier.id] ?? ""}
                          onChange={(e) =>
                            setModForm((p) => ({
                              ...p,
                              tierDeltas: {
                                ...p.tierDeltas,
                                [tier.id]: e.target.value,
                              },
                            }))
                          }
                          placeholder="0"
                          className="w-20 bg-transparent border-none text-sm focus:ring-0 p-0 font-semibold text-on-surface"
                        />
                      </div>
                    ))}
                    {activeTiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          applySameDeltaToAllTiers(
                            modForm.tierDeltas[activeTiers[0]?.id] ?? ""
                          )
                        }
                        className="text-primary text-[10px] font-bold uppercase hover:underline whitespace-nowrap"
                      >
                        Samakan
                      </button>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddModifier}
                    disabled={!modForm.name.trim()}
                    className="flex-1 text-sm font-semibold bg-primary text-on-primary px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {editModId ? "Simpan Perubahan" : "Tambahkan"}
                  </button>
                  <button
                    type="button"
                    onClick={resetModForm}
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {modifiers.length === 0 && queuedModifiers.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-on-surface-variant">
                Belum ada add-on untuk produk ini.
              </p>
            ) : (
              (() => {
                const groupMap = new Map<string | null, JSX.Element[]>();

                queuedModifiers.forEach((m, idx) => {
                  const key = m.group_name || null;
                  if (!groupMap.has(key)) groupMap.set(key, []);
                  groupMap.get(key)!.push(
                    <div key={`new-${idx}`} className="px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-surface-container-low/50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">
                          {m.name}
                          <span className="ml-2 text-[10px] font-bold uppercase text-warning">Baru</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {activeTiers.map((t) => (
                            <span key={t.id} className="text-[10px] font-semibold bg-surface-container-low rounded px-1.5 py-0.5 text-on-surface-variant" title={t.name}>
                              {tierCode(t.name)} +{(m.tierDeltas[t.id] ?? 0).toLocaleString("id-ID")}
                            </span>
                          ))}
                        </div>
                        <button type="button" onClick={() => { setEditModId(`new-${idx}`); setEditQueuedIdx(idx); setModForm({ name: m.name, group_name: m.group_name, tierDeltas: (() => { const r: Record<string, string> = {}; for (const k in m.tierDeltas) r[k] = String(m.tierDeltas[k]); return r; })() }); setShowModForm(true); }} aria-label={`Ubah ${m.name}`} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"><Pencil size={16} /></button>
                        <button type="button" onClick={() => setQueuedModifiers((prev) => prev.filter((_, i) => i !== idx))} aria-label={`Hapus ${m.name}`} className="p-2 text-error hover:bg-error-container/20 rounded-full transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  );
                });

                modifiers.forEach((m) => {
                  const key = m.group_name || null;
                  if (!groupMap.has(key)) groupMap.set(key, []);
                  groupMap.get(key)!.push(
                    <div key={m.id} className="px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-surface-container-low/50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">{m.name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {activeTiers.map((t) => {
                            const delta = m.tier_prices?.find((tp) => tp.tier_id === t.id)?.price_delta ?? 0;
                            return <span key={t.id} className="text-[10px] font-semibold bg-surface-container-low rounded px-1.5 py-0.5 text-on-surface-variant" title={t.name}>{tierCode(t.name)} +{delta.toLocaleString("id-ID")}</span>;
                          })}
                        </div>
                        <button type="button" onClick={() => { setEditModId(m.id); setEditQueuedIdx(null); setModForm({ name: m.name, group_name: m.group_name ?? "", tierDeltas: (() => { const r: Record<string, string> = {}; activeTiers.forEach((t) => { r[t.id] = String(m.tier_prices?.find((tp) => tp.tier_id === t.id)?.price_delta ?? ""); }); return r; })() }); setShowModForm(true); }} aria-label={`Ubah ${m.name}`} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"><Pencil size={16} /></button>
                        <button type="button" onClick={() => handleDeleteModifier(m)} aria-label={`Hapus ${m.name}`} className="p-2 text-error hover:bg-error-container/20 rounded-full transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  );
                });

                const sorted = Array.from(groupMap).sort(([a], [b]) => {
                  if (a === null) return -1;
                  if (b === null) return 1;
                  return a.localeCompare(b);
                });

                return (
                  <div className="border-t border-surface-container">
                    {sorted.map(([group, items]) => (
                      <div key={group ?? "__ungrouped"}>
                        {group !== null && (
                          <div className="px-6 py-2 bg-surface-container-low/40 border-b border-surface-container">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{group}</span>
                          </div>
                        )}
                        <div className="divide-y divide-surface-container">
                          {items}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}

            <div className="p-4 px-6 bg-surface-container-low/30 border-t border-surface-container">
              <p className="text-xs text-on-surface-variant flex items-center gap-2">
                <Info size={14} className="flex-shrink-0" />
                Harga add-on akan dijumlahkan dengan harga produk utama sesuai
                tier yang dipilih pelanggan.
              </p>
            </div>
          </div>

          {/* Resep / Bahan Baku */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="p-6 pb-4 flex items-center justify-between">
              <h3 className="text-headline-sm text-on-surface flex items-center gap-2">
                <CookingPot size={22} className="text-primary" />
                Resep / Bahan Baku
              </h3>
              <button
                type="button"
                onClick={() => setShowRecipeManager(true)}
                className="text-primary text-[10px] font-bold uppercase tracking-wider hover:underline"
              >
                Kelola Resep
              </button>
            </div>

            {recipeRows.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-on-surface-variant">
                Belum ada resep — produk ini dijual tanpa memotong stok bahan.
              </p>
            ) : (
              <div className="border-t border-surface-container divide-y divide-surface-container">
                {recipeRows.map((r) => (
                  <div
                    key={r.id ?? r.ingredient_id}
                    className="px-6 py-3.5 flex items-center justify-between gap-3"
                  >
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {r.ingredient_name}
                      {!r.id && (
                        <span className="ml-2 text-[10px] font-bold uppercase text-warning">
                          Baru
                        </span>
                      )}
                    </p>
                    <span className="text-xs font-mono text-on-surface-variant flex-shrink-0">
                      {r.quantity_used.toLocaleString("id-ID", { maximumFractionDigits: 2 })}{" "}
                      {r.ingredient_unit} / porsi
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 px-6 bg-surface-container-low/30 border-t border-surface-container">
              <p className="text-xs text-on-surface-variant flex items-center gap-2">
                <Info size={14} className="flex-shrink-0" />
                Stok bahan otomatis berkurang sesuai resep setiap produk terjual.
              </p>
            </div>
          </div>
        </div>
      </div>

      {isMobileBottom && (
        <div
          className="fixed left-0 right-0 z-[55]"
          style={{ bottom: "var(--nav-bottom-safe)" }}
        >
          <div className="bg-surface-container-lowest/95 backdrop-blur-xl border-t border-surface-container px-4 py-3 flex gap-2">
            <Link
              href={listUrl}
              className="flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant active:scale-[0.98] transition-all"
            >
              Batal
            </Link>
            {saveButton("flex-1 py-3 shadow-none")}
          </div>
        </div>
      )}

      <CategoryManagerSlideOver
        open={showCatManager}
        onClose={() => setShowCatManager(false)}
        outletId={outletId}
        categories={catList}
        onCategoriesChange={handleCategoriesChange}
      />
      <TierManagerSlideOver
        open={showTierManager}
        onClose={() => setShowTierManager(false)}
        outletId={outletId}
        onTiersChange={handleTiersChange}
      />
      <RecipeManagerSlideOver
        open={showRecipeManager}
        onClose={() => setShowRecipeManager(false)}
        outletId={outletId}
        productId={mode === "edit" ? productId : undefined}
        rows={recipeRows}
        onRowsChange={setRecipeRows}
      />
    </div>
  );
}
