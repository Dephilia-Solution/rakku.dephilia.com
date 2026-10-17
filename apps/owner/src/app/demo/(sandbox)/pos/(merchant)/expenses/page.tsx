"use client";
import Expenses from "@pos/app/(dashboard)/expenses/ExpensesClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { return <Expenses expenses={useDemoView().expenses} />; }
