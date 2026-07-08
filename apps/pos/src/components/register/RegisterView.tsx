"use client";

import { useState, useCallback, useEffect } from "react";
import { useCartStore } from "@/lib/store/cartStore";
import { ProductWithCategory, Category, Modifier, PricingTier, CartItem } from "@rakku/shared-types";
import CategoryTabs from "@/components/register/CategoryTabs";
import ProductGrid from "@/components/register/ProductGrid";
import OrderSidebar from "@/components/register/OrderSidebar";
import MobileCartBar from "@/components/register/MobileCartBar";
import PaymentModal from "@/components/register/PaymentModal";
import DraftOrdersPanel from "@/components/register/DraftOrdersPanel";
import { Search, Command } from "lucide-react";

interface RegisterViewProps {
  products: ProductWithCategory[];
  categories: Category[];
  modifiers: Modifier[];
}

export default function RegisterView({
  products,
  categories,
  modifiers,
}: RegisterViewProps) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showDraftPanel, setShowDraftPanel] = useState(false);
  const [draftVersion, setDraftVersion] = useState(0);

  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const addProduct = useCartStore((s) => s.addProduct);
  const updateItemModifiers = useCartStore((s) => s.updateItemModifiers);
  const cartItems = useCartStore((s) => s.items);
  const pricingTierId = useCartStore((s) => s.pricingTierId);
  const setPricingTiers = useCartStore((s) => s.setPricingTiers);
  const fetchActiveTaxesAndDiscounts = useCartStore((s) => s.fetchActiveTaxesAndDiscounts);

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("0");
  const [customGroup, setCustomGroup] = useState("");

  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([]);
  const [itemNote, setItemNote] = useState("");

  const [pricingTiers, setLocalTiers] = useState<PricingTier[]>([]);

  useEffect(() => {
    const loadTiers = async () => {
      try {
        const sessionRes = await fetch("/api/auth/tenant/session");
        if (!sessionRes.ok) return;
        const session = await sessionRes.json();
        const res = await fetch(
          `/api/admin/pricing-tiers?company_id=${session.company_id}&outlet_id=${session.outlet_id}`
        );
        if (res.ok) {
          const data = await res.json();
          setLocalTiers(data.tiers);

          const tierPriceMap: Record<string, Record<string, number>> = {};
          for (const ptp of data.productTierPrices) {
            if (!tierPriceMap[ptp.product_id]) {
              tierPriceMap[ptp.product_id] = {};
            }
            tierPriceMap[ptp.product_id][ptp.tier_id] = ptp.price;
          }

          const modifierDeltaMap: Record<string, Record<string, number>> = {};
          for (const mtp of data.modifierTierPrices ?? []) {
            if (!modifierDeltaMap[mtp.modifier_id]) {
              modifierDeltaMap[mtp.modifier_id] = {};
            }
            modifierDeltaMap[mtp.modifier_id][mtp.tier_id] = mtp.price_delta;
          }

          setPricingTiers(data.tiers, tierPriceMap, modifierDeltaMap);
        }
      } catch {}
    };
    loadTiers();
    fetchActiveTaxesAndDiscounts();
  }, [setPricingTiers, fetchActiveTaxesAndDiscounts]);

  const modifierTierDeltaMap = useCartStore((s) => s.modifierTierDeltaMap);

  const getModDelta = (mod: Modifier) => {
    if (!pricingTierId) return mod.price_delta ?? 0;
    return modifierTierDeltaMap[mod.id]?.[pricingTierId] ?? mod.price_delta ?? 0;
  };

  // --- FIX: lock body scroll whenever any full-screen overlay is open.
  // Mencegah rubber-band scroll di iOS Safari yang kelihatan seperti
  // "overflow atas-bawah" saat modal/drawer terbuka.
  useEffect(() => {
    const anyOverlayOpen = showModifierModal || showCartDrawer || showDraftPanel || showPayment;
    if (anyOverlayOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [showModifierModal, showCartDrawer, showDraftPanel, showPayment]);

  const filteredProducts = products.filter((p) => {
    if (!p.is_active) return false;
    if (activeCategory !== "all" && p.category_id !== activeCategory)
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.category_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSelectProduct = async (product: ProductWithCategory) => {
    const productMods = modifiers.filter((m) => m.product_id === product.id);
    if (productMods.length > 0) {
      setSelectedProduct(product);
      setSelectedModifiers([]);
      setItemNote("");
      setShowModifierModal(true);
    } else {
      addProduct(product);
    }
  };

  const handleEditItem = useCallback((itemId: string) => {
    const item = cartItems.find((i) => i.id === itemId);
    if (!item) return;
    const product = products.find((p) => p.id === item.product.id);
    if (!product) return;

    setSelectedProduct(product);
    setEditingItemId(itemId);
    setSelectedModifiers(item.modifiers ?? []);
    setItemNote(item.note ?? "");
    setShowModifierModal(true);
  }, [cartItems, products]);

  const handleToggleModifier = (mod: Modifier) => {
    setSelectedModifiers((prev) => {
      const exists = prev.find((m) => m.id === mod.id);
      if (exists) {
        return prev.filter((m) => m.id !== mod.id);
      }
      const sameGroup = prev.filter((m) => m.group_name !== mod.group_name || mod.group_name === null);
      return [...sameGroup, mod];
    });
  };

  const handleConfirmModifiers = () => {
    if (!selectedProduct) return;
    const mods = selectedModifiers.length > 0 ? selectedModifiers : [];
    const note = itemNote.trim() || null;
    if (editingItemId) {
      updateItemModifiers(editingItemId, mods, note);
    } else {
      addProduct(selectedProduct, mods, note);
    }
    closeModifierModal();
  };

  const handleAddCustom = () => {
    if (!selectedProduct || !customName.trim()) return;
    const customMod: Modifier = {
      id: `custom-${Date.now()}`,
      product_id: selectedProduct.id,
      name: customName.trim(),
      price_delta: Number(customPrice) || 0,
      group_name: customGroup.trim() || null,
    };
    setSelectedModifiers((prev) => {
      const sameGroup = customMod.group_name
        ? prev.filter((m) => m.group_name !== customMod.group_name)
        : prev;
      return [...sameGroup, customMod];
    });
    setShowCustomInput(false);
    setCustomName("");
    setCustomPrice("0");
    setCustomGroup("");
  };

  const closeModifierModal = () => {
    setShowModifierModal(false);
    setEditingItemId(null);
    setSelectedProduct(null);
    setSelectedModifiers([]);
    setItemNote("");
    setShowCustomInput(false);
    setCustomName("");
    setCustomPrice("0");
    setCustomGroup("");
  };

  const handleCheckout = () => {
    setShowPayment(true);
  };

  const handleSelectDraft = async (draft: { id: string; customer_name: string; pricing_tier_id: string | null; order_items: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number; modifier_label: string | null; note: string | null }> }) => {
    const clear = useCartStore.getState().clear;
    const setDraftOrderId = useCartStore.getState().setDraftOrderId;
    const setCustomerName = useCartStore.getState().setCustomerName;
    const restoreDraftItem = useCartStore.getState().restoreDraftItem;

    clear();
    setDraftOrderId(draft.id);
    setCustomerName(draft.customer_name);

    for (const item of draft.order_items) {
      const product = products.find((p) => p.id === item.product_id)
        ?? products.find((p) => p.name === item.product_name);
      if (!product) continue;

      const cartItem: CartItem = {
        id: "",
        product,
        quantity: item.quantity,
        modifiers: [],
        modifier_label: item.modifier_label,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        note: item.note ?? null,
        source: "draft",
      };
      restoreDraftItem(cartItem, draft.pricing_tier_id);
    }

    setShowDraftPanel(false);
  };

  const handleSelectTier = (tierId: string | null) => {
    useCartStore.getState().setPricingTier(tierId);
  };

  return (
    // FIX: w-full + max-w-full mengunci lebar row terhadap viewport,
    // jadi kalau ada child yang "bandel" (fixed width, gak responsive),
    // dia dipotong bukan mendorong body ikut melebar.
    <div className="flex w-full max-w-full min-w-0 h-dvh overflow-hidden">
      {/* Left: Product area */}
      {/* FIX: min-w-0 wajib di flex child yang isinya bisa lebih lebar
          dari ruang tersisa (search bar, grid produk, dsb). Tanpa ini,
          flex item defaultnya min-width:auto dan akan mendorong lebar
          keluar viewport alih-alih menyusut. */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden pt-safe">
        {/* Tier Selector */}
        {pricingTiers.length > 0 && (
          <div className="px-4 sm:px-6 pt-4 pb-2 overflow-hidden">
            <div className="flex gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
              {pricingTiers.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => handleSelectTier(tier.id)}
                  className={`flex-shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                    pricingTierId === tier.id
                      ? "bg-forest text-white shadow-sm"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {tier.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-4 sm:px-6 pt-2 pb-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-xl pl-11 pr-12 py-2.5 text-base text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 text-[10px] font-mono text-neutral-400 bg-neutral-100 rounded-md px-1.5 py-1 hidden sm:flex">
              <Command size={12} />
              K
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="px-4 sm:px-6 pb-3 overflow-hidden">
          <CategoryTabs
            categories={categories}
            activeId={activeCategory}
            onChange={setActiveCategory}
          />
        </div>

        {/* Product Grid */}
        {/* FIX: min-h-0 supaya flex-1 + overflow-y-auto benar-benar
            mengunci tinggi di dalam h-dvh, bukan mendorong parent
            lebih tinggi dari viewport (overflow atas-bawah). */}
        <div className="flex-1 min-h-0 overflow-y-auto pt-2 px-4 sm:px-6 pb-[var(--content-bottom-offset,5rem)] lg:pb-6">
          <ProductGrid
            products={filteredProducts}
            onSelect={handleSelectProduct}
          />
        </div>
      </div>

      {/* Desktop: Order Sidebar */}
      {/* CATATAN: pastikan di dalam OrderSidebar.tsx, versi non-drawer
          pakai className mengandung "hidden lg:flex" (bukan cuma
          "lg:w-96"). Kalau tidak, dia tetap ambil ruang di flex row
          pada layar HP walau gak kelihatan, dan itu penyebab paling
          umum overflow kiri-kanan. */}
      <OrderSidebar
        onCheckout={handleCheckout}
        onOpenDraft={() => setShowDraftPanel(true)}
        onEditItem={handleEditItem}
        refreshKey={draftVersion}
      />

      {/* Mobile: Cart Drawer */}
      <OrderSidebar
        isDrawer
        isOpen={showCartDrawer}
        onClose={() => setShowCartDrawer(false)}
        onCheckout={() => {
          setShowCartDrawer(false);
          setShowPayment(true);
        }}
        onOpenDraft={() => setShowDraftPanel(true)}
        onEditItem={handleEditItem}
        refreshKey={draftVersion}
      />

      {/* Mobile: Persistent Cart Bar */}
      <MobileCartBar
        onViewCart={() => setShowCartDrawer(true)}
      />

      {/* Draft Orders Panel */}
      <DraftOrdersPanel
        isOpen={showDraftPanel}
        onClose={() => setShowDraftPanel(false)}
        onSelectDraft={handleSelectDraft}
        onDraftChange={() => setDraftVersion((v) => v + 1)}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onOrderComplete={() => setDraftVersion((v) => v + 1)}
      />

      {/* Modifier Selection Modal */}
      {showModifierModal && selectedProduct && (() => {
        const productMods = modifiers.filter((m) => m.product_id === selectedProduct.id);
        const groups: Record<string, Modifier[]> = {};
        const ungrouped: Modifier[] = [];
        for (const mod of productMods) {
          if (mod.group_name) {
            if (!groups[mod.group_name]) groups[mod.group_name] = [];
            groups[mod.group_name].push(mod);
          } else {
            ungrouped.push(mod);
          }
        }
        const groupNames = Object.keys(groups);

        return (
          <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm overflow-y-auto overscroll-contain">
            <div className="min-h-full flex items-center justify-center p-4">
              {/* FIX: w-full + max-w-sm + mx-4 supaya modal gak pernah
                  lebih lebar dari viewport HP kecil (< 360px). */}
              <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-6 max-h-[90dvh] overflow-y-auto">
                <h3 className="font-display font-semibold text-base text-neutral-900 mb-4">
                  {editingItemId ? "Edit" : "Tambah"} — {selectedProduct.name}
                </h3>

                <div className="space-y-4">
                  {groupNames.map((groupName) => (
                    <div key={groupName}>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        {groupName}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {groups[groupName].map((mod) => {
                          const delta = getModDelta(mod);
                          const isSelected = selectedModifiers.some((m) => m.id === mod.id);
                          return (
                            <button
                              key={mod.id}
                              onClick={() => handleToggleModifier(mod)}
                              className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                                isSelected
                                  ? "border-forest bg-primary-50 text-forest"
                                  : "border-neutral-200 text-neutral-700 hover:border-forest hover:bg-primary-50"
                              }`}
                            >
                              {mod.name}
                              {delta > 0 && (
                                <span className="ml-1 text-xs font-mono">
                                  +{delta.toLocaleString("id-ID")}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {ungrouped.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        Tambahan
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ungrouped.map((mod) => {
                          const delta = getModDelta(mod);
                          const isSelected = selectedModifiers.some((m) => m.id === mod.id);
                          return (
                            <button
                              key={mod.id}
                              onClick={() => handleToggleModifier(mod)}
                              className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                                isSelected
                                  ? "border-forest bg-primary-50 text-forest"
                                  : "border-neutral-200 text-neutral-700 hover:border-forest hover:bg-primary-50"
                              }`}
                            >
                              {mod.name}
                              {delta > 0 && (
                                <span className="ml-1 text-xs font-mono">
                                  +{delta.toLocaleString("id-ID")}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors text-sm font-medium ${
                      showCustomInput
                        ? "border-forest bg-primary-50 text-forest"
                        : "border-dashed border-neutral-300 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
                    }`}
                  >
                    + Tambahan Lain
                  </button>
                  {showCustomInput && (
                    <div className="space-y-2 pl-2">
                      <input
                        type="text"
                        value={customGroup}
                        onChange={(e) => setCustomGroup(e.target.value)}
                        placeholder="Grup (opsional)"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                      />
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Nama tambahan"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                      />
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          value={customPrice}
                          onChange={(e) => setCustomPrice(e.target.value)}
                          placeholder="Harga"
                          className="flex-1 min-w-0 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                        />
                        <button
                          onClick={handleAddCustom}
                          disabled={!customName.trim()}
                          className="bg-forest text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-forest-dark disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                        >
                          Tambah
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                      Catatan
                    </p>
                    <input
                      type="text"
                      value={itemNote}
                      onChange={(e) => setItemNote(e.target.value)}
                      placeholder="Contoh: tidak pedas, extra sambal..."
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                    />
                  </div>
                </div>

                {selectedModifiers.length > 0 && (
                  <div className="mt-3 p-2 bg-neutral-50 rounded-lg">
                    <p className="text-xs text-neutral-500">
                      Dipilih: {selectedModifiers.map((m) => m.name).join(", ")}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={closeModifierModal}
                    className="flex-1 min-w-0 text-sm text-neutral-500 hover:text-neutral-700 py-3 rounded-xl border border-neutral-200 hover:bg-neutral-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirmModifiers}
                    className="flex-1 min-w-0 bg-forest text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-forest-dark"
                  >
                    {editingItemId ? "Simpan" : "Tambahkan"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}