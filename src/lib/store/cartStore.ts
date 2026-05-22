import { create } from "zustand";
import { Product, Modifier, CartItem, OrderType } from "@/types";

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  customerName: string;
  note: string;
  addProduct: (product: Product, modifier?: Modifier) => void;
  incrementQty: (itemId: string) => void;
  decrementQty: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  setOrderType: (type: OrderType) => void;
  setCustomerName: (name: string) => void;
  setNote: (note: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  orderType: "dine_in",
  customerName: "",
  note: "",

  addProduct: (product, modifier) =>
    set((state) => {
      const modLabel = modifier
        ? `${modifier.name} +${modifier.price_delta.toLocaleString("id-ID")}`
        : null;
      const unitPrice = product.price + (modifier?.price_delta ?? 0);

      const existing = state.items.find(
        (item) =>
          item.product.id === product.id &&
          item.modifier?.id === (modifier?.id ?? null)
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
  clear: () =>
    set({
      items: [],
      customerName: "",
      note: "",
    }),
}));

export const useCartTotals = () => {
  const items = useCartStore((s) => s.items);
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const taxRate = 10;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { subtotal, taxRate, taxAmount, total, itemCount };
};
