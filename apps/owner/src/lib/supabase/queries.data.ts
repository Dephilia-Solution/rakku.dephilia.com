import { createAdminClient } from "@rakku/supabase-clients";
import {
  OrderType,
  PaymentMethod,
  OrderStatus,
  PaymentStatus,
  AppliedTax,
  AppliedDiscount,
  PricingTier,
  Tax,
  ProductDiscount,
  OrderDiscount,
  ProductWithCategory,
  Category,
  Modifier,
  ModifierTierPrice,
  ProductTierPrice,
  Product,
  Ingredient,
} from "@rakku/shared-types";

type JsonLike = Record<string, unknown>;

// ============================================================
// Helper: verify outlet belongs to company (guard for mutations)
// ============================================================
export async function verifyOutletBelongsToCompany(
  outletId: string,
  companyId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("outlets")
    .select("id")
    .eq("id", outletId)
    .eq("company_id", companyId)
    .maybeSingle();
  return !!data;
}

// ============================================================
// Helper: get all outlet ids for a company
// ============================================================
export async function getCompanyOutletIds(
  companyId: string
): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("outlets")
    .select("id")
    .eq("company_id", companyId);
  return (data ?? []).map((o) => o.id as string);
}

export async function getCompanyOutletMap(
  companyId: string
): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("outlets")
    .select("id, name")
    .eq("company_id", companyId);
  const map = new Map<string, string>();
  for (const o of data ?? []) {
    map.set(o.id as string, o.name as string);
  }
  return map;
}

// ============================================================
// ORDERS — read all orders across company outlets
// ============================================================
export interface OwnerOrderWithItems {
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
  table_id: string | null;
  table_name: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  reserved_until: string | null;
  pricing_tier_id: string | null;
  split_bill: boolean;
  discount_amount: number;
  taxes: AppliedTax[] | null;
  discounts: AppliedDiscount[] | null;
  created_at: string;
  outlet_id: string;
  outlet_name: string;
  items: {
    id: string;
    order_id: string;
    product_id: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    modifier_label: string | null;
    note: string | null;
    subtotal: number;
  }[];
}

export async function getCompanyOrders(
  companyId: string,
  outletId?: string
): Promise<OwnerOrderWithItems[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("orders")
    .select("*, order_items(*), outlets!inner(name), dining_tables!fk_orders_table(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (outletId) {
    query = query.eq("outlet_id", outletId);
  }

  const { data } = await query;

  return (
    (data as JsonLike[])?.map((o) => {
      const outlet = o.outlets as JsonLike;
      const table = o.dining_tables as JsonLike | null;
      return {
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
        table_id: (o.table_id as string) ?? null,
        table_name: (table?.name as string) ?? null,
        status: (o.status as OrderStatus) ?? "completed",
        payment_status: (o.payment_status as PaymentStatus) ?? "paid",
        reserved_until: o.reserved_until as string | null,
        pricing_tier_id: o.pricing_tier_id as string | null,
        split_bill: (o.split_bill as boolean) ?? false,
        discount_amount: Number(o.discount_amount ?? 0),
        taxes: o.taxes as AppliedTax[] | null,
        discounts: o.discounts as AppliedDiscount[] | null,
        created_at: o.created_at as string,
        outlet_id: o.outlet_id as string,
        outlet_name: (outlet?.name as string) ?? "",
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
      };
    }) ?? []
  );
}

// ============================================================
// Get single order by id (company-scoped, any outlet)
// ============================================================
export async function getCompanyOrderById(
  orderId: string,
  companyId: string
): Promise<OwnerOrderWithItems | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*), outlets!inner(name), dining_tables!fk_orders_table(name)")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!data) return null;
  const o = data as JsonLike;
  const outlet = o.outlets as JsonLike;
  const table = o.dining_tables as JsonLike | null;

  return {
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
    table_id: (o.table_id as string) ?? null,
    table_name: (table?.name as string) ?? null,
    status: (o.status as OrderStatus) ?? "completed",
    payment_status: (o.payment_status as PaymentStatus) ?? "paid",
    reserved_until: o.reserved_until as string | null,
    pricing_tier_id: o.pricing_tier_id as string | null,
    split_bill: (o.split_bill as boolean) ?? false,
    discount_amount: Number(o.discount_amount ?? 0),
    taxes: o.taxes as AppliedTax[] | null,
    discounts: o.discounts as AppliedDiscount[] | null,
    created_at: o.created_at as string,
    outlet_id: o.outlet_id as string,
    outlet_name: (outlet?.name as string) ?? "",
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
  };
}

