import type { ComponentPropsWithoutRef } from "react";

type ScrollRevealProps = ComponentPropsWithoutRef<"section">;

export function ScrollReveal({ children, className = "", ...props }: ScrollRevealProps) {
  return (
    <section
      {...props}
      className={className}
    >
      {children}
    </section>
  );
}
