import { ArrowLeft, LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backHref?: string;
  /** Custom back link component (e.g. next/link Link). If provided, backHref is used. */
  backAs?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}

export default function PageHeader({
  title,
  subtitle,
  onBack,
  backAs,
  actions,
  icon: Icon,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 md:mb-8">
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        {(onBack || backAs) &&
          (backAs ?? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Kembali"
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
            >
              <ArrowLeft size={20} />
            </button>
          ))}
        <div className="min-w-0">
          <h1 className="font-display text-display-title text-on-surface flex items-center gap-2 truncate">
            {Icon && <Icon size={24} className="text-primary flex-shrink-0" />}
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-on-surface-variant mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 md:gap-3 ml-auto">{actions}</div>
      )}
    </div>
  );
}
