"use client";
import Tables from "@pos/app/(dashboard)/tables/TablesClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { return <Tables tables={useDemoView().tables} />; }
