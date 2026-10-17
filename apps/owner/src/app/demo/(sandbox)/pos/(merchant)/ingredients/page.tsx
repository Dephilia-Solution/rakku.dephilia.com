"use client";
import Ingredients from "@pos/app/(dashboard)/ingredients/IngredientsClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { return <Ingredients ingredients={useDemoView().ingredients} />; }
