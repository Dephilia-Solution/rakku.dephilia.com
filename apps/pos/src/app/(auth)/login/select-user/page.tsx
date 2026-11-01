import Form from "@pos/components/auth/SelectUser";
import { requireLoginStage } from "@/lib/auth/stage";
export default async function Page() { await requireLoginStage("user"); return <Form />; }
