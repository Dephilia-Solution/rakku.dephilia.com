"use client";
import Reports from "@/app/(dashboard)/reports/ReportsClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { const view = useDemoView(); return <Reports outlets={view.outlets} companyName={view.company.name} />; }
