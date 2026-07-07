import { CartItem, OrderType, PaymentMethod, SplitPayment, AppliedTax, AppliedDiscount } from "@rakku/shared-types";

async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Terjadi kesalahan");
  return data;
}

export async function createOrder(data: {
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  taxes: AppliedTax[];
  discounts: AppliedDiscount[];
  customerName?: string;
  note?: string;
  status?: string;
  paymentStatus?: string;
  companyId?: string;
  outletId?: string;
  cashierId?: string;
  pricingTierId?: string | null;
  splitPayments?: SplitPayment[];
}) {
  return api("/api/admin/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createCategory(name: string, companyId: string, outletId: string) {
  return api("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify({ name, company_id: companyId, outlet_id: outletId }),
  });
}

export async function updateCategory(id: string, name: string) {
  return api("/api/admin/categories", {
    method: "PATCH",
    body: JSON.stringify({ id, name }),
  });
}

export async function deleteCategory(id: string) {
  return api(`/api/admin/categories?id=${id}`, { method: "DELETE" });
}

export async function createProduct(product: {
  name: string;
  price: number;
  category_id: string;
  description?: string;
  is_active?: boolean;
  companyId?: string;
  outletId?: string;
}) {
  return api("/api/admin/products", {
    method: "POST",
    body: JSON.stringify({
      name: product.name,
      price: product.price,
      category_id: product.category_id,
      description: product.description,
      is_active: product.is_active,
      company_id: product.companyId,
      outlet_id: product.outletId,
    }),
  });
}

export async function updateProduct(
  id: string,
  product: {
    name?: string;
    price?: number;
    category_id?: string;
    description?: string;
    is_active?: boolean;
    image_url?: string | null;
  }
) {
  return api("/api/admin/products", {
    method: "PATCH",
    body: JSON.stringify({ id, ...product }),
  });
}

export async function toggleProductActive(id: string, is_active: boolean) {
  return api("/api/admin/products", {
    method: "PUT",
    body: JSON.stringify({ id, is_active }),
  });
}

export async function getModifiersByProduct(productId: string) {
  return api(`/api/admin/modifiers?product_id=${productId}`);
}

export async function createModifier(productId: string, name: string, priceDelta: number) {
  return api("/api/admin/modifiers", {
    method: "POST",
    body: JSON.stringify({ product_id: productId, name, price_delta: priceDelta }),
  });
}

export async function deleteModifier(id: string) {
  return api(`/api/admin/modifiers?id=${id}`, { method: "DELETE" });
}
