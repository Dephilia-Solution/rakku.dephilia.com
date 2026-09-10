import { CartItem, OrderType, PaymentMethod, SplitPayment, AppliedTax, AppliedDiscount, IngredientUnit } from "@rakku/shared-types";

async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error ?? "Terjadi kesalahan") as Error & {
      code?: string;
    };
    error.code = data.code;
    throw error;
  }
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
  tableId?: string | null;
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

export async function reorderCategories(orders: { id: string; sort_order: number }[]) {
  return api("/api/admin/categories", {
    method: "PUT",
    body: JSON.stringify({ orders }),
  });
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

export async function deleteProduct(id: string) {
  return api(`/api/admin/products?id=${id}`, { method: "DELETE" });
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

export async function createIngredient(ingredient: {
  name: string;
  unit: IngredientUnit;
  stock_quantity?: number;
  min_stock_alert?: number;
  cost_per_unit?: number;
}) {
  return api("/api/admin/ingredients", {
    method: "POST",
    body: JSON.stringify(ingredient),
  });
}

export async function updateIngredient(
  id: string,
  ingredient: {
    name?: string;
    unit?: IngredientUnit;
    stock_quantity?: number;
    min_stock_alert?: number;
    cost_per_unit?: number;
    is_active?: boolean;
  }
) {
  return api("/api/admin/ingredients", {
    method: "PATCH",
    body: JSON.stringify({ id, ...ingredient }),
  });
}

export async function deleteIngredient(id: string) {
  return api(`/api/admin/ingredients?id=${id}`, { method: "DELETE" });
}

export async function createExpense(expense: {
  category: string;
  amount: number;
  description?: string;
  expense_date?: string;
}) {
  return api("/api/admin/expenses", {
    method: "POST",
    body: JSON.stringify(expense),
  });
}

export async function updateExpense(
  id: string,
  expense: {
    category?: string;
    amount?: number;
    description?: string;
    expense_date?: string;
  }
) {
  return api("/api/admin/expenses", {
    method: "PATCH",
    body: JSON.stringify({ id, ...expense }),
  });
}

export async function deleteExpense(id: string) {
  return api(`/api/admin/expenses?id=${id}`, { method: "DELETE" });
}

export async function adjustIngredientStock(
  id: string,
  stockQuantity: number,
  note?: string
) {
  return api(`/api/admin/ingredients/${id}/adjust`, {
    method: "POST",
    body: JSON.stringify({ stock_quantity: stockQuantity, note }),
  });
}

export async function createPurchase(data: {
  supplier_name?: string;
  purchase_date?: string;
  note?: string;
  items: {
    ingredient_id: string;
    quantity: number;
    unit_cost: number;
  }[];
}) {
  return api("/api/admin/purchases", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTables() {
  return api("/api/admin/tables");
}

export async function createTable(name: string) {
  return api("/api/admin/tables", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateTable(id: string, data: { name?: string; status?: string }) {
  return api("/api/admin/tables", {
    method: "PATCH",
    body: JSON.stringify({ id, ...data }),
  });
}

export async function deleteTable(id: string) {
  return api(`/api/admin/tables?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function generateTables(count: number) {
  return api("/api/admin/tables/generate", {
    method: "POST",
    body: JSON.stringify({ count }),
  });
}
