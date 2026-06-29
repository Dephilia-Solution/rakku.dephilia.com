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

export interface TenantSession {
  user_id: string;
  company_id: string;
  outlet_id: string;
  role_id: string;
  user_name: string;
  company_name: string;
  outlet_name: string;
}

export interface PendingLogin {
  company_id: string;
  company_name?: string;
  outlet_id?: string;
  outlet_name?: string;
}
