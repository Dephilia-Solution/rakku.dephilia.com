import { redirect } from "next/navigation";
import { createClient } from "@rakku/supabase-clients/server";

export default async function SuperadminRoot() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data?.user) {
    redirect("/login");
  }

  redirect("/companies");
}
