"use client";
import Purchases from "@pos/app/(dashboard)/purchases/PurchasesClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { return <Purchases purchases={useDemoView().purchases} />; }
