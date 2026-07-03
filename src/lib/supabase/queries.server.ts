import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { OrderType, PaymentMethod, OrderStatus, PaymentStatus, AppliedTax, AppliedDiscount } from "@/types";

type JsonLike = Record<string, unknown>;

async function getSessionScope() {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    throw new Error("No tenant session");
  }
  return {
    company_id: session.company_id,
    outlet_id: session.outlet_id,
  };
}

export async function getActiveProducts() {
  const supabase = createAdminClient();
  const { company_id, outlet_id } = await getSessionScope();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name)")
    .eq("is_active", true)
    .eq("company_id", company_id)
    .eq("outlet_id", outlet_id)
    .order("name");
  return (
    (data as JsonLike[])?.map((p) => ({
      id: p.id as string,
      name: p.name as string,
      price: Number(p.price),
      category_id: p.category_id as string,
      image_url: p.image_url as string | null,
      is_active: p.is_active as boolean,
      description: p.description as string | null,
      category_name: ((p.categories as JsonLike)?.name as string) ?? "",
    })) ?? []
  );
}

export async function getAllProducts() {
  const supabase = createAdminClient();
  const { company_id, outlet_id } = await getSessionScope();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name)")
    .eq("company_id", company_id)
    .eq("outlet_id", outlet_id)
    .order("name");
  return (
    (data as JsonLike[])?.map((p) => ({
      id: p.id as string,
      name: p.name as string,
      price: Number(p.price),
      category_id: p.category_id as string,
      image_url: p.image_url as string | null,
      is_active: p.is_active as boolean,
      description: p.description as string | null,
      category_name: ((p.categories as JsonLike)?.name as string) ?? "",
    })) ?? []
  );
}

export async function getCategories() {
  const supabase = createAdminClient();
  const { company_id, outlet_id } = await getSessionScope();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("company_id", company_id)
    .eq("outlet_id", outlet_id)
    .order("sort_order");
  return (
    (data as JsonLike[])?.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      sort_order: c.sort_order as number,
    })) ?? []
  );
}

export async function getAllModifiers() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("modifiers")
    .select("*, modifier_tier_prices(*)");
  return (
    (data as JsonLike[])?.map((m) => ({
      id: m.id as string,
      product_id: m.product_id as string,
      name: m.name as string,
      price_delta: Number(m.price_delta ?? 0),
      group_name: (m.group_name as string) ?? null,
      tier_prices: ((m.modifier_tier_prices as JsonLike[]) ?? []).map((tp) => ({
        modifier_id: tp.modifier_id as string,
        tier_id: tp.tier_id as string,
        price_delta: Number(tp.price_delta),
      })),
    })) ?? []
  );
}

export async function getPricingTiers() {
  const supabase = createAdminClient();
  const { company_id, outlet_id } = await getSessionScope();
  const { data } = await supabase
    .from("pricing_tiers")
    .select("*")
    .eq("company_id", company_id)
    .eq("outlet_id", outlet_id)
    .eq("is_active", true)
    .order("sort_order");
  return (
    (data as JsonLike[])?.map((t) => ({
      id: t.id as string,
      company_id: t.company_id as string,
      outlet_id: t.outlet_id as string,
      name: t.name as string,
      slug: t.slug as string,
      is_active: t.is_active as boolean,
      sort_order: t.sort_order as number,
    })) ?? []
  );
}

export async function getProductTierPrices() {
  const supabase = createAdminClient();
  const { company_id, outlet_id } = await getSessionScope();
  const { data: tiers } = await supabase
    .from("pricing_tiers")
    .select("id")
    .eq("company_id", company_id)
    .eq("outlet_id", outlet_id);
  const tierIds = (tiers as JsonLike[])?.map((t) => t.id as string) ?? [];
  if (tierIds.length === 0) return [];
  const { data } = await supabase
    .from("product_tier_prices")
    .select("*")
    .in("tier_id", tierIds);
  return (
    (data as JsonLike[])?.map((p) => ({
      id: p.id as string,
      product_id: p.product_id as string,
      tier_id: p.tier_id as string,
      price: Number(p.price),
    })) ?? []
  );
}

