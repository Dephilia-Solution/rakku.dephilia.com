"use client";

import { Category } from "@rakku/shared-types";

interface CategoryTabsProps {
  categories: Category[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function CategoryTabs({
  categories,
  activeId,
  onChange,
}: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => onChange("all")}
        className={`whitespace-nowrap rounded-full px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
          activeId === "all"
            ? "bg-forest text-white"
            : "text-neutral-600 hover:bg-neutral-100"
        }`}
      >
        All Items
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`whitespace-nowrap rounded-full px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
            activeId === cat.id
              ? "bg-forest text-white"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
