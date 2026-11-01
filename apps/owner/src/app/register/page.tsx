import Form from "@/components/auth/register-form";
import { requireOwnerGuest } from "@/lib/auth/guest";
export const dynamic = "force-dynamic";
export default async function Page() { await requireOwnerGuest(); return <Form />; }
