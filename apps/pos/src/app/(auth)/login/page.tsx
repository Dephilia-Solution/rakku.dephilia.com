import Form from "@pos/components/auth/CompanyLogin";
import { requireLoginStage } from "@/lib/auth/stage";
export default async function Page() { await requireLoginStage("company"); return <Form />; }
