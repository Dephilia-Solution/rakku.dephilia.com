"use client";
import { usePathname } from "next/navigation";
import { SessionBoundary } from "@rakku/ui";
export default function SessionGuard() { return <SessionBoundary app="owner" pathname={usePathname()} />; }
