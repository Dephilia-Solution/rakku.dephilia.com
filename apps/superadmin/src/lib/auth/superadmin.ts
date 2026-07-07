import { createClient } from "@rakku/supabase-clients/server";

export async function requireSuperadmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data?.user) {
    throw new Error("UNAUTHORIZED");
  }

  return data.user;
}
