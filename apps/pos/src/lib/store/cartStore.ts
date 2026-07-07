import { create } from "zustand";
import { Product, Modifier, CartItem, OrderType, PricingTier, SplitPayment, Tax, ProductDiscount, OrderDiscount, AppliedTax, AppliedDiscount } from "@rakku/shared-types";

export function getTierPrice(
  productId: string,
  tierId: string | null,
  tierPriceMap: Record<string, Record<string, number>>,
  fallback: number
): number {
  if (!tierId) return fallback;
  return tierPriceMap[productId]?.[tierId] ?? fallback;
}

export function getTierModifierDelta(
  modifierId: string,
  tierId: string | null,
  deltaMap: Record<string, Record<string, number>>,
  fallback: number
): number {
  if (!tierId) return fallback;
  return deltaMap[modifierId]?.[tierId] ?? fallback;
}

function applyDiscount(price: number, discount: { type: "percentage" | "fixed"; value: number }): number {
  if (discount.type === "percentage") {
    return price * (1 - discount.value / 100);
  }
  return Math.max(0, price - discount.value);
}

function calcDiscountAmount(original: number, discounted: number): number {
  return original - discounted;
}

const CATEGORY_PRIORITY: Record<string, number> = {
  "Makanan": 1,
  "Makanan Ringan": 2,
  "Snack": 3,
  "Pastry": 3,
  "Roti": 3,
  "Coffee": 4,
  "Minuman": 5,
  "Non-Coffee": 6,
  "Add-ons": 7,
  "Add-on": 7,
};

