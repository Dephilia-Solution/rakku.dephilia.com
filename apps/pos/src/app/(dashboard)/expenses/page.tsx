import { getAllExpenses } from "@/lib/supabase/queries.server";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage() {
  const expenses = await getAllExpenses();

  return <ExpensesClient expenses={expenses} />;
}
