"use client";

import { Children, type PropsWithChildren } from "react";
import { MotionConfig, motion, type HTMLMotionProps, type Variants } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const SPRING_LIFT = { type: "spring", stiffness: 320, damping: 24, mass: 0.6 } as const;
const SPRING_BUTTON = { type: "spring", stiffness: 520, damping: 32, mass: 0.4 } as const;

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

export function MotionProvider({ children }: PropsWithChildren) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

type StaggerProps = HTMLMotionProps<"div">;

export function Stagger({ children, className = "", ...props }: StaggerProps) {
  return (
    <motion.div
      {...props}
      className={className}
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1, margin: "0px 0px -8% 0px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = "", ...props }: StaggerProps) {
  return (
    <motion.div {...props} className={className} variants={fadeRise}>
      {children}
    </motion.div>
  );
}

type ButtonLinkProps = HTMLMotionProps<"a">;

export function ButtonLink({ children, className = "", ...props }: ButtonLinkProps) {
  return (
    <motion.a
      {...props}
      className={`landing-button ${className}`}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING_BUTTON}
    >
      {children}
    </motion.a>
  );
}

type HeroCopyProps = PropsWithChildren<{ className?: string }>;

export function HeroCopy({ children, className = "" }: HeroCopyProps) {
  return (
    <motion.div className={className} variants={stagger} initial="hidden" animate="visible" transition={{ delayChildren: 0.05 }}>
      {Children.map(children, (child, index) => (
        <motion.div key={index} variants={fadeRise}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export function HeroVisual({ children, className = "" }: HeroCopyProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.12 }}
    >
      {children}
    </motion.div>
  );
}

export function Lift({ children, className = "" }: HeroCopyProps) {
  return (
    <motion.div className={className} whileHover={{ y: -4 }} transition={SPRING_LIFT}>
      {children}
    </motion.div>
  );
}