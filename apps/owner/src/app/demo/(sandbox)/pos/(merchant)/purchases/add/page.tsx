"use client";
import PurchaseForm from "@pos/app/(dashboard)/purchases/add/AddPurchaseForm";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { return <PurchaseForm ingredients={useDemoView().ingredients} />; }
