"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { SlideOver } from "@rakku/ui";
import { useModalHistory } from "@/hooks/useModalHistory";

export default function OwnerSheet({ open, onClose, title, subtitle, children, footer, wide = false, widthClassName }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: ReactNode; footer?: ReactNode; wide?: boolean; widthClassName?: string;
}) {
  const { handleCloseAndPop } = useModalHistory(open, onClose);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<SlideOver open={open} onClose={handleCloseAndPop} title={title} subtitle={subtitle}
    widthClassName={`owner-sheet ${widthClassName ?? (wide ? "md:max-w-2xl" : "md:max-w-lg")}`} footer={footer}>{children}</SlideOver>, document.body);
}