export async function getOrders() {
  const supabase = createAdminClient();
  const { company_id, outlet_id } = await getSessionScope();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("company_id", company_id)
    .eq("outlet_id", outlet_id)
    .order("created_at", { ascending: false });
  return (
    (data as JsonLike[])?.map((o) => ({
      id: o.id as string,
      order_number: o.order_number as number,
      order_type: o.order_type as OrderType,
      payment_method: o.payment_method as PaymentMethod,
      subtotal: Number(o.subtotal),
      tax_rate: Number(o.tax_rate),
      tax_amount: Number(o.tax_amount),
      total_price: Number(o.total_price),
      note: o.note as string | null,
      customer_name: (o.customer_name as string) ?? "",
      cashier_name: (o.cashier_name as string) ?? null,
      status: (o.status as OrderStatus) ?? "completed",
      payment_status: (o.payment_status as PaymentStatus) ?? "paid",
      reserved_until: o.reserved_until as string | null,
      pricing_tier_id: o.pricing_tier_id as string | null,
      split_bill: (o.split_bill as boolean) ?? false,
      discount_amount: Number(o.discount_amount ?? 0),
      taxes: o.taxes as AppliedTax[] | null,
      discounts: o.discounts as AppliedDiscount[] | null,
      created_at: o.created_at as string,
      items: ((o.order_items ?? []) as JsonLike[]).map((i) => ({
        id: i.id as string,
        order_id: i.order_id as string,
        product_id: i.product_id as string,
        product_name: i.product_name as string,
        unit_price: Number(i.unit_price),
        quantity: i.quantity as number,
        modifier_label: i.modifier_label as string | null,
        note: i.note as string | null,
        subtotal: Number(i.subtotal),
      })),
    })) ?? []
  );
}

export async function getSalesSummary() {
  const supabase = createAdminClient();
  const { company_id, outlet_id } = await getSessionScope();
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("company_id", company_id)
    .eq("outlet_id", outlet_id);

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
    itemCounts[i.product_name as string] =
      (itemCounts[i.product_name as string] || 0) + (i.quantity as number);
  });
  const topEntry = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
  const topItem = topEntry
    ? { name: topEntry[0], count: topEntry[1] }
    : null;

  return { totalTransactions, totalRevenue, topItem };
}

export async function getActiveTaxes() {
  const supabase = createAdminClient();
  const { company_id, outlet_id } = await getSessionScope();
  const { data } = await supabase
    .from("taxes")
    .select("*")
    .eq("company_id", company_id)
    .eq("outlet_id", outlet_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (
    (data as JsonLike[])?.map((t) => ({
      id: t.id as string,
      company_id: t.company_id as string,
      outlet_id: t.outlet_id as string,
      name: t.name as string,
      type: t.type as "percentage" | "fixed",
      value: Number(t.value),
      is_active: t.is_active as boolean,
      sort_order: t.sort_order as number,
      created_at: t.created_at as string,
    })) ?? []
  );
}

export async function getActiveProductDiscounts() {
  const supabase = createAdminClient();
  const { company_id, outlet_id } = await getSessionScope();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("product_discounts")
    .select("*")
    .eq("company_id", company_id)
    .eq("outlet_id", outlet_id)
    .eq("is_active", true)
    .lte("start_date", now)
    .gte("end_date", now);
  return (
    (data as JsonLike[])?.map((d) => ({
      id: d.id as string,
      company_id: d.company_id as string,
      outlet_id: d.outlet_id as string,
      product_id: d.product_id as string,
      name: d.name as string,
      type: d.type as "percentage" | "fixed",
      value: Number(d.value),
      start_date: d.start_date as string,
      end_date: d.end_date as string,
      is_active: d.is_active as boolean,
      created_at: d.created_at as string,
    })) ?? []
  );
}

export async function getActiveOrderDiscounts() {
  const supabase = createAdminClient();
  const { company_id, outlet_id } = await getSessionScope();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("order_discounts")
    .select("*")
    .eq("company_id", company_id)
    .eq("outlet_id", outlet_id)
    .eq("is_active", true)
    .lte("start_date", now)
    .gte("end_date", now);
  return (
    (data as JsonLike[])?.map((d) => ({
      id: d.id as string,
      company_id: d.company_id as string,
      outlet_id: d.outlet_id as string,
      name: d.name as string,
      type: d.type as "percentage" | "fixed",
      value: Number(d.value),
      start_date: d.start_date as string,
      end_date: d.end_date as string,
      is_active: d.is_active as boolean,
      created_at: d.created_at as string,
    })) ?? []
  );
}
