import type { PropsWithChildren } from "react";

type ContainerProps = PropsWithChildren<{
  className?: string;
}>;

export function Container({ children, className = "" }: ContainerProps) {
  return <div className={`landing-container ${className}`}>{children}</div>;
}

export function SectionKicker({ children, light = false }: PropsWithChildren<{ light?: boolean }>) {
  const value = String(children);
  const [number, ...label] = value.split("/");

  return (
    <div className={`mb-5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${light ? "text-lime" : "text-green-700"}`}>
      <span className="text-coral">{number}</span>
      {label.length > 0 ? `/${label.join("/")}` : null}
    </div>
  );
}

export function TextLink({ href, children, light = false }: PropsWithChildren<{ href: string; light?: boolean }>) {
  return (
    <a
      href={href}
      className={`landing-link-underline inline-flex min-h-12 items-center gap-2 text-[0.8125rem] font-bold transition-colors duration-200 ${
        light ? "text-lime hover:text-ivory" : "text-green-800 hover:text-green-950"
      }`}
    >
      {children}
    </a>
  );
}
