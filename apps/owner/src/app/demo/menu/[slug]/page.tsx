import { notFound } from "next/navigation";
import { createDemoSandbox, DEMO_IDS } from "@rakku/demo";
import PublicMenuView from "@pos/components/menu/PublicMenuView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DemoMenuPage({ params }: { params: { slug: string } }) {
  const id = params.slug === "pusat" ? DEMO_IDS.pusat : params.slug === "taman" ? DEMO_IDS.taman : null;
  if (!id) notFound();
  const sandbox = createDemoSandbox();
  const menu = sandbox.publicMenu(id);
  sandbox.destroy();
  return <PublicMenuView menu={menu} />;
}
