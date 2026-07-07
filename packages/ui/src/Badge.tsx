interface BadgeProps {
  variant?: "active" | "inactive" | "info" | "warning";
  children: React.ReactNode;
}

const variants = {
  active: "bg-primary-100 text-primary-800",
  inactive: "bg-neutral-200 text-neutral-600",
  info: "bg-blue-100 text-blue-800",
  warning: "bg-amber-100 text-amber-800",
};

export default function Badge({ variant = "info", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
