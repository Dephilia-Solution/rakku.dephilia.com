"use client";

import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

import { CloseIcon, MenuIcon } from "./icons";

type MobileMenuProps = {
  links: ReadonlyArray<readonly [string, string]>;
  ownerUrl: string;
};

const panel: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 30, staggerChildren: 0.05, delayChildren: 0.05 },
  },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.16, ease: "easeIn" } },
};

const item: Variants = {
  hidden: { opacity: 0, x: 10 },
  visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 420, damping: 32 } },
};

export function MobileMenu({ links, ownerUrl }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="relative md:hidden">
      <motion.button
        type="button"
        className="flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-md border border-brand text-green-950 transition-colors hover:bg-paper-deep"
        aria-expanded={open}
        aria-controls="landing-mobile-menu"
        aria-label={open ? "Tutup menu" : "Buka menu"}
        onClick={() => setOpen((current) => !current)}
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 520, damping: 30 }}
      >
        {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
      </motion.button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id="landing-mobile-menu"
            key="panel"
            variants={panel}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(18rem,calc(100vw-2rem))] origin-top-right rounded-xl border border-brand bg-ivory p-2 shadow-xl"
          >
            {links.map(([label, href]) => (
              <motion.a key={href} href={href} onClick={closeMenu} variants={item} className="flex min-h-12 items-center rounded-lg px-3 text-sm font-semibold text-green-950 transition-colors hover:bg-paper-deep">
                {label}
              </motion.a>
            ))}
            <motion.div variants={item} className="my-1 border-t border-brand" />
            <motion.a href={`${ownerUrl}/login`} onClick={closeMenu} variants={item} className="flex min-h-12 items-center rounded-lg px-3 text-sm font-semibold text-green-800 transition-colors hover:bg-paper-deep">
              Masuk ke portal owner
            </motion.a>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}