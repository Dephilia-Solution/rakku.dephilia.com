"use client";

import { useRef, useState, type PropsWithChildren } from "react";
import { MotionConfig, motion, useMotionValueEvent, useScroll, type HTMLMotionProps } from "framer-motion";
import { useEntrance } from "./use-entrance";

export function MotionProvider({ children }: PropsWithChildren) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

type HeaderFrameProps = PropsWithChildren<{ className?: string }>;

export function HeaderFrame({ children, className = "" }: HeaderFrameProps) {
  const { scrollY, scrollYProgress } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const threshold = useRef(false);

  useMotionValueEvent(scrollY, "change", latest => {
    const next = latest > 12;
    if (next !== threshold.current) { threshold.current = next; setScrolled(next); }
  });

  return <header data-scrolled={scrolled} className={`landing-header sticky top-0 z-50 border-b border-green-950/10 bg-paper/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl ${className}`}>
    {children}
    <motion.div aria-hidden="true" className="landing-reading-progress pointer-events-none absolute inset-x-0 bottom-[-1px] h-px origin-left bg-green-700/65" style={{scaleX: scrollYProgress}} />
  </header>;
}

type StaggerProps = HTMLMotionProps<"div">;

export function Stagger({ children, className = "", ...props }: StaggerProps) {
  const ref = useEntrance<HTMLDivElement>({selector: ":scope > [data-motion-item]", name: "stagger", distance: 18, duration: 560, stagger: 65, opacity: .68});
  return <motion.div {...props} ref={ref} className={className} data-motion-stagger>{children}</motion.div>;
}

export function StaggerItem({ children, className = "", ...props }: StaggerProps) {
  return <motion.div {...props} className={className} data-motion-item>{children}</motion.div>;
}

type MotionLinkProps = HTMLMotionProps<"a">;

export function MotionLink({ children, className = "", ...props }: MotionLinkProps) {
  return <motion.a {...props} className={className}>{children}</motion.a>;
}

export function ButtonLink({ children, className = "", ...props }: MotionLinkProps) {
  // CSS owns hover/press transforms, avoiding competing Framer + CSS transforms.
  return <motion.a {...props} className={`landing-button ${className}`}>{children}</motion.a>;
}

type HeroCopyProps = PropsWithChildren<{ className?: string }>;

export function HeroCopy({ children, className = "" }: HeroCopyProps) {
  const ref = useEntrance<HTMLDivElement>({selector: ":scope > :not(h1):not(aside)", name: "hero-copy", distance: 8, duration: 440, stagger: 45, opacity: 1});
  // The headline is never hidden or delayed: preserve first-paint readability/LCP.
  return <div ref={ref} className={`${className} space-y-6`}>{children}</div>;
}

export function HeroVisual({ children, className = "" }: HeroCopyProps) {
  const ref = useEntrance<HTMLDivElement>({selector: ":scope > *", name: "hero-visual", distance: 20, duration: 650, opacity: 1});
  return <div ref={ref} className={className}>{children}</div>;
}

export function InteractiveRow({ children, className = "" }: HeroCopyProps) {
  return <div className={`landing-interactive-row ${className}`}>{children}</div>;
}

export function Lift({ children, className = "" }: HeroCopyProps) {
  return <div className={`landing-lift ${className}`}>{children}</div>;
}
