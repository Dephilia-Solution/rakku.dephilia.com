"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useEntrance } from "./use-entrance";

type ScrollRevealProps = ComponentPropsWithoutRef<"section"> & {reveal?: "section" | "heading"};

export function ScrollReveal({ children, className = "", reveal = "section", ...props }: ScrollRevealProps) {
  const ref = useEntrance<HTMLElement>({selector: reveal === "heading" ? "[data-reveal-heading]" : ":scope > .landing-container", name: "section"});
  return (
    <section
      {...props}
      ref={ref}
      className={className}
    >
      {children}
    </section>
  );
}
