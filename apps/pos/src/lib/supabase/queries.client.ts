"use client";

import { useMemo } from "react";
import { useMerchantRequest } from "@pos/lib/merchant-runtime";
import { CartItem, OrderType, PaymentMethod, SplitPayment, AppliedTax, AppliedDiscount, IngredientUnit } from "@rakku/shared-types";

export function createClientQueries(request: typeof fetch = globalThis.fetch) {
async function api(url: string, options?: RequestInit) {
  const res = await request(url, {
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

async function createOrder(data: {
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
  amountPaid?: number;
}) {
  return api("/api/admin/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function createCategory(name: string, companyId: string, outletId: string) {
  return api("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify({ name, company_id: companyId, outlet_id: outletId }),
  });
}

async function updateCategory(id: string, name: string) {
  return api("/api/admin/categories", {
    method: "PATCH",
    body: JSON.stringify({ id, name }),
  });
}

async function deleteCategory(id: string) {
  return api(`/api/admin/categories?id=${id}`, { method: "DELETE" });
}

async function reorderCategories(orders: { id: string; sort_order: number }[]) {
  return api("/api/admin/categories", {
    method: "PUT",
    body: JSON.stringify({ orders }),
  });
}

async function createProduct(product: {
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

async function updateProduct(
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

async function toggleProductActive(id: string, is_active: boolean) {
  return api("/api/admin/products", {
    method: "PUT",
    body: JSON.stringify({ id, is_active }),
  });
}

async function deleteProduct(id: string) {
  return api(`/api/admin/products?id=${id}`, { method: "DELETE" });
}

async function getModifiersByProduct(productId: string) {
  return api(`/api/admin/modifiers?product_id=${productId}`);
}

async function createModifier(productId: string, name: string, priceDelta: number) {
  return api("/api/admin/modifiers", {
    method: "POST",
    body: JSON.stringify({ product_id: productId, name, price_delta: priceDelta }),
  });
}

async function deleteModifier(id: string) {
  return api(`/api/admin/modifiers?id=${id}`, { method: "DELETE" });
}

async function createIngredient(ingredient: {
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

async function updateIngredient(
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

async function deleteIngredient(id: string) {
  return api(`/api/admin/ingredients?id=${id}`, { method: "DELETE" });
}

async function createExpense(expense: {
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

async function updateExpense(
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

async function deleteExpense(id: string) {
  return api(`/api/admin/expenses?id=${id}`, { method: "DELETE" });
}

async function adjustIngredientStock(
  id: string,
  stockQuantity: number,
  note?: string
) {
  return api(`/api/admin/ingredients/${id}/adjust`, {
    method: "POST",
    body: JSON.stringify({ stock_quantity: stockQuantity, note }),
  });
}

async function createPurchase(data: {
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

async function getTables() {
  return api("/api/admin/tables");
}

async function createTable(name: string) {
  return api("/api/admin/tables", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

async function updateTable(id: string, data: { name?: string; status?: string }) {
  return api("/api/admin/tables", {
    method: "PATCH",
    body: JSON.stringify({ id, ...data }),
  });
}

async function deleteTable(id: string) {
  return api(`/api/admin/tables?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

async function generateTables(count: number) {
  return api("/api/admin/tables/generate", {
    method: "POST",
    body: JSON.stringify({ count }),
  });
}

return {
  createOrder, createCategory, updateCategory, deleteCategory, reorderCategories,
  createProduct, updateProduct, toggleProductActive, deleteProduct,
  getModifiersByProduct, createModifier, deleteModifier,
  createIngredient, updateIngredient, deleteIngredient, adjustIngredientStock,
  createExpense, updateExpense, deleteExpense, createPurchase,
  getTables, createTable, updateTable, deleteTable, generateTables,
};
}

export const {
  createOrder, createCategory, updateCategory, deleteCategory, reorderCategories,
  createProduct, updateProduct, toggleProductActive, deleteProduct,
  getModifiersByProduct, createModifier, deleteModifier,
  createIngredient, updateIngredient, deleteIngredient, adjustIngredientStock,
  createExpense, updateExpense, deleteExpense, createPurchase,
  getTables, createTable, updateTable, deleteTable, generateTables,
} = createClientQueries();

export function useClientQueries() {
  const request = useMerchantRequest();
  return useMemo(() => createClientQueries(request), [request]);
}
