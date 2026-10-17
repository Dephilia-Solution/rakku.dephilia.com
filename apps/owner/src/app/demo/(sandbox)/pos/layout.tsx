import { DemoArea } from "@/components/demo/DemoArea";

export default function PosDemoLayout({ children }: { children: React.ReactNode }) {
  return <div className="demo-pos"><DemoArea app="pos">{children}</DemoArea></div>;
}
