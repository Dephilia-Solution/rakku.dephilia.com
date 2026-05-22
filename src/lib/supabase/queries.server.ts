import { createClient as createServerClient } from "@/lib/supabase/server";
import { OrderType, PaymentMethod } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonLike = Record<string, any>;

export async function getActiveProducts() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name)")
    .eq("is_active", true)
    .order("name");
  return (
    (data as JsonLike[])?.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      category_id: p.category_id,
      image_url: p.image_url,
      is_active: p.is_active,
      description: p.description,
      category_name: p.categories?.name ?? "",
    })) ?? []
  );
}

export async function getAllProducts() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name)")
    .order("name");
  return (
    (data as JsonLike[])?.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      category_id: p.category_id,
      image_url: p.image_url,
      is_active: p.is_active,
      description: p.description,
      category_name: p.categories?.name ?? "",
    })) ?? []
  );
}

export async function getCategories() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");
  return (
    (data as JsonLike[])?.map((c) => ({
      id: c.id,
      name: c.name,
      sort_order: c.sort_order,
    })) ?? []
  );
}

export async function getAllModifiers() {
  const supabase = await createServerClient();
  const { data } = await supabase.from("modifiers").select("*");
  return (
    (data as JsonLike[])?.map((m) => ({
      id: m.id,
      product_id: m.product_id,
      name: m.name,
      price_delta: Number(m.price_delta),
    })) ?? []
  );
}

export async function getOrders() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });
  return (
    (data as JsonLike[])?.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      order_type: o.order_type as OrderType,
      payment_method: o.payment_method as PaymentMethod,
      subtotal: Number(o.subtotal),
      tax_rate: Number(o.tax_rate),
      tax_amount: Number(o.tax_amount),
      total_price: Number(o.total_price),
      note: o.note,
      customer_name: o.customer_name,
      created_at: o.created_at,
      items: ((o.order_items ?? []) as JsonLike[]).map((i) => ({
        id: i.id,
        order_id: i.order_id,
        product_id: i.product_id,
        product_name: i.product_name,
        unit_price: Number(i.unit_price),
        quantity: i.quantity,
        modifier_label: i.modifier_label,
        subtotal: Number(i.subtotal),
      })),
    })) ?? []
  );
}

export async function getSalesSummary() {
  const supabase = await createServerClient();
  const { data: orders } = await supabase.from("orders").select("*");

  if (!orders || orders.length === 0) {
    return {
      totalTransactions: 0,
      totalRevenue: 0,
      topItem: null as { name: string; count: number } | null,
    };
  }

  const totalTransactions = orders.length;
  const totalRevenue = (orders as JsonLike[]).reduce(
    (s, o) => s + Number(o.total_price),
    0
  );

  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, quantity");
  const itemCounts: Record<string, number> = {};
  ((items ?? []) as JsonLike[]).forEach((i) => {
    itemCounts[i.product_name] =
      (itemCounts[i.product_name] || 0) + i.quantity;
  });
  const topEntry = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
  const topItem = topEntry
    ? { name: topEntry[0], count: topEntry[1] }
    : null;

  return { totalTransactions, totalRevenue, topItem };
}
