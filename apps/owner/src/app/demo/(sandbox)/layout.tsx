import { DemoProvider } from "@/components/demo/DemoProvider";

export default function SandboxLayout({ children }: { children: React.ReactNode }) {
  return <DemoProvider>{children}</DemoProvider>;
}
