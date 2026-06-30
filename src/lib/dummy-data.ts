import {
  Category,
  ProductWithCategory,
  Modifier,
  OrderWithItems,
  OrderItem,
} from "@/types";

export const categories: Category[] = [
  { id: "cat-1", name: "Coffee", sort_order: 1 },
  { id: "cat-2", name: "Pastry", sort_order: 2 },
  { id: "cat-3", name: "Non-Coffee", sort_order: 3 },
  { id: "cat-4", name: "Add-ons", sort_order: 4 },
];

export const products: ProductWithCategory[] = [
  { id: "prod-1", name: "Cafe Latte", price: 45000, category_id: "cat-1", image_url: null, is_active: true, description: "Espresso with steamed milk", category_name: "Coffee" },
  { id: "prod-2", name: "Cappuccino", price: 45000, category_id: "cat-1", image_url: null, is_active: true, description: "Espresso with foamed milk", category_name: "Coffee" },
  { id: "prod-3", name: "Espresso", price: 30000, category_id: "cat-1", image_url: null, is_active: true, description: "Double shot espresso", category_name: "Coffee" },
  { id: "prod-4", name: "Butter Croissant", price: 35000, category_id: "cat-2", image_url: null, is_active: true, description: "Flaky butter croissant", category_name: "Pastry" },
  { id: "prod-5", name: "Chocolate Muffin", price: 28000, category_id: "cat-2", image_url: null, is_active: true, description: "Rich chocolate muffin", category_name: "Pastry" },
  { id: "prod-6", name: "Matcha Latte", price: 50000, category_id: "cat-3", image_url: null, is_active: true, description: "Ceremonial matcha with milk", category_name: "Non-Coffee" },
  { id: "prod-7", name: "Chocolate", price: 45000, category_id: "cat-3", image_url: null, is_active: true, description: "Rich hot chocolate", category_name: "Non-Coffee" },
  { id: "prod-8", name: "Fresh Orange Juice", price: 35000, category_id: "cat-3", image_url: null, is_active: true, description: "Fresh squeezed orange juice", category_name: "Non-Coffee" },
  { id: "prod-9", name: "Iced Matcha Latte", price: 55000, category_id: "cat-3", image_url: null, is_active: true, description: "Iced matcha with milk", category_name: "Non-Coffee" },
  { id: "prod-10", name: "Vanilla Muffin", price: 28000, category_id: "cat-2", image_url: null, is_active: false, description: "Vanilla muffin with sprinkles", category_name: "Pastry" },
];

export const modifiers: Modifier[] = [
  { id: "mod-1", product_id: "prod-1", name: "Oat Milk", price_delta: 5000 },
  { id: "mod-2", product_id: "prod-1", name: "Soy Milk", price_delta: 4000 },
  { id: "mod-3", product_id: "prod-2", name: "Oat Milk", price_delta: 5000 },
  { id: "mod-4", product_id: "prod-6", name: "Oat Milk", price_delta: 5000 },
  { id: "mod-5", product_id: "prod-7", name: "Extra Marshmallow", price_delta: 3000 },
  { id: "mod-6", product_id: "prod-1", name: "Extra Shot", price_delta: 8000 },
];

export const sampleOrderItems: OrderItem[] = [
  { id: "oi-1", order_id: "ord-1", product_id: "prod-1", product_name: "Cafe Latte", unit_price: 45000, quantity: 2, modifier_label: "Oat Milk +5000", subtotal: 100000 },
  { id: "oi-2", order_id: "ord-1", product_id: "prod-4", product_name: "Butter Croissant", unit_price: 35000, quantity: 1, modifier_label: null, subtotal: 35000 },
  { id: "oi-3", order_id: "ord-2", product_id: "prod-3", product_name: "Espresso", unit_price: 30000, quantity: 1, modifier_label: null, subtotal: 30000 },
  { id: "oi-4", order_id: "ord-2", product_id: "prod-6", product_name: "Matcha Latte", unit_price: 50000, quantity: 1, modifier_label: "Oat Milk +5000", subtotal: 55000 },
  { id: "oi-5", order_id: "ord-3", product_id: "prod-7", product_name: "Chocolate", unit_price: 45000, quantity: 3, modifier_label: "Extra Marshmallow +3000", subtotal: 144000 },
];

export const sampleOrders: OrderWithItems[] = [
  {
    id: "ord-1", order_number: 1042, order_type: "dine_in", payment_method: "cash",
    subtotal: 135000, tax_rate: 10, tax_amount: 13500, total_price: 148500,
    note: null, customer_name: "", status: "completed", payment_status: "paid",
    reserved_until: null, pricing_option_id: null, created_at: "2026-05-22T09:30:00Z",
    items: [sampleOrderItems[0], sampleOrderItems[1]],
  },
  {
    id: "ord-2", order_number: 1043, order_type: "delivery", payment_method: "qris",
    subtotal: 85000, tax_rate: 10, tax_amount: 8500, total_price: 93500,
    note: "Less ice please", customer_name: "Budi", status: "completed", payment_status: "paid",
    reserved_until: null, pricing_option_id: null, created_at: "2026-05-22T10:15:00Z",
    items: [sampleOrderItems[2], sampleOrderItems[3]],
  },
  {
    id: "ord-3", order_number: 1044, order_type: "dine_in", payment_method: "card",
    subtotal: 144000, tax_rate: 10, tax_amount: 14400, total_price: 158400,
    note: null, customer_name: "", status: "completed", payment_status: "paid",
    reserved_until: null, pricing_option_id: null, created_at: "2026-05-22T11:00:00Z",
    items: [sampleOrderItems[4]],
  },
  {
    id: "ord-4", order_number: 1045, order_type: "delivery", payment_method: "cash",
    subtotal: 75000, tax_rate: 10, tax_amount: 7500, total_price: 82500,
    note: "Extra napkins", customer_name: "Siti", status: "completed", payment_status: "paid",
    reserved_until: null, pricing_option_id: null, created_at: "2026-05-21T18:30:00Z",
    items: [
      { id: "oi-6", order_id: "ord-4", product_id: "prod-2", product_name: "Cappuccino", unit_price: 45000, quantity: 1, modifier_label: null, subtotal: 45000 },
      { id: "oi-7", order_id: "ord-4", product_id: "prod-5", product_name: "Chocolate Muffin", unit_price: 28000, quantity: 1, modifier_label: null, subtotal: 28000 },
    ],
  },
  {
    id: "ord-5", order_number: 1046, order_type: "dine_in", payment_method: "qris",
    subtotal: 100000, tax_rate: 10, tax_amount: 10000, total_price: 110000,
    note: null, customer_name: "", status: "completed", payment_status: "paid",
    reserved_until: null, pricing_option_id: null, created_at: "2026-05-21T07:45:00Z",
    items: [
      { id: "oi-8", order_id: "ord-5", product_id: "prod-9", product_name: "Iced Matcha Latte", unit_price: 55000, quantity: 1, modifier_label: null, subtotal: 55000 },
      { id: "oi-9", order_id: "ord-5", product_id: "prod-4", product_name: "Butter Croissant", unit_price: 35000, quantity: 1, modifier_label: null, subtotal: 35000 },
    ],
  },
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
