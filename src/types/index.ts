export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
  image_url: string | null;
  is_active: boolean;
  description: string | null;
}

export interface ProductWithCategory extends Product {
  category_name: string;
}

export interface Modifier {
  id: string;
  product_id: string;
  name: string;
  price_delta: number;
}

export type OrderType = "dine_in" | "delivery";
export type PaymentMethod = "cash" | "qris" | "card";

export interface Order {
  id: string;
  order_number: number;
  order_type: OrderType;
  payment_method: PaymentMethod;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_price: number;
  note: string | null;
  customer_name: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  modifier_label: string | null;
  subtotal: number;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  modifier: Modifier | null;
  modifier_label: string | null;
  unit_price: number;
  subtotal: number;
}
