"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

import { CloseIcon, MenuIcon } from "./icons";

type MobileMenuProps = {
  links: ReadonlyArray<readonly [string, string]>;
  ownerUrl: string;
};

const panel: Variants = {
  hidden: { opacity: 0, y: -6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: "easeOut", staggerChildren: 0.035 },
  },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12, ease: "easeIn" } },
};

const item: Variants = {
  hidden: { opacity: 0, x: 6 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.16, ease: "easeOut" } },
};

export function MobileMenu({ links, ownerUrl }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function closeMenu() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="relative lg:hidden">
      <motion.button
        ref={triggerRef}
        type="button"
        className="flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-md border border-brand text-green-950 transition-colors hover:bg-paper-deep active:scale-95"
        aria-expanded={open}
        aria-controls="landing-mobile-menu"
        aria-label={open ? "Tutup menu" : "Buka menu"}
        onClick={() => setOpen((current) => !current)}
        whileTap={{ scale: 0.95 }}
      >
        {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
      </motion.button>
      <AnimatePresence>
        {open ? (
          <motion.nav
            id="landing-mobile-menu"
            key="panel"
            aria-label="Navigasi mobile"
            variants={panel}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(18rem,calc(100vw-2rem))] origin-top-right rounded-md border border-brand bg-ivory p-2 shadow-card"
          >
            {links.map(([label, href]) => (
              <motion.a key={href} href={href} onClick={closeMenu} variants={item} className="flex min-h-12 items-center rounded px-3 text-sm font-semibold text-green-950 transition-colors hover:bg-paper-deep active:bg-paper-deep">
                {label}
              </motion.a>
            ))}
            <motion.div variants={item} className="my-1 border-t border-brand" />
            <motion.a href={`${ownerUrl}/login`} onClick={closeMenu} variants={item} className="flex min-h-12 items-center rounded px-3 text-sm font-semibold text-green-800 transition-colors hover:bg-paper-deep active:bg-paper-deep">
              Masuk ke portal owner
            </motion.a>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
