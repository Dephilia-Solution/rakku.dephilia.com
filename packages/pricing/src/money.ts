export interface Rule { name: string; type: "percentage" | "fixed"; value: number; }
export interface AppliedRule extends Rule { amount: number; }
export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function discountFor(amount: number, rule: Rule) {
  if (!Number.isFinite(rule.value) || rule.value < 0 || (rule.type === "percentage" && rule.value > 100)) throw new Error("Diskon tidak valid");
  return Math.min(amount, money(rule.type === "percentage" ? amount * rule.value / 100 : rule.value));
}
export function calculateTotals(items: { unit_price: number; quantity: number; subtotal: number; discount?: Rule | null }[], taxes: Rule[], orderDiscount: Rule | null) {
  const subtotal = money(items.reduce((sum, i) => sum + i.subtotal, 0));
  const appliedDiscounts: AppliedRule[] = [];
  for (const item of items) if (item.discount) {
    const amount = money(item.unit_price * item.quantity - item.subtotal);
    const existing = appliedDiscounts.find(d => d.name === item.discount!.name);
    if (existing) existing.amount = money(existing.amount + amount);
    else appliedDiscounts.push({ name: item.discount.name, type: "fixed", value: 0, amount });
  }
  const totalProductDiscount = money(appliedDiscounts.reduce((sum, d) => sum + d.amount, 0));
  const orderDiscountAmount = orderDiscount ? discountFor(subtotal, orderDiscount) : 0;
  const discounted = money(subtotal - orderDiscountAmount);
  if (orderDiscount && orderDiscountAmount) appliedDiscounts.push({ ...orderDiscount, amount: orderDiscountAmount });
  const appliedTaxes = taxes.map(tax => {
    if (!Number.isFinite(tax.value) || tax.value < 0) throw new Error("Pajak tidak valid");
    return { ...tax, amount: money(tax.type === "percentage" ? discounted * tax.value / 100 : tax.value) };
  });
  const totalTaxAmount = money(appliedTaxes.reduce((sum, t) => sum + t.amount, 0));
  // QRIS and cash use whole rupiah. Preserve the rounding adjustment in the order.
  const beforeRounding = money(discounted + totalTaxAmount);
  const total = Math.round(beforeRounding);
  return { subtotal, totalProductDiscount, appliedDiscounts, appliedTaxes, totalTaxAmount,
    orderDiscount: orderDiscount ? { ...orderDiscount, amount: orderDiscountAmount } : null,
    roundingAmount: money(total - beforeRounding), total, itemCount: items.reduce((sum, i) => sum + i.quantity, 0) };
}
