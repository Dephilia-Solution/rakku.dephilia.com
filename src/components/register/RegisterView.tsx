"use client";

import { useState, useCallback, useEffect } from "react";
import { useCartStore } from "@/lib/store/cartStore";
import { ProductWithCategory, Category, Modifier, PricingTier, CartItem } from "@/types";
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

  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const addProduct = useCartStore((s) => s.addProduct);
  const updateItemModifier = useCartStore((s) => s.updateItemModifier);
  const cartItems = useCartStore((s) => s.items);
  const pricingTierId = useCartStore((s) => s.pricingTierId);
  const setPricingTiers = useCartStore((s) => s.setPricingTiers);

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("0");

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
  }, [setPricingTiers]);

  const modifierTierDeltaMap = useCartStore((s) => s.modifierTierDeltaMap);

  const getModDelta = (mod: Modifier) => {
    if (!pricingTierId) return mod.price_delta ?? 0;
    return modifierTierDeltaMap[mod.id]?.[pricingTierId] ?? mod.price_delta ?? 0;
  };

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
    setShowModifierModal(true);
  }, [cartItems, products]);

  const handleAddWithModifier = (modifier?: Modifier) => {
    if (selectedProduct) {
      if (editingItemId) {
        updateItemModifier(editingItemId, modifier);
      } else {
        addProduct(selectedProduct, modifier);
      }
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
    };
    if (editingItemId) {
      updateItemModifier(editingItemId, customMod);
    } else {
      addProduct(selectedProduct, customMod);
    }
    closeModifierModal();
  };

  const closeModifierModal = () => {
    setShowModifierModal(false);
    setEditingItemId(null);
    setSelectedProduct(null);
    setShowCustomInput(false);
    setCustomName("");
    setCustomPrice("");
  };

  const handleCheckout = () => {
    setShowPayment(true);
  };

  const handleSelectDraft = async (draft: { id: string; customer_name: string; pricing_tier_id: string | null; order_items: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number; modifier_label: string | null }> }) => {
    const clear = useCartStore.getState().clear;
    const setDraftOrderId = useCartStore.getState().setDraftOrderId;
    const setCustomerName = useCartStore.getState().setCustomerName;
    const restoreDraftItem = useCartStore.getState().restoreDraftItem;

    clear();
    setDraftOrderId(draft.id);
    setCustomerName(draft.customer_name);

    // Restore items preserving saved tier & prices (no recompute)
    for (const item of draft.order_items) {
      const product = products.find((p) => p.id === item.product_id)
        ?? products.find((p) => p.name === item.product_name);
      if (!product) continue;

      const cartItem: CartItem = {
        id: "",
        product,
        quantity: item.quantity,
        modifier: null,
        modifier_label: item.modifier_label,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
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
    <div className="flex h-screen overflow-hidden">
      {/* Left: Product area */}
      <div className="flex-1 flex flex-col overflow-hidden pt-safe">
        {/* Tier Selector */}
        {pricingTiers.length > 0 && (
          <div className="px-4 sm:px-6 pt-4 pb-2">
            <div className="flex gap-2">
              {pricingTiers.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => handleSelectTier(tier.id)}
                  className={`flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all ${
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
              className="w-full bg-white border border-neutral-200 rounded-xl pl-11 pr-12 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 text-[10px] font-mono text-neutral-400 bg-neutral-100 rounded-md px-1.5 py-1 hidden sm:flex">
              <Command size={12} />
              K
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="px-4 sm:px-6 pb-3">
          <CategoryTabs
            categories={categories}
            activeId={activeCategory}
            onChange={setActiveCategory}
          />
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pt-2 px-4 sm:px-6 pb-[140px] lg:pb-6">
          <ProductGrid
            products={filteredProducts}
            onSelect={handleSelectProduct}
          />
        </div>
      </div>

      {/* Desktop: Order Sidebar */}
      <OrderSidebar
        onCheckout={handleCheckout}
        onOpenDraft={() => setShowDraftPanel(true)}
        onEditItem={handleEditItem}
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
      />

      {/* Mobile: Persistent Cart Bar */}
      <MobileCartBar
        onViewCart={() => setShowCartDrawer(true)}
        onCheckout={() => setShowPayment(true)}
      />



      {/* Draft Orders Panel */}
      <DraftOrdersPanel
        isOpen={showDraftPanel}
        onClose={() => setShowDraftPanel(false)}
        onSelectDraft={handleSelectDraft}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
      />

      {/* Modifier Selection Modal */}
      {showModifierModal && selectedProduct && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-6">
            <h3 className="font-display font-semibold text-base text-neutral-900 mb-4">
              {editingItemId ? "Edit" : "Tambah"} — {selectedProduct.name}
            </h3>

            <p className="text-sm text-neutral-600 mb-4">Pilih tambahan:</p>
            <div className="space-y-2">
              <button
                onClick={() => handleAddWithModifier(undefined)}
                className="w-full text-left px-4 py-3 rounded-xl border border-neutral-200 hover:border-forest hover:bg-primary-50 transition-colors text-sm font-medium text-neutral-900"
              >
                Tidak ada tambahan
              </button>
              {modifiers
                .filter((m) => m.product_id === selectedProduct.id)
                .map((mod) => {
                  const delta = getModDelta(mod);
                  return (
                  <button
                    key={mod.id}
                    onClick={() => handleAddWithModifier(mod)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-neutral-200 hover:border-forest hover:bg-primary-50 transition-colors flex justify-between items-center"
                  >
                    <span className="text-sm font-medium text-neutral-900">
                      {mod.name}
                    </span>
                    <span className="text-sm font-mono text-forest font-semibold">
                      +{delta.toLocaleString("id-ID")}
                    </span>
                  </button>
                  );
                })}
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
                      className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                    />
                    <button
                      onClick={handleAddCustom}
                      disabled={!customName.trim()}
                      className="bg-forest text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-forest-dark disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Tambah
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={closeModifierModal}
              className="mt-4 w-full text-sm text-neutral-400 hover:text-neutral-600 py-2"
            >
              Batal
            </button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
