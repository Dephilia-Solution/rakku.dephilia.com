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
  price_delta?: number;
  group_name: string | null;
}

export type OrderType = "dine_in" | "take_away" | "delivery" | "gojek" | "grab" | "shopee";
export type PaymentMethod = "cash" | "qris" | "card" | "later";
export type OrderStatus = "draft" | "pending_payment" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export interface PricingTier {
  id: string;
  company_id: string;
  outlet_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
}

export interface ProductTierPrice {
  id: string;
  product_id: string;
  tier_id: string;
  price: number;
}

export interface ModifierTierPrice {
  id: string;
  modifier_id: string;
  tier_id: string;
  price_delta: number;
}

export interface SplitPaymentItem {
  cart_item_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface SplitPayment {
  id: string;
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  status: "unpaid" | "paid";
  customer_name: string | null;
  items: SplitPaymentItem[];
  created_at: string;
}

export interface PricingOption {
  id: string;
  product_id: string;
  name: string;
  price: number;
  is_active: boolean;
  company_id: string;
  outlet_id: string;
  sort_order: number;
  created_at: string;
}

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
  customer_name: string;
  cashier_name: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  reserved_until: string | null;
  pricing_tier_id: string | null;
  split_bill: boolean;
  discount_amount: number;
  taxes: AppliedTax[] | null;
  discounts: AppliedDiscount[] | null;
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
  note: string | null;
  subtotal: number;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  split_payments?: SplitPayment[];
}

export interface Tax {
  id: string;
  company_id: string;
  outlet_id: string;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProductDiscount {
  id: string;
  company_id: string;
  outlet_id: string;
  product_id: string;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface OrderDiscount {
  id: string;
  company_id: string;
  outlet_id: string;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface AppliedTax {
  name: string;
  type: "percentage" | "fixed";
  value: number;
  amount: number;
}

export interface AppliedDiscount {
  name: string;
  type: "percentage" | "fixed";
  value: number;
  amount: number;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  modifiers: Modifier[];
  modifier_label: string | null;
  unit_price: number;
  subtotal: number;
  pricing_tier_id?: string;
  note: string | null;
  source?: 'draft' | 'new';
  discount?: AppliedDiscount | null;
  discounted_unit_price?: number;
}

export interface Company {
  id: string;
  code: string;
  name: string;
  password_hash: string;
  logo_url: string | null;
  status: "active" | "suspended";
  created_at: string;
}

export interface Outlet {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  status: "active" | "inactive";
  created_at: string;
}

export interface Menu {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  path: string;
  sort_order: number;
}

export interface Role {
  id: string;
  company_id: string;
  name: string;
}

export interface RoleMenuAccess {
  role_id: string;
  menu_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface User {
  id: string;
  company_id: string;
  role_id: string;
  name: string;
  username: string;
  pin_hash: string;
  avatar_url: string | null;
  all_outlets: boolean;
  status: "active" | "inactive";
  failed_pin_attempts: number;
  locked_until: string | null;
  created_at: string;
}

export interface UserOutlet {
  user_id: string;
  outlet_id: string;
}
