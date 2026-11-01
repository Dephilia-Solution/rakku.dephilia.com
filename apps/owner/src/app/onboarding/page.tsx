import Form from "@/components/auth/onboarding-form";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page() { const session = await getOwnerSessionFromCookies(); if (!session) redirect("/login"); if (session.company_id) redirect("/"); return <Form />; }
