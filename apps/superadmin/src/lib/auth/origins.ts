/** Canonical invitation origin plus the explicitly configured app aliases. */
export function isAllowedSuperadminOrigin(origin: string | null): boolean {
  if (!origin) return true;
  const configured = [process.env.SUPERADMIN_URL, ...(process.env.SUPERADMIN_ALLOWED_ORIGINS ?? "").split(",")];
  const allowed = configured.filter((value): value is string => Boolean(value?.trim()))
    .map(value => new URL(value.trim()).origin);
  return allowed.includes(origin);
}
