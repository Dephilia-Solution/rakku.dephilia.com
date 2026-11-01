export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateString);
  return new Date(dateOnly ? `${dateString}T00:00:00+07:00` : dateString).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(!dateOnly ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
  });
}
