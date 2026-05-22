import { createClient } from "@/lib/supabase/client";
import { CartItem, OrderType, PaymentMethod } from "@/types";

export async function createOrder(data: {
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  customerName?: string;
  note?: string;
}) {
  const supabase = createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_type: data.orderType,
      payment_method: data.paymentMethod,
      subtotal: data.subtotal,
      tax_rate: Number(process.env.NEXT_PUBLIC_TAX_RATE) || 10,
      tax_amount: data.taxAmount,
      total_price: data.total,
      customer_name: data.customerName || null,
      note: data.note || null,
    })
    .select()
    .single();

  if (orderError || !order) throw new Error(orderError?.message ?? "Gagal membuat order");

  const orderItems = data.items.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_name: item.product.name,
    unit_price: item.product.price,
    quantity: item.quantity,
    modifier_label: item.modifier_label,
    subtotal: item.subtotal,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) throw new Error(itemsError.message);

  return order;
}

export async function createCategory(name: string) {
  const supabase = createClient();
  const { data: max, error: maxError } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  if (maxError && maxError.code !== "PGRST116") throw new Error(maxError.message);

  const { data, error } = await supabase
    .from("categories")
    .insert({ name, sort_order: (max?.sort_order ?? 0) + 1 })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCategory(id: string, name: string) {
  const supabase = createClient();
  const { error } = await supabase.from("categories").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCategory(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createProduct(product: {
  name: string;
  price: number;
  category_id: string;
  description?: string;
  is_active?: boolean;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: product.name,
      price: product.price,
      category_id: product.category_id,
      description: product.description ?? null,
      is_active: product.is_active ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
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
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ ...product, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function toggleProductActive(id: string, is_active: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getModifiersByProduct(productId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("modifiers")
    .select("*")
    .eq("product_id", productId)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id,
    product_id: m.product_id,
    name: m.name,
    price_delta: Number(m.price_delta),
  }));
}

export async function createModifier(productId: string, name: string, priceDelta: number) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("modifiers")
    .insert({ product_id: productId, name, price_delta: priceDelta })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    product_id: data.product_id,
    name: data.name,
    price_delta: Number(data.price_delta),
  };
}

export async function updateModifier(id: string, name: string, priceDelta: number) {
  const supabase = createClient();
  const { error } = await supabase
    .from("modifiers")
    .update({ name, price_delta: priceDelta })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteModifier(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("modifiers")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
