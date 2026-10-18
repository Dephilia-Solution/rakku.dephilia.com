import Form from "@pos/components/auth/SelectOutlet";
import { requireLoginStage } from "@/lib/auth/stage";
export default async function Page() { await requireLoginStage("outlet"); return <Form />; }
