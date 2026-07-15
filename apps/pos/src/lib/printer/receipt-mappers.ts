import { formatDate } from "@/lib/dummy-data";
import { AppliedTax, AppliedDiscount } from "@rakku/shared-types";
import { ReceiptData, ReceiptItem } from "./types";

interface OrderRow {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  modifier_label: string | null;
  note: string | null;
  subtotal: number;
}

interface OrderDataShape {
  order_number: number;
  order_type: string;
  payment_method: string;
  subtotal: number;
  total_price: number;
  customer_name: string;
  cashier_name: string | null;
  created_at: string;
  order_items: OrderRow[];
  taxes: AppliedTax[] | null;
  discounts: AppliedDiscount[] | null;
}

export function orderToReceiptData(order: OrderDataShape): ReceiptData {
  const items: ReceiptItem[] = order.order_items.map((it) => ({
    product_name: it.product_name,
    quantity: it.quantity,
    unit_price: it.unit_price,
    subtotal: it.subtotal,
    modifier_label: it.modifier_label,
    note: it.note,
  }));

  return {
    orderNumber: order.order_number,
    customerName: order.customer_name,
    cashierName: order.cashier_name,
    items,
    subtotal: order.subtotal,
    appliedTaxes: order.taxes ?? [],
    appliedDiscounts: order.discounts ?? [],
    total: order.total_price,
    paymentMethod: order.payment_method,
    orderType: order.order_type,
    createdAt: formatDate(order.created_at),
  };
}
