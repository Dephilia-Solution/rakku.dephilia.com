"use client";
import Tables from "@/app/(dashboard)/tables/TablesClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { const view = useDemoView(); return <Tables outlets={view.outlets} />; }
