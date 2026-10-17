import { DemoArea } from "@/components/demo/DemoArea";
import DemoOwnerShell from "@/components/demo/DemoOwnerShell";

export default function OwnerDemoLayout({ children }: { children: React.ReactNode }) {
  return <DemoArea app="owner"><DemoOwnerShell>{children}</DemoOwnerShell></DemoArea>;
}
