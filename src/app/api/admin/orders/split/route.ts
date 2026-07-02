import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { orderId, splitPayments } = body;

  if (!orderId || !splitPayments?.length) {
    return NextResponse.json({ error: "Data split bayar tidak lengkap" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const inserts = splitPayments.map((sp: { amount: number; payment_method: string; customer_name?: string }) => ({
    order_id: orderId,
    amount: sp.amount,
    payment_method: sp.payment_method,
    status: "paid",
    customer_name: sp.customer_name || null,
  }));

  const { data, error } = await supabase
    .from("split_payments")
    .insert(inserts)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("orders")
    .update({ split_bill: true })
    .eq("id", orderId);

  return NextResponse.json(data, { status: 201 });
}
