"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";

interface TocItem {
  title: string;
  id: string;
}

export default function TocNav({ items }: { items: readonly TocItem[] }) {
  const sections = useMemo(() => items.map(({ title, id }) => ({ title, id })), [items]);
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    if (!sections.length) return;
    const elements = sections
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!elements.length) return;

    let frame = 0;
    const updateActive = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = [...elements].reverse().find((el) => el.getBoundingClientRect().top <= 140);
        setActiveId(current?.id ?? elements[0].id);
      });
    };

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [sections]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  };

  return (
    <ol className="space-y-0.5">
      {sections.map((item) => {
        const isActive = item.id === activeId;
        return (
          <li key={item.id} className="relative">
            <span
              aria-hidden
              className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-leaf transition-opacity duration-200 ${
                isActive ? "opacity-100" : "opacity-0"
              }`}
            />
            <a
              href={`#${item.id}`}
              onClick={(event) => handleClick(event, item.id)}
              aria-current={isActive ? "location" : undefined}
              className={`block rounded-md py-1.5 pl-3 pr-2 text-[12.5px] leading-snug transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf ${
                isActive
                  ? "bg-cream font-semibold text-leaf"
                  : "text-muted hover:bg-cream/60 hover:text-ink"
              }`}
            >
              {item.title}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
