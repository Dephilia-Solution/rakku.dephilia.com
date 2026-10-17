"use client";
import Products from "@/app/(dashboard)/products/OwnerProductsClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { const view = useDemoView(); return <Products outlets={view.outlets} />; }
