import { create } from "zustand";
import { Product, Modifier, CartItem, OrderType, PricingTier, SplitPayment } from "@/types";

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

  addProduct: (product: Product, modifier?: Modifier, isDraftRestore?: boolean) => void;
  restoreDraftItem: (item: CartItem, tierId: string | null) => void;
  incrementQty: (itemId: string) => void;
  decrementQty: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  updateItemModifier: (itemId: string, modifier?: Modifier) => void;
  setOrderType: (type: OrderType) => void;
  setCustomerName: (name: string) => void;
  setNote: (note: string) => void;
  setDraftOrderId: (id: string | null) => void;
  setPricingTier: (tierId: string | null) => void;
  setPricingTiers: (tiers: PricingTier[], tierPrices: Record<string, Record<string, number>>, modifierDeltas: Record<string, Record<string, number>>) => void;
  setModifierTierDeltas: (deltas: Record<string, Record<string, number>>) => void;
  setSplitPayments: (payments: SplitPayment[]) => void;
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

  addProduct: (product, modifier, isDraftRestore) =>
    set((state) => {
      const modDelta = modifier
        ? getTierModifierDelta(modifier.id, state.pricingTierId, state.modifierTierDeltaMap, modifier.price_delta ?? 0)
        : 0;
      const modLabel = modifier
        ? `${modifier.name} +${modDelta.toLocaleString("id-ID")}`
        : null;
      const basePrice = getTierPrice(product.id, state.pricingTierId, state.productTierPriceMap, product.price);
      const unitPrice = basePrice + modDelta;

      const modifierId = modifier?.id ?? null;

      const existing = state.items.find(
        (item) =>
          item.product.id === product.id &&
          (item.modifier?.id ?? null) === modifierId &&
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

      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product,
        quantity: 1,
        modifier: modifier ?? null,
        modifier_label: modLabel,
        unit_price: unitPrice,
        subtotal: unitPrice,
        pricing_tier_id: state.pricingTierId ?? undefined,
        source: isDraftRestore ? 'draft' : undefined,
      };
      return { items: [...state.items, newItem] };
    }),

  restoreDraftItem: (item, tierId) =>
    set((state) => ({
      pricingTierId: tierId,
      items: [
        ...state.items,
        {
          ...item,
          id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          pricing_tier_id: tierId ?? undefined,
          source: "draft",
        },
      ],
    })),

  incrementQty: (itemId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: item.quantity + 1,
              subtotal: (item.quantity + 1) * item.unit_price,
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
                subtotal: (item.quantity - 1) * item.unit_price,
              }
            : item
        )
        .filter((item) => item.quantity > 0),
    })),

  removeItem: (itemId) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== itemId),
    })),

  updateItemModifier: (itemId, modifier) =>
    set((state) => {
      const item = state.items.find((i) => i.id === itemId);
      if (!item) return state;
      const modDelta = modifier
        ? getTierModifierDelta(modifier.id, state.pricingTierId, state.modifierTierDeltaMap, modifier.price_delta ?? 0)
        : 0;
      const basePrice = getTierPrice(item.product.id, state.pricingTierId, state.productTierPriceMap, item.product.price);
      const unitPrice = basePrice + modDelta;
      return {
        items: state.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                modifier: modifier ?? null,
                modifier_label: modifier
                  ? `${modifier.name} +${modDelta.toLocaleString("id-ID")}`
                  : null,
                unit_price: unitPrice,
                subtotal: item.quantity * unitPrice,
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
        const modDelta = item.modifier
          ? getTierModifierDelta(item.modifier.id, tierId, state.modifierTierDeltaMap, item.modifier.price_delta ?? 0)
          : 0;
        const basePrice = getTierPrice(item.product.id, tierId, state.productTierPriceMap, item.product.price);
        const unitPrice = basePrice + modDelta;
        return {
          ...item,
          unit_price: unitPrice,
          subtotal: item.quantity * unitPrice,
          pricing_tier_id: tierId ?? undefined,
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
        const modDelta = item.modifier
          ? getTierModifierDelta(item.modifier.id, tierId, modifierDeltaMap, item.modifier.price_delta ?? 0)
          : 0;
        const basePrice = getTierPrice(item.product.id, tierId, tierPriceMap, item.product.price);
        const unitPrice = basePrice + modDelta;
        return {
          ...item,
          unit_price: unitPrice,
          subtotal: item.quantity * unitPrice,
          pricing_tier_id: tierId ?? undefined,
        };
      }),
    });
  },

  setModifierTierDeltas: (deltas) => set({ modifierTierDeltaMap: deltas }),

  setSplitPayments: (splitPayments) => set({ splitPayments }),

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
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const taxRate = 10;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { subtotal, taxRate, taxAmount, total, itemCount };
};