function categorySortKey(category: string): number {
  return CATEGORY_PRIORITY[category] ?? 99;
}

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  customerName: string;
  note: string;
  draftOrderId: string | null;
  pricingTierId: string | null;
  pricingTiers: PricingTier[];
  productTierPriceMap: Record<string, Record<string, number>>;
  modifierTierDeltaMap: Record<string, Record<string, number>>;
  splitPayments: SplitPayment[];
  activeTaxes: Tax[];
  activeProductDiscounts: ProductDiscount[];
  activeOrderDiscounts: OrderDiscount[];

  addProduct: (product: Product, modifiers?: Modifier[], note?: string | null, isDraftRestore?: boolean) => void;
  restoreDraftItem: (item: CartItem, tierId: string | null) => void;
  incrementQty: (itemId: string) => void;
  decrementQty: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  updateItemModifiers: (itemId: string, modifiers?: Modifier[], note?: string | null) => void;
  setOrderType: (type: OrderType) => void;
  setCustomerName: (name: string) => void;
  setNote: (note: string) => void;
  setDraftOrderId: (id: string | null) => void;
  setPricingTier: (tierId: string | null) => void;
  setPricingTiers: (tiers: PricingTier[], tierPrices: Record<string, Record<string, number>>, modifierDeltas: Record<string, Record<string, number>>) => void;
  setModifierTierDeltas: (deltas: Record<string, Record<string, number>>) => void;
  setSplitPayments: (payments: SplitPayment[]) => void;
  setActiveTaxes: (taxes: Tax[]) => void;
  setActiveProductDiscounts: (discounts: ProductDiscount[]) => void;
  setActiveOrderDiscounts: (discounts: OrderDiscount[]) => void;
  fetchActiveTaxesAndDiscounts: () => Promise<void>;
  clear: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  orderType: "dine_in",
  customerName: "",
  note: "",
  draftOrderId: null,
  pricingTierId: null,
  pricingTiers: [],
  productTierPriceMap: {},
  modifierTierDeltaMap: {},
  splitPayments: [],
  activeTaxes: [],
  activeProductDiscounts: [],
  activeOrderDiscounts: [],

  addProduct: (product, modifiers, note, isDraftRestore) =>
    set((state) => {
      const mods = modifiers ?? [];
      const modDelta = mods.reduce((sum, mod) => {
        return sum + getTierModifierDelta(mod.id, state.pricingTierId, state.modifierTierDeltaMap, mod.price_delta ?? 0);
      }, 0);
      const modLabel = mods.length > 0
        ? mods.map((mod) => {
            const delta = getTierModifierDelta(mod.id, state.pricingTierId, state.modifierTierDeltaMap, mod.price_delta ?? 0);
            return delta > 0 ? `${mod.name} +${delta.toLocaleString("id-ID")}` : mod.name;
          }).join(", ")
        : null;
      const basePrice = getTierPrice(product.id, state.pricingTierId, state.productTierPriceMap, product.price);
      const unitPrice = basePrice + modDelta;

      const modifierIds = mods.map((m) => m.id).sort().join(",");

      const existing = state.items.find(
        (item) =>
          item.product.id === product.id &&
          item.modifiers.map((m) => m.id).sort().join(",") === modifierIds &&
          item.note === (note ?? null) &&
          (isDraftRestore ? item.source === 'draft' : !item.source)
      );

      if (existing) {
        return {
          items: state.items.map((item) =>
            item.id === existing.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  subtotal: (item.quantity + 1) * item.unit_price,
                }
              : item
          ),
        };
      }

      // Apply product discount if available
      const productDiscount = state.activeProductDiscounts.find(
        (d) => d.product_id === product.id
      );
      const discount = productDiscount
        ? { name: productDiscount.name, type: productDiscount.type, value: productDiscount.value, amount: 0 }
        : null;
      const discountedUnitPrice = productDiscount
        ? applyDiscount(unitPrice, productDiscount)
        : unitPrice;

      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product,
        quantity: 1,
        modifiers: mods,
        modifier_label: modLabel,
        unit_price: unitPrice,
        subtotal: discountedUnitPrice,
        pricing_tier_id: state.pricingTierId ?? undefined,
        note: note ?? null,
        source: isDraftRestore ? 'draft' : undefined,
        discount: discount,
        discounted_unit_price: discountedUnitPrice,
      };
      return { items: [...state.items, newItem] };
    }),

  restoreDraftItem: (item, tierId) =>
    set((state) => {
      const productDiscount = state.activeProductDiscounts.find(
        (d) => d.product_id === item.product.id
      );
      const discount = productDiscount
        ? { name: productDiscount.name, type: productDiscount.type as "percentage" | "fixed", value: productDiscount.value, amount: 0 }
        : null;
      const discountedUnitPrice = productDiscount
        ? applyDiscount(item.unit_price, productDiscount)
        : item.unit_price;

      return {
        pricingTierId: tierId,
        items: [
          ...state.items,
          {
            ...item,
            id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            pricing_tier_id: tierId ?? undefined,
            source: "draft",
            discount: discount,
            discounted_unit_price: discountedUnitPrice,
          },
        ],
      };
    }),

  incrementQty: (itemId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: item.quantity + 1,
              subtotal: (item.quantity + 1) * (item.discounted_unit_price ?? item.unit_price),
            }
          : item
      ),
    })),

  decrementQty: (itemId) =>
    set((state) => ({
      items: state.items
        .map((item) =>
          item.id === itemId
            ? {
                ...item,
                quantity: item.quantity - 1,
                subtotal: (item.quantity - 1) * (item.discounted_unit_price ?? item.unit_price),
              }
            : item
        )
        .filter((item) => item.quantity > 0),
    })),

  removeItem: (itemId) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== itemId),
    })),

  updateItemModifiers: (itemId, modifiers, note) =>
    set((state) => {
      const item = state.items.find((i) => i.id === itemId);
      if (!item) return state;
      const mods = modifiers ?? [];
      const modDelta = mods.reduce((sum, mod) => {
        return sum + getTierModifierDelta(mod.id, state.pricingTierId, state.modifierTierDeltaMap, mod.price_delta ?? 0);
      }, 0);
      const basePrice = getTierPrice(item.product.id, state.pricingTierId, state.productTierPriceMap, item.product.price);
      const unitPrice = basePrice + modDelta;
      const modLabel = mods.length > 0
        ? mods.map((mod) => {
            const delta = getTierModifierDelta(mod.id, state.pricingTierId, state.modifierTierDeltaMap, mod.price_delta ?? 0);
            return delta > 0 ? `${mod.name} +${delta.toLocaleString("id-ID")}` : mod.name;
          }).join(", ")
        : null;

      const productDiscount = state.activeProductDiscounts.find(
        (d) => d.product_id === item.product.id
      );
      const discount = productDiscount
        ? { name: productDiscount.name, type: productDiscount.type, value: productDiscount.value, amount: 0 }
        : null;
      const discountedUnitPrice = productDiscount
        ? applyDiscount(unitPrice, productDiscount)
        : unitPrice;

      return {
        items: state.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                modifiers: mods,
                modifier_label: modLabel,
                note: note ?? null,
                unit_price: unitPrice,
                subtotal: item.quantity * discountedUnitPrice,
                discount: discount,
                discounted_unit_price: discountedUnitPrice,
              }
            : item
        ),
      };
    }),

  setOrderType: (orderType) => set({ orderType }),

  setPricingTier: (tierId) =>
    set((state) => ({
      pricingTierId: tierId,
      items: state.items.map((item) => {
        const modDelta = item.modifiers.reduce((sum, mod) => {
          return sum + getTierModifierDelta(mod.id, tierId, state.modifierTierDeltaMap, mod.price_delta ?? 0);
        }, 0);
        const basePrice = getTierPrice(item.product.id, tierId, state.productTierPriceMap, item.product.price);
        const unitPrice = basePrice + modDelta;

        const productDiscount = state.activeProductDiscounts.find(
          (d) => d.product_id === item.product.id
        );
        const discount = productDiscount
          ? { name: productDiscount.name, type: productDiscount.type, value: productDiscount.value, amount: 0 }
          : null;
        const discountedUnitPrice = productDiscount
          ? applyDiscount(unitPrice, productDiscount)
          : unitPrice;

        return {
          ...item,
          unit_price: unitPrice,
          subtotal: item.quantity * discountedUnitPrice,
          pricing_tier_id: tierId ?? undefined,
          discount: discount,
          discounted_unit_price: discountedUnitPrice,
        };
      }),
    })),

  setPricingTiers: (tiers, tierPriceMap, modifierDeltaMap) => {
    const state = get();
    const defaultTier = tiers.find((t) => t.is_active) ?? tiers[0];
    const tierId = defaultTier?.id ?? null;
    set({
      pricingTiers: tiers,
      productTierPriceMap: tierPriceMap,
      modifierTierDeltaMap: modifierDeltaMap,
      pricingTierId: tierId,
      items: state.items.map((item) => {
        const modDelta = item.modifiers.reduce((sum, mod) => {
          return sum + getTierModifierDelta(mod.id, tierId, modifierDeltaMap, mod.price_delta ?? 0);
        }, 0);
        const basePrice = getTierPrice(item.product.id, tierId, tierPriceMap, item.product.price);
        const unitPrice = basePrice + modDelta;

        const productDiscount = state.activeProductDiscounts.find(
          (d) => d.product_id === item.product.id
        );
        const discount = productDiscount
          ? { name: productDiscount.name, type: productDiscount.type, value: productDiscount.value, amount: 0 }
          : null;
        const discountedUnitPrice = productDiscount
          ? applyDiscount(unitPrice, productDiscount)
          : unitPrice;

        return {
          ...item,
          unit_price: unitPrice,
          subtotal: item.quantity * discountedUnitPrice,
          pricing_tier_id: tierId ?? undefined,
          discount: discount,
          discounted_unit_price: discountedUnitPrice,
        };
      }),
    });
  },

  setModifierTierDeltas: (deltas) => set({ modifierTierDeltaMap: deltas }),

  setSplitPayments: (splitPayments) => set({ splitPayments }),

  setActiveTaxes: (activeTaxes) => set({ activeTaxes }),
  setActiveProductDiscounts: (activeProductDiscounts) => set({ activeProductDiscounts }),
  setActiveOrderDiscounts: (activeOrderDiscounts) => set({ activeOrderDiscounts }),

  fetchActiveTaxesAndDiscounts: async () => {
    try {
      const [taxesRes, discountsRes] = await Promise.all([
        fetch("/api/admin/taxes/active"),
        fetch("/api/admin/discounts/active"),
      ]);
      if (taxesRes.ok) {
        const taxes = await taxesRes.json();
        set({ activeTaxes: taxes ?? [] });
      }
      if (discountsRes.ok) {
        const data = await discountsRes.json();
        set({
          activeProductDiscounts: data.productDiscounts ?? [],
          activeOrderDiscounts: data.orderDiscounts ?? [],
        });
      }
    } catch {
      // silently fail - taxes/discounts will just be empty
    }
  },

  setCustomerName: (customerName) => set({ customerName }),
  setNote: (note) => set({ note }),
  setDraftOrderId: (draftOrderId) => set({ draftOrderId }),
  clear: () =>
    set({
      items: [],
      customerName: "",
      note: "",
      draftOrderId: null,
      pricingTierId: null,
      splitPayments: [],
      activeTaxes: [],
      activeProductDiscounts: [],
      activeOrderDiscounts: [],
    }),
}));

