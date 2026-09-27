"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";

import { CloseIcon, MenuIcon } from "./icons";

type MobileMenuProps = {
  links: ReadonlyArray<readonly [string, string]>;
  ownerUrl: string;
};

const MENU_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const panel: Variants = {
  hidden: { opacity: 0, y: -6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: MENU_EASE, staggerChildren: 0.04 },
  },
  exit: { opacity: 0, y: -6, transition: { duration: 0.14, ease: MENU_EASE } },
};

const item: Variants = {
  hidden: { opacity: 0, x: 6 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: MENU_EASE } },
};

export function MobileMenu({ links, ownerUrl }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [],
    );
    focusable[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || focusable.length < 2) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="relative lg:hidden">
      <motion.button
        ref={triggerRef}
        type="button"
        className="flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-md border border-brand text-green-950 transition-colors hover:bg-paper-deep"
        aria-expanded={open}
        aria-controls="landing-mobile-menu"
        aria-label={open ? "Tutup menu" : "Buka menu"}
        onClick={() => setOpen((current) => !current)}
        whileHover={reduceMotion ? undefined : { scale: 1.02 }}
        whileTap={reduceMotion ? undefined : { scale: 0.95 }}
        transition={{ duration: 0.16, ease: MENU_EASE }}
      >
        {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
      </motion.button>
      <AnimatePresence>
        {open ? (
          <motion.nav
            id="landing-mobile-menu"
            key="panel"
            ref={panelRef}
            aria-label="Navigasi mobile"
            variants={panel}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(18rem,calc(100vw-2rem))] origin-top-right rounded-md border border-brand bg-ivory p-2 shadow-card"
          >
            {links.map(([label, href]) => (
              <motion.a key={href} href={href} onClick={closeMenu} variants={item} whileHover={reduceMotion ? undefined : { x: 3 }} whileTap={reduceMotion ? undefined : { x: 1, scale: 0.99 }} transition={{ duration: 0.16, ease: MENU_EASE }} className="flex min-h-12 items-center rounded px-3 text-sm font-semibold text-green-950 transition-colors hover:bg-paper-deep active:bg-paper-deep">
                {label}
              </motion.a>
            ))}
            <motion.div variants={item} className="my-1 border-t border-brand" />
            <motion.a href={`${ownerUrl}/login`} onClick={closeMenu} variants={item} whileHover={reduceMotion ? undefined : { x: 3 }} whileTap={reduceMotion ? undefined : { x: 1, scale: 0.99 }} transition={{ duration: 0.16, ease: MENU_EASE }} className="flex min-h-12 items-center rounded px-3 text-sm font-semibold text-green-800 transition-colors hover:bg-paper-deep active:bg-paper-deep">
              Masuk ke portal owner
            </motion.a>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
