"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import MoreMenuSheet from "./MoreMenuSheet";
import { ownerPrimaryItems, ownerOverflowItems } from "./nav-config";

export default function BottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest/90 backdrop-blur-xl border-t border-surface-container flex items-stretch z-50 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
        aria-label="Navigasi utama"
      >
        {ownerPrimaryItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 min-h-[56px] gap-0.5 transition-colors active:scale-95 ${
                active
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/4 right-1/4 h-[3px] bg-primary rounded-full" />
              )}
              <Icon size={22} />
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          onClick={() => setShowMore(true)}
          className={`relative flex flex-col items-center justify-center flex-1 min-h-[56px] gap-0.5 transition-colors active:scale-95 text-on-surface-variant hover:text-on-surface`}
        >
          <span className="absolute top-0 left-1/4 right-1/4 h-[3px] bg-transparent rounded-full" />
          <MoreHorizontal size={22} />
          <span className="text-[10px] font-medium leading-none">Lainnya</span>
        </button>
      </nav>

      <MoreMenuSheet
        isOpen={showMore}
        onClose={() => setShowMore(false)}
        overflowItems={ownerOverflowItems}
      />
    </>
  );
}
