import Form from "@/components/auth/reset-password-form";
import { getAuthorizedUser } from "@/lib/auth/require-superadmin";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page() { if (await getAuthorizedUser()) redirect("/companies"); return <Form />; }
