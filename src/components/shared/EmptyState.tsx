import { Coffee, LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export default function EmptyState({
  icon: Icon = Coffee,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-neutral-400" />
      </div>
      <h3 className="text-base font-semibold text-neutral-900 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-neutral-400 text-center max-w-xs">
          {description}
        </p>
      )}
    </div>
  );
}
