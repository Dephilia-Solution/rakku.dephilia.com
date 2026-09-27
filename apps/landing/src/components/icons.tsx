type IconProps = {
  className?: string;
  strokeWidth?: number;
};

export function ArrowRightIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowUpRightIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19 19 5M8 5h11v11" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowDownIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v15M6 13l6 6 6-6" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12 4.2 4.2L19 6.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReceiptIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h12v18l-1.8-1.4-1.6 1.4L13 19.6l-1.6 1.4L9.8 19.6 8.2 21 6.4 19.6 6 21V3Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d="M9.5 8h5M9.5 11.5h5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function PackageIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.8 20 7v10l-8 4.2L4 17V7l8-4.2Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d="M4.5 7.3 12 11l7.5-3.7M12 21v-10" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d="M7.5 4.6 15 8.3M9.5 10.6 17 6.9" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function TrendingUpIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m3 17 5.5-5.5 3.5 3.5L19 8" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 8h5v5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StoreIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10.5V21h6v-5.5h4V21h6V10.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d="M3 10.5h18L19.2 5.2A2 2 0 0 0 17.3 4H6.7a2 2 0 0 0-1.9 1.2L3 10.5Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d="M4 10.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function KeyIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="13.5" r="3.5" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="m10.6 10.9 8.4-8.4M15 7l3 3M17.5 4.5l2 2" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function QrCodeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M1.5 1.5h7v7h-7V1.5Zm2 2v3h3v-3h-3ZM15.5 1.5h7v7h-7V1.5Zm2 2v3h3v-3h-3ZM1.5 15.5h7v7h-7v-7Zm2 2v3h3v-3h-3ZM10 2h2v2h-2V2Zm3 2h2v2h-2V4Zm-2 2h2v2h-2V6Zm5 4h2v2h-2v-2Zm3 2h2v2h-2v-2Zm-2 2h2v2h-2v-2ZM10 10h2v2h-2v-2Zm3 3h2v2h-2v-2ZM10 16h2v2h-2v-2Zm3 2h2v2h-2v-2Zm-2 2h2v2h-2v-2Z" />
    </svg>
  );
}

export function PlusIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.3" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function OutletStepIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 8c-11 0-18 8-18 18 0 14 18 30 18 30s18-16 18-30c0-10-7-18-18-18Z" fill="#1F4D3A" />
      <circle cx="32" cy="26" r="10" fill="#EAF1DD" />
      <circle cx="32" cy="26" r="5" fill="#C3D34F" />
    </svg>
  );
}

export function ProductStepIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="4" width="26" height="26" rx="6" fill="#1F4D3A" />
      <rect x="34" y="4" width="26" height="26" rx="6" fill="#EAF1DD" />
      <rect x="4" y="34" width="26" height="26" rx="6" fill="#F4F7EE" />
      <rect x="34" y="34" width="26" height="26" rx="6" fill="#C3D34F" />
    </svg>
  );
}

export function CashierStepIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="10" width="56" height="40" rx="6" fill="none" stroke="#1F4D3A" strokeWidth="3" />
      <rect x="10" y="18" width="28" height="20" rx="2" fill="#EAF1DD" />
      <rect x="44" y="18" width="10" height="8" rx="2" fill="#C3D34F" />
      <rect x="44" y="29" width="10" height="8" rx="2" fill="#8FB768" />
      <rect x="44" y="40" width="10" height="6" rx="2" fill="#1F4D3A" />
    </svg>
  );
}

export function ReportStepIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <line x1="4" y1="54" x2="60" y2="54" stroke="#D8DED0" strokeWidth="2" />
      <rect x="10" y="38" width="10" height="16" rx="2" fill="#1F4D3A" />
      <rect x="27" y="28" width="10" height="26" rx="2" fill="#8FB768" />
      <rect x="44" y="14" width="10" height="40" rx="2" fill="#C3D34F" />
      <circle cx="49" cy="8" r="4" fill="#E2643C" />
    </svg>
  );
}
