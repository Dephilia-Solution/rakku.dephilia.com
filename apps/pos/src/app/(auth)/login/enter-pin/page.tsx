import Form from "@pos/components/auth/EnterPin";
import { requireLoginStage } from "@/lib/auth/stage";
export default async function Page({ searchParams }: { searchParams: Promise<{ user_id?: string }> }) {
  await requireLoginStage("pin", (await searchParams).user_id); return <Form />;
}
