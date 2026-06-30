import { create } from "zustand";
import { Product, Modifier, CartItem, OrderType, PricingOption } from "@/types";

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  customerName: string;
  note: string;
  draftOrderId: string | null;
  addProduct: (product: Product, modifier?: Modifier, pricingOption?: PricingOption) => void;
  incrementQty: (itemId: string) => void;
  decrementQty: (itemId: string) => void;
  removeItem: (itemId: string) => void;
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

  addProduct: (product, modifier, pricingOption) =>
    set((state) => {
      const modLabel = modifier
        ? `${modifier.name} +${modifier.price_delta.toLocaleString("id-ID")}`
        : null;
      const optionPrice = pricingOption?.price ?? product.price;
      const unitPrice = optionPrice + (modifier?.price_delta ?? 0);

      const existing = state.items.find(
        (item) =>
          item.product.id === product.id &&
          item.modifier?.id === (modifier?.id ?? null) &&
          item.pricing_option_id === (pricingOption?.id ?? null)
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

  return Object.entries(grouped).map(([category, catItems]) => ({
    category,
    items: catItems,
    subtotal: catItems.reduce((sum, item) => sum + item.subtotal, 0),
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
