export type ReportRange = "today" | "yesterday" | "week" | "month" | "all";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function jakartaLocal(date: Date): Date {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS);
}

/** UTC instant of 00:00 Asia/Jakarta for the supplied instant. */
export function jakartaDayStart(date: Date = new Date()): Date {
  const local = jakartaLocal(date);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - JAKARTA_OFFSET_MS);
}

/** Jakarta calendar key (`YYYY-MM-DD`), safe across host time zones. */
export function jakartaDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return jakartaLocal(date).toISOString().slice(0, 10);
}

/** Jakarta calendar month key (`YYYY-MM`). */
export function jakartaMonthKey(value: Date | string): string {
  return jakartaDateKey(value).slice(0, 7);
}

export interface JakartaRangeBounds {
  start: string | null;
  end: string | null;
  endInclusive: string | null;
}

/**
 * Half-open UTC bounds for a Jakarta reporting range. `end` is exclusive.
 * "all" intentionally returns null; callers that need a history cap must apply
 * the plan limit explicitly.
 */
export function jakartaRangeBounds(range: ReportRange, now: Date = new Date()): JakartaRangeBounds {
  const startToday = jakartaDayStart(now);
  if (range === "all") return { start: null, end: null, endInclusive: null };
  if (range === "today") {
    return {
      start: startToday.toISOString(),
      end: new Date(startToday.getTime() + DAY_MS).toISOString(),
      endInclusive: jakartaDateKey(now),
    };
  }
  if (range === "yesterday") {
    const start = new Date(startToday.getTime() - DAY_MS);
    return { start: start.toISOString(), end: startToday.toISOString(), endInclusive: jakartaDateKey(start) };
  }
  if (range === "week") {
    const start = new Date(startToday.getTime() - 6 * DAY_MS);
    return {
      start: start.toISOString(),
      end: new Date(startToday.getTime() + DAY_MS).toISOString(),
      endInclusive: jakartaDateKey(now),
    };
  }
  const local = jakartaLocal(now);
  local.setUTCDate(1);
  local.setUTCHours(0, 0, 0, 0);
  return {
    start: new Date(local.getTime() - JAKARTA_OFFSET_MS).toISOString(),
    end: new Date(startToday.getTime() + DAY_MS).toISOString(),
    endInclusive: jakartaDateKey(now),
  };
}

export function isWithinJakartaRange(value: Date | string, range: ReportRange, now: Date = new Date()): boolean {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const bounds = jakartaRangeBounds(range, now);
  if (!bounds.start || !bounds.end) return true;
  return date.getTime() >= Date.parse(bounds.start) && date.getTime() < Date.parse(bounds.end);
}

/** Subtract Jakarta calendar days without host-timezone DST changes. */
export function jakartaDateKeyMinusDays(value: Date | string, days: number): string {
  const date = value instanceof Date ? value : new Date(value);
  const local = jakartaLocal(date);
  local.setUTCDate(local.getUTCDate() - days);
  return local.toISOString().slice(0, 10);
}
