"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

type EntranceOptions = {
  selector: string;
  name: string;
  distance?: number;
  duration?: number;
  stagger?: number;
  opacity?: number;
};

/** Progressive enhancement: server HTML is always visible. Only a finite,
 * first-entrance animation is added after hydration; no scroll-frame state. */
export function useEntrance<T extends HTMLElement>({ selector, name, distance = 14, duration = 520, stagger = 0, opacity = .72 }: EntranceOptions) {
  const ref = useRef<T>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion !== false || !ref.current || !window.IntersectionObserver || !Element.prototype.animate) return;
    const targets = [...ref.current.querySelectorAll<HTMLElement>(selector)];
    const seen = new WeakSet<Element>();
    const animations = new Set<Animation>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || seen.has(entry.target)) continue;
        seen.add(entry.target); observer.unobserve(entry.target);
        const target = entry.target as HTMLElement;
        // Avoid moving a keyboard target or replaying content above a restored
        // scroll position. The document remains usable if effects never run.
        if (target.matches(":focus-within") || entry.boundingClientRect.bottom < 0) continue;
        const delay = Math.min(targets.indexOf(target) * stagger, 160);
        const animation = target.animate([
          {opacity, transform: `translate3d(0,${distance}px,0)`},
          {opacity: 1, transform: "translate3d(0,0,0)"},
        ], {id: `landing:${name}`, duration, delay, easing: "cubic-bezier(.16,1,.3,1)", fill: "none"});
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      }
    }, {threshold: .08, rootMargin: "0px 0px -24px 0px"});
    targets.forEach(target => observer.observe(target));
    return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); };
  }, [selector, name, distance, duration, stagger, opacity, reduceMotion]);

  return ref;
}
