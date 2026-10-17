"use client";
import Register from "@pos/components/register/RegisterView";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { const view = useDemoView(); return <Register {...view.register} />; }
