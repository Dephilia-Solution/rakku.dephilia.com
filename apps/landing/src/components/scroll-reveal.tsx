"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type ScrollRevealProps = HTMLMotionProps<"section">;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function ScrollReveal({ children, className = "", ...props }: ScrollRevealProps) {
  return (
    <motion.section
      {...props}
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      {children}
    </motion.section>
  );
}