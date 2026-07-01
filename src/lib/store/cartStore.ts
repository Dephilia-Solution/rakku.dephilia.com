import { create } from "zustand";
import { Product, Modifier, CartItem, OrderType, PricingOption } from "@/types";

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
  addProduct: (product: Product, modifier?: Modifier, pricingOption?: PricingOption, isDraftRestore?: boolean) => void;
  incrementQty: (itemId: string) => void;
  decrementQty: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  updateItemModifier: (itemId: string, modifier?: Modifier, pricingOption?: PricingOption) => void;
  setOrderType: (type: OrderType) => void;
  setCustomerName: (name: string) => void;
  setNote: (note: string) => void;
  setDraftOrderId: (id: string | null) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  orderType: "dine_in",
  customerName: "",
  note: "",
  draftOrderId: null,

  addProduct: (product, modifier, pricingOption, isDraftRestore) =>
    set((state) => {
      const modLabel = modifier
        ? `${modifier.name} +${modifier.price_delta.toLocaleString("id-ID")}`
        : null;
      const optionPrice = pricingOption?.price ?? product.price;
      const unitPrice = optionPrice + (modifier?.price_delta ?? 0);

      const modifierId = modifier?.id ?? null;

      const existing = state.items.find(
        (item) =>
          item.product.id === product.id &&
          (item.modifier?.id ?? null) === modifierId &&
          (item.pricing_option_id ?? null) === (pricingOption?.id ?? null) &&
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
        pricing_option_id: pricingOption?.id,
        pricing_option_name: pricingOption?.name,
        source: isDraftRestore ? 'draft' : undefined,
      };
      return { items: [...state.items, newItem] };
    }),

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

  updateItemModifier: (itemId, modifier, pricingOption) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              modifier: modifier ?? null,
              modifier_label: modifier
                ? `${modifier.name} +${modifier.price_delta.toLocaleString("id-ID")}`
                : null,
              pricing_option_id: pricingOption?.id,
              pricing_option_name: pricingOption?.name,
              unit_price: (pricingOption?.price ?? item.product.price) + (modifier?.price_delta ?? 0),
              subtotal: item.quantity * ((pricingOption?.price ?? item.product.price) + (modifier?.price_delta ?? 0)),
            }
          : item
      ),
    })),

  setOrderType: (orderType) => set({ orderType }),
  setCustomerName: (customerName) => set({ customerName }),
  setNote: (note) => set({ note }),
  setDraftOrderId: (draftOrderId) => set({ draftOrderId }),
  clear: () =>
    set({
      items: [],
      customerName: "",
      note: "",
      draftOrderId: null,
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
