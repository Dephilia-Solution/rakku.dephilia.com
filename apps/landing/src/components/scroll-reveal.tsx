"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

type ScrollRevealProps = HTMLMotionProps<"section">;

export function ScrollReveal({ children, className = "", ...props }: ScrollRevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      {...props}
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}