export const useCartGroupedArray = () => {
  const items = useCartStore((s) => s.items);

  const grouped = items.reduce((acc, item) => {
    const category = (item.product as { category_name?: string }).category_name || "Uncategorized";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, CartItem[]>);

  return Object.entries(grouped)
    .sort(([a], [b]) => categorySortKey(a) - categorySortKey(b))
    .map(([category, catItems]) => ({
      category,
      items: catItems,
      subtotal: catItems.reduce((sum, item) => sum + item.subtotal, 0),
    }));
};

export const useCartGroupedByProduct = () => {
  const items = useCartStore((s) => s.items);

  const grouped = items.reduce((acc, item) => {
    const category = (item.product as { category_name?: string }).category_name || "Uncategorized";
    const productId = item.product.id;
    if (!acc[category]) {
      acc[category] = {};
    }
    if (!acc[category][productId]) {
      acc[category][productId] = {
        product: item.product,
        variants: [],
        totalQty: 0,
        subtotal: 0,
      };
    }
    acc[category][productId].variants.push(item);
    acc[category][productId].totalQty += item.quantity;
    acc[category][productId].subtotal += item.subtotal;
    return acc;
  }, {} as Record<string, Record<string, { product: Product; variants: CartItem[]; totalQty: number; subtotal: number }>>);

  return Object.entries(grouped)
    .sort(([a], [b]) => categorySortKey(a) - categorySortKey(b))
    .map(([category, products]) => ({
      category,
      products: Object.values(products),
      subtotal: Object.values(products).reduce((sum, p) => sum + p.subtotal, 0),
    }));
};

export const useCartTotals = () => {
  const items = useCartStore((s) => s.items);
  const activeTaxes = useCartStore((s) => s.activeTaxes);
  const activeOrderDiscounts = useCartStore((s) => s.activeOrderDiscounts);

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  // Calculate total product discounts
  const totalProductDiscount = items.reduce((sum, item) => {
    if (item.discount) {
      return sum + calcDiscountAmount(item.unit_price * item.quantity, item.subtotal);
    }
    return sum;
  }, 0);

  // Apply order discount (take first active)
  const orderDiscount = activeOrderDiscounts.length > 0 ? activeOrderDiscounts[0] : null;
  const orderDiscountAmount = orderDiscount
    ? (orderDiscount.type === "percentage"
        ? subtotal * (orderDiscount.value / 100)
        : orderDiscount.value)
    : 0;
  const subtotalAfterOrderDiscount = subtotal - orderDiscountAmount;

  // Apply all active taxes on the subtotal after order discount
  const appliedTaxes: AppliedTax[] = activeTaxes.map((tax) => {
    let amount = 0;
    if (tax.type === "percentage") {
      amount = subtotalAfterOrderDiscount * (tax.value / 100);
    } else {
      amount = tax.value;
    }
    return {
      name: tax.name,
      type: tax.type,
      value: tax.value,
      amount,
    };
  });
  const totalTaxAmount = appliedTaxes.reduce((sum, t) => sum + t.amount, 0);

  // Build applied discounts list
  const appliedDiscounts: AppliedDiscount[] = [];

  // Add product discounts (one per product, sum them by name)
  const productDiscountsByName: Record<string, number> = {};
  items.forEach((item) => {
    if (item.discount) {
      const discAmount = calcDiscountAmount(item.unit_price * item.quantity, item.subtotal);
      productDiscountsByName[item.discount.name] =
        (productDiscountsByName[item.discount.name] ?? 0) + discAmount;
    }
  });
  Object.entries(productDiscountsByName).forEach(([name, amount]) => {
    appliedDiscounts.push({ name, type: "fixed", value: 0, amount });
  });

  if (orderDiscount && orderDiscountAmount > 0) {
    appliedDiscounts.push({
      name: orderDiscount.name,
      type: orderDiscount.type,
      value: orderDiscount.value,
      amount: orderDiscountAmount,
    });
  }

  const total = subtotalAfterOrderDiscount + totalTaxAmount;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    subtotal,
    totalProductDiscount,
    orderDiscount: orderDiscount
      ? { name: orderDiscount.name, type: orderDiscount.type, value: orderDiscount.value, amount: orderDiscountAmount }
      : null,
    appliedTaxes,
    totalTaxAmount,
    appliedDiscounts,
    total,
    itemCount,
  };
};
