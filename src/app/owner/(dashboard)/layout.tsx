import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@/lib/supabase/admin";
import OwnerSidebar from "@/components/owner/OwnerSidebar";
import ToastContainer from "@/components/shared/Toast";

export default async function OwnerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOwnerSessionFromCookies();

  if (!session) {
    redirect("/owner/masuk");
  }

  // Pastikan owner sudah punya company
  const supabase = createAdminClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, code, logo_url")
    .eq("owner_id", session.owner_id)
    .maybeSingle();

  if (!company) {
    redirect("/owner/onboarding");
  }

  const ownerData = {
    name: session.name,
    email: session.email,
    companyName: company.name,
    companyCode: company.code,
  };

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <OwnerSidebar owner={ownerData} />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8">{children}</main>
      <ToastContainer />
    </div>
  );
}
