import { notFound } from "next/navigation";
import { createDemoSandbox, DEMO_IDS } from "@rakku/demo";
import PublicMenuView from "@pos/components/menu/PublicMenuView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DemoMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const id = (await params).slug === "pusat" ? DEMO_IDS.pusat : (await params).slug === "taman" ? DEMO_IDS.taman : null;
  if (!id) notFound();
  const sandbox = createDemoSandbox();
  const menu = sandbox.publicMenu(id);
  sandbox.destroy();
  return <PublicMenuView menu={menu} />;
}
