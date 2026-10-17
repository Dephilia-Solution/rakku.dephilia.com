"use client";
import Balance from "@/components/billing/BalanceClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { const view = useDemoView(); return view.balance ? <Balance balance={view.balance} transactions={view.transactions} bankAccounts={view.banks} withdrawals={view.withdrawals} /> : null; }
