import type { ReactNode } from "react";

export function OwnerPageHeader({ title, description, eyebrow, actions, children }: {
  title: string; description?: string; eyebrow?: ReactNode; actions?: ReactNode; children?: ReactNode;
}) {
  return <header className="owner-page-header">
    <div className="min-w-0 flex-1">
      {eyebrow && <div className="owner-eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {description && <p className="owner-page-description">{description}</p>}
      {children}
    </div>
    {actions && <div className="owner-actions">{actions}</div>}
  </header>;
}

export function OwnerSection({ title, description, actions, children, className = "" }: {
  title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={`owner-panel ${className}`}>
    <div className="owner-section-header">
      <div className="min-w-0"><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {actions && <div className="owner-actions">{actions}</div>}
    </div>
    {children}
  </section>;
}

export function OwnerEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="owner-empty"><p className="font-semibold text-on-surface">{title}</p><p>{description}</p>{action}</div>;
}

export function OwnerError({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="owner-feedback owner-feedback--error"><p>{message}</p>{retry && <button type="button" className="owner-button owner-button--secondary" onClick={retry}>Coba lagi</button>}</div>;
}

export function OwnerSkeleton({ rows = 3 }: { rows?: number }) {
  return <div role="status" aria-label="Memuat data" className="space-y-3"><span className="sr-only">Memuat data…</span>{Array.from({ length: rows }, (_, index) => <div key={index} className="owner-skeleton h-24" />)}</div>;
}
