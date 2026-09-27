"use client";

import { Children, useState, type PropsWithChildren } from "react";
import {
  MotionConfig,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.52, ease: EASE } },
};

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

export function MotionProvider({ children }: PropsWithChildren) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

type HeaderFrameProps = PropsWithChildren<{ className?: string }>;

export function HeaderFrame({ children, className = "" }: HeaderFrameProps) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useReducedMotion();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const next = latest > 12;
    setScrolled((current) => (current === next ? current : next));
  });

  return (
    <motion.header
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{
        opacity: 1,
        y: 0,
        backgroundColor: scrolled ? "rgba(243, 239, 230, 0.95)" : "rgba(243, 239, 230, 0.85)",
        boxShadow: scrolled ? "0 8px 24px rgba(24, 49, 38, 0.06)" : "0 0 0 rgba(24, 49, 38, 0)",
      }}
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: EASE }}
      className={`sticky top-0 z-50 border-b bg-paper/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl ${
        scrolled
          ? "border-green-950/20"
          : "border-green-950/10"
      } ${className}`}
    >
      {children}
    </motion.header>
  );
}

type StaggerProps = HTMLMotionProps<"div">;

export function Stagger({ children, className = "", ...props }: StaggerProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      {...props}
      className={className}
      variants={stagger}
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.25, margin: "0px 0px -8% 0px" }}
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

type MotionLinkProps = HTMLMotionProps<"a">;

export function MotionLink({ children, className = "", ...props }: MotionLinkProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.a
      {...props}
      className={className}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { y: 1, scale: 0.985 }}
      transition={{ duration: 0.18, ease: EASE }}
    >
      {children}
    </motion.a>
  );
}

type ButtonLinkProps = MotionLinkProps;

export function ButtonLink({ children, className = "", ...props }: ButtonLinkProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.a
      {...props}
      className={`landing-button ${className}`}
      whileHover={reduceMotion ? undefined : { y: -1, scale: 1.015 }}
      whileTap={reduceMotion ? undefined : { y: 1, scale: 0.98 }}
      transition={{ duration: 0.18, ease: EASE }}
    >
      {children}
    </motion.a>
  );
}

type HeroCopyProps = PropsWithChildren<{ className?: string }>;

export function HeroCopy({ children, className = "" }: HeroCopyProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={stagger}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      transition={{ delayChildren: 0.05 }}
    >
      {Children.map(children, (child, index) => (
        <motion.div key={index} variants={fadeRise}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export function HeroVisual({ children, className = "" }: HeroCopyProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.16 }}
    >
      {children}
    </motion.div>
  );
}

type InteractiveRowProps = PropsWithChildren<{ className?: string }>;

export function InteractiveRow({ children, className = "" }: InteractiveRowProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { y: 1 }}
      transition={{ duration: 0.2, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function Lift({ children, className = "" }: HeroCopyProps) {
  return <motion.div className={className}>{children}</motion.div>;
}