// ============================================================
// PRICING TIERS — list across outlets (with outlet name)
// ============================================================
export interface PricingTierWithOutlet extends PricingTier {
  outlet_name: string;
}

export async function getCompanyPricingTiers(
  companyId: string,
  outletId?: string
): Promise<PricingTierWithOutlet[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("pricing_tiers")
    .select("*, outlets!inner(name)")
    .eq("company_id", companyId)
    .order("sort_order");

  if (outletId) {
    query = query.eq("outlet_id", outletId);
  }

  const { data } = await query;

  return (
    (data as JsonLike[])?.map((t) => {
      const outlet = t.outlets as JsonLike;
      return {
        id: t.id as string,
        company_id: t.company_id as string,
        outlet_id: t.outlet_id as string,
        name: t.name as string,
        slug: t.slug as string,
        is_active: t.is_active as boolean,
        sort_order: t.sort_order as number,
        outlet_name: (outlet?.name as string) ?? "",
      };
    }) ?? []
  );
}

export async function createCompanyPricingTier(params: {
  companyId: string;
  outletId: string;
  name: string;
  slug: string;
  sortOrder: number;
}): Promise<{ tier: { id: string } | null; error: string | null }> {
  const supabase = createAdminClient();
  const { companyId, outletId, name, slug, sortOrder } = params;

  if (!(await verifyOutletBelongsToCompany(outletId, companyId))) {
    return { tier: null, error: "Outlet tidak ditemukan" };
  }

  // Cek slug unik per outlet
  const { data: existing } = await supabase
    .from("pricing_tiers")
    .select("id")
    .eq("company_id", companyId)
    .eq("outlet_id", outletId)
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return { tier: null, error: "Slug sudah dipakai di outlet ini" };
  }

  const { data: tier, error } = await supabase
    .from("pricing_tiers")
    .insert({
      company_id: companyId,
      outlet_id: outletId,
      name,
      slug,
      is_active: true,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error || !tier) {
    return { tier: null, error: "Gagal membuat pricing tier" };
  }
  return { tier: { id: tier.id as string }, error: null };
}

export async function updateCompanyPricingTier(params: {
  tierId: string;
  companyId: string;
  name?: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const { tierId, companyId, name, slug, sortOrder, isActive } = params;

  // Verify ownership
  const { data: existing } = await supabase
    .from("pricing_tiers")
    .select("id, outlet_id, slug")
    .eq("id", tierId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!existing) return { error: "Pricing tier tidak ditemukan" };

  // Cek slug unik jika diubah
  if (slug && slug !== (existing as JsonLike).slug) {
    const { data: dup } = await supabase
      .from("pricing_tiers")
      .select("id")
      .eq("company_id", companyId)
      .eq("outlet_id", (existing as JsonLike).outlet_id as string)
      .eq("slug", slug)
      .neq("id", tierId)
      .maybeSingle();
    if (dup) return { error: "Slug sudah dipakai di outlet ini" };
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (slug !== undefined) updateData.slug = slug;
  if (sortOrder !== undefined) updateData.sort_order = sortOrder;
  if (isActive !== undefined) updateData.is_active = isActive;

  const { error } = await supabase
    .from("pricing_tiers")
    .update(updateData)
    .eq("id", tierId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal mengupdate pricing tier" };
  return { error: null };
}

export async function deleteCompanyPricingTier(
  tierId: string,
  companyId: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("pricing_tiers")
    .delete()
    .eq("id", tierId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal menghapus pricing tier" };
  return { error: null };
}

// ============================================================
// TAXES — list across outlets (with outlet name)
// ============================================================
export interface TaxWithOutlet extends Tax {
  outlet_name: string;
}

export async function getCompanyTaxes(
  companyId: string,
  outletId?: string
): Promise<TaxWithOutlet[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("taxes")
    .select("*, outlets!inner(name)")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });

  if (outletId) {
    query = query.eq("outlet_id", outletId);
  }

  const { data } = await query;

  return (
    (data as JsonLike[])?.map((t) => {
      const outlet = t.outlets as JsonLike;
      return {
        id: t.id as string,
        company_id: t.company_id as string,
        outlet_id: t.outlet_id as string,
        name: t.name as string,
        type: t.type as "percentage" | "fixed",
        value: Number(t.value),
        is_active: t.is_active as boolean,
        sort_order: t.sort_order as number,
        created_at: t.created_at as string,
        outlet_name: (outlet?.name as string) ?? "",
      };
    }) ?? []
  );
}

export async function createCompanyTax(params: {
  companyId: string;
  outletId: string;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  sortOrder: number;
}): Promise<{ tax: { id: string } | null; error: string | null }> {
  const supabase = createAdminClient();
  const { companyId, outletId, name, type, value, sortOrder } = params;

  if (!(await verifyOutletBelongsToCompany(outletId, companyId))) {
    return { tax: null, error: "Outlet tidak ditemukan" };
  }

  const { data: tax, error } = await supabase
    .from("taxes")
    .insert({
      company_id: companyId,
      outlet_id: outletId,
      name,
      type,
      value,
      is_active: true,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error || !tax) {
    return { tax: null, error: "Gagal membuat tax" };
  }
  return { tax: { id: tax.id as string }, error: null };
}

export async function updateCompanyTax(params: {
  taxId: string;
  companyId: string;
  name?: string;
  type?: "percentage" | "fixed";
  value?: number;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const { taxId, companyId, name, type, value, sortOrder, isActive } = params;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (type !== undefined) updateData.type = type;
  if (value !== undefined) updateData.value = value;
  if (sortOrder !== undefined) updateData.sort_order = sortOrder;
  if (isActive !== undefined) updateData.is_active = isActive;

  const { error } = await supabase
    .from("taxes")
    .update(updateData)
    .eq("id", taxId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal mengupdate tax" };
  return { error: null };
}

export async function deleteCompanyTax(
  taxId: string,
  companyId: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("taxes")
    .delete()
    .eq("id", taxId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal menghapus tax" };
  return { error: null };
}

// ============================================================
// DISCOUNTS — product & order discounts (with outlet name)
// ============================================================
export interface ProductDiscountWithOutlet extends ProductDiscount {
  outlet_name: string;
}
export interface OrderDiscountWithOutlet extends OrderDiscount {
  outlet_name: string;
}

export async function getCompanyProductDiscounts(
  companyId: string,
  outletId?: string
): Promise<ProductDiscountWithOutlet[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("product_discounts")
    .select("*, outlets!inner(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (outletId) {
    query = query.eq("outlet_id", outletId);
  }

  const { data } = await query;

  return (
    (data as JsonLike[])?.map((d) => {
      const outlet = d.outlets as JsonLike;
      return {
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
        outlet_name: (outlet?.name as string) ?? "",
      };
    }) ?? []
  );
}

export async function getCompanyOrderDiscounts(
  companyId: string,
  outletId?: string
): Promise<OrderDiscountWithOutlet[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("order_discounts")
    .select("*, outlets!inner(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (outletId) {
    query = query.eq("outlet_id", outletId);
  }

  const { data } = await query;

  return (
    (data as JsonLike[])?.map((d) => {
      const outlet = d.outlets as JsonLike;
      return {
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
        outlet_name: (outlet?.name as string) ?? "",
      };
    }) ?? []
  );
}

export async function createCompanyDiscount(params: {
  companyId: string;
  outletId: string;
  scope: "product" | "order";
  productId?: string;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  startDate: string;
  endDate: string;
}): Promise<{ discount: { id: string } | null; error: string | null }> {
  const supabase = createAdminClient();
  const { companyId, outletId, scope, productId, name, type, value, startDate, endDate } = params;

  if (!(await verifyOutletBelongsToCompany(outletId, companyId))) {
    return { discount: null, error: "Outlet tidak ditemukan" };
  }

  if (scope === "product") {
    if (!productId) return { discount: null, error: "Produk wajib dipilih" };
    // Verify product belongs to outlet
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("company_id", companyId)
      .eq("outlet_id", outletId)
      .maybeSingle();
    if (!product) return { discount: null, error: "Produk tidak ditemukan di outlet ini" };

    const { data: discount, error } = await supabase
      .from("product_discounts")
      .insert({
        company_id: companyId,
        outlet_id: outletId,
        product_id: productId,
        name,
        type,
        value,
        start_date: startDate,
        end_date: endDate,
        is_active: true,
      })
      .select("id")
      .single();

    if (error || !discount) return { discount: null, error: "Gagal membuat diskon" };
    return { discount: { id: discount.id as string }, error: null };
  } else {
    const { data: discount, error } = await supabase
      .from("order_discounts")
      .insert({
        company_id: companyId,
        outlet_id: outletId,
        name,
        type,
        value,
        start_date: startDate,
        end_date: endDate,
        is_active: true,
      })
      .select("id")
      .single();

    if (error || !discount) return { discount: null, error: "Gagal membuat diskon" };
    return { discount: { id: discount.id as string }, error: null };
  }
}

export async function updateCompanyDiscount(params: {
  discountId: string;
  companyId: string;
  scope: "product" | "order";
  name?: string;
  type?: "percentage" | "fixed";
  value?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  productId?: string;
}): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const { discountId, companyId, scope, name, type, value, startDate, endDate, isActive, productId } = params;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (type !== undefined) updateData.type = type;
  if (value !== undefined) updateData.value = value;
  if (startDate !== undefined) updateData.start_date = startDate;
  if (endDate !== undefined) updateData.end_date = endDate;
  if (isActive !== undefined) updateData.is_active = isActive;
  if (productId !== undefined && scope === "product") updateData.product_id = productId;

  const table = scope === "product" ? "product_discounts" : "order_discounts";
  const { error } = await supabase
    .from(table)
    .update(updateData)
    .eq("id", discountId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal mengupdate diskon" };
  return { error: null };
}

export async function deleteCompanyDiscount(
  discountId: string,
  companyId: string,
  scope: "product" | "order"
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const table = scope === "product" ? "product_discounts" : "order_discounts";

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", discountId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal menghapus diskon" };
  return { error: null };
}

// ============================================================
// PRODUCTS — list products for a specific outlet (for DiscountManager dropdown)
// ============================================================
export async function getOutletProducts(
  companyId: string,
  outletId: string
): Promise<ProductWithCategory[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name)")
    .eq("company_id", companyId)
    .eq("outlet_id", outletId)
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

// ============================================================
// CATEGORIES — scoped by company + outlet (admin client bypasses RLS)
// ============================================================
export async function getCompanyCategories(
  companyId: string,
  outletId: string
): Promise<Category[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("company_id", companyId)
    .eq("outlet_id", outletId)
    .order("sort_order");

  return (data as JsonLike[])?.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    sort_order: c.sort_order as number,
  })) ?? [];
}

// ============================================================
// PRICING TIERS — scoped by company + outlet (for server-side fetch)
// Returns plain PricingTier[] (consistent with POS pattern)
// ============================================================
export async function getCompanyPricingTiersSimple(
  companyId: string,
  outletId: string
): Promise<PricingTier[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("pricing_tiers")
    .select("*")
    .eq("company_id", companyId)
    .eq("outlet_id", outletId)
    .order("sort_order");

  return (data as JsonLike[])?.map((t) => ({
    id: t.id as string,
    company_id: t.company_id as string,
    outlet_id: t.outlet_id as string,
    name: t.name as string,
    slug: t.slug as string,
    is_active: t.is_active as boolean,
    sort_order: t.sort_order as number,
  })) ?? [];
}

// ============================================================
// PRODUCT — single product by ID (scoped by company)
// ============================================================
export async function getCompanyProductById(
  companyId: string,
  productId: string
): Promise<(Product & { image_url: string | null; description: string | null }) | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, price, category_id, image_url, is_active, description")
    .eq("id", productId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!data) return null;
  const p = data as JsonLike;
  return {
    id: p.id as string,
    name: p.name as string,
    price: Number(p.price),
    category_id: p.category_id as string,
    image_url: p.image_url as string | null,
    is_active: p.is_active as boolean,
    description: p.description as string | null,
  };
}

// ============================================================
// MODIFIERS — for a product (scoped by company via products join)
// ============================================================
export async function getProductModifiers(
  companyId: string,
  productId: string
): Promise<(Modifier & { tier_prices?: ModifierTierPrice[] })[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("modifiers")
    .select("*, modifier_tier_prices(*), products!inner(company_id)")
    .eq("product_id", productId)
    .eq("products.company_id", companyId)
    .order("name");

  return (data as JsonLike[])?.map((m) => ({
    id: m.id as string,
    product_id: m.product_id as string,
    name: m.name as string,
    price_delta: m.price_delta as number | undefined,
    group_name: m.group_name as string | null,
    tier_prices: ((m.modifier_tier_prices as JsonLike[]) ?? []).map((tp) => ({
      id: tp.id as string,
      modifier_id: tp.modifier_id as string,
      tier_id: tp.tier_id as string,
      price_delta: Number(tp.price_delta),
    })),
  })) ?? [];
}

// ============================================================
// PRODUCT TIER PRICES — for a product
// ============================================================
export async function getProductTierPricesByProduct(
  productId: string
): Promise<ProductTierPrice[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("product_tier_prices")
    .select("*")
    .eq("product_id", productId);

  return (data as JsonLike[])?.map((p) => ({
    id: p.id as string,
    product_id: p.product_id as string,
    tier_id: p.tier_id as string,
    price: Number(p.price),
  })) ?? [];
}

// ============================================================
// INGREDIENTS — for a company+outlet
// ============================================================
export async function getCompanyIngredients(
  companyId: string,
  outletId: string
): Promise<Ingredient[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ingredients")
    .select("*")
    .eq("company_id", companyId)
    .eq("outlet_id", outletId)
    .order("name", { ascending: true });

  return (data as JsonLike[])?.map((i) => ({
    id: i.id as string,
    company_id: i.company_id as string,
    outlet_id: i.outlet_id as string,
    name: i.name as string,
    unit: i.unit as Ingredient["unit"],
    stock_quantity: Number(i.stock_quantity),
    min_stock_alert: Number(i.min_stock_alert),
    cost_per_unit: Number(i.cost_per_unit),
    is_active: i.is_active as boolean,
    created_at: i.created_at as string,
    updated_at: i.updated_at as string,
  })) ?? [];
}

// ============================================================
// RECIPES — for a product (scoped by company via products join)
// ============================================================
export async function getProductRecipes(
  companyId: string,
  productId: string
): Promise<
  {
    id: string;
    product_id: string;
    ingredient_id: string;
    quantity_used: number;
    created_at: string;
    ingredient_name: string;
    ingredient_unit: Ingredient["unit"];
  }[]
> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("product_recipes")
    .select("*, ingredients(name, unit), products!inner(company_id)")
    .eq("product_id", productId)
    .eq("products.company_id", companyId);

  return (data as JsonLike[])?.map((r) => ({
    id: r.id as string,
    product_id: r.product_id as string,
    ingredient_id: r.ingredient_id as string,
    quantity_used: Number(r.quantity_used),
    created_at: r.created_at as string,
    ingredient_name: ((r.ingredients as JsonLike)?.name as string) ?? "",
    ingredient_unit:
      (((r.ingredients as JsonLike)?.unit as Ingredient["unit"]) ?? "pcs"),
  })) ?? [];
}
