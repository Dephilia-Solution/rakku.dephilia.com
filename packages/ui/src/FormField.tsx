interface FormFieldProps {
  label: string;
  htmlFor?: string;
  /** Aksi kecil di kanan label (mis. tombol "Kelola") */
  action?: React.ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Kelas input standar design system (dipakai bareng FormField). */
export const fieldInputClass =
  "w-full bg-surface-container-low border-none rounded-lg py-3 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary outline-none transition-all";

export const fieldSelectClass = `${fieldInputClass} appearance-none cursor-pointer`;

export default function FormField({
  label,
  htmlFor,
  action,
  hint,
  error,
  required,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-label-caps uppercase text-on-surface-variant"
        >
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
        {action}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-error font-medium">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}
