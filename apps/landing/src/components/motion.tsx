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

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const SPRING_BUTTON = { type: "spring", stiffness: 520, damping: 32, mass: 0.4 } as const;

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
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
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`sticky top-0 z-50 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled
          ? "border-green-950/20 bg-paper/95 shadow-[0_8px_24px_rgba(24,49,38,0.06)]"
          : "border-green-950/10 bg-paper/85"
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

type ButtonLinkProps = HTMLMotionProps<"a">;

export function ButtonLink({ children, className = "", ...props }: ButtonLinkProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.a
      {...props}
      className={`landing-button ${className}`}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={SPRING_BUTTON}
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
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.65, ease: EASE, delay: 0.12 }}
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
      whileHover={reduceMotion ? undefined : { x: 4 }}
      whileTap={reduceMotion ? undefined : { x: 2 }}
      transition={{ duration: 0.22, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function Lift({ children, className = "" }: HeroCopyProps) {
  return <motion.div className={className}>{children}</motion.div>;
}
