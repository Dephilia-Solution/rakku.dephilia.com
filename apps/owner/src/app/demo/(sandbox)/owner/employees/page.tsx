"use client";

import { useEffect } from "react";
import { useRouter } from "@/lib/merchant-runtime";

export default function Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/outlets?tab=tim");
  }, [router]);
  return null;
}
