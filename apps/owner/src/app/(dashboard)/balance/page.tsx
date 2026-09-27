import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { getBalance, listBalanceTransactions } from "@rakku/ledger";
import BalanceClient from "@/components/billing/BalanceClient";
import type { MerchantBankAccount, Withdrawal } from "@rakku/shared-types";

export default async function BalancePage() {
  const session = await getOwnerSessionFromCookies();
  if (!session) redirect("/login");
  if (!session.company_id) redirect("/onboarding");

  const supabase = createAdminClient();
  const [balance, transactions, bankAccountsResult, withdrawalsResult] =
    await Promise.all([
      getBalance(supabase, session.company_id),
      listBalanceTransactions(supabase, session.company_id, { limit: 20 }),
      supabase
        .from("merchant_bank_accounts")
        .select("*")
        .eq("company_id", session.company_id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("withdrawals")
        .select("*")
        .eq("company_id", session.company_id)
        .order("requested_at", { ascending: false })
        .limit(20),
    ]);

  return (
    <BalanceClient
      balance={balance}
      transactions={transactions}
      bankAccounts={(bankAccountsResult.data ?? []) as MerchantBankAccount[]}
      withdrawals={(withdrawalsResult.data ?? []) as Withdrawal[]}
    />
  );
}
